import { IConfig } from "config";
import { mockDeep } from "jest-mock-extended";
import { IJob } from "../../src/entities/job";
import { JobHandlerFactory } from "../../src/job/jobHandlerFactory";
import { JobValidator } from "../../src/job/jobValidator";
import { ProductionJobHandler } from "../../src/job/productionJobHandler";
import { JobManager } from "../../src/job/jobManager";
import { JobRepository } from "../../src/repositories/jobRepository";
import { RepoEntitlementsRepository } from "../../src/repositories/repoEntitlementsRepository";
import { ICDNConnector } from "../../src/services/cdn";
import { IJobCommandExecutor } from "../../src/services/commandExecutor";
import { IFileSystemServices } from "../../src/services/fileServices";
import { IJobRepoLogger } from "../../src/services/logger";
import { IRepoConnector } from "../../src/services/repo";
import * as data from '../data/jobDef'

describe('JobManager Tests', () => {
    let job: IJob;
    let config: IConfig;
    let jobRepo: JobRepository;
    let fileSystemServices: IFileSystemServices;
    let jobCommandExecutor: IJobCommandExecutor;
    let cdnConnector: ICDNConnector;
    let repoConnector: IRepoConnector;
    let logger: IJobRepoLogger;
    let jobHandlerFactory: JobHandlerFactory;
    let jobManager: JobManager;
    let jobValidator: JobValidator;
    let repoEntitlementRepository: RepoEntitlementsRepository;

    beforeEach(() => {
        jest.useFakeTimers('modern');
        jest.setSystemTime(new Date(2021, 4, 3));
        job = JSON.parse(JSON.stringify(data.default));
        config = mockDeep<IConfig>();
        jobRepo = mockDeep<JobRepository>();
        fileSystemServices = mockDeep<IFileSystemServices>();
        jobCommandExecutor = mockDeep<IJobCommandExecutor>();
        cdnConnector = mockDeep<ICDNConnector>();
        repoConnector = mockDeep<IRepoConnector>();
        logger = mockDeep<IJobRepoLogger>();
        jobHandlerFactory = mockDeep<JobHandlerFactory>();
        jobValidator = mockDeep<JobValidator>();
        repoEntitlementRepository = mockDeep<RepoEntitlementsRepository>();
        jobManager = new JobManager(config, jobValidator, jobHandlerFactory, jobCommandExecutor, jobRepo, repoEntitlementRepository, cdnConnector, repoConnector, fileSystemServices, logger);
    })

    test('JobManager constructor tests', () => {
        expect(jobManager).toBeDefined();
    })

    describe('JobManager start Tests', () => {
        test('JobManager start stops when it recieves stop signal', async () => {
            jobManager.start();
            jobManager.stop();
            jest.runAllTimers();
            expect(jobManager.isStopped()).toBe(true);
        })

        test('JobManager start continues until stop even where there is no valid job signal', async () => {
            jobRepo.getOneQueuedJobAndUpdate.mockReturnValueOnce(null);
            jobManager.start();
            expect(jobRepo.getOneQueuedJobAndUpdate.mock.calls).toHaveLength(1);
            expect(jobHandlerFactory.createJobHandler.mock.calls).toHaveLength(0);
            jobManager.stop();
            jest.runAllTimers();
        })
    })

    describe('JobManager workex Tests', () => {
        test('JobManager workex doesnt throw error when there is no job', async () => {
            let handler = mockDeep<ProductionJobHandler>();
            jobRepo.getOneQueuedJobAndUpdate.mockResolvedValueOnce(job);
            jobHandlerFactory.createJobHandler.mockReturnValueOnce(handler);
            await jobManager.workEx();
            expect(jobRepo.getOneQueuedJobAndUpdate.mock.calls).toHaveLength(1);
            expect(jobHandlerFactory.createJobHandler.mock.calls).toHaveLength(1);
            expect(handler.execute.mock.calls).toHaveLength(1);
        })
    })
})