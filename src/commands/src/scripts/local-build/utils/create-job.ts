import { EnhancedJob, JobStatus } from '../../../../../entities/job';
import { CommitGetResponse } from './types';

interface Props {
  branchName: string;
  repoOwner: string;
  repoName: string;
  commit: CommitGetResponse;
  project: string;
  directory?: string;
}

export function createLocalJob({
  branchName,
  repoName,
  repoOwner,
  commit,
  project,
  directory,
}: Props): Omit<EnhancedJob & { isLocal: boolean }, '_id'> {
  return {
    isLocal: true,
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
    pathPrefix: `${project}/testingRelease6/docsworker-xlarge/${branchName}`,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName,
      branchName,
      isFork: repoOwner !== '10gen' && repoOwner !== 'mongodb',
      repoOwner,
      url: commit.url,
      newHead: commit.sha,
      urlSlug: branchName,
      prefix: '',
      project: 'testingRelease3',
      pathPrefix: `${project}/docsworker-xlarge/${branchName}`,
      mutPrefix: 'testingRelease2',
      directory: directory,
    },
    logs: [],
  };
}
