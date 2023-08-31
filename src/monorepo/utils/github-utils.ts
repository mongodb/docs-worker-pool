import { getOctokitClient } from '../../clients/githubClient';
import { MONOREPO_NAME, SNOOTY_TOML_FILENAME } from './monorepo-constants';
import toml from 'toml';

interface GetProjectNameProps {
  snootyTomlPath: string;
  repoOwner: string;
}
export async function getProjectName({ repoOwner, snootyTomlPath }: GetProjectNameProps) {
  try {
    const client = getOctokitClient();

    const { data } = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
      repo: MONOREPO_NAME,
      owner: repoOwner,
      path: `${snootyTomlPath}/${SNOOTY_TOML_FILENAME}`,
    });

    if (!data || !('content' in data))
      throw new Error(
        `ERROR! No content found for the following snooty.toml file: ${snootyTomlPath}/${SNOOTY_TOML_FILENAME}`
      );

    const snootyTomlString = Buffer.from(data.content, 'base64').toString('utf8');
    const projectName = toml.parse(snootyTomlString).name;

    return projectName;
  } catch (error) {}
}
