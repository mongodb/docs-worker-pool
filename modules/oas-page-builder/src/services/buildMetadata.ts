import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { BuildMetadata, OASPagesMetadata } from './types';

export const getOASMetadata = (bundlePath: string): BuildMetadata | null => {
  const zip = new AdmZip(bundlePath);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    if (entry.entryName === 'site.bson') {
      const buildMetadata = deserialize(entry.getData());
      const siteTitle: string = buildMetadata['title'];
      const oasMetadata: OASPagesMetadata | undefined = buildMetadata['openapi_pages'];
      if (!!oasMetadata && siteTitle) {
        return {
          siteTitle,
          openapiPages: oasMetadata,
        };
      }
    }
  }

  return null;
};
