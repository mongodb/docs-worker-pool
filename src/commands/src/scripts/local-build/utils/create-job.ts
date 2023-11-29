import { RestEndpointMethodTypes } from '@octokit/rest';
import { JobStatus } from '../../../../../entities/job';

type CommitGetResponse = RestEndpointMethodTypes['git']['getCommit']['response']['data'];

interface Props {
  branchName: string;
  repoOwner: string;
  repoName: string;
  commit: CommitGetResponse;
}

export function prepGithubPushPayload({ branchName, repoName, repoOwner, commit }: Props) {
  const { name, email } = commit.author;
  return {
    title: `${repoOwner}/${repoName}`,
    user: name,
    email: email ?? '',
    status: JobStatus.inQueue,
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
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
      project: repoName,
    },
    logs: [],
  };
}
