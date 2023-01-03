import fetch from 'node-fetch';
import { RedocExecutor } from '../../../src/services/redocExecutor';
import { findLastSavedGitHash } from '../../../src/services/database';
import { buildOpenAPIPages } from '../../../src/services/pageBuilder';
import { OASPageMetadata, PageBuilderOptions } from '../../../src/services/types';
import { ModuleOptions } from '../../../src/types';

const MOCKED_GIT_HASH = '1234';
const LAST_SAVED_GIT_HASH = '4321';

const mockExecute = jest.fn();
// Mock execRedoc since we only want to ensure pageBuilder properly calls the function
jest.mock('../../../src/services/redocExecutor', () => ({
  RedocExecutor: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
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
  const testOptions: PageBuilderOptions = {
    output: '/path/to/destination',
    redoc: '/path/to/redoc/cli/index.js',
    repo: '/path/to/repo',
    siteUrl: 'https://mongodb.com/docs',
    siteTitle: 'Test Docs',
  };

  beforeEach(() => {
    // Reset mock to reset call count
    mockExecute.mockReset();
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
    // const mockSoundPlayerInstance = SoundPlayer.mock.instances[0];
    // const mockRedocExecutorInstance = RedocExecutor.mock.instances[0];
    expect(mockExecute).toBeCalledTimes(testEntries.length);
    // Local
    expect(mockExecute).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.output}/${testEntries[0][0]}/index.html`
    );
    // Url
    expect(mockExecute).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.output, testEntries[1][0])
    );
    // Atlas
    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}.json`,
      getExpectedOutputPath(testOptions.output, testEntries[2][0])
    );
  });

  it('builds Atlas Cloud API with backup git hash', async () => {
    mockFetchImplementation(false);
    // @ts-ignore
    findLastSavedGitHash.mockReturnValue({ gitHash: LAST_SAVED_GIT_HASH });

    const testEntries: [string, OASPageMetadata][] = [['path/to/page/1', { source_type: 'atlas', source: 'cloud' }]];

    await buildOpenAPIPages(testEntries, testOptions);
    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${LAST_SAVED_GIT_HASH}.json`,
      getExpectedOutputPath(testOptions.output, testEntries[0][0])
    );
  });

  it('does not build atlas OAS when backup git hash is missing', async () => {
    mockFetchImplementation(false);
    // @ts-ignore
    findLastSavedGitHash.mockReturnValue(null);

    const testEntries: [string, OASPageMetadata][] = [['path/to/page/1', { source_type: 'atlas', source: 'cloud' }]];

    await buildOpenAPIPages(testEntries, testOptions);
    expect(mockExecute).toBeCalledTimes(0);
  });
});
