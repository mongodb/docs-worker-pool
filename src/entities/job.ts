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
  stable: boolean | null | undefined;
  isNextGen: boolean | null | undefined;
  regression: boolean | null | undefined;
  urlSlug: string | null | undefined;
  prefix: string;
  project: string;
  includeInGlobalSearch: boolean;
};

export type EnhancedPayload = {
  jobType: string;
  source: string;
  action: string;
  repoName: string;
  branchName: string;
  isFork: boolean;
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
  stable?: boolean | null;
  isNextGen?: boolean | null;
  repoBranches?: any;
  regression?: boolean | null;
  urlSlug?: string | null;
  prefix: string;
  project: string;
  includeInGlobalSearch?: boolean;
};

export type Job = {
  _id: string;
  useWithBenchmark?: boolean;
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
  invalidationStatusURL: string | null | undefined;
  email: string; // probably can be removed
  comMessage: string[] | null | undefined;
  purgedUrls: string[] | null | undefined;
  shouldGenerateSearchManifest: boolean;
};

export type EnhancedJob = {
  _id: string;
  useWithBenchmark?: boolean;
  payload: EnhancedPayload;
  createdTime: Date;
  endTime: Date | null | undefined;
  error?: any;
  logs: string[] | null | undefined;
  priority: number | null | undefined;
  result?: any;
  startTime: Date | null;
  status: JobStatus | null;
  title: string;
  user: string;
  manifestPrefix?: string | null;
  pathPrefix?: string | null;
  mutPrefix?: string | null;
  buildCommands?: string[];
  deployCommands?: string[];
  invalidationStatusURL?: string | null;
  email: string | null; // probably can be removed
  comMessage?: string[] | null;
  purgedUrls?: string[] | null;
  shouldGenerateSearchManifest?: boolean;
};
