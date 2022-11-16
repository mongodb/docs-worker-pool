// Model for documents in the "oas_files" collection.
export interface OASFile {
  api: string;
  fileContent: string;
  gitHash: string;
}

export type OASFileGitHash = Pick<OASFile, 'gitHash'>;
