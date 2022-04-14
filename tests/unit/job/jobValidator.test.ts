import { mockDeep, mockReset } from 'jest-mock-extended';
import { Job } from '../../../src/entities/job';
import { IFileSystemServices } from '../../../src/services/fileServices';
import * as data from '../../data/jobDef';
import { JobValidator } from '../../../src/job/jobValidator';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { TestDataProvider } from '../../data/data';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';

let job: Job;
let fileSystemServices: IFileSystemServices;
let repoEntitlementRepository: RepoEntitlementsRepository;
let jobValidator: JobValidator;
let repoBranchesRepository: RepoBranchesRepository;

beforeEach(() => {
  job = JSON.parse(JSON.stringify(data.default.value));
  fileSystemServices = mockDeep<IFileSystemServices>();
  repoEntitlementRepository = mockDeep<RepoEntitlementsRepository>();
  repoBranchesRepository = mockDeep<RepoBranchesRepository>();
  jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepository);
});

afterEach(() => {
  mockReset(repoEntitlementRepository);
  mockReset(fileSystemServices);
  mockReset(repoEntitlementRepository);
});

describe('JobValidator Tests', () => {
  test('Construct Job Factory', () => {
    expect(new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepository)).toBeDefined();
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
      `${job.user} is not entitled for repo ${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('Throw If User Not Entitled Fails because undefined return value', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue(undefined);
    await expect(jobValidator.throwIfUserNotEntitled(job)).rejects.toThrow(
      `${job.user} is not entitled for repo ${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('Throw If User Not Entitled Fails because repo not found in return value', async () => {
    repoEntitlementRepository.getRepoEntitlementsByGithubUsername
      .calledWith(job.user)
      .mockReturnValue({ status: 'success', repos: [`someotherepo`], github_username: job.user });
    await expect(jobValidator.throwIfUserNotEntitled(job)).rejects.toThrow(
      `${job.user} is not entitled for repo ${job.payload.repoName}`
    );
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });

  test('Throw If branch not configured throws as branch configuration not found', async () => {
    fileSystemServices.downloadYaml
      .calledWith(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/${job.payload.repoName}.yaml`
      )
      .mockReturnValue({ status: 'failure' });
    await expect(jobValidator.throwIfBranchNotConfigured(job)).rejects.toThrow(
      `repoBranches not found for ${job.payload.repoName}`
    );
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
    const pubBranchRetVal = TestDataProvider.getPublishBranchesContent(job);
    job.payload.isNextGen = true;
    fileSystemServices.downloadYaml
      .calledWith(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/${job.payload.repoName}.yaml`
      )
      .mockReturnValue({ status: 'success', content: pubBranchRetVal });
    await jobValidator.throwIfJobInvalid(job);
    expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
  });
});
