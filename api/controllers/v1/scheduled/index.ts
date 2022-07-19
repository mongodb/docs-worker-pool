import { DeployRepo } from "./utils";
import { options as docsLandingOptions } from './repos/docs-landing';

export const DeployDocsLanding = async () => {
    const { branches, repoName, repoOwner } = docsLandingOptions;
    Promise.all(branches.map(branch => {
            return DeployRepo(repoOwner, repoName, branch)
        })
    )

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
      };
}