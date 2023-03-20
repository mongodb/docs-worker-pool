import fetch from 'node-fetch';
import { normalizePath } from '../utils/normalizePath';
import { RedocExecutor } from './redocExecutor';
import { findLastSavedGitHash } from './database';
import { OASPageMetadata, PageBuilderOptions, RedocBuildOptions, RedocVersionOptions } from './types';

const OAS_FILE_SERVER = 'https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/';

const fetchTextData = async (url: string, errMsg: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Error should be caught when creating pages.
    throw new Error(`${errMsg}; ${res.statusText}`);
  }
  return res.text();
};

interface AtlasSpecUrlParams {
  apiKeyword: string;
  apiVersion?: string;
  resourceVersion?: string;
}

const getAtlasSpecUrl = async ({ apiKeyword, apiVersion, resourceVersion }: AtlasSpecUrlParams) => {
  // Currently, the only expected API fetched programmatically is the Cloud Admin API,
  // but it's possible to have more in the future with varying processes.
  const keywords = ['cloud'];
  if (!keywords.includes(apiKeyword)) {
    throw new Error(`${apiKeyword} is not a supported API for building.`);
  }

  const versionExtension = `${apiVersion ? `-v${apiVersion.split('.')[0]}` : ''}${
    apiVersion && resourceVersion ? `-${resourceVersion}` : ''
  }`;

  let oasFileURL;

  try {
    const versionURL = 'https://cloud.mongodb.com/version';
    const gitHash = await fetchTextData(versionURL, 'Could not find current version or git hash');
    oasFileURL = `${OAS_FILE_SERVER}${gitHash}${versionExtension}.json`;

    // Sometimes the latest git hash might not have a fully available spec file yet.
    // If this is the case, we should default to using the last successfully saved
    // hash in our database.
    await fetchTextData(oasFileURL, `Error fetching data from ${oasFileURL}`);
  } catch (e) {
    console.error(e);

    const res = await findLastSavedGitHash(apiKeyword);
    if (res) {
      oasFileURL = `${OAS_FILE_SERVER}${res.gitHash}${versionExtension}.json`;
      console.log(`Using ${oasFileURL}`);
    } else {
      throw new Error(`Could not find a saved hash for API: ${apiKeyword}`);
    }
  }

  return oasFileURL;
};

interface GetOASpecParams {
  sourceType: string;
  source: string;
  output: string;
  pageSlug: string;
  repoPath: string;
  redocExecutor: RedocExecutor;
  siteUrl: string;
  activeResourceVersion?: string;
  resourceVersions?: string[];
  apiVersion?: string;
  resourceVersion?: string;
}

async function getOASpec({
  source,
  sourceType,
  repoPath,
  pageSlug,
  redocExecutor,
  output,
  apiVersion,
  resourceVersion,
  resourceVersions,
  siteUrl,
}: GetOASpecParams) {
  try {
    let spec = '';
    const buildOptions: RedocBuildOptions = {};
    if (sourceType === 'url') {
      spec = source;
    } else if (sourceType === 'local') {
      const localFilePath = normalizePath(`${repoPath}/source/${source}`);
      spec = localFilePath;
    } else if (sourceType === 'atlas') {
      spec = await getAtlasSpecUrl({ apiKeyword: source, apiVersion, resourceVersion });
      // Ignore "incompatible types" warnings for Atlas Admin API/cloud-docs
      buildOptions['ignoreIncompatibleTypes'] = true;
    } else {
      throw new Error(`Unsupported source type "${sourceType}" for ${pageSlug}`);
    }

    const filePathExtension = `${resourceVersion && apiVersion ? `/${resourceVersion}` : ''}`;

    const path = `${output}/${pageSlug}${filePathExtension}/index.html`;
    const finalFilename = normalizePath(path);

    let versionOptions: RedocVersionOptions | undefined;

    if (resourceVersions && apiVersion) {
      const rootUrl = `${siteUrl}/${pageSlug}`;

      // if there is no resource version provided, but there is a resourceVersions array present,
      // get the latest resource version from the array, and assign it to the active resource version
      if (!resourceVersion) {
        const latestResourceVersion = resourceVersions.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[
          resourceVersions.length - 1
        ];

        versionOptions = {
          active: {
            apiVersion,
            resourceVersion: latestResourceVersion,
          },
          rootUrl,
          resourceVersions,
        };
      } else {
        versionOptions = {
          active: {
            apiVersion,
            resourceVersion: resourceVersion,
          },
          rootUrl,
          resourceVersions,
        };
      }
    }

    await redocExecutor.execute(spec, finalFilename, buildOptions, versionOptions);
  } catch (e) {
    console.error(e);
  }
}

export const buildOpenAPIPages = async (
  entries: [string, OASPageMetadata][],
  { output, redoc: redocPath, repo: repoPath, siteUrl, siteTitle }: PageBuilderOptions
) => {
  const redocExecutor = new RedocExecutor(redocPath, siteUrl, siteTitle);

  for (const [pageSlug, data] of entries) {
    const { source_type: sourceType, source, api_version: apiVersion, resource_versions: resourceVersions } = data;

    if (!apiVersion && resourceVersions && resourceVersions.length > 0) {
      console.error(
        `ERROR: API version is not specified, but resource version is present for source ${source} and sourceType: ${sourceType}`
      );
      continue;
    }

    if (resourceVersions) {
      // if a resource versions array is provided, then we can loop through the resourceVersions array and call the getOASpec
      // for each minor version
      for (const resourceVersion of resourceVersions) {
        // there is a minor version and major version
        await getOASpec({
          source,
          sourceType,
          output,
          pageSlug,
          redocExecutor,
          repoPath,
          apiVersion,
          resourceVersion,
          siteUrl,
          resourceVersions,
        });
      }

      // provide no resource version in this context for the base version
      await getOASpec({
        source,
        sourceType,
        output,
        pageSlug,
        redocExecutor,
        repoPath,
        apiVersion,
        siteUrl,
        resourceVersions,
      });
    } else {
      // apiVersion can be undefined, this case is handled within the getOASpec function
      await getOASpec({
        source,
        sourceType,
        output,
        pageSlug,
        redocExecutor,
        repoPath,
        apiVersion,
        siteUrl,
      });
    }
  }
};
