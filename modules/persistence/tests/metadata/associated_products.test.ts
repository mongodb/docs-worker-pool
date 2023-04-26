import { MongoClient } from 'mongodb';
import {
  _getRepoBranchesEntry,
  _getAllAssociatedRepoBranchesEntries,
  _umbrellaMetadataEntry,
  _getAssociatedProducts,
  _shapeToCsCursor,
  SharedMetadata,
} from '../../src/services/metadata/associated_products';

import metadata from '../data/metadata.json';
import repoBranches from '../data/repos_branches.json';

let connection;
let mockDb;
jest.mock('../../src/services/connector', () => {
  return {
    pool: jest.fn(() => {
      return mockDb;
    }),
    db: jest.fn(() => {
      return mockDb;
    }),
  };
});

describe('associated_products module', () => {
  const branch = 'master';
  const project = 'atlas-cli';

  beforeAll(async () => {
    // process.env.MONGO_URL defaults to localhost
    // https://github.com/shelfio/jest-mongodb#3-configure-mongodb-client
    // or update jest-mongodb-config.js
    connection = await MongoClient.connect(process.env.MONGO_URL || 'test');
    mockDb = await connection.db();
    await mockDb.collection('repos_branches').deleteMany({});
    await mockDb.collection('metadata').deleteMany({});
    await mockDb.collection('repos_branches').insertMany(repoBranches);
    await mockDb.collection('metadata').insertMany(metadata);
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('getRepoBranchesEntry', () => {
    it('should query repo branches for project and branch', async () => {
      const resBranch = await _getRepoBranchesEntry(project, branch);
      expect(resBranch).toMatchSnapshot();
    });
  });

  describe('getAllAssociatedRepoBranchesEntries', () => {
    const umbrellaMetadata = metadata.find((m) => !!m['associated_products']) as unknown as SharedMetadata;
    const associatedMetadata = metadata.find((m) => !m['associated_products']) as unknown as SharedMetadata;

    it('should return empty list if no associated products', async () => {
      const res = await _getAllAssociatedRepoBranchesEntries(associatedMetadata);
      expect(res).toHaveLength(0);
    });

    it('should get all repo branches info for specified associated products', async () => {
      const res = await _getAllAssociatedRepoBranchesEntries(umbrellaMetadata);
      expect(res[0]).toMatchSnapshot();
    });
  });

  describe('umbrellaMetadataEntry', () => {
    it('returns the most recent umbrella metadata for specified project in passed metadata', async () => {
      const umbrellaMeta = await _umbrellaMetadataEntry('atlas-cli');
      expect(umbrellaMeta).toMatchSnapshot();
    });
  });

  describe('getAssociatedProducts and shapeToCsCursor', () => {
    const umbrellaMetadata = metadata.find((m) => !!m['associated_products']) as unknown as SharedMetadata;

    test('getAssociatedProducts returns an aggregation cursor for metadata, grouped by most recent build_id', async () => {
      const cursor = await _getAssociatedProducts(umbrellaMetadata);
      await cursor.sort({ '_id.branch': -1 }).forEach((doc) => {
        expect(doc).toMatchSnapshot();
      });
    });

    test('shapeToCsCursor returns copied ToCs (with slugs and urls), toctreeOrder, and their parent metadata document', async () => {
      const cursor = await _getAssociatedProducts(umbrellaMetadata);
      const repoBranchesMap = {};
      repoBranchesMap['atlas-cli'] = {
        master: {},
        url: {
          dotcomprd: 'www.mongodb.com',
        },
        prefix: {
          dotcomprd: 'docs/atlas/cli',
        },
      };
      const { tocInsertions, tocOrderInsertions, associatedMetadataEntries } = await _shapeToCsCursor(
        cursor,
        repoBranchesMap
      );
      expect(tocInsertions).toMatchSnapshot();
      expect(tocOrderInsertions).toMatchSnapshot();
      expect(associatedMetadataEntries).toMatchSnapshot();
    });
  });
});
