import fetch from 'node-fetch';
import { findLastSavedGitHash } from '../../../src/services/database';
import { buildOpenAPIPages } from '../../../src/services/pageBuilder';
import { OASPageMetadata, PageBuilderOptions, RedocVersionOptions } from '../../../src/services/types';

const MOCKED_GIT_HASH = '1234';
const LAST_SAVED_GIT_HASH = '4321';
const SITE_URL = 'https://mongodb.com/docs';

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

// Helper function for concatenated output path
const getExpectedOutputPath = (destination: string, pageSlug: string, apiVersion?: string, resourceVersion?: string) =>
  `${destination}/${pageSlug}${resourceVersion && apiVersion ? `/${resourceVersion}` : ''}/index.html`;

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
    siteUrl: SITE_URL,
    siteTitle: 'Test Docs',
  };
  const expectedAtlasBuildOptions = {
    ignoreIncompatibleTypes: true,
  };
  const expectedDefaultBuildOptions = {};

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

    expect(mockExecute).toBeCalledTimes(testEntries.length);
    // Local
    expect(mockExecute).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.output}/${testEntries[0][0]}/index.html`,
      expectedDefaultBuildOptions,
      undefined
    );
    // Url
    expect(mockExecute).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.output, testEntries[1][0]),
      expectedDefaultBuildOptions,
      undefined
    );
    // Atlas
    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}.json`,
      getExpectedOutputPath(testOptions.output, testEntries[2][0]),
      expectedAtlasBuildOptions,
      undefined
    );
  });

  it('builds OpenAPI pages with api version', async () => {
    mockFetchImplementation(true);

    const testEntries: [string, OASPageMetadata][] = [
      ['path/to/page/1/v1', { source_type: 'local', source: '/local-spec/v1.json', api_version: '1.0' }],
      [
        'path/to/page/2/v1',
        {
          source_type: 'url',
          source: 'https://raw.githubusercontent.com/mongodb/docs-landing/master/source/openapi/loremipsum/v1.json',
          api_version: '1.0',
        },
      ],
      ['path/to/page/3/v1', { source_type: 'atlas', source: 'cloud', api_version: '1.0' }],
    ];

    await buildOpenAPIPages(testEntries, testOptions);
    console.log(getExpectedOutputPath(testOptions.output, testEntries[0][0], '1.0'));
    expect(mockExecute).toBeCalledTimes(testEntries.length);
    // Local
    expect(mockExecute).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.output}/${testEntries[0][0]}/index.html`,
      expectedDefaultBuildOptions,
      undefined
    );
    // Url
    expect(mockExecute).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.output, testEntries[1][0], '1.0'),
      expectedDefaultBuildOptions,
      undefined
    );
    // Atlas
    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}-v1.json`,
      getExpectedOutputPath(testOptions.output, testEntries[2][0], '1.0'),
      expectedAtlasBuildOptions,
      undefined
    );
  });

  it('builds OpenAPI pages with api version and resource version', async () => {
    mockFetchImplementation(true);

    const RESOURCE_VERSION = '01-01-2020';
    const RESOURCE_VERSIONS = [RESOURCE_VERSION];
    const API_VERSION = '2.0';

    const EXPECTED_BUILD_OPTIONS: RedocVersionOptions = {
      active: {
        apiVersion: API_VERSION,
        resourceVersion: RESOURCE_VERSION,
      },
      rootUrl: SITE_URL,
      resourceVersions: RESOURCE_VERSIONS,
    };

    const testEntries: [string, OASPageMetadata][] = [
      [
        'path/to/page/1/v2',
        { source_type: 'local', source: '/local-spec.json', api_version: '2.0', resource_versions: RESOURCE_VERSIONS },
      ],
      [
        'path/to/page/2/v2',
        {
          source_type: 'url',
          source: 'https://raw.githubusercontent.com/mongodb/docs-landing/master/source/openapi/loremipsum.json',
          api_version: '2.0',
          resource_versions: RESOURCE_VERSIONS,
        },
      ],
      [
        'path/to/page/3/v2',
        { source_type: 'atlas', source: 'cloud', api_version: '2.0', resource_versions: RESOURCE_VERSIONS },
      ],
    ];

    await buildOpenAPIPages(testEntries, testOptions);

    expect(mockExecute).toBeCalledTimes(testEntries.length * 2);
    // Local
    expect(mockExecute).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.output}/${testEntries[0][0]}/01-01-2020/index.html`,
      expectedDefaultBuildOptions,
      EXPECTED_BUILD_OPTIONS
    );

    expect(mockExecute).toBeCalledWith(
      `${testOptions.repo}/source${testEntries[0][1].source}`,
      `${testOptions.output}/${testEntries[0][0]}/index.html`,
      expectedDefaultBuildOptions,
      EXPECTED_BUILD_OPTIONS
    );
    // Url
    expect(mockExecute).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.output, testEntries[1][0], '2.0', '01-01-2020'),
      expectedDefaultBuildOptions,
      EXPECTED_BUILD_OPTIONS
    );

    expect(mockExecute).toBeCalledWith(
      `${testEntries[1][1].source}`,
      getExpectedOutputPath(testOptions.output, testEntries[1][0], '2.0'),
      expectedDefaultBuildOptions,
      EXPECTED_BUILD_OPTIONS
    );
    // Atlas
    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}-v2-01-01-2020.json`,
      getExpectedOutputPath(testOptions.output, testEntries[2][0], '2.0', '01-01-2020'),
      expectedAtlasBuildOptions,
      EXPECTED_BUILD_OPTIONS
    );

    expect(mockExecute).toBeCalledWith(
      `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${MOCKED_GIT_HASH}-v2.json`,
      getExpectedOutputPath(testOptions.output, testEntries[2][0], '2.0'),
      expectedAtlasBuildOptions,
      EXPECTED_BUILD_OPTIONS
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
      getExpectedOutputPath(testOptions.output, testEntries[0][0]),
      expectedAtlasBuildOptions,
      undefined
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
