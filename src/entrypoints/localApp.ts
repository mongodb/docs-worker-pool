import path from 'path';
import { executeCliCommand } from '../commands/src/helpers';
import { nextGenParse } from '../commands/src/shared/next-gen-parse';
import { nextGenHtml } from '../commands/src/shared/next-gen-html';

async function localApp() {
  const repoDir = path.join(process.cwd(), '/repos');
  const repoName = 'docs-landing';

  await executeCliCommand({
    command: 'git',
    args: ['clone', `https://github.com/mongodb/${repoName}`],
    options: { cwd: repoDir },
  });

  console.log('Begin snooty build...');
  const snootyBuildRes = await nextGenParse(repoName);

  console.log(snootyBuildRes.stderr);

  console.log('snooty build complete');

  console.log('Begin next-gen-html...');

  const nextGenHtmlRes = await nextGenHtml(repoName);

  console.log(nextGenHtmlRes.stdout);

  console.log('next-gen-html complete');

  console.log('Begin next-gen-stage...');
}

localApp();
