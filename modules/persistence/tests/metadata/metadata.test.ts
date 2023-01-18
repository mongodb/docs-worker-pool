import AdmZip from 'adm-zip';
import { serialize } from 'bson';
import { Db, Document, MongoClient, ObjectId, WithId } from 'mongodb';
import { _metadataFromZip, insertMetadata, deleteStaleMetadata } from '../../src/services/metadata';
import metadata from '../data/metadata.json';
import repoBranches from '../data/repos_branches.json';

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

const convertToBuildId = (docs: any[]) => {
  // convert _id field into a ObjectId
  return docs.map((d) => {
    d._id = new ObjectId(d._id);
    return d;
  });
};

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
    // process.env.MONGO_URL defaults to localhost
    // https://github.com/shelfio/jest-mongodb#3-configure-mongodb-client
    // or update jest-mongodb-config.js
    connection = await MongoClient.connect(process.env.MONGO_URL || 'test');
    mockDb = connection.db();
    await mockDb.collection('repos_branches').insertMany(convertToBuildId(repoBranches));
    await mockDb.collection('metadata').insertMany(convertToBuildId(metadata));
  });

  afterAll(async () => {
    await mockDb.collection('repos_branches').deleteMany({});
    await mockDb.collection('metadata').deleteMany({});
    await connection.close();
  });

  describe('metadataFromZip', () => {
    const metaFromZip = _metadataFromZip(zip);
    it('should get metadata from site.bson', () => {
      expect(metaFromZip).toEqual(meta);
    });
  });

  describe('insertMetadata', () => {
    const buildId = new ObjectId();
    it('should insert metadata docs into metadata collection', async () => {
      try {
        await insertMetadata(buildId, zip);
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
        build_id: buildId,
        created_at: buildId.getTimestamp(),
      };
      testData.push(testDoc);
    }

    it('removes copies of metadata for same project-branch, keeping the most recent ones', async () => {
      await mockDb.collection('metadata').insertMany(testData);
      await deleteStaleMetadata(zip);
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
