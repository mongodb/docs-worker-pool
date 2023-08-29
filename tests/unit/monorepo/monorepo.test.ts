import { Octokit } from '@octokit/rest';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getOctokitClient } from '../../../src/clients/githubClient';
import { mockDeep } from 'jest-mock-extended';

jest.mock('../../../src/clients/githubClient');
jest.mock('@octokit/rest');

const mockedGetOctokitClient = getOctokitClient as jest.MockedFunction<typeof getOctokitClient>;
const mockedOctokit = mockDeep<Octokit>();

mockedGetOctokitClient.mockReturnValue(mockedOctokit);

afterEach(() => {
  jest.resetAllMocks();
});

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

    // This will be the GitHub API response for the server-docs/source/datalake/source path. This should reject
    // since there should not be a snooty.toml file in this directory
    jest.spyOn(mockedOctokit, 'request').mockRejectedValueOnce({} as unknown as ReturnType<Octokit['request']>);

    // This will be the GitHub API response for the server-docs/source/datalake path. This should resolve
    // since there should be a snooty.toml file in this directory
    jest.spyOn(mockedOctokit, 'request').mockResolvedValueOnce({} as unknown as ReturnType<Octokit['request']>);

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['server-docs/source/datalake/source/index.rst'],
    });

    expect(paths).toContain('server-docs/source/datalake');
  });
});
