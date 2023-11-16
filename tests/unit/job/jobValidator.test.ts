import { mockDeep, mockReset } from 'jest-mock-extended';
import { Job } from '../../../src/entities/job';
import { IFileSystemServices } from '../../../src/services/fileServices';
import { getBuildJobDef } from '../../data/jobDef';
import { JobValidator } from '../../../src/job/jobValidator';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { TestDataProvider } from '../../data/data';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';

let job: Job;
let fileSystemServices: IFileSystemServices;
let repoEntitlementRepository: RepoEntitlementsRepository;
let jobValidator: JobValidator;
let repoBranchesRepository: RepoBranchesRepository;
let docsetsRepository: DocsetsRepository;

beforeEach(() => {
  // Deep copy buildJobDef is necessary because we modify job
  job = getBuildJobDef();
  fileSystemServices = mockDeep<IFileSystemServices>();
  repoEntitlementRepository = mockDeep<RepoEntitlementsRepository>();
  repoBranchesRepository = mockDeep<RepoBranchesRepository>();
  docsetsRepository = mockDeep<DocsetsRepository>();
  jobValidator = new JobValidator(
    fileSystemServices,
    repoEntitlementRepository,
    repoBranchesRepository,
    docsetsRepository
  );
});

afterEach(() => {
  mockReset(repoEntitlementRepository);
  mockReset(fileSystemServices);
  mockReset(repoBranchesRepository);
  mockReset(docsetsRepository);
});

describe('JobValidator Tests', () => {
  test('Construct Job Factory', () => {
    expect(
      new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepository, docsetsRepository)
    ).toBeDefined();
  });

  test('invalid job type throws', async () => {
    job.payload.jobType = 'Unknown';
    await expect(jobValidator.throwIfJobInvalid(job)).rejects.toThrow('Invalid JobType');
  });

  describe.each(TestDataProvider.getJobPropertiesValidateTestCases())(
    'Validate invalid repoName/branchName/repoOwner',
    (element) => {
      test(`Testing for ${element.prop} value ${element.value} expected error ${element.expectedError}`, async () => {
        job.payload[element.prop] = element.value;
        await expect(jobValidator.throwIfJobInvalid(job)).rejects.toThrow(element.expectedError);
      });
    }
  );

  test('Throw If User Not Entitled Fails with failure status', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername
      .calledWith(job.user)
      .mockReturnValue({ status: 'failure' });
    await expect(jobValidator.throwIfUserNotEntitled(job)).rejects.toThrow(
      `${job.user} is not entitled for repo ${job.payload.repoOwner}/${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('Throw If User Not Entitled Fails because undefined return value', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue(undefined);
    await expect(jobValidator.throwIfUserNotEntitled(job)).rejects.toThrow(
      `${job.user} is not entitled for repo ${job.payload.repoOwner}/${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('Throw If User Not Entitled Fails because repo not found in return value', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername
      .calledWith(job.user)
      .mockReturnValue({ status: 'success', repos: [`someotherepo`], github_username: job.user });
    await expect(jobValidator.throwIfUserNotEntitled(job)).rejects.toThrow(
      `${job.user} is not entitled for repo ${job.payload.repoOwner}/${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('throwIfNotPublishable throws as branch not configured for publishing', () => {
    expect(() => {
      jobValidator.throwIfNotPublishable(job);
    }).toThrowError(`${job.payload.branchName} is not configured for publish`);
  });

  test('throwIfNotPublishable returns without error', () => {
    job.payload.repoBranches = TestDataProvider.getRepoBranchesData(job);
    expect(() => {
      jobValidator.throwIfNotPublishable(job);
    }).not.toThrow();
  });

  test('valid staging job throwIfJobInvalid dont throws as branch is configured for publishing and stable branch is not set', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue({
      status: 'success',
      repos: [`${job.payload.repoOwner}/${job.payload.repoName}`],
      github_username: job.user,
    });
    job.payload.isNextGen = true;
    await jobValidator.throwIfJobInvalid(job);
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });
});
