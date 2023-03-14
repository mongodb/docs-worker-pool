// Model for documents in the "oas_files" collection.

interface VersionData {
  [k: string]: string[];
}

export interface OASFile {
  api: string;
  fileContent: string;
  gitHash: string;
  lastUpdated: string;
  versions: VersionData;
}

export type OASFilePartial = Pick<OASFile, 'gitHash' | 'versions'>;
