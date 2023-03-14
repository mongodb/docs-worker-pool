import { TestDataProvider } from '../../data/data';
import { JobHandlerTestHelper } from '../../utils/jobHandlerTestHelper';
import { getBuildJobDef } from '../../data/jobDef';

describe('StagingJobHandler Tests', () => {
  let jobHandlerTestHelper: JobHandlerTestHelper;

  beforeEach(() => {
    jobHandlerTestHelper = new JobHandlerTestHelper();
    jobHandlerTestHelper.init('staging');
  });

  test('Construct Production Handler', () => {
    expect(jobHandlerTestHelper.jobHandler).toBeDefined();
  });

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    jobHandlerTestHelper.jobHandler.stop();
    expect(() => {
      jobHandlerTestHelper.jobHandler.execute();
    }).toThrow(`${jobHandlerTestHelper.job._id} is stopped`);
  });

  test('Execute legacy build runs successfully', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(false, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getCommonBuildCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(
      TestDataProvider.getCommonDeployCommandsForStaging(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
  });

  test('Execute nextgen build runs successfully without path prefix', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(true);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(
      TestDataProvider.getExpectedStageDeployNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
  });

  test('Execute nextgen build runs successfully with pathprefix', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.job.payload.pathPrefix = 'Mutprefix';
    jobHandlerTestHelper.job.payload.mutPrefix = 'Mutprefix';
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(true);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(
      TestDataProvider.getExpectedStageDeployNextGenCommands(jobHandlerTestHelper.job)
    );
  });

  test('Execute nextgen build runs successfully and results in summary message', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(true);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Summary: All good'
    );
  });

  test('Execute nextgen build deploy throws error updates the job with correct error message', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, 'ERROR:BAD ONE');
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(true);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
  });

  test('Staging deploy does not kick off manifest generation job', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    const queueManifestJobSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'queueManifestJob');

    expect(jobHandlerTestHelper.job).toEqual(getBuildJobDef());

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();

    expect(queueManifestJobSpy).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(0);
  });
});
