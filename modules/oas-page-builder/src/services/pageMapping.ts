import { OASPageMapping, OASPageMetadata } from './types';

const fetchTextData = async (url: string, errMsg: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Error should be caught when creating pages.
    throw new Error(`${errMsg}; ${res.statusText}`);
  }
  return res.text();
};

const getOASFileUrl = (gitHash: string) =>
  `https://mongodb-mms-prod-build-server.s3.amazonaws.com/openapi/${gitHash}.json`;

const getAtlasSpecUrl = async (apiKeyword: string) => {
  // Currently, the only expected API fetched programmatically is the Cloud Admin API,
  // but it's possible to have more in the future with varying processes.
  if (apiKeyword !== 'cloud') {
    throw new Error(`${apiKeyword} is not a supported API for building.`);
  }

  let oasFileURL;
  try {
    const versionURL = 'https://cloud.mongodb.com/version';
    const gitHash = await fetchTextData(versionURL, 'Could not find current version or git hash.');
    oasFileURL = getOASFileUrl(gitHash);

    // Sometimes the latest git hash might not have a fully available spec file yet.
    // If this is the case, we should default to using the last saved hash in our database.
    await fetchTextData(oasFileURL, `Error fetching data from ${oasFileURL}.`);
  } catch (e) {
    console.warn(e);

    const lastSavedHash = '';
    // If the spec at the new URL still does not exist, then Redoc should throw a build error
    oasFileURL = getOASFileUrl(lastSavedHash);
  }

  return oasFileURL;
};

export const constructOpenAPIPageMapping = async (entries: [string, OASPageMetadata][]) => {
  const mapping: OASPageMapping = {};

  for (const [slug, data] of entries) {
    const { source_type: sourceType, source } = data;

    if (sourceType === 'url' || sourceType === 'local') {
      // mapping[slug] = await createSerializedStore(source);
      mapping[slug] = source;
    } else if (sourceType === 'atlas') {
      mapping[slug] = await getAtlasSpecUrl(source);
    }
  }

  return mapping;
};
