interface DirectoryConfig {
  snooty_toml?: string;
  source?: string;
}

interface RepoConfig {
  repoName: string;
  deployable: boolean;
  branches: BranchConfig[];
}

interface BranchConfig {
  gitBranchName: string;
}

// TODO: Populate these more. For DOP-3911, they are
// being added for testing purposes.
export interface DocSetEntry {
  project: string;
  prefix: string;
  bucket: string;
  url: string;
  directories?: DirectoryConfig;
  repos?: RepoConfig[];
}
