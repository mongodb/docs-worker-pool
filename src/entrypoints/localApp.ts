import { nextGenParse } from '../commands/src/shared/next-gen-parse';
import { nextGenHtml } from '../commands/src/shared/next-gen-html';
import { prepareBuildAndGetDependencies } from '../commands/src/helpers/dependency-helpers';
import { nextGenStage } from '../commands/src/shared/next-gen-stage';
import { oasPageBuild } from '../commands/src/shared/oas-page-build';
import { persistenceModule } from '../commands/src/shared/persistence-module';
import { nextGenDeploy } from '../commands/src/shared/next-gen-deploy';

async function localApp() {
  // TODO: Fetch this from repos_branches
  const repoName = 'docs-java';
  const projectName = 'java';
  const baseUrl = 'https://www.mongodb.com';
  const bucket = 'docs-java-dotcomstg';
  const mutPrefix = 'docs/drivers/java/sync';

  const { commitHash, patchId, bundlePath, commitBranch, hasRedirects, repoDir } = await prepareBuildAndGetDependencies(
    repoName,
    projectName,
    baseUrl
  );

  console.log('Begin snooty build...');
  const snootyBuildRes = await nextGenParse({ repoDir, commitHash, patchId });

  console.log(snootyBuildRes.errorText);

  console.log('snooty build complete');

  console.log('Begin persistence-module');
  const persistenceModuleRes = await persistenceModule({ bundlePath });
  console.log(persistenceModuleRes);
  console.log('persistence-module complete');

  console.log('Begin next-gen-html...');

  const nextGenHtmlRes = await nextGenHtml();
  console.log(nextGenHtmlRes.outputText);

  console.log('next-gen-html complete');

  console.log('Begin oas-page-build...');
  const siteUrl = mutPrefix ? `${baseUrl}/${mutPrefix}` : `${baseUrl}`;
  const oasPageBuildRes = await oasPageBuild({ repoDir, bundlePath, siteUrl });
  console.log('oas-page-build compelte');

  console.log(oasPageBuildRes);
  console.log('Begin next-gen-stage...');

  const resultMessage = await nextGenStage({
    patchId,
    commitBranch,
    repoDir,
    projectName,
    bucket,
    url: baseUrl,
    mutPrefix,
  });
  console.log(resultMessage);
  console.log('next-gen-stage complete');

  console.log('Begin next-gen-deploy...');
  const deployRes = await nextGenDeploy({
    bucket,
    hasConfigRedirects: hasRedirects,
    gitBranch: commitBranch,
    mutPrefix,
    url: baseUrl,
  });
  console.log(deployRes);
  console.log('next-gen-deploy complete');
}

localApp();
