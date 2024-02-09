import { EnhancedJob, JobStatus } from '../../../../../entities/job';
import { CommitGetResponse } from './types';

export const JOB_TYPES = ['githubPush', 'productionDeploy', 'manifestGeneration', 'regression'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const isValidJobType = (val: string): val is JobType => JOB_TYPES.includes(val as JobType);
interface Props {
  branchName: string;
  repoOwner: string;
  repoName: string;
  commit: CommitGetResponse;
  project: string;
  jobType: JobType;
  directory?: string;
}

export function createLocalJob({
  branchName,
  repoName,
  repoOwner,
  commit,
  project,
  directory,
  jobType,
}: Props): Omit<EnhancedJob & { isLocal: boolean }, '_id'> {
  return {
    isLocal: true,
    title: `${repoOwner}/${repoName}`,
    user: commit.author?.name ?? 'branberry',
    email: commit.author?.email ?? '',
    status: JobStatus.inQueue,
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    pathPrefix: `${project}/docsworker-xlarge/${branchName}`,
    payload: {
      jobType: jobType,
      source: 'local',
      action: 'debug',
      repoName,
      branchName,
      isFork: repoOwner !== '10gen' && repoOwner !== 'mongodb',
      repoOwner,
      url: commit.url,
      newHead: commit.sha,
      urlSlug: branchName,
      prefix: '',
      project: project,
      pathPrefix: `${project}/docsworker-xlarge/${branchName}`,
      mutPrefix: project,
      directory: directory,
    },
    logs: [],
  };
}
