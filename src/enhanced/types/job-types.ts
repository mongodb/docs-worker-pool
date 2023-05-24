export type JobType = 'githubPush' | 'manifestGeneration' | 'productionDeploy' | 'regression';

export interface JobsQueuePayload {
  jobType: string;
  source: string;
  action: string;
  repoName: string;
  branchName: string;
  url: string;
  isFork: boolean;
  repoOwner: string;
  stable?: string;
  primaryAlias?: boolean;
  project?: string;
  prefix?: string;
  urlSlug?: string;
  private?: boolean;
  aliased?: boolean;
  newHead?: string | null;
  isXlarge?: boolean;
  patch?: string;
  alias?: string;
  manifestPrefix?: string;
  pathPrefix?: string;
  mutPrefix?: string;
}
