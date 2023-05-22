import AdmZip from 'adm-zip';
import { bulkUpsertAll } from '../connector';

const COLLECTION_NAME = 'assets';

// Service responsible for upsertion of any image or blob assets.

const assetsFromZip = (zip: AdmZip) => {
  const assets = zip.getEntries();
  return assets
    .filter((entry) => entry.entryName?.startsWith('assets/'))
    .map((entry) => ({ _id: entry.entryName.replace('assets/', ''), data: entry.getData() }));
};

export const upsertAssets = async (zip: AdmZip) => {
  const timerLabel = 'asset upsertion';
  console.time(timerLabel);
  try {
    const assets = assetsFromZip(zip);
    const res = await bulkUpsertAll(assets, COLLECTION_NAME);
    return res;
  } catch (error) {
    console.error(`Error at upsertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  } finally {
    console.timeEnd(timerLabel);
  }
};
