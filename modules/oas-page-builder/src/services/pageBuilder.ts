import fetch from 'node-fetch';
import { normalizePath } from '../utils/normalizePath';
import { fetchVersionData } from '../utils/fetchVersionData';
import { RedocExecutor } from './redocExecutor';
import { OASPageMetadata, PageBuilderOptions, RedocBuildOptions, RedocVersionOptions } from './types';
import { findLastSavedVersionData, saveSuccessfulBuildVersionData } from './database';
import { VersionData } from './models/OASFile';
import { normalizeUrl } from '../utils/normalizeUrl';

const OAS_FILE_SERVER = 'https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/';
const GIT_HASH_URL = 'https://cloud.mongodb.com/version';

const fetchTextData = async (url: string, errMsg: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Error should be caught when creating pages.
    throw new Error(`${errMsg}; ${res.statusText}`);
  }
  return res.text();
};

const createFetchGitHash = () => {
  let gitHashCache: string;
  return {
    fetchGitHash: async () => {
      if (gitHashCache) return gitHashCache;
      try {
        const gitHash = await fetchTextData(GIT_HASH_URL, 'Could not find current version or git hash');
        gitHashCache = gitHash;
        return gitHash;
      } catch (e) {
        console.error(e);
        throw new Error(`Unsuccessful git hash fetch`);
      }
    },
    resetGitHashCache: () => {
      gitHashCache = '';
    },
  };
};

const { fetchGitHash, resetGitHashCache } = createFetchGitHash();

interface AtlasSpecUrlParams {
  apiKeyword: string;
  apiVersion?: string;
  resourceVersion?: string;
}

const ensureSavedVersionDataMatches = (versions: VersionData, apiVersion?: string, resourceVersion?: string) => {
  // Check that requested versions are included in saved version data
  if (apiVersion) {
    if (!versions.major.includes(apiVersion) || (resourceVersion && !versions[apiVersion].includes(resourceVersion))) {
      throw new Error(`Last successful build data does not include necessary version data:\n
      Version requested: ${apiVersion}${resourceVersion ? ` - ${resourceVersion}` : ``}`);
    }
  }
};

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
  let successfulGitHash = true;

  try {
    const gitHash = await fetchGitHash();
    oasFileURL = `${OAS_FILE_SERVER}${gitHash}${versionExtension}.json`;

    // Sometimes the latest git hash might not have a fully available spec file yet.
    // If this is the case, we should default to using the last successfully saved
    // hash in our database.
    await fetchTextData(oasFileURL, `Error fetching data from ${oasFileURL}`);
  } catch (e) {
    const unsuccessfulOasFileURL = oasFileURL;
    successfulGitHash = false;

    const res = await findLastSavedVersionData(apiKeyword);
    if (res) {
      ensureSavedVersionDataMatches(res.versions, apiVersion, resourceVersion);
      oasFileURL = `${OAS_FILE_SERVER}${res.gitHash}${versionExtension}.json`;
      console.log(`Error occurred fetching from newest OAS spec at ${unsuccessfulOasFileURL}.\n
      This error is a rare but expected result of upload timing between gitHashes and specs.\n
      If you see this error multiple times, let the DOP team know!\n\n
      Using last successfully fetched OAS spec at ${oasFileURL}!`);
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

    let versionOptions: RedocVersionOptions | undefined;

    if (resourceVersions && resourceVersions.length > 0 && apiVersion) {
      const rootUrl = normalizeUrl(`${siteUrl}/${pageSlug}`);

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
            resourceVersion,
          },
          rootUrl,
          resourceVersions,
        };
      }
    }

    await redocExecutor.execute(spec, finalFilename, buildOptions, versionOptions);
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
  const redocExecutor = new RedocExecutor(redocPath, siteUrl, siteTitle);

  for (const [pageSlug, data] of entries) {
    let totalSuccess = true;
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
          siteUrl,
          resourceVersions,
        });

        if (!isSuccessfulBuild) totalSuccess = false;
      }
    }

    // apiVersion can be undefined, this case is handled within the getOASpec function
    // resourceVersions can also be undefined, but again, this is handled within the getOASpec function
    const isSuccessfulBuild = await getOASpec({
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
    if (!isSuccessfulBuild) totalSuccess = false;
    // If all builds successful, persist git hash and version data in db
    if (totalSuccess && sourceType == 'atlas') {
      try {
        const gitHash = await fetchGitHash();
        const versions = await fetchVersionData(gitHash);
        await saveSuccessfulBuildVersionData(source, gitHash, versions);
      } catch (e) {
        console.error(e);
      }
    }
    resetGitHashCache();
  }
};
