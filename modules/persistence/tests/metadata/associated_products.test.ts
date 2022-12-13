import { MongoClient } from 'mongodb';
import {
  _getRepoBranchesEntry,
  _getAllAssociatedRepoBranchesEntries,
  _umbrellaMetadataEntry,
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
  });

  beforeAll(async () => {
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
});
