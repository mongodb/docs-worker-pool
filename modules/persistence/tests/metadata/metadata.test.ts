import AdmZip from 'adm-zip';
import { serialize } from 'bson';
import { Db, Document, MongoClient, ObjectId, WithId } from 'mongodb';
import { _metadataFromZip, insertMetadata, deleteStaleMetadata } from '../../src/services/metadata';
import { setMockDB, closeDb } from '../utils';

let connection: MongoClient;
let mockDb: Db;
jest.mock('../../src/services/connector', () => {
  return {
    pool: jest.fn(() => {
      return mockDb;
    }),
    db: jest.fn(async () => {
      return mockDb;
    }),
    insert: jest.fn(async (docs: any[], collection: string, buildId: ObjectId) => {
      const convertedDocs = docs.map((d) => ({ ...d, build_id: buildId, created_at: buildId.getTimestamp() }));
      return await mockDb.collection(collection).insertMany(convertedDocs);
    }),
    deleteDocuments: jest.fn(async (ids, collection) => {
      const query = {
        _id: { $in: ids },
      };
      return await mockDb.collection(collection).deleteMany(query);
    }),
  };
});

describe('metadata module', () => {
  const branch = 'master';
  const project = 'atlas-cli';
  const zip = new AdmZip();
  const meta = {
    project,
    branch,
    test: true,
  };
  zip.addFile('site.bson', Buffer.from(serialize(meta)));

  beforeAll(async () => {
    [mockDb, connection] = await setMockDB();
  });

  afterAll(async () => {
    await closeDb(mockDb, connection);
  });

  describe('metadataFromZip', () => {
    it('should get metadata from site.bson', async () => {
      const metaFromZip = await _metadataFromZip(zip);
      expect(metaFromZip).toEqual(meta);
    });
  });

  describe('insertMetadata', () => {
    const buildId = new ObjectId();
    it('should insert metadata docs into metadata collection', async () => {
      try {
        const metaFromZip = await _metadataFromZip(zip);
        await insertMetadata(buildId, metaFromZip);
      } catch (e) {
        console.log(e);
      }
      const res = (await mockDb.collection('metadata').findOne({ test: true })) || ({} as WithId<Document>);
      expect(res.build_id.toString()).toEqual(buildId.toString());
    });
  });

  describe('deleteStaleMetadata', () => {
    // upserting data
    const testData: Document[] = [];
    for (let idx = 0; idx < 10; idx++) {
      const buildId = new ObjectId();
      const testDoc = {
        ...meta,
        idx,
        _id: buildId,
        build_id: buildId,
        created_at: buildId.getTimestamp(),
      };
      testData.push(testDoc);
    }

    it('removes copies of metadata for same project-branch, keeping the most recent ones', async () => {
      await mockDb.collection('metadata').insertMany(testData);
      const metaFromZip = await _metadataFromZip(zip);
      await deleteStaleMetadata(metaFromZip);
      const res = await mockDb
        .collection('metadata')
        .find({ project, branch })
        .sort({
          build_id: -1,
          _id: -1,
        })
        .toArray();
      expect(res.length).toEqual(4);
      for (let idx = 0; idx < res.length; idx++) {
        expect(res[idx].idx).toEqual(9 - idx);
      }
    });
  });
});
