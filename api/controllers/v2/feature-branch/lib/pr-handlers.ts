import { OCTOKIT_DEFAULT_HEADERS, getOctokitClient } from '../../../../utils/octokit-client';

export const DOCS_WORKER_POOL_REPO_NAME = 'docs-worker-pool';
export const MONGODB_ORG_NAME = 'mongodb';

const DEFAULT_OPTIONS = {
  owner: MONGODB_ORG_NAME,
  repo: DOCS_WORKER_POOL_REPO_NAME,
  headers: OCTOKIT_DEFAULT_HEADERS,
};
const client = getOctokitClient();

export async function checkIfUserIsDocsCollaborator(username: string): Promise<boolean> {
  try {
    await client.request('GET /repos/{owner}/{repo}/collaborators/{username}', {
      ...DEFAULT_OPTIONS,
      username,
    });

    // if no error is thrown, the user is a collaborator
    return true;
  } catch (error) {
    console.error('User not a collaborator: ', error);
    return false;
  }
}

export async function checkIfPrExistsForBranch(username: string, branch: string): Promise<boolean> {
  try {
    await client.request('GET /repos/{owner}/{repo}/pulls', {
      ...DEFAULT_OPTIONS,
      head: `${username}:${branch}`,
      base: 'master',
    });

    return true;
  } catch (error) {
    console.error('The PR does not exist for the given username and branch: ', error);
    return false;
  }
}
export async function executeFeatureWorkflow(workflowId: string, branch: string): Promise<void> {
  await client.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
    ...DEFAULT_OPTIONS,
    ref: branch,
    workflow_id: workflowId,
    inputs: {},
  });
}
