import { JobHandlerTestHelper } from '../../utils/jobHandlerTestHelper';

describe('ManifestJobHandler Tests', () => {
  let jobHandlerTestHelper: JobHandlerTestHelper;

  beforeEach(() => {
    jobHandlerTestHelper = new JobHandlerTestHelper();
    jobHandlerTestHelper.init('manifest');
  });

  test('Constructs ManifestJobHandler', () => {
    expect(jobHandlerTestHelper.jobHandler).toBeDefined();
  });

  test('Execute called after a stop signal throws error ManifestHandler at decorator', () => {
    jobHandlerTestHelper.jobHandler.stop();
    expect(() => {
      jobHandlerTestHelper.jobHandler.execute();
    }).toThrow(`${jobHandlerTestHelper.job._id} is stopped`);
  });

  test('Execute manifestJob runs successfully and does not queue another manifest job', async () => {
    const queueManifestJobSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'queueManifestJob');
    jobHandlerTestHelper.jobHandler.currJob.payload.jobType = 'manifestGeneration';
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(queueManifestJobSpy).toBeCalledTimes(0);
  });
});
