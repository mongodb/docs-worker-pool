import {
  nextGenDeploy,
  nextGenHtml,
  nextGenParse,
  nextGenStage,
  oasPageBuild,
  persistenceModule,
  prepareBuildAndGetDependencies,
} from '../commands';
import { Job, Payload } from '../entities/job';
import { IJobRepoLogger } from '../services/logger';

const fakePayload: Payload = {
  repoName: 'cloud-docs',
  project: 'cloud-docs',
  jobType: '',
  source: '',
  action: '',
  branchName: 'master',
  isFork: false,
  repoOwner: '10gen',
  url: 'https://github.com/10gen/cloud-docs', // ???
  mutPrefix: 'docs-qa/atlas/mmeigs-build',
  prefix: '',
  includeInGlobalSearch: true,
} as Payload;

const fakeJob: Job = {
  _id: '082u3roinswdf988888888',
  useWithBenchmark: true,
  payload: fakePayload,
  createdTime: new Date(),
  startTime: new Date(),
  title: '10gen/cloud-docs',
  user: 'mmeigs',
  mutPrefix: 'docs-qa/atlas/mmeigs-build',
  buildCommands: [],
  deployCommands: [],
  email: 'matt.meigs@mongodb.com',
  shouldGenerateSearchManifest: false,
  endTime: undefined,
  error: undefined,
  comMessage: undefined,
  logs: undefined,
  priority: undefined,
  result: undefined,
  status: null,
  manifestPrefix: undefined,
  pathPrefix: undefined,
  invalidationStatusURL: undefined,
  purgedUrls: undefined,
};

const logger = {
  save: (contextId: string, message: string) => console.log(message),
} as IJobRepoLogger;

async function localApp() {
  const baseUrl = 'https://mongodbcom-cdn.website.staging.corp.mongodb.com';
  const bucket = 'docs-atlas-stg';

  const { repoName, project, mutPrefix, directory } = fakePayload;

  const buildDependencies = [
    {
      dependencies: [
        {
          url: 'https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/docs-mongodb-internal.yaml',
          filename: 'published-branches.yaml',
        },
      ],
    },
    {
      buildDir: 'source/driver-examples',
      dependencies: [
        {
          url: 'https://raw.githubusercontent.com/mongodb/mongo-python-driver/master/test/test_examples.py',
          filename: 'test_examples.py',
        },
        {
          url: 'https://raw.githubusercontent.com/mongodb/motor/master/test/asyncio_tests/test_examples.py',
          filename: 'test_examples_motor.py',
        },
      ],
    },
  ];

  const { commitBranch, hasRedirects } = await prepareBuildAndGetDependencies(
    repoName,
    project,
    baseUrl,
    buildDependencies,
    directory
  );

  console.log('Begin snooty build...');
  const snootyBuildRes = await nextGenParse({ job: fakeJob });
  console.log(snootyBuildRes.errorText);
  console.log('Snooty build complete');

  console.log('Begin persistence-module');
  const persistenceModuleRes = await persistenceModule({ job: fakeJob });
  console.log(persistenceModuleRes);
  console.log('Persistence-module complete');

  console.log('Begin next-gen-html...');
  const nextGenHtmlRes = await nextGenHtml();
  console.log(nextGenHtmlRes.outputText);
  console.log('next-gen-html complete');

  console.log('Begin oas-page-build...');
  const oasPageBuildRes = await oasPageBuild({ job: fakeJob, baseUrl });
  console.log(oasPageBuildRes);
  console.log('Oas-page-build compelte');

  console.log('Begin next-gen-stage...');
  await nextGenStage({
    job: fakeJob,
    bucket,
    url: baseUrl,
    logger,
  });
  console.log('next-gen-stage complete');

  console.log('Begin next-gen-deploy...');
  const deployRes = await nextGenDeploy({
    hasConfigRedirects: hasRedirects,
    gitBranch: commitBranch,
    mutPrefix: mutPrefix || '',
    bucket,
    url: baseUrl,
  });
  console.log(deployRes);
  console.log('Next-gen-deploy complete');
}

localApp();
