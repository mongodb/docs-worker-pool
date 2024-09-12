import * as c from 'config';
import * as mongodb from 'mongodb';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { markBuildArtifactsForDeletion, validateJsonWebhook } from '../../handlers/github';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';
import { ReposBranchesDocsetsDocument } from '../../../modules/persistence/src/services/metadata/repos_branches';
import { PushEvent } from '@octokit/webhooks-types';
import { APIGatewayProxyResult } from 'aws-lambda';

async function prepGithubPushPayload(
  githubEvent: any,
  repoBranchesRepository: RepoBranchesRepository,
  prefix: string,
  repoInfo: ReposBranchesDocsetsDocument
) {
  const branch_name = githubEvent.ref.split('/')[2];
  const branch_info = await repoBranchesRepository.getRepoBranchAliases(
    githubEvent.repository.name,
    branch_name,
    repoInfo.project
  );
  const urlSlug = branch_info.aliasObject?.urlSlug ?? branch_name;
  const project = repoInfo?.project ?? githubEvent.repository.name;

  return {
    title: githubEvent.repository.full_name,
    user: githubEvent.pusher.name,
    email: githubEvent.pusher.email,
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    buildDepsExeStartTime: 0,
    buildDepsExeEndTime: 0,
    parseExeStartTime: 0,
    parseExeEndTime: 0,
    htmlExeStartTime: 0,
    htmlExeEndTime: 0,
    oasPageBuildExeStartTime: 0,
    oasPageBuildExeEndTime: 0,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: githubEvent.repository.name,
      branchName: githubEvent.ref.split('/')[2],
      isFork: githubEvent.repository.fork,
      isXlarge: true,
      repoOwner: githubEvent.repository.owner.login,
      url: githubEvent.repository.clone_url,
      newHead: githubEvent.after,
      urlSlug: urlSlug,
      prefix: prefix,
      project: project,
    },
    logs: [],
  };
}

export const TriggerBuild = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/plain' },
    body: 'The Autobuilder is currently disabled for staging. Please use Netlify instead.',
  };
};
export const MarkBuildArtifactsForDeletion = markBuildArtifactsForDeletion;
