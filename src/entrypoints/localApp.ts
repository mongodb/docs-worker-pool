import { executeCliCommand, getRepoDir } from '../commands/src/helpers';
import { nextGenParse } from '../commands/src/shared/next-gen-parse';
import { nextGenHtml } from '../commands/src/shared/next-gen-html';
import { getCliBuildDependencies } from '../commands/src/helpers/execution-helper';
import { nextGenStage } from '../commands/src/shared/next-gen-stage';
import { oasPageBuild } from '../commands/src/shared/oas-page-build';
import { persistenceModule } from '../commands/src/shared/persistence-module';

async function localApp() {
  const repoName = 'docs-java';
  const projectName = 'java';
  const baseUrl = 'https://www.mongodb.com';
  const repoDir = getRepoDir(repoName);

  // mocking out the clone aspect of a job
  await executeCliCommand({
    command: 'git',
    args: ['clone', `https://github.com/mongodb/${repoName}`],
    options: { cwd: `${process.cwd()}/repos` },
  });

  const { commitHash, patchId, bundlePath } = await getCliBuildDependencies(repoDir, projectName, baseUrl);

  console.log('Hello');

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
  const mutPrefix = 'docs';
  const siteUrl = mutPrefix ? `${baseUrl}/${mutPrefix}` : `${baseUrl}`;
  const oasPageBuildRes = await oasPageBuild({ repoDir, bundlePath, siteUrl });
  console.log('oas-page-build compelte');

  console.log(oasPageBuildRes);
  console.log('Begin next-gen-stage...');

  const resultMessage = await nextGenStage({
    repoDir,
    projectName,
    bucketName: 'docs-mongodb-org-stg',
    url: baseUrl,
    mutPrefix,
  });
  console.log(resultMessage);
  console.log('Begin next-gen-stage complete');
  console.log(process.env);
}

localApp();
