// Service that holds responsibility for initializing and exposing mdb interfaces.
// Also exports helper functions for common operations (insert, upsert one by _id, etc.)
// When adding helpers here, ask yourself if the helper will be used by more than one service
// If no, the helper should be implemented in that service, not here

import * as mongodb from 'mongodb';
import { ObjectId, Db, Document } from 'mongodb';
import { db as poolDb } from './pool';

// We should only ever have one client active at a time.
// const atlasURL = `mongodb+srv://${process.env.MONGO_ATLAS_USERNAME}:${process.env.MONGO_ATLAS_PASSWORD}@${process.env.MONGO_ATLAS_HOST}/?retryWrites=true&w=majority&maxPoolSize=20`;
// TODO-3394: Remove local connection
const atlasURL = `mongodb://127.0.0.1:27017`;
const client = new mongodb.MongoClient(atlasURL);

export const teardown = async () => {
  await client.close();
};

// Initialize and export our pool connection
// Try to limit access to pool as much as possible - we mostly want it for just repo_branches.
export const pool = async () => {
  return poolDb(client);
};

// cached db object, so we can handle initial connection process once if unitialized
let dbInstance: Db;
// Handles memoization of db object, and initial connection logic if needs to be initialized
export const db = async () => {
  if (!dbInstance) {
    try {
      await client.connect();
      dbInstance = client.db(process.env.SNOOTY_DB_NAME);
    } catch (error) {
      console.error(`Error at db client connection: ${error}`);
      throw error;
    }
  }
  return dbInstance;
};

// all docs should be inserted with the buildId for the run.
export const insert = async (docs: any[], collection: string, buildId: ObjectId) => {
  const insertSession = await db();
  try {
    return await insertSession
      .collection(collection)
      .insertMany(docs.map((d) => ({ ...d, build_id: buildId, created_at: buildId.getTimestamp() })));
  } catch (error) {
    console.error(`Error at insertion time for ${collection}: ${error}`);
    throw error;
  }
};

const bulkWrite = async (operations: mongodb.AnyBulkWriteOperation[], collection: string) => {
  const dbSession = await db();
  try {
    return dbSession.collection(collection).bulkWrite(operations);
  } catch (error) {
    console.error(`Error at bulk write time for ${collection}: ${error}`);
    throw error;
  }
};

// Upsert wrapper, requires an _id field.
// TODO-3394: Use the new bulkWrite function?
export const bulkUpsert = async (items: Document[], collection: string) => {
  const upsertSession = await db();
  try {
    const operations: mongodb.AnyBulkWriteOperation[] = [];
    items.forEach((item: Document) => {
      const op = {
        updateOne: {
          filter: { _id: item._id },
          update: { $set: item },
          upsert: true,
        },
      };
      operations.push(op);
    });
    return upsertSession.collection(collection).bulkWrite(operations);
  } catch (error) {
    console.error(`Error at bulk upsertion time for ${collection}: ${error}`);
    throw error;
  }
};

/**
 *
 * Finds the page documents for a given Snooty project name + branch combination.
 * If this is the first build for the Snooty project name + branch, no documents
 * will be found.
 *
 * @param pageIdPrefix - Includes the Snooty project name, user (docsworker-xlarge), and branch
 * @param collection - The collection to perform the find query on
 */
const findPrevPageDocs = async (pageIdPrefix: string, collection: string) => {
  const dbSession = await db();
  const findQuery = {
    page_id: { $regex: new RegExp(`^${pageIdPrefix}`) },
    deleted: false,
  };
  const projection = {
    _id: 0,
    page_id: 1,
    ast: 1,
  };

  try {
    return dbSession.collection(collection).find(findQuery).project(projection);
  } catch (error) {
    console.error(
      `Error trying to find previous page documents using prefix ${pageIdPrefix} in ${collection}}: ${error}`
    );
    throw error;
  }
};

const createPageAstMapping = async (docsCursor: mongodb.FindCursor) => {
  // Create mapping for page id and its AST
  const mapping: Record<string, object> = {};
  // Create set of all page ids. To be used for tracking unseen pages in the current build
  const pageIds = new Set<string>();
  for await (const doc of docsCursor) {
    mapping[doc.page_id] = doc.ast;
    pageIds.add(doc.page_id);
  }
  return { mapping, pageIds };
};

/**
 *
 * Compares the ASTs of the current pages with the previous pages. New update
 * operations are added whenever a diff in the page ASTs is found. Page IDs are
 * removed from `prevPageIds` to signal that the previous page has been "seen"
 *
 * @param operations - array of db operations. New operations will be pushed to this array when page diffs are found
 * @param updateTime - the time to set updates to
 * @param currentPages - the page documents for the current build
 * @param prevPageDocsMapping - a mapping of the page ASTs from the previous build
 * @param prevPageIds - a set of all page IDs from the previous build
 */
const checkForPageDiffs = (
  operations: mongodb.AnyBulkWriteOperation[],
  updateTime: Date,
  currentPages: Document[],
  prevPageDocsMapping: Record<string, object>,
  prevPageIds: Set<string>
) => {
  currentPages.forEach((page) => {
    // Filter out rst (non-page) files
    if (!page.filename.endsWith('.txt')) {
      return;
    }

    const stringifiedAst = JSON.stringify(page.ast);
    const currentPageId = page.page_id;
    const previousAst = JSON.stringify(prevPageDocsMapping[currentPageId]);
    prevPageIds.delete(currentPageId);

    // Update the document if page's current AST is different from previous build's
    if (stringifiedAst !== previousAst) {
      const operation = {
        updateOne: {
          filter: { page_id: currentPageId },
          update: {
            $set: {
              ...page,
              updated_at: updateTime,
              deleted: false,
            },
            $setOnInsert: {
              created_at: updateTime,
            },
          },
          upsert: true,
        },
      };
      operations.push(operation);
    }
  });
};

/**
 *
 * Marks any pages from the previous build that were not used as "deleted"
 *
 * @param operations - array of db operations. New operations will be pushed to this array when pages are "deleted"
 * @param updateTime - the time to set updates to
 * @param unseenPageIds - a set of page IDs from the previous build that were not used for any comparisons
 */
const markUnseenPagesAsDeleted = (
  operations: mongodb.AnyBulkWriteOperation[],
  updateTime: Date,
  unusedPageIds: Set<string>
) => {
  unusedPageIds.forEach((unseenPageId) => {
    const operation = {
      updateOne: {
        filter: { page_id: unseenPageId },
        update: {
          $set: {
            deleted: true,
            updated_at: updateTime,
          },
        },
      },
    };
    operations.push(operation);
  });
};

export const bulkUpsertUpdatedPageDocuments = async (pages: Document[], collection: string) => {
  console.time('updated_documents');
  if (pages.length === 0) {
    return;
  }

  // Find all pages that share the same project name + branch. Expects page IDs
  // to include these two properties after parse
  const pageIdPrefix = pages[0].page_id.split('/').slice(0, 3).join('/');
  const previousPagesCursor = await findPrevPageDocs(pageIdPrefix, collection);
  const { mapping: prevPageDocsMapping, pageIds: prevPageIds } = await createPageAstMapping(previousPagesCursor);

  const operations: mongodb.AnyBulkWriteOperation[] = [];
  const updateTime = new Date();

  checkForPageDiffs(operations, updateTime, pages, prevPageDocsMapping, prevPageIds);
  markUnseenPagesAsDeleted(operations, updateTime, prevPageIds);

  if (operations.length > 0) {
    const res = await bulkWrite(operations, collection);
    console.log(res);
  }
  console.timeEnd('updated_documents');

  console.log(pages.length);
  console.log(operations.length);
};

export const deleteDocuments = async (_ids: ObjectId[], collection: string) => {
  const deleteSession = await db();
  try {
    const query = {
      _id: { $in: _ids },
    };
    const res = await deleteSession.collection(collection).deleteMany(query);
    console.log(`Deleted ${res.deletedCount} documents in ${collection}`);
    return res;
  } catch (error) {
    console.error(`Error at delete time for ${collection}: ${error}`);
    throw error;
  }
};
