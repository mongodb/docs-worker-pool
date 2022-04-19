// TODO: Cut down on null and undefined type definition allowances

export enum JobStatus {
  inQueue = 'inQueue',
  inProgress = 'inProgress',
  completed = 'completed',
  failed = 'failed',
}

// TODO: Formalize JobTypes
// export enum JobType {
//   githubPush = 'githubPush',
//   manifestGeneration = 'manifestGeneration',
//   productionDeploy = 'productionDeploy',
//   regression = 'regression',
// }

export type Payload = {
  jobType: string;
  source: string;
  action: string;
  repoName: string;
  branchName: string;
  isFork: boolean;
  private: boolean;
  isXlarge: boolean | null | undefined;
  repoOwner: string;
  url: string;
  newHead: string | null | undefined;
  patch: string | null | undefined;
  alias: string | null | undefined;
  manifestPrefix: string | undefined;
  pathPrefix: string | null | undefined;
  mutPrefix: string | null | undefined;
  aliased: boolean | null | undefined;
  primaryAlias: string | null | undefined;
  repoBranches: any;
  stable: string | null | undefined;
  isNextGen: boolean | null | undefined;
  regression: boolean | null | undefined;
  urlSlug: string | null | undefined;
  prefix: string;
  project: string;
  includeInGlobalSearch: boolean;
};

// TODO: Instead of "or undefined", make fields Optional
export type Job = {
  _id: string;
  payload: Payload;
  createdTime: Date;
  endTime: Date | null | undefined;
  error: any | null | undefined;
  logs: string[] | null | undefined;
  priority: number | null | undefined;
  result: any | null | undefined;
  startTime: Date;
  status: JobStatus | null;
  title: string;
  user: string;
  manifestPrefix: string | undefined;
  pathPrefix: string | null | undefined;
  mutPrefix: string | null | undefined;
  buildCommands: string[];
  deployCommands: string[];
  email: string; // probably can be removed
  comMessage: string[] | null | undefined;
  purgedUrls: string[] | null | undefined;
  shouldGenerateSearchManifest: boolean;
};
