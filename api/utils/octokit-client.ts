import { Octokit } from '@octokit/rest';
import c from 'config';
let octokitClient: Octokit;

export const OCTOKIT_DEFAULT_HEADERS = {
  'X-GitHub-Api-Version': '2022-11-28',
};

export function getOctokitClient(): Octokit {
  if (octokitClient) return octokitClient;

  const githubToken = c.get<string>('githubBotPW');

  octokitClient = new Octokit({
    auth: githubToken,
  });

  return octokitClient;
}
