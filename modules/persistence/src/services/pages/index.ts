import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import isEqual from 'fast-deep-equal';
import { AnyBulkWriteOperation, Document, FindCursor, ObjectId } from 'mongodb';
import { bulkWrite, db, insert } from '../connector';

interface StaticAsset {
  checksum: string;
  key: string;
}

interface PageAst {
  [key: string]: any;
}

export interface UpdatedPage {
  page_id: string;
  filename: string;
  ast: PageAst;
  static_assets: StaticAsset[];

  created_at: Date;
  updated_at: Date;
  deleted: boolean;
}

const COLLECTION_NAME = 'documents';
const UPDATED_AST_COLL_NAME = 'updated_documents';

// Service responsible for memoization of page level documents.
// Any extraneous logic performed on page level documents as part of upload should be added here
// or within subfolders of this module
const pagesFromZip = (zip: AdmZip) => {
  const zipPages = zip.getEntries();
  return zipPages
    .filter((entry) => entry.entryName?.startsWith('documents/'))
    .map((entry) => deserialize(entry.getData()));
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
    return dbSession.collection<UpdatedPage>(collection).find(findQuery).project(projection);
  } catch (error) {
    console.error(
      `Error trying to find previous page documents using prefix ${pageIdPrefix} in ${collection}}: ${error}`
    );
    throw error;
  }
};

const createPageAstMapping = async (docsCursor: FindCursor) => {
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
  operations: AnyBulkWriteOperation[],
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

    const currentPageId = page.page_id;
    prevPageIds.delete(currentPageId);

    // Update the document if page's current AST is different from previous build's.
    // New pages should always count as having a "different" AST
    if (!isEqual(page.ast, prevPageDocsMapping[currentPageId])) {
      const operation = {
        updateOne: {
          filter: { page_id: currentPageId },
          update: {
            $set: {
              page_id: currentPageId,
              filename: page.filename,
              ast: page.ast,
              static_assets: page.static_assets,
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
  operations: AnyBulkWriteOperation[],
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

export const updatePages = async (pages: Document[], collection: string) => {
  if (pages.length === 0) {
    return;
  }

  // Find all pages that share the same project name + branch. Expects page IDs
  // to include these two properties after parse
  const pageIdPrefix = pages[0].page_id.split('/').slice(0, 3).join('/');
  const previousPagesCursor = await findPrevPageDocs(pageIdPrefix, collection);
  const { mapping: prevPageDocsMapping, pageIds: prevPageIds } = await createPageAstMapping(previousPagesCursor);

  const operations: AnyBulkWriteOperation[] = [];
  const updateTime = new Date();

  checkForPageDiffs(operations, updateTime, pages, prevPageDocsMapping, prevPageIds);
  markUnseenPagesAsDeleted(operations, updateTime, prevPageIds);

  if (operations.length > 0) {
    await bulkWrite(operations, collection);
  }
};

export const insertAndUpdatePages = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const pages = pagesFromZip(zip);
    return Promise.all([insert(pages, COLLECTION_NAME, buildId), updatePages(pages, UPDATED_AST_COLL_NAME)]);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};
