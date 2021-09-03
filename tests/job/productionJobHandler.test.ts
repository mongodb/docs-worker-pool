import { JobHandlerFactory } from '../../job/JobHandlerFactory';
import { mockDeep } from 'jest-mock-extended';
import { IJob } from '../../entities/job';
import { IConfig } from 'config';
import { JobRepository } from '../../repositories/jobRepository';
import { IFileSystemServices } from '../../services/fileServices';
import { IJobCommandExecutor } from '../../services/commandExecutor';
import { ICDNConnector } from '../../services/cdn';
import { IRepoConnector } from '../../services/repo';
import { IJobRepoLogger } from '../../services/logger';
import { ProductionJobHandler } from '../../job/productionJobHandler';
import { RegressionJobHandler } from '../../job/regressionJobHandler';
import { StagingJobHandler } from '../../job/stagingJobHandler';
import * as data from '../data/jobDef'
import { exception } from 'node:console';
import { JobStoppedError } from '../../errors/errors';
import { TestDataProvider } from '../data/data';

describe('JobHandlerFactory Tests', () => {
  let job: IJob;
  let config: IConfig;
  let jobRepo: JobRepository;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let cdnConnector: ICDNConnector;
  let repoConnector: IRepoConnector;
  let logger: IJobRepoLogger;
  let prodJobHandler: ProductionJobHandler;

  beforeEach(() => {
    job = JSON.parse(JSON.stringify(data.default));
    config = mockDeep<IConfig>();
    jobRepo = mockDeep<JobRepository>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    cdnConnector = mockDeep<ICDNConnector>();
    repoConnector = mockDeep<IRepoConnector>();
    logger = mockDeep<IJobRepoLogger>();
    prodJobHandler = new ProductionJobHandler(job,config,jobRepo,fileSystemServices,jobCommandExecutor, cdnConnector, repoConnector, logger);
  })

  test('Construct Production Handler', () => {
    expect(new ProductionJobHandler(job,config,jobRepo,fileSystemServices,jobCommandExecutor, cdnConnector, repoConnector, logger)).toBeDefined();
  })

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    prodJobHandler.stop();
    expect( () => {prodJobHandler.execute()}).toThrow(`${job._id} is stopped`);
  })

  test('Execute throws error when cleaning up should update status', async () => {
    fileSystemServices.removeDirectory.calledWith(`repos/${job.payload.repoName}`).mockImplementation(() => { throw new Error("Invalid Directory");});
    await prodJobHandler.execute();
    expect(fileSystemServices.removeDirectory).toBeCalledWith(`repos/${job.payload.repoName}`);
    expect(repoConnector.cloneRepo).toBeCalledTimes(0);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid Directory");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})


test('Execute throws error when cloning repo should update status and save the logs', async () => {
    repoConnector.cloneRepo.mockImplementation(() => { throw new Error("Invalid RepoName");});
    await prodJobHandler.execute();
    expect(fileSystemServices.removeDirectory).toBeCalledWith(`repos/${job.payload.repoName}`);
    expect(repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid RepoName");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
    expect(logger.save).toBeCalledTimes(3);
})


describe.each(TestDataProvider.getAllCommitCheckCases())('Validate all commit check error cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        repoConnector.checkCommits.calledWith(job).mockReturnValue(element);
        await prodJobHandler.execute();
        expect(repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(repoConnector.checkCommits).toBeCalledTimes(1);
        expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, `Specified commit does not exist on ${job.payload.branchName} branch`);
    })
})

test('Execute throws error when Pulling repo should update status and save the logs', async () => {
    repoConnector.pullRepo.calledWith(job).mockImplementation(() => { throw new Error("Invalid RepoName during pull repo");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid RepoName during pull repo");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Applying patch repo should update status and save the logs', async () => {
    repoConnector.applyPatch.calledWith(job).mockImplementation(() => { throw new Error("Error while applying patch RepoName during pull repo");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    job.payload.patch = "Testing apply patch";
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Error while applying patch RepoName during pull repo");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Downloading makefile repo should update status', async () => {
    fileSystemServices.saveUrlAsFile.calledWith(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${job.payload.repoName}`).mockImplementation(() => { throw new Error("Error while Downloading makefile");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Error while Downloading makefile");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute Next Gen build successfully runs', async () => {
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    fileSystemServices.rootFileExists.calledWith(`repos/${job.payload.repoName}/worker.sh`).mockReturnValue(true);
    fileSystemServices.readFileAsUtf8.calledWith(`repos/${job.payload.repoName}/worker.sh`).mockReturnValue("build-and-stage-next-gen\r\n");
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Error while Downloading makefile");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

})