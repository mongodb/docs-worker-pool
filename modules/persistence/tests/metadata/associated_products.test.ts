import { MongoClient } from 'mongodb';
import {
  _getRepoBranchesEntry,
  _getAllAssociatedRepoBranchesEntries,
  _umbrellaMetadataEntry,
  _getAssociatedProducts,
  _shapeToCsCursor,
} from '../../src/services/metadata/associated_products';
import { ToC } from '../../src/services/metadata/ToC';

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
  const project = 'docs-atlas-cli';

  afterEach(async () => {
    await mockDb.collection('repos_branches').deleteMany({});
    await mockDb.collection('metadata').deleteMany({});
  });

  beforeAll(async () => {
    // process.env.MONGO_URL defaults to localhost
    // https://github.com/shelfio/jest-mongodb#3-configure-mongodb-client
    // or update jest-mongodb-config.js
    connection = await MongoClient.connect(process.env.MONGO_URL || 'test');
    mockDb = await connection.db();
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('getRepoBranchesEntry', () => {
    it('should query repo branches for project and branch', async () => {
      const reposBranches = mockDb.collection('repos_branches');
      const mockBranch = {
        branches: [{ gitBranchName: 'master' }, { gitBranchName: 'v1.0' }],
        project,
      };
      await reposBranches.insertOne(mockBranch);

      const queriedBranch = await _getRepoBranchesEntry(project, branch);
      expect(queriedBranch).toEqual(mockBranch);
    });
  });

  describe('getAllAssociatedRepoBranchesEntries', () => {
    const metadata = {
      project,
      branch,
      toctree: {} as ToC,
      toctreeOrder: [],
    };

    it('should return empty list if no associated products', async () => {
      const res = await _getAllAssociatedRepoBranchesEntries(metadata);
      expect(res).toHaveLength(0);
    });

    it('should get all repo branches info for specified associated products', async () => {
      const associated_project_name = 'test-project';
      metadata['associated_products'] = [
        {
          name: associated_project_name,
          versions: ['master'],
        },
      ];
      const reposBranches = mockDb.collection('repos_branches');
      const mockBranch = {
        branches: [{ gitBranchName: 'master' }, { gitBranchName: 'v1.0' }],
        project: associated_project_name,
      };
      await reposBranches.insertOne(mockBranch);
      const res = await _getAllAssociatedRepoBranchesEntries(metadata);
      expect(res[0]).toEqual(mockBranch);
    });
  });

  describe('umbrellaMetadataEntry', () => {
    const mockedMetadata = {
      project,
      branch,
      toctree: {} as ToC,
      toctreeOrder: [],
      associated_products: [{ name: 'associated-proj', versions: ['master', 'v1.0'] }],
      buildId: 1,
    };
    const mockedMetaTwo = {
      project,
      branch,
      toctree: {} as ToC,
      toctreeOrder: [],
      associated_products: [{ name: 'associated-proj', versions: ['master'] }],
      buildId: 2,
    };

    beforeEach(async () => {
      const repoBranches = mockDb.collection('metadata');
      await repoBranches.insertMany([mockedMetadata, mockedMetaTwo]);
    });

    it('returns the most recent metadata', async () => {
      const metadata = {
        project: 'associated-proj',
        branch: 'master',
        toctree: {} as ToC,
        toctreeOrder: [],
      };
      const umbrellaMeta = await _umbrellaMetadataEntry(metadata);
      expect(umbrellaMeta).toEqual(mockedMetadata);
    });
  });

  describe('getAssociatedProducts and shapeToCsCursor', () => {
    const proj = 'associated-proj';
    const branch = 'master';
    const umbrellaMetadata = {
      associated_products: [
        {
          name: proj,
          versions: [branch],
        },
      ],
    };
    const tocSample = {
      title: 'sample1',
      slug: 'slug1',
      children: [],
    };
    const tocSample2 = {
      title: 'sample2',
      slug: 'slug2',
      children: [],
    };
    const metadataSample = {
      project: proj,
      build_id: 1,
      toctree: tocSample,
      toctreeOrder: [1],
      branch: branch,
    };
    const metadataSample2 = {
      project: proj,
      build_id: 2,
      toctree: tocSample2,
      toctreeOrder: [2],
      branch: branch,
    };
    // ignored metadata due to branch mismatch
    const testBranch = 'test-branch';
    const metadataSample3 = {
      project: proj,
      build_id: 3,
      toctree: { ...tocSample2, slug: 'slug3' },
      toctreeOrder: [3],
      branch: testBranch,
    };

    test('getAssociatedProducts returns an aggregation cursor for metadata, grouped by most recent build_id', async () => {
      const metadataCollection = mockDb.collection('metadata');
      await metadataCollection.insertMany([metadataSample, metadataSample2]);
      const cursor = await _getAssociatedProducts(umbrellaMetadata);
      await cursor.forEach((doc) => {
        expect(doc['most_recent']['build_id']).toEqual(2);
      });
    });

    test('shapeToCsCursor returns the toc and toctreeOrder to be inserted', async () => {
      const metadataCollection = mockDb.collection('metadata');
      await metadataCollection.insertMany([metadataSample, metadataSample2, metadataSample3]);
      const cursor = await _getAssociatedProducts(umbrellaMetadata);
      const repoBranchesMap = {};
      repoBranchesMap[proj] = {
        master: [],
      };
      const { tocInsertions, tocOrderInsertions } = await _shapeToCsCursor(cursor, repoBranchesMap);
      expect(tocOrderInsertions[proj][branch]).toEqual(metadataSample2.toctreeOrder);
      expect(tocOrderInsertions[proj][testBranch]).toBeUndefined();
      expect(tocInsertions[proj][branch]).toEqual(metadataSample2.toctree);
      expect(tocInsertions[proj][testBranch]).toBeUndefined();
    });
  });
});
