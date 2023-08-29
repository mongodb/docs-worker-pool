import { Octokit } from '@octokit/rest';
import c from 'config';

let client: Octokit;

export function getOctokitClient(): Octokit {
  if (client) return client;

  try {
    // since c.get can throw, catching so we can
    // more accurately log the error
    const githubToken = c.get<string>('githubBotPW');

    client = new Octokit({ auth: githubToken });
    return client;
  } catch (error) {
    console.error('ERROR! Failed to create Octokit client. Is GITHUB_BOT_PASSWORD defined?', error);
    throw error;
  }
}
