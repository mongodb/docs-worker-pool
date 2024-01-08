import { Octokit } from '@octokit/rest';

let client: Octokit;

export function getOctokitClient(password?: string): Octokit {
  if (client) return client;

  try {
    const GITHUB_BOT_PASSWORD = process.env.GITHUB_BOT_PASSWORD ?? password;

    if (!GITHUB_BOT_PASSWORD) throw new Error('GITHUB_BOT_PASSWORD is not defined');

    client = new Octokit({ auth: GITHUB_BOT_PASSWORD });
    return client;
  } catch (error) {
    console.error('ERROR! Failed to create Octokit client. Is GITHUB_BOT_PASSWORD defined?', error);
    throw error;
  }
}
