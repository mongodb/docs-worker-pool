import { mockReset } from 'jest-mock-extended';
import { TestDataProvider } from '../../data/data';
import { getBuildJobDef, getManifestJobDef } from '../../data/jobDef';
import { JobHandlerTestHelper } from '../../utils/jobHandlerTestHelper';

describe('ProductionJobHandler Tests', () => {
  let jobHandlerTestHelper: JobHandlerTestHelper;

  beforeEach(() => {
    jobHandlerTestHelper = new JobHandlerTestHelper();
    jobHandlerTestHelper.init('prod');
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

  test('Execute throws error when cleaning up should update status', async () => {
    jobHandlerTestHelper.fileSystemServices.removeDirectory
      .calledWith(`repos/${jobHandlerTestHelper.job.payload.repoName}`)
      .mockImplementation(() => {
        throw new Error('Invalid Directory');
      });
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(
      `repos/${jobHandlerTestHelper.job.payload.repoName}`
    );
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Invalid Directory'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
  });

  test('Execute throws error when cloning repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.cloneRepo.mockImplementation((targetPath: string) => {
      throw new Error('Invalid RepoName');
    });
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(
      `repos/${jobHandlerTestHelper.job.payload.repoName}`
    );
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Invalid RepoName'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.logger.save).toBeCalledTimes(3);
  });

  describe.each(TestDataProvider.getAllCommitCheckCases())('Validate all commit check error cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
      jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockReturnValue(element);
      await jobHandlerTestHelper.jobHandler.execute();
      expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
        jobHandlerTestHelper.job._id,
        `Specified commit does not exist on ${jobHandlerTestHelper.job.payload.branchName} branch`
      );
    });
  });

  test(`commit check throws , status updated properly`, async () => {
    jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockImplementation(() => {
      throw new Error('Commit check issue');
    });
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Commit check issue'
    );
  });

  test('Execute throws error when Pulling repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.pullRepo.calledWith(jobHandlerTestHelper.job).mockImplementation(() => {
      throw new Error('Invalid RepoName during pull repo');
    });
    jobHandlerTestHelper.repoConnector.checkCommits
      .calledWith(jobHandlerTestHelper.job)
      .mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Invalid RepoName during pull repo'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
  });

  test('Execute throws error when Applying patch repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.applyPatch.calledWith(jobHandlerTestHelper.job).mockImplementation(() => {
      throw new Error('Error while applying patch RepoName during pull repo');
    });
    jobHandlerTestHelper.repoConnector.checkCommits
      .calledWith(jobHandlerTestHelper.job)
      .mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    jobHandlerTestHelper.job.payload.patch = 'Testing apply patch';
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Error while applying patch RepoName during pull repo'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
  });

  test('Execute throws error when Downloading makefile repo should update status', async () => {
    jobHandlerTestHelper.fileSystemServices.saveUrlAsFile
      .calledWith(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${jobHandlerTestHelper.job.payload.repoName}`
      )
      .mockImplementation(() => {
        throw new Error('Error while Downloading makefile');
      });
    jobHandlerTestHelper.repoConnector.checkCommits
      .calledWith(jobHandlerTestHelper.job)
      .mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Error while Downloading makefile'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
  });

  describe.each(TestDataProvider.getPathPrefixCases())('Validate all Generate path prefix cases', (element) => {
    test(`Testing Path prefix with input ${JSON.stringify(element)}`, async () => {
      jobHandlerTestHelper.job.payload.repoBranches = element.value;
      jobHandlerTestHelper.setupForSuccess();
      await jobHandlerTestHelper.jobHandler.execute();
      expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.job.payload.pathPrefix).toEqual(element.pathPrefix);
      expect(jobHandlerTestHelper.job.payload.mutPrefix).toEqual(element.mutPrefix);
    });
  });

  describe.each(TestDataProvider.getManifestPrefixCases())('Validate all Generate manifest prefix cases', (element) => {
    test(`Testing manifest prefix with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
      jobHandlerTestHelper.executeCommandWithGivenParamsForManifest(element);
      await jobHandlerTestHelper.jobHandler.execute();
      expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
      expect(jobHandlerTestHelper.job.payload.manifestPrefix).toEqual(element.manifestPrefix);
    });
  });

  test('Validate setting env vars', async () => {
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.job.payload.aliased = true;
    jobHandlerTestHelper.job.payload.primaryAlias = null;
    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    // TODO: Correct number of arguments
    expect(jobHandlerTestHelper.fileSystemServices.writeToFile).toBeCalledWith(
      `repos/${jobHandlerTestHelper.job.payload.repoName}/.env.production`,
      TestDataProvider.getEnvVarsWithPathPrefixWithFlags(jobHandlerTestHelper.job),
      { encoding: 'utf8', flag: 'w' }
    );
  });

  test('Default production deploy kicks off manifest generation', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    const queueManifestJobSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'queueManifestJob');

    expect(jobHandlerTestHelper.jobHandler.currJob).toEqual(getBuildJobDef());

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();

    expect(queueManifestJobSpy).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(1);

    expect(jobHandlerTestHelper.jobRepo.insertJob.mock.calls[0][0]).toEqual(getManifestJobDef());
  });

  test('Production deploy with false shouldGenerateManifest() result does not kick off manifest job', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    jobHandlerTestHelper.jobHandler.queueManifestJob = jest.fn();
    jobHandlerTestHelper.jobHandler.shouldGenerateSearchManifest = jest.fn().mockReturnValueOnce(false);

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();

    expect(jobHandlerTestHelper.jobHandler.shouldGenerateSearchManifest).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobHandler.queueManifestJob).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(0);
  });

  test('Calling queueManifestJob() with false shouldGenerateManifest flag does not kick off manifest job', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    jobHandlerTestHelper.job.shouldGenerateSearchManifest = false;

    const result = getBuildJobDef();
    result['shouldGenerateSearchManifest'] = false;
    expect(jobHandlerTestHelper.jobHandler.currJob).toEqual(result);

    jobHandlerTestHelper.setupForSuccess();
    // In theory, queueManifestJob should not be called by this process, but
    // for the purpose of testing, we need to know that it exits without
    // inserting another job.
    await jobHandlerTestHelper.jobHandler.queueManifestJob();
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(0);
  });

  test('Docs-landing deploy does not kick off manifest job', async () => {
    jobHandlerTestHelper.jobRepo.insertJob = jest.fn();
    jobHandlerTestHelper.job.payload.repoName = 'docs-landing';
    const queueManifestJobSpy = jest.spyOn(jobHandlerTestHelper.jobHandler, 'queueManifestJob');

    const result = getBuildJobDef();
    result.payload.repoName = 'docs-landing';
    expect(jobHandlerTestHelper.jobHandler.currJob).toEqual(result);

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();

    expect(queueManifestJobSpy).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertJob).toBeCalledTimes(0);
  });

  test("Production deploy of a job with empty string pathPrefix sets PATH_PREFIX env to '/'", async () => {
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.job.payload.repoBranches.prefix = '';
    jobHandlerTestHelper.job.payload.prefix = '';
    jobHandlerTestHelper.job.payload.urlSlug = null;

    jobHandlerTestHelper.setupForSuccess();
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();

    expect(jobHandlerTestHelper.fileSystemServices.writeToFile).toBeCalledWith(
      `repos/${jobHandlerTestHelper.job.payload.repoName}/.env.production`,
      `GATSBY_PARSER_USER=TestUser\nGATSBY_PARSER_BRANCH=${jobHandlerTestHelper.job.payload.branchName}\nPATH_PREFIX=/\nGATSBY_BASE_URL=test\nPREVIEW_BUILD_ENABLED=false\nGATSBY_TEST_SEARCH_UI=false\n`,
      { encoding: 'utf8', flag: 'w' }
    );
  });

  test('Execute Next Gen Build successfully', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true, false, {
      status: 'success',
      output: 'Great work',
      error: null,
    });
    jobHandlerTestHelper.job.useWithBenchmark = true;
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
  });

  test('Execute Next Gen Build throws error while executing commands', async () => {
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.setupForSuccess();
    mockReset(jobHandlerTestHelper.jobCommandExecutor);
    jobHandlerTestHelper.jobCommandExecutor.execute.mockReturnValue({
      status: 'failed',
      error: 'Command Execution failed',
    });
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Command Execution failed'
    );
  });

  test('Execute Next Gen Build throws error when execute throws error', async () => {
    jobHandlerTestHelper.job.payload.repoBranches = TestDataProvider.getRepoBranchesData(jobHandlerTestHelper.job);
    jobHandlerTestHelper.setupForSuccess();
    jobHandlerTestHelper.jobCommandExecutor.execute.mockImplementation(() => {
      throw new Error('Unable to Execute Commands');
    });
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Unable to Execute Commands'
    );
  });

  describe.each(TestDataProvider.getManifestPrefixCases())(
    'Execute Next Gen Build Validate all deploy commands',
    (element) => {
      test(`Testing  all deploy command cases with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        jobHandlerTestHelper.executeCommandWithGivenParamsForManifest(element);
        jobHandlerTestHelper.jobCommandExecutor.execute.mockReturnValue({
          status: 'success',
          output: 'Great work',
          error: null,
        });
        jobHandlerTestHelper.fileSystemServices.getFilesInDirectory
          .calledWith(`./${jobHandlerTestHelper.job.payload.repoName}/build/public`, '')
          .mockReturnValue(['1.html', '2.html', '3.html']);
        await jobHandlerTestHelper.jobHandler.execute();
        jobHandlerTestHelper.verifyNextGenSuccess();
        const expectedCommandSet = TestDataProvider.getExpectedProdDeployNextGenCommands(jobHandlerTestHelper.job);
        expect(jobHandlerTestHelper.job.deployCommands).toEqual(expectedCommandSet);
        expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(
          jobHandlerTestHelper.job._id,
          'Great work'
        );
        expect(jobHandlerTestHelper.fileSystemServices.getFilesInDirectory).toBeCalledWith(
          `./${jobHandlerTestHelper.job.payload.repoName}/build/public`,
          '',
          null,
          null
        );
        expect(jobHandlerTestHelper.jobRepo.updateWithCompletionStatus).toBeCalledWith(jobHandlerTestHelper.job._id, [
          '1.html',
          '2.html',
          '3.html',
        ]);
      });
    }
  );

  test('Execute Build succeeded deploy failed updates status properly', async () => {
    jobHandlerTestHelper.setStageForDeployFailure('Bad work', 'Not Good');
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Bad work'
    );
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, 'Not Good');
  });

  test('Execute Build succeeded deploy failed updates status properly on nullish case', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, 'Not Good');
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, 'Not Good');
  });

  test('Execute Build succeeded deploy failed with an ERROR updates status properly', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, 'ERROR:BAD ONE');
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      'Failed pushing to Production: ERROR:BAD ONE'
    );
  });

  test('Execute legacy build successfully purges only updated urls', async () => {
    const purgedUrls = jobHandlerTestHelper.setStageForDeploySuccess(false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(
      TestDataProvider.getCommonBuildCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(
      TestDataProvider.getCommonDeployCommands(jobHandlerTestHelper.job)
    );
    expect(jobHandlerTestHelper.cdnConnector.purge).toBeCalledWith(
      jobHandlerTestHelper.job._id,
      purgedUrls,
      jobHandlerTestHelper.job.payload.prefix
    );
    expect(jobHandlerTestHelper.jobRepo.insertPurgedUrls).toBeCalledWith(jobHandlerTestHelper.job._id, purgedUrls);
  });

  test('Deploy purge process inserts invalidationStatusUrl', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(true);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.insertInvalidationRequestStatusUrl).toBeCalledTimes(1);
  });
});
