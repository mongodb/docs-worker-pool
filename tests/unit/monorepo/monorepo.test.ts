import { Octokit } from '@octokit/rest';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getOctokitClient } from '../../../src/clients/githubClient';
import { mockDeep } from 'jest-mock-extended';

jest.mock('../../../src/clients/githubClient');
jest.mock('@octokit/rest');

const mockedOctokit = mockDeep<Octokit>();

const mockedRequestResult = {} as unknown as ReturnType<Octokit['request']>;

beforeEach(() => {
  jest.resetAllMocks();

  const mockedGetOctokitClient = getOctokitClient as jest.MockedFunction<typeof getOctokitClient>;
  mockedGetOctokitClient.mockReturnValue(mockedOctokit);
});

interface MockOctokitResponseConfig {
  failures: number;
  shouldSucceed: boolean;
}
function mockOctokitResponse({ failures, shouldSucceed }: MockOctokitResponseConfig) {
  for (let i = 0; i < failures; i++) {
    jest.spyOn(mockedOctokit, 'request').mockRejectedValueOnce(mockedRequestResult);
  }

  if (shouldSucceed) jest.spyOn(mockedOctokit, 'request').mockResolvedValueOnce(mockedRequestResult);
}

describe('Monorepo Path Parsing tests', () => {
  it('Successfully finds project paths if snooty.toml is changed', async () => {
    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['server-docs/snooty.toml', 'server-docs/source/datalake/snooty.toml'],
    });

    expect(paths).toContain('server-docs');
    expect(paths).toContain('server-docs/source/datalake');
  });

  it('Successfully finds project paths based on changed files other than snooty.toml', async () => {
    /**
     * server-docs/source/datalake contains a snooty.toml file. We will reject once and then resolve
     * once as this should mimic responses from the GitHub API.
     */

    mockOctokitResponse({ failures: 1, shouldSucceed: true });

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['server-docs/source/datalake/source/index.rst'],
    });

    expect(paths).toContain('server-docs/source/datalake');
  });

  it('Returns an empty array if there is no snooty.toml at in point in the file path', async () => {
    mockOctokitResponse({ failures: 2, shouldSucceed: false });

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['bad/path/index.rst'],
    });

    expect(paths.length).toEqual(0);
  });

  it('Returns only one project path when two files in the same project are modified', async () => {
    /**
     * server-docs/source/datalake contains a snooty.toml file. We will reject once and then resolve
     * once as this should mimic responses from the GitHub API.
     */

    mockOctokitResponse({ failures: 2, shouldSucceed: true });
    mockOctokitResponse({ failures: 1, shouldSucceed: true });

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: [
        'server-docs/source/datalake/source/index.rst',
        'server-docs/source/datalake/source/test/index.rst',
      ],
    });

    expect(paths).toContain('server-docs/source/datalake');
  });
});
