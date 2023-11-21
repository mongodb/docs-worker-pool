import { getOctokitClient } from '../../../../clients/githubClient';
import { CliCommandResponse, executeCliCommand } from '../../helpers';
import { getArgs } from './utils/get-args';

const getDockerBuild = (npmAuth: string) =>
  executeCliCommand({
    command: 'docker',
    args: [
      'buildx',
      'build',
      '--file',
      'Dockerfile.local',
      '.',
      '--build-arg',
      `NPM_BASE_64_AUTH=${npmAuth}`,
      '--build-arg',
      'NPM_EMAIL=docs-platform',
      '-t',
      'autobuilder/local:latest',
    ],
  });

async function main() {
  const npmAuth = 'TODO';
  const client = getOctokitClient();

  const { repoName, repoOwner, branchName, rebuild } = getArgs();

  const commitPromise = client.request('GET /repos/{owner}/{repo}/commits/{ref}', {
    owner: repoOwner,
    repo: repoName,
    ref: branchName,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const promises: [typeof commitPromise, Promise<CliCommandResponse> | undefined] = [commitPromise, undefined];
  if (rebuild) {
    const buildPromise = getDockerBuild(npmAuth);
    promises[1] = buildPromise;
  }

  const [commit] = await Promise.all(promises);
}

main();
