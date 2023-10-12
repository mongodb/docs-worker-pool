import {
  nextGenDeploy,
  nextGenHtml,
  nextGenParse,
  nextGenStage,
  oasPageBuild,
  persistenceModule,
  prepareBuildAndGetDependencies,
} from '../commands';

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
