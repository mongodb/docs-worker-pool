// Model for documents in the "oas_files" collection.

// interface VersionData {
//   [k: string]: string[];
// }

export interface OASFile {
  api: string;
  fileContent: string;
  gitHash: string;
}

export type OASFileGitHash = Pick<OASFile, 'gitHash'>;
