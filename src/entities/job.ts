// TODO: Cut down on null and undefined type definition allowances, with Optional
// TODO: Remove duplicate defintions from Payload and Job, (e.g. prefixes)

export enum JobStatus {
  inQueue = 'inQueue',
  inProgress = 'inProgress',
  completed = 'completed',
  failed = 'failed',
  timedOut = 'timedOut',
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
  isXlarge?: boolean | null;
  repoOwner: string;
  url: string;
  newHead?: string | null;
  patch?: string | null;
  alias?: string | null;
  manifestPrefix?: string;
  pathPrefix?: string | null;
  mutPrefix?: string | null;
  aliased?: boolean | null;
  primaryAlias?: string | null;
  repoBranches?: any;
  stable?: boolean | null;
  isNextGen?: boolean | null;
  regression?: boolean | null;
  urlSlug?: string | null;
  prefix: string;
  project: string;
  includeInGlobalSearch?: boolean;
};

export type Job = {
  _id: string;
  payload: Payload;
  createdTime: Date;
  endTime?: Date | null;
  error?: any;
  logs?: string[] | null;
  priority?: number;
  result?: any;
  startTime: Date | null;
  status: JobStatus | null;
  title: string;
  user: string;
  manifestPrefix?: string;
  pathPrefix?: string | null;
  mutPrefix?: string | null;
  buildCommands?: string[];
  deployCommands?: string[];
  invalidationStatusURL?: string | null;
  email: string; // probably can be removed
  comMessage?: string[] | null;
  purgedUrls?: string[] | null;
  shouldGenerateSearchManifest?: boolean;
};
