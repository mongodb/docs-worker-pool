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
  rejections: number;
  shouldResolve: boolean;
}

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

/**
 * Helper function to call mockRejectedValues multiple times. This is because
 * we expect a rejected promise every time we check a path that does not have a snooty.toml file.
 * We only ever need to resolve once per function call for it to succeed, so we can encode that as a
 * boolean value as opposed to a number.
 */
function mockOctokitResponse({ rejections, shouldResolve }: MockOctokitResponseConfig) {
  for (let i = 0; i < rejections; i++) {
    jest.spyOn(mockedOctokit, 'request').mockRejectedValueOnce(mockedRequestResult);
  }

  if (shouldResolve) jest.spyOn(mockedOctokit, 'request').mockResolvedValueOnce(mockedRequestResult);
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

    mockOctokitTreeResponse(['server-docs/source/datalake/snooty.toml', 'server-docs/snooty.toml']);

    const paths = await getMonorepoPaths({
      commitSha: '12345',
      ownerName: 'mongodb',
      repoName: 'monorepo',
      updatedFilePaths: ['server-docs/source/datalake/source/index.rst'],
    });

    expect(paths).toContain('server-docs/source/datalake');
  });

  it('Returns an empty array if there is no snooty.toml at in point in the file path', async () => {
    mockOctokitResponse({ rejections: 2, shouldResolve: false });

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

    // NOTE: Not sure why the order is reversed, but it seems that the
    // server-docs/source/datalake/source/test/index.rst path is handled first.
    // Must be some async testing funkiness

    // these API responses correspond to the server-docs/source/datalake/source/test/index.rst
    // should reject at server-docs/source/datalake/source/test
    // should reject at server-docs/source/datalake/source
    // should resolve at server-docs/source/datalake
    mockOctokitResponse({ rejections: 2, shouldResolve: true });

    // these API responses correspond to the server-docs/source/datalake/source/index.rst path
    // should reject at server-docs/source/datalake/source
    // should resolve at server-docs/source/datalake
    mockOctokitResponse({ rejections: 1, shouldResolve: true });

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
