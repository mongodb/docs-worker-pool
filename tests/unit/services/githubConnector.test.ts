import { mockDeep, mockReset } from 'jest-mock-extended';
import { IFileSystemServices } from '../../../src/services/fileServices';
import { getBuildJobDef } from '../../data/jobDef';
import { IConfig } from 'config';
import { IGithubCommandExecutor } from '../../../src/services/commandExecutor';
import { IJobRepoLogger } from '../../../src/services/logger';
import { GitHubConnector } from '../../../src/services/repo';
import type { Job } from '../../../src/entities/job';

let job: Job;
let commandExecutor: IGithubCommandExecutor;
let jobRepoLogger: IJobRepoLogger;
let config: IConfig;
let fileSystemServices: IFileSystemServices;
let gitHubConnector: GitHubConnector;

beforeEach(() => {
  jest.setTimeout(30000);
  job = getBuildJobDef();
  fileSystemServices = mockDeep<IFileSystemServices>();
  commandExecutor = mockDeep<IGithubCommandExecutor>();
  jobRepoLogger = mockDeep<IJobRepoLogger>();
  config = mockDeep<IConfig>();
  gitHubConnector = new GitHubConnector(commandExecutor, config, fileSystemServices, jobRepoLogger);
});

afterEach(() => {
  mockReset(fileSystemServices);
  mockReset(commandExecutor);
  mockReset(jobRepoLogger);
  mockReset(config);
});

describe('GitHubConnector Tests', () => {
  test('GitHubConnector constructor', () => {
    expect(gitHubConnector).toBeDefined();
  });

  describe('GitHubConnector applyPatch Tests', () => {
    test('GitHubConnector applyPatch  succeeds', async () => {
      job.payload.patch = 'Somepatch';
      commandExecutor.applyPatch
        .calledWith(job.payload.repoName, 'myPatch.patch')
        .mockReturnValueOnce({ output: 'fine', status: 'success', error: null });
      const resp = gitHubConnector.applyPatch(job);
      expect(fileSystemServices.writeToFile.mock.calls).toHaveLength(1);
      expect(fileSystemServices.writeToFile).toHaveBeenCalledWith(
        `repos/${job.payload.repoName}/myPatch.patch`,
        job.payload.patch,
        { encoding: 'utf8', flag: 'w' }
      );
      expect(commandExecutor.applyPatch.mock.calls).toHaveLength(1);
      expect(commandExecutor.applyPatch).toHaveBeenCalledWith(job.payload.repoName, 'myPatch.patch');
    });

    test('GitHubConnector applyPatch  doesnt work if there is patch data in job payload', async () => {
      gitHubConnector.applyPatch(job);
      expect(fileSystemServices.writeToFile.mock.calls).toHaveLength(0);
      expect(commandExecutor.applyPatch.mock.calls).toHaveLength(0);
    });

    test('GitHubConnector applyPatch  throws if commandExecutor throws', async () => {
      job.payload.patch = 'Somepatch';
      commandExecutor.applyPatch.calledWith(job.payload.repoName, 'myPatch.patch').mockImplementationOnce(() => {
        throw Error('Unable to apply patch');
      });
      await expect(gitHubConnector.applyPatch(job)).rejects.toThrow(
        'Error creating patch  Error: Unable to apply patch'
      );
      expect(fileSystemServices.writeToFile.mock.calls).toHaveLength(1);
      expect(fileSystemServices.writeToFile).toHaveBeenCalledWith(
        `repos/${job.payload.repoName}/myPatch.patch`,
        job.payload.patch,
        { encoding: 'utf8', flag: 'w' }
      );
      expect(commandExecutor.applyPatch.mock.calls).toHaveLength(1);
      expect(commandExecutor.applyPatch).toHaveBeenCalledWith(job.payload.repoName, 'myPatch.patch');
    });

    test('GitHubConnector applyPatch  throws if writefile throws', async () => {
      job.payload.patch = 'Somepatch';
      fileSystemServices.writeToFile.mockImplementationOnce(() => {
        throw Error('Unable to write to file');
      });
      expect(gitHubConnector.applyPatch(job)).rejects.toThrow('Unable to write to file');
      expect(fileSystemServices.writeToFile.mock.calls).toHaveLength(1);
      expect(fileSystemServices.writeToFile).toHaveBeenCalledWith(
        `repos/${job.payload.repoName}/myPatch.patch`,
        job.payload.patch,
        { encoding: 'utf8', flag: 'w' }
      );
      expect(commandExecutor.applyPatch.mock.calls).toHaveLength(0);
    });
  });

  describe('GitHubConnector checkCommits Tests', () => {
    test('GitHubConnector checkCommits  succeeds', async () => {
      job.payload.newHead = 'newHead';
      commandExecutor.checkoutBranchForSpecificHead
        .calledWith(job.payload.repoName, job.payload.branchName, job.payload.newHead)
        .mockReturnValueOnce({ output: 'valid', error: null, status: 'success' });
      await gitHubConnector.checkCommits(job);
      expect(commandExecutor.checkoutBranchForSpecificHead).toHaveBeenCalledWith(
        job.payload.repoName,
        job.payload.branchName,
        job.payload.newHead
      );
      expect(commandExecutor.checkoutBranchForSpecificHead.mock.calls).toHaveLength(1);
    });

    test('GitHubConnector checkCommits no head doesnt call checkoutbrancg', async () => {
      job.payload.newHead = null;
      await gitHubConnector.checkCommits(job);
      expect(commandExecutor.checkoutBranchForSpecificHead.mock.calls).toHaveLength(0);
    });
  });

  describe('GitHubConnector pullRepo Tests', () => {
    test('GitHubConnector pullRepo  succeeds', async () => {
      commandExecutor.pullRepo
        .calledWith(job.payload.repoName, job.payload.branchName, job.payload.newHead)
        .mockReturnValueOnce({ output: 'valid', error: null, status: 'success' });
      await gitHubConnector.pullRepo(job);
      expect(commandExecutor.pullRepo).toHaveBeenCalledWith(
        job.payload.repoName,
        job.payload.branchName,
        job.payload.newHead
      );
      expect(commandExecutor.pullRepo.mock.calls).toHaveLength(1);
    });
  });
});
