import axios from 'axios';
import { TestDataProvider } from '../../data/data';
import { JobHandlerTestHelper } from '../../utils/jobHandlerTestHelper';
import { getStagingJobDef } from '../../data/jobDef';
import { JobStatus } from '../../../src/entities/job';

describe('StagingJobHandler Tests', () => {
  let jobHandlerTestHelper: JobHandlerTestHelper;
  let spyPost;

  beforeEach(() => {
    jobHandlerTestHelper = new JobHandlerTestHelper();
    jobHandlerTestHelper.init('staging');
    spyPost = jest.spyOn(axios, 'post');
  });

  afterEach(() => {
    process.env.GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED = 'false';
    spyPost.mockClear();
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

  test('Execute nextgen build runs successfully without path prefix', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(false);
    await jobHandlerTestHelper.jobHandler.execute();
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
    jobHandlerTestHelper.setStageForDeploySuccess(false);
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.job.payload.pathPrefix = 'Mutprefix';
    jobHandlerTestHelper.job.payload.mutPrefix = 'Mutprefix';
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(
      TestDataProvider.getExpectedStageDeployNextGenCommands(jobHandlerTestHelper.job)
    );
  });

  test('Execute nextgen build runs successfully and results in summary message', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithStatus).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Summary: All good'
    );
  });

  test('Execute nextgen build deploy throws error updates the job with correct error message', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, 'ERROR:BAD ONE');
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getExpectedStagingBuildNextGenCommands(jobHandlerTestHelper.job)
    );
  });

  test('Staging deploy does not kick off manifest generation job', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    const queueManifestJobSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'queueManifestJob');

    expect(jobHandlerTestHelper.job).toEqual(getStagingJobDef());

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();

    expect(queueManifestJobSpy).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(0);
  });
});
