import { mockDeep, mockReset } from 'jest-mock-extended';
import { IJob } from '../../../src/entities/job';
import { IFileSystemServices } from '../../../src/services/fileServices';
import * as data from '../../data/jobDef'
import * as stageData from '../../data/stageJobDef'
import { JobValidator } from '../../../src/job/jobValidator';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { TestDataProvider } from '../../data/data';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';


let job: IJob;
let stageJob: IJob;
let fileSystemServices: IFileSystemServices;
let repoEntitlementRepository: RepoEntitlementsRepository;
let repoBranchesRepository: RepoBranchesRepository;
let jobValidator: JobValidator;


beforeEach(() => {
    job = JSON.parse(JSON.stringify(data.default.value));
    stageJob = JSON.parse(JSON.stringify(stageData.default.value))
    fileSystemServices = mockDeep<IFileSystemServices>();
    repoEntitlementRepository = mockDeep<RepoEntitlementsRepository>();
    repoBranchesRepository = mockDeep<RepoBranchesRepository>();
    jobValidator = new JobValidator(fileSystemServices, repoBranchesRepository, repoEntitlementRepository);
})

afterEach(() => {
    mockReset(repoEntitlementRepository);
    mockReset(fileSystemServices);
    mockReset(repoEntitlementRepository);
})

describe('JobValidator Tests', () => {

    test('Construct Job Factory', () => {
        expect(new JobValidator(fileSystemServices, repoBranchesRepository, repoEntitlementRepository)).toBeDefined();
    })


    test('invalid job type throws', async () => {
        job.payload.jobType = "Unknown";
        await expect(jobValidator.throwIfJobInvalid(job))
            .rejects.toThrow('Invalid JobType');
    })

    describe.each(TestDataProvider.getJobPropertiesValidateTestCases())('Validate invalid repoName/branchName/repoOwner', (element) => {
        test(`Testing for ${element.prop} value ${element.value} expected error ${element.expectedError}`, async () => {
            job.payload[element.prop] = element.value;
            await expect(jobValidator.throwIfJobInvalid(job))
                .rejects.toThrow(element.expectedError);
        })
    })

    test('Throw If User Not Entitled Fails with failure status', async () => {
        repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue( { status: 'failure' });
        await expect(jobValidator.throwIfUserNotEntitled(job))
            .rejects.toThrow(`${job.user} is not entitled to deploy repo ${job.payload.repoName}`);
        expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
    })

    test('Throw If User Not Entitled Fails because undefined return value', async () => {
        repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue(undefined);
        await expect(jobValidator.throwIfUserNotEntitled(job))
            .rejects.toThrow(`${job.user} is not entitled to deploy repo ${job.payload.repoName}`);
        expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
    })

    test('Throw If User Not Entitled Fails because repo not found in return value', async () => {
        repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue({ status: 'success', repos:[`someotherepo`], github_username: job.user });
        await expect(jobValidator.throwIfUserNotEntitled(job))
            .rejects.toThrow(`${job.user} is not entitled to deploy repo ${job.payload.repoName}`);
        expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
    })

    test('Throw If repo not configured throws as repoName is not configured for deployment', async () => {
      repoBranchesRepository.getConfiguredBranchesByGithubRepoName.calledWith(job.payload.repoName).mockReturnValue({ status: 'failure' });
      await expect(jobValidator.throwIfBranchNotConfigured(job))
        .rejects.toThrow(`${job.payload.repoName} is not configured for deployment`);
      expect(repoBranchesRepository.getConfiguredBranchesByGithubRepoName).toHaveBeenCalledTimes(1);
    })

    test('Throw If branch not configured throws as branch configuration not found', async () => {
        repoBranchesRepository.getConfiguredBranchesByGithubRepoName.calledWith(job.payload.repoName).mockReturnValue({ branches: [{gitBranchName: "nope"}], status: 'success' });
        await expect(jobValidator.throwIfBranchNotConfigured(job))
            .rejects.toThrow(`${job.payload.branchName} in the ${job.payload.repoName} repository is not configured for deployment.`);
        expect(repoBranchesRepository.getConfiguredBranchesByGithubRepoName).toHaveBeenCalledTimes(1);
    })

    test('throwIfJobInvalid does not throw when the branch is configured for publishing and user has required permissions', async () => {
        repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(job.user).mockReturnValue( { status: 'success', repos:[`${job.payload.repoOwner}/${job.payload.repoName}`], github_username: job.user });
        repoBranchesRepository.getConfiguredBranchesByGithubRepoName.calledWith(job.payload.repoName).mockReturnValue({status: 'success', branches: [{gitBranchName: job.payload.branchName}]})
        await jobValidator.throwIfJobInvalid(job);
        expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(1);
        expect(repoBranchesRepository.getConfiguredBranchesByGithubRepoName).toHaveBeenCalledTimes(1);
    })

    test('throwIfJobInvalid does not check user entitlements for staging builds', async() => {
        repoEntitlementRepository.getRepoEntitlementsByGithubUsername.calledWith(stageJob.user).mockReturnValue( { status: 'success', repos:[`${stageJob.payload.repoOwner}/${stageJob.payload.repoName}`], github_username: stageJob.user });
        repoBranchesRepository.getConfiguredBranchesByGithubRepoName.calledWith(job.payload.repoName).mockReturnValue({status: 'success', branches: [{gitBranchName: job.payload.branchName}]})
        await jobValidator.throwIfJobInvalid(stageJob);
        expect(repoEntitlementRepository.getRepoEntitlementsByGithubUsername).toHaveBeenCalledTimes(0);
        expect(repoBranchesRepository.getConfiguredBranchesByGithubRepoName).toHaveBeenCalledTimes(0);
    })

})
