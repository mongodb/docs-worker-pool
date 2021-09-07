import { mockReset } from 'jest-mock-extended';
import { TestDataProvider } from '../data/data';
import { JobValidatorTestHelper } from '../utils/jobValidaterTestHelper';


describe('JobHandlerFactory Tests', () => {
    
    let jobValidatorTestHelper: JobValidatorTestHelper;

  beforeEach(() => {
    jobValidatorTestHelper = new JobValidatorTestHelper();
    jobValidatorTestHelper.init("staging");
  })

  test('Construct Production Handler', () => {
    expect(jobValidatorTestHelper.jobHandler).toBeDefined();
  })

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    jobValidatorTestHelper.jobHandler.stop();
    expect( () => {jobValidatorTestHelper.jobHandler.execute()}).toThrow(`${jobValidatorTestHelper.job._id} is stopped`);
  })

test('Execute legacy build runs successfully', async () => {
    jobValidatorTestHelper.setStageForDeploySuccess(false);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobValidatorTestHelper.job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommandsForStaging(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.cdnConnector.purgeAll).toHaveBeenCalledTimes(0);
    expect(jobValidatorTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobValidatorTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
})

test('Execute nextgen build runs successfully', async () => {
    jobValidatorTestHelper.setStageForDeploySuccess(true);
    jobValidatorTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(true);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.job.payload.isNextGen).toEqual(true);
    expect(jobValidatorTestHelper.job.buildCommands).toEqual(TestDataProvider.getExpectedStagingBuildNextGenCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.job.deployCommands).toEqual(TestDataProvider.getExpectedStageDeployNextGenCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.cdnConnector.purgeAll).toHaveBeenCalledTimes(0);
    expect(jobValidatorTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobValidatorTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
})

})

