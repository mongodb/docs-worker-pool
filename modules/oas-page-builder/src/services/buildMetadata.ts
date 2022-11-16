import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { OASPagesMetadata } from './types';

export const getOASMetadata = (bundlePath: string): OASPagesMetadata | null => {
  const zip = new AdmZip(bundlePath);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    if (entry.entryName === 'site.bson') {
      const buildMetadata = deserialize(entry.getData());
      const oasMetadata: OASPagesMetadata = buildMetadata['openapi_pages'];
      if (!!oasMetadata) return oasMetadata;
    }
  }

  return null;
};
