import AdmZip from 'adm-zip';
import { upsert } from '../connector';

const COLLECTION_NAME = 'assets';

// Service responsible for upsertion of any image or blob assets.

const assetsFromZip = (zip: AdmZip) => {
  const assets = zip.getEntries();
  return assets
    .filter((entry) => entry.entryName?.startsWith('assets/'))
    .map((entry) => ({ _id: entry.entryName.replace('assets/', ''), data: entry.getData() }));
};

export const upsertAssets = async (zip: AdmZip) => {
  try {
    const assets = await assetsFromZip(zip);
    return Promise.all(assets.map((asset) => upsert(asset, COLLECTION_NAME, asset._id)));
  } catch (error) {
    console.error(`Error at upsertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};
