import fetch from 'node-fetch';
import { normalizePath } from '../utils/normalizePath';
import { RedocExecutor } from './redocExecutor';
import { findLastSavedVersionData, saveSuccessfulBuildVersionData } from './database';
import { OASPageMetadata, PageBuilderOptions, RedocBuildOptions } from './types';

const OAS_FILE_SERVER = 'https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/';

const fetchTextData = async (url: string, errMsg: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Error should be caught when creating pages.
    throw new Error(`${errMsg}; ${res.statusText}`);
  }
  return res.text();
};

const fetchGitHash = async () => {
  const versionURL = 'https://cloud.mongodb.com/version';
  return fetchTextData(versionURL, 'Could not find current version or git hash');
};

interface AtlasSpecUrlParams {
  apiKeyword: string;
  apiVersion?: string;
  resourceVersion?: string;
}

const getAtlasSpecUrl = async ({ apiKeyword, apiVersion, resourceVersion }: AtlasSpecUrlParams) => {
  // Currently, the only expected API fetched programmatically is the Cloud Admin API,
  // but it's possible to have more in the future with varying processes.
  const res = await findLastSavedVersionData(apiKeyword);
  console.log('res ', res);
  const keywords = ['cloud'];
  if (!keywords.includes(apiKeyword)) {
    throw new Error(`${apiKeyword} is not a supported API for building.`);
  }

  const versionExtension = `${apiVersion ? `-v${apiVersion.split('.')[0]}` : ''}${
    apiVersion && resourceVersion ? `-${resourceVersion}` : ''
  }`;

  let oasFileURL;
  let successfulGitHash = true;

  try {
    const gitHash = await fetchGitHash();
    oasFileURL = `${OAS_FILE_SERVER}${gitHash}${versionExtension}.json`;

    // Sometimes the latest git hash might not have a fully available spec file yet.
    // If this is the case, we should default to using the last successfully saved
    // hash in our database.
    await fetchTextData(oasFileURL, `Error fetching data from ${oasFileURL}`);
  } catch (e) {
    console.error(e);
    successfulGitHash = false;

    const res = await findLastSavedVersionData(apiKeyword);
    if (res) {
      // Check  that requested versions are included in saved version data
      if (apiVersion) {
        if (
          !res.versions.major.includes(apiVersion) ||
          (resourceVersion && !res.versions[apiVersion].includes(resourceVersion))
        ) {
          throw new Error('Last successful saved build data does not include necessary version data');
        }
      }
      oasFileURL = `${OAS_FILE_SERVER}${res.gitHash}${versionExtension}.json`;
      console.log(`Using ${oasFileURL}`);
    } else {
      throw new Error(`Could not find a saved hash for API: ${apiKeyword}`);
    }
  }

  return {
    oasFileURL,
    successfulGitHash,
  };
};

interface GetOASpecParams {
  sourceType: string;
  source: string;
  output: string;
  pageSlug: string;
  repoPath: string;
  redocExecutor: RedocExecutor;
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
}: GetOASpecParams) {
  try {
    let spec = '';
    let isSuccessfulBuild = true;
    const buildOptions: RedocBuildOptions = {};
    if (sourceType === 'url') {
      spec = source;
    } else if (sourceType === 'local') {
      const localFilePath = normalizePath(`${repoPath}/source/${source}`);
      spec = localFilePath;
    } else if (sourceType === 'atlas') {
      const { oasFileURL, successfulGitHash } = await getAtlasSpecUrl({
        apiKeyword: source,
        apiVersion,
        resourceVersion,
      });
      spec = oasFileURL;
      isSuccessfulBuild = successfulGitHash;
      // Ignore "incompatible types" warnings for Atlas Admin API/cloud-docs

      buildOptions['ignoreIncompatibleTypes'] = true;
    } else {
      throw new Error(`Unsupported source type "${sourceType}" for ${pageSlug}`);
    }

    const filePathExtension = `${resourceVersion && apiVersion ? `/${resourceVersion}` : ''}`;

    const path = `${output}/${pageSlug}${filePathExtension}/index.html`;
    const finalFilename = normalizePath(path);
    await redocExecutor.execute(spec, finalFilename, buildOptions);
    return isSuccessfulBuild;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export const buildOpenAPIPages = async (
  entries: [string, OASPageMetadata][],
  { output, redoc: redocPath, repo: repoPath, siteUrl, siteTitle }: PageBuilderOptions
) => {
  let totalSuccess = true;
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
        const isSuccessfulBuild = await getOASpec({
          source,
          sourceType,
          output,
          pageSlug,
          redocExecutor,
          repoPath,
          apiVersion,
          resourceVersion,
        });
        if (!isSuccessfulBuild) totalSuccess = false;
      }
    }
    // apiVersion can be undefined, this case is handled within the getOASpec function
    const isSuccessfulBuild = await getOASpec({
      source,
      sourceType,
      output,
      pageSlug,
      redocExecutor,
      repoPath,
      apiVersion,
    });
    if (!isSuccessfulBuild) totalSuccess = false;

    // Make sure all successful, then save to db
    if (totalSuccess) {
      try {
        const gitHash = await fetchGitHash();
        const versionUrl = `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${gitHash}-api-versions.json`;
        const res = await fetch(versionUrl);
        const { versions } = await res.json();
        await saveSuccessfulBuildVersionData(source, gitHash, versions);
      } catch (e) {
        console.log(e);
      }
    }
    totalSuccess = true;
  }
};
