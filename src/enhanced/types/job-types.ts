export type JobType = 'githubPush' | 'manifestGeneration' | 'productionDeploy' | 'regression';

export interface JobsQueuePayload {
  jobId: string;
}
