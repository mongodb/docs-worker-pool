import {
  nextGenDeploy,
  nextGenHtml,
  nextGenParse,
  nextGenStage,
  oasPageBuild,
  persistenceModule,
  prepareBuildAndGetDependencies,
} from '../commands';
import { Payload } from '../entities/job';

const fakePayload: Payload = {
  repoName: 'cloud-docs',
  project: 'cloud-docs',
  // directory: 'cloud-docs',
  jobType: '',
  source: '',
  action: '',
  branchName: 'mmeigs-build', // mm-build??
  isFork: false,
  repoOwner: '10gen',
  url: 'https://github.com/10gen/cloud-docs', // ???
  mutPrefix: 'docs-qa/atlas/mmeigs-build',
  prefix: '',
  includeInGlobalSearch: true,
} as Payload;
// Bucket??

async function localApp() {
  const baseUrl = 'https://mongodbcom-cdn.website.staging.corp.mongodb.com';
  const bucket = 'docs-atlas-dotcomstg';

  const { repoName, project, mutPrefix, directory } = fakePayload;

  // const repoName = 'docs-java';
  // const project = 'java';
  // const baseUrl = 'https://docs-mongodbcom-staging.corp.mongodb.com/';
  // const bucket = 'docs-java-dotcomstg';
  // const mutPrefix = 'java'
  // const repoName = 'cloud-docs';
  // const project = 'cloud-docs';
  // const baseUrl = 'https://docs-mongodbcom-staging.corp.mongodb.com';
  // const bucket = 'docs-atlas-dotcomstg';
  // const mutPrefix = 'docs-qa/atlas'

  const { commitHash, patchId, bundlePath, commitBranch, hasRedirects, repoDir } = await prepareBuildAndGetDependencies(
    repoName,
    project,
    baseUrl,
    directory
  );

  console.log('repoDir ', repoDir);

  console.log('Begin snooty build...');
  // const snootyBuildRes = await nextGenParse({ repoDir, commitHash, patchId });

  // console.log(snootyBuildRes.errorText);

  console.log('snooty build complete');

  console.log('Begin persistence-module');
  // const persistenceModuleRes = await persistenceModule({ bundlePath });
  // console.log(persistenceModuleRes);
  console.log('persistence-module complete');

  console.log('Begin next-gen-html...');

  // const nextGenHtmlRes = await nextGenHtml();
  // console.log(nextGenHtmlRes.outputText);

  console.log('next-gen-html complete');

  console.log('Begin oas-page-build...');
  const siteUrl = mutPrefix ? `${baseUrl}/${mutPrefix}` : `${baseUrl}`;
  console.log('siteUrl: ', siteUrl);
  // const oasPageBuildRes = await oasPageBuild({ repoDir, bundlePath, siteUrl });
  console.log('oas-page-build compelte');

  // console.log(oasPageBuildRes);
  console.log('Begin next-gen-stage...');

  // const {resultMessage, commands} = await nextGenStage({
  //   patchId,
  //   commitBranch,
  //   repoDir,
  //   projectName: project,
  //   bucket,
  //   url: baseUrl,
  //   mutPrefix: mutPrefix || '',
  //   commitHash,
  // });
  // console.log(resultMessage);
  console.log('next-gen-stage complete');

  console.log('Begin next-gen-deploy...');
  // const deployRes = await nextGenDeploy({
  //   bucket,
  //   hasConfigRedirects: hasRedirects,
  //   gitBranch: commitBranch,
  //   mutPrefix: mutPrefix || '',
  //   url: baseUrl,
  // });
  // console.log(deployRes);
  console.log('next-gen-deploy complete');
  // console.log('commands: ', commands)
  console.log('bundle Path: ', bundlePath);
}

localApp();
