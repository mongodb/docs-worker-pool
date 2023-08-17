import { getDeployableJobs } from '../../../api/controllers/v1/slack';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';

const mockRepoInfo = {
  branches: [{}, {}],
  project: 'docs',
  prefix: {
    stg: '',
    prd: '',
    dotcomstg: 'docs',
    dotcomprd: 'docs',
  },
};

const mockBranchObject = {
  docs: {
    master: {
      aliasObject: {
        publishOriginalBranchName: false,
        isStableBranch: false,
        urlAliases: ['v6.0', 'upcoming'],
        urlSlug: 'v6.0',
      },
    },
    'v5.0': {
      aliasObject: {
        publishOriginalBranchName: true,
        isStableBranch: true,
        urlAliases: ['manual', 'stable'],
        urlSlug: 'manual',
      },
    },
  },
};

// Mock RepoBranchesRepository so that we can mock which data to return.
jest.mock('../../../src/repositories/repoBranchesRepository', () => ({
  RepoBranchesRepository: jest.fn().mockImplementation(() => ({
    getRepo: jest.fn().mockImplementation(() => mockRepoInfo),
    getRepoBranchAliases: jest
      .fn()
      .mockImplementation((repoName, branchName) => mockBranchObject[repoName][branchName]),
  })),
}));

jest.mock('config');

describe('Slack API Controller Tests', () => {
  const mockEntitlement = {
    email: 'test.user@mongodb.com',
    github_username: 'test.user',
  };
  // We're mocking RepoBranchesRepository to avoid needing access to a database. We'll use mock data.
  const mockRepoBranchRepository = new RepoBranchesRepository(null, null, null);

  test('deployable jobs with the assigned urlSlug have primaryAlias set to true', async () => {
    const mockValues = {
      repo_option: [{ value: 'mongodb/docs/master' }],
    };

    const deployable = await getDeployableJobs(mockValues, mockEntitlement, mockRepoBranchRepository);

    expect(deployable).toHaveLength(2);
    const jobsWithPrimaryAlias = deployable.filter((job) => job.payload.primaryAlias);
    expect(jobsWithPrimaryAlias).toHaveLength(1);
    expect(jobsWithPrimaryAlias[0]).toHaveProperty('payload.urlSlug', 'v6.0');
  });

  test('deploying original branch does not cause incorrectly assigned primaryAlias', async () => {
    const mockValues = {
      repo_option: [{ value: 'mongodb/docs/v5.0' }],
    };

    const deployable = await getDeployableJobs(mockValues, mockEntitlement, mockRepoBranchRepository);

    expect(deployable).toHaveLength(3);
    const jobsWithPrimaryAlias = deployable.filter((job) => job.payload.primaryAlias);
    expect(jobsWithPrimaryAlias).toHaveLength(1);
    expect(jobsWithPrimaryAlias[0]).toHaveProperty('payload.urlSlug', 'manual');
  });
});
