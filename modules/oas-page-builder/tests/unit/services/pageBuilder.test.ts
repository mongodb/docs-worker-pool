import fetch from 'node-fetch';
import { execRedoc } from '../../../src/services/commandExecutor';
import { findLastSavedGitHash } from '../../../src/services/database';
import { buildOpenAPIPages } from '../../../src/services/pageBuilder';
import { OASPageMetadata } from '../../../src/services/types';
import { ModuleOptions } from '../../../src/types';

const MOCKED_GIT_HASH = '1234';
const LAST_SAVED_GIT_HASH = '4321';

// Mock execRedoc since we only want to ensure pageBuilder properly calls the function
jest.mock('../../../src/services/commandExecutor', () => ({
  execRedoc: jest.fn(),
}));

// Mock database since implementation relies on database instance. Returned values
// are mocked for each test.
jest.mock('../../../src/services/database', () => ({
  findLastSavedGitHash: jest.fn(),
}));

// Helper function for concatendated output path
const getExpectedOutputPath = (destination: string, pageSlug: string) => `${destination}/${pageSlug}/index.html`;

// Allows node-fetch to be mockable
jest.mock('node-fetch');
const mockFetchImplementation = (ok: boolean) => {
  // @ts-ignore
  fetch.mockImplementation(() => ({
    ok,
    text: () => MOCKED_GIT_HASH,
  }));
};

describe('pageBuilder', () => {
  const testOptions: ModuleOptions = {
    bundle: '/path/to/bundle.zip',
    destination: '/path/to/destination',
    redoc: '/path/to/redoc/cli/index.js',
    repo: '/path/to/repo',
  };

  beforeEach(() => {
    // Reset mock to reset call count
    // @ts-ignore
    execRedoc.mockReset();
  });

  it('builds OpenAPI pages', async () => {
    mockFetchImplementation(true);

    const testEntries: [string, OASPageMetadata][] = [
      ['path/to/page/1', { source_type: 'local', source: '/local-spec.json' }],
      [
        'path/to/page/2',
        {
          source_type: 'url',
          source: 'https://raw.githubusercontent.com/mongodb/docs-landing/master/source/openapi/loremipsum.json',
        },
      ],
      ['path/to/page/3', { source_type: 'atlas', source: 'cloud' }],
    ];

    await buildOpenAPIPages(testEntries, testOptions);
    expect(execRedoc).toBeCalledTimes(testEntries.length);
    // Local
    expect(execRedoc).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.destination}/${testEntries[0][0]}/index.html`,
      testOptions.redoc
    );
    // Url
    expect(execRedoc).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.destination, testEntries[1][0]),
      testOptions.redoc
    );
    // Atlas
    expect(execRedoc).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}.json`,
      getExpectedOutputPath(testOptions.destination, testEntries[2][0]),
      testOptions.redoc
    );
  });

  it('builds Atlas Cloud API with backup git hash', async () => {
    mockFetchImplementation(false);
    // @ts-ignore
    findLastSavedGitHash.mockReturnValue({ gitHash: LAST_SAVED_GIT_HASH });

    const testEntries: [string, OASPageMetadata][] = [['path/to/page/1', { source_type: 'atlas', source: 'cloud' }]];

    await buildOpenAPIPages(testEntries, testOptions);
    expect(execRedoc).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${LAST_SAVED_GIT_HASH}.json`,
      getExpectedOutputPath(testOptions.destination, testEntries[0][0]),
      testOptions.redoc
    );
  });

  it('does not build atlas OAS when backup git hash is missing', async () => {
    mockFetchImplementation(false);
    // @ts-ignore
    findLastSavedGitHash.mockReturnValue({});

    const testEntries: [string, OASPageMetadata][] = [['path/to/page/1', { source_type: 'atlas', source: 'cloud' }]];

    await buildOpenAPIPages(testEntries, testOptions);
    expect(execRedoc).toBeCalledTimes(0);
  });
});
