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

export interface IPayload {
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
}

// TODO: Restrict jobTypes, a la JobStatus
export interface IJob {
  _id: string;
  payload: IPayload;
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
  // TODO: Remove extraneous prefixes (duplicate of payload)
  manifestPrefix: string | undefined;
  pathPrefix: string | null | undefined;
  mutPrefix: string | null | undefined;
  buildCommands: string[];
  deployCommands: string[];
}

export type BuildJob = IJob & {
  email: string; // probably can be removed
  comMessage: string[] | null | undefined;
  purgedUrls: string[] | null | undefined;
};

// ManifestJob represents the creation of the search manifest, which is kicked off
// in the execute() function of JobHandler.
export type ManifestJob = IJob;
