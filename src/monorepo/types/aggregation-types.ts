// Types to narrow matchCondition arguments for Docset aggregations
type DirectoriesKey = 'snooty_toml';
type RepoBranchesKey = 'project' | 'branches' | 'repoName' | `directories.${DirectoriesKey}`;

export type MatchCondition = { [key in RepoBranchesKey]+?: string };
export type Projection = { [key in RepoBranchesKey]+?: number };
