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
    jobHandlerTestHelper.verifyManifestSuccess();
    expect(queueManifestJobSpy).toBeCalledTimes(0);
  });

  test('prepDeployCommands has reasonable output', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    jobHandlerTestHelper.jobHandler.currJob.payload.jobType = 'manifestGeneration';
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.deployCommands).toEqual('');
  });

  // TODO: Move to TestDataProvider once similar test in productionJobHandler
  // is merged / removed
  const manifestCases = [
    {
      project: 'testProject',
      urlSlug: 'testSlug',
      branchName: 'testBranchName',
      manifestPrefix: `testProject-testSlug`,
    },
    {
      project: 'testProject',
      urlSlug: '',
      branchName: 'testBranchName',
      manifestPrefix: `testProject-testBranchName`,
    },
    // Substitution cases defined in constructManifestPrefix()
    {
      project: 'cloudgov',
      urlSlug: 'testSlug',
      branchName: '',
      manifestPrefix: `AtlasGov-testSlug`,
    },
    {
      project: 'cloud',
      urlSlug: 'testSlug',
      branchName: '',
      manifestPrefix: `atlas-testSlug`,
    },
    {
      project: 'docs',
      urlSlug: 'testSlug',
      branchName: '',
      manifestPrefix: `manual-testSlug`,
    },
  ];
  describe.each(manifestCases)('Validate constructManifestPrefix() cases', (element) => {
    test(`Manifest case: ${element.toString()}`, () => {
      jobHandlerTestHelper.jobHandler.currJob.payload.project = element.project;
      jobHandlerTestHelper.jobHandler.currJob.payload.urlSlug = element.urlSlug;
      jobHandlerTestHelper.jobHandler.currJob.payload.branchName = element.branchName;
      jobHandlerTestHelper.jobHandler.currJob.payload.jobType = 'manifestGeneration';
      const p = jobHandlerTestHelper.jobHandler.constructManifestPrefix();
      expect(p).toEqual(element.manifestPrefix);
    });
  });
});
