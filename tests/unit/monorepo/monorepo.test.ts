import { Octokit } from '@octokit/rest';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getOctokitClient } from '../../../src/clients/githubClient';
import { mockDeep } from 'jest-mock-extended';

jest.mock('../../../src/clients/githubClient');
jest.mock('@octokit/rest');

const mockedOctokit = mockDeep<Octokit>();

beforeEach(() => {
  jest.resetAllMocks();

  const mockedGetOctokitClient = getOctokitClient as jest.MockedFunction<typeof getOctokitClient>;
  mockedGetOctokitClient.mockReturnValue(mockedOctokit);
});

function mockOctokitTreeResponse(filePaths: string[]) {
  // Partial representation of the GitHub API response that we care about.
  // The response contains a property `tree` which is an array of objects.
  const mockedResponse = {
    data: {
      tree: filePaths.map((path) => ({ path })),
    },
  };

  jest
    .spyOn(mockedOctokit, 'request')
    .mockResolvedValueOnce(mockedResponse as unknown as ReturnType<Octokit['request']>);
}

describe('Monorepo Path Parsing tests', () => {
  it('Successfully finds project paths if snooty.toml is changed', async () => {
    mockOctokitTreeResponse(['server-docs/source/datalake/snooty.toml', 'server-docs/snooty.toml']);

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

    mockOctokitTreeResponse(['server-docs/source/datalake/snooty.toml', 'server-docs/snooty.toml']);

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['server-docs/source/datalake/source/index.rst'],
    });

    expect(paths).toContain('server-docs/source/datalake');
  });

  it('Returns an empty array if there is no snooty.toml at any point in the file path', async () => {
    mockOctokitTreeResponse(['server-docs/source/datalake/snooty.toml', 'server-docs/snooty.toml']);

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
    mockOctokitTreeResponse(['server-docs/source/datalake/snooty.toml', 'server-docs/snooty.toml']);

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
    expect(paths.length).toEqual(1);
  });
});
