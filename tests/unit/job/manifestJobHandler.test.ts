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
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(queueManifestJobSpy).toBeCalledTimes(0);
  });

  test('prepDeployCommands has reasonable output', async () => {
    const prepSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'prepDeployCommands');
    jobHandlerTestHelper.job.manifestPrefix = 'test-job-mani-prefix';
    jobHandlerTestHelper.job.payload.manifestPrefix = 'test-payload-mani-prefix';
    jobHandlerTestHelper.jobHandler.currJob.payload.jobType = 'manifestGeneration';
    // Set config variables
    jobHandlerTestHelper.config.get.calledWith('searchIndexBucket').mockReturnValue('sample-bucket');
    jobHandlerTestHelper.config.get.calledWith('env').mockReturnValue('dotcomstg');
    const mockFolderConfig = {
      dev: '',
      dotcomstg: 'example-preprd',
      dotcomprd: 'example-prd',
    };
    jobHandlerTestHelper.config.get.calledWith('searchIndexFolder').mockReturnValue(mockFolderConfig);
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(prepSpy).toBeCalledTimes(1);
    const o = [
      '. /venv/bin/activate',
      'cd repos/testauth',
      'echo IGNORE: testing manifest generation deploy commands',
      'mut-index upload public -b sample-bucket -o example-preprd/test-job-mani-prefix.json -u https://github.com/skerschb/testauth.git/ ',
    ];
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(o);
  });

  test('prepDeployCommands throws error without manifestPrefix', async () => {
    const prepSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'prepDeployCommands');
    jobHandlerTestHelper.jobHandler.currJob.payload.jobType = 'manifestGeneration';
    jobHandlerTestHelper.setStageForDeploySuccess(true, false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(prepSpy).toBeCalledTimes(1);
    expect(prepSpy).toThrowError();
    expect(jobHandlerTestHelper.job.deployCommands).toEqual([]);
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
      project: 'cloud-docs',
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
