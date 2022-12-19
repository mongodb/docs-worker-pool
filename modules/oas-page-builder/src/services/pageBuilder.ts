import fetch from 'node-fetch';
import { ModuleOptions } from '../types';
import { normalizePath } from '../utils/normalizePath';
import { execRedoc } from './commandExecutor';
import { findLastSavedGitHash } from './database';
import { OASPageMetadata } from './types';

const OAS_FILE_SERVER = 'https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/';

const fetchTextData = async (url: string, errMsg: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Error should be caught when creating pages.
    throw new Error(`${errMsg}; ${res.statusText}`);
  }
  return res.text();
};

const getOASFileUrl = (gitHash: string) => `${OAS_FILE_SERVER}${gitHash}.json`;

const getAtlasSpecUrl = async (apiKeyword: string) => {
  // Currently, the only expected API fetched programmatically is the Cloud Admin API,
  // but it's possible to have more in the future with varying processes.
  const keywords = ['cloud'];
  if (!keywords.includes(apiKeyword)) {
    throw new Error(`${apiKeyword} is not a supported API for building.`);
  }

  let oasFileURL;
  try {
    const versionURL = 'https://cloud.mongodb.com/version';
    const gitHash = await fetchTextData(versionURL, 'Could not find current version or git hash');
    oasFileURL = getOASFileUrl(gitHash);

    // Sometimes the latest git hash might not have a fully available spec file yet.
    // If this is the case, we should default to using the last successfully saved
    // hash in our database.
    await fetchTextData(oasFileURL, `Error fetching data from ${oasFileURL}`);
  } catch (e) {
    console.error(e);

    const res = await findLastSavedGitHash(apiKeyword);
    if (res) {
      oasFileURL = getOASFileUrl(res.gitHash);
      console.log(`Using ${oasFileURL}`);
    } else {
      throw new Error(`Could not find a saved hash for API: ${apiKeyword}`);
    }
  }

  return oasFileURL;
};

export const buildOpenAPIPages = async (
  entries: [string, OASPageMetadata][],
  { output, redoc: redocPath, repo: repoPath, 'site-url': siteUrl }: ModuleOptions
) => {
  for (const [pageSlug, data] of entries) {
    const { source_type: sourceType, source } = data;

    try {
      let spec = '';

      if (sourceType === 'url') {
        spec = source;
      } else if (sourceType === 'local') {
        const localFilePath = normalizePath(`${repoPath}/source/${source}`);
        spec = localFilePath;
      } else if (sourceType === 'atlas') {
        spec = await getAtlasSpecUrl(source);
      } else {
        throw new Error(`Unsupported source type "${sourceType}" for ${pageSlug}`);
      }

      const finalFilename = normalizePath(`${output}/${pageSlug}/index.html`);
      await execRedoc(spec, finalFilename, redocPath, siteUrl);
    } catch (e) {
      console.error(e);
      // Continue to try to build other pages since it's possible that mut will
      // still upload existing HTML files
      continue;
    }
  }
};
