import { EnhancedJob, JobStatus } from '../../../../../entities/job';
import { CommitGetResponse } from './types';

interface Props {
  branchName: string;
  repoOwner: string;
  repoName: string;
  commit: CommitGetResponse;
}

export function createLocalJob({ branchName, repoName, repoOwner, commit }: Props): Omit<EnhancedJob, '_id'> {
  return {
    title: `${repoOwner}/${repoName}`,
    user: commit.author?.name ?? '',
    email: commit.author?.email ?? '',
    status: JobStatus.inQueue,
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    pathPrefix: `${repoName}/docsworker-xlarge/${branchName}`,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName,
      branchName,
      isFork: repoName !== '10gen' && repoName !== 'mongodb',
      repoOwner,
      url: commit.url,
      newHead: commit.sha,
      urlSlug: branchName,
      prefix: '', // empty string for now
      project: repoName, // Needs to get the project rather than repo name
      pathPrefix: `${repoName}/docsworker-xlarge/${branchName}`,
    },
    logs: [],
  };
}
