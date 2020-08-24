const job = require('../../jobTypes/githubPushJob');
const GitHubJob = require('../../jobTypes/githubJob').GitHubJobClass;
const GatsbyAdapter = require('../../jobTypes/gatsbyAdapter').GatsbyAdapterClass;
const workerUtils = require('../../utils/utils');
const yaml = require('js-yaml');

const payloadStagelCommit = {
  repoName: 'docs-spark-connector',
  branchName: 'master', 
  localBranchName: 'DOP-1253',
  repoOwner: 'mongodb',
  patch: 'foobar',
  patchType: 'commit'
};

const payloadRegGitHubPush = {
  repoName: 'docs-node',
  branchName: 'master', 
  repoOwner: 'mongodb',
};

const payloadNonVersioned = {
  repoName: 'docs-node',
  branchName: 'master', 
  repoOwner: 'mongodb',
  patch: 'foobar',
  patchType: 'commit'
};

const payloadVersioned = {
  repoName: 'docs-node',
  branchName: 'master', 
  repoOwner: 'mongodb',
  patch: 'foobar',
  patchType: 'commit'
};

const testProdDeployVersioned = {
  payload: payloadVersioned
}

const testProdDeployNoVersion = {
  payload: payloadNonVersioned
}
const testPayloadWithPatch = {
  user: 'madelinezec',
  payload: payloadStagelCommit
};

const testRegStaging = {
  payload: payloadRegGitHubPush
};

describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    jest.useFakeTimers();
    jest.setTimeout(30000)
  });

  //  Tests 
  it('path prefix for non-versioned repo', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    const testJob = new GitHubJob(testProdDeployNoVersion);
    console.log(testJob)
    const publishedBranchesObj = {};
    const body = `prefix: 'drivers/node'
version:
  published:
    - 'master'
  active:
    - 'master'
  stable: ''
  upcoming: master
git:
  branches:
    manual: 'master'
    published:
      - 'master'
      # the branches/published list **must** be ordered from most to
      # least recent release.
...`
    const yamlParsed = yaml.safeLoad(body);
    publishedBranchesObj['status'] = 'success';
    publishedBranchesObj['content'] = yamlParsed;

    workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue(publishedBranchesObj)
    workerUtils.getServerUser = jest.fn().mockReturnValue('docsworker-xlarge');
    await testJob.constructPrefix(true)
    expect(testJob.currentJob.payload.pathPrefix).toEqual(`drivers/node`);
    expect(testJob.currentJob.payload.mutPrefix).toEqual(`drivers/node`)
    
    //check string written to .env.production
    const builder = new GatsbyAdapter(testJob);
    const envVars = `GATSBY_PARSER_USER=docsworker-xlarge\nGATSBY_PARSER_BRANCH=master\nPATH_PREFIX=drivers/node\n`;
    expect(await builder.writeEnvVars()).toEqual(envVars);     
  });

  it('path prefix for versioned repo', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    const testJob = new GitHubJob(testProdDeployVersioned);
    console.log(testJob)
    const publishedBranchesObj = {};
    const body = `prefix: 'bi-connector'
version:
  published:
    - '2.13'
    - '2.12'
  active:
    - '2.13'
    - '2.12'
    - '2.11'
  stable: ''
  upcoming: ''
git:
  branches:
    manual: 'master'
    published:
      - 'master'
      - 'v2.12'
      - 'v2.11'
      # the branches/published list **must** be ordered from most to
      # least recent release.
...`
    const yamlParsed = yaml.safeLoad(body);
    publishedBranchesObj['status'] = 'success';
    publishedBranchesObj['content'] = yamlParsed;

    workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue(publishedBranchesObj)
    workerUtils.getServerUser = jest.fn().mockReturnValue('docsworker-xlarge');
    await testJob.constructPrefix(true)
    expect(testJob.currentJob.payload.pathPrefix).toEqual(`bi-connector/master`);
    expect(testJob.currentJob.payload.mutPrefix).toEqual(`bi-connector/master`);
    
    //check string written to .env.production
    const builder = new GatsbyAdapter(testJob);
    const envVars = `GATSBY_PARSER_USER=docsworker-xlarge\nGATSBY_PARSER_BRANCH=master\nPATH_PREFIX=bi-connector/master\n`;
    expect(await builder.writeEnvVars()).toEqual(envVars);        
  });

  it('path prefix for stagel commit job', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    const testJob = new GitHubJob(testPayloadWithPatch);

    const publishedBranchesObj = {};
    const body = `prefix: 'spark-connector'
version:
  published:
    - '2.13'
    - '2.12'
  active:
    - '2.13'
    - '2.12'
    - '2.11'
  stable: ''
  upcoming: ''
git:
  branches:
    manual: 'master'
    published:
      - 'master'
      - 'v2.12'
      - 'v2.11'
      # the branches/published list **must** be ordered from most to
      # least recent release.
...`
    const yamlParsed = yaml.safeLoad(body);
    publishedBranchesObj['status'] = 'success';
    publishedBranchesObj['content'] = yamlParsed;

    workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue(publishedBranchesObj)
    workerUtils.getServerUser = jest.fn().mockReturnValue('docsworker-xlarge');
    await testJob.constructPrefix(false)
    expect(testJob.currentJob.payload.pathPrefix).toEqual(`spark-connector/madelinezec/DOP-1253/docsworker-xlarge/master`);
    expect(testJob.currentJob.payload.mutPrefix).toEqual(`spark-connector/madelinezec/DOP-1253`)
    
    //check string written to .env.production
    const builder = new GatsbyAdapter(testJob);
    const envVars = `GATSBY_PARSER_USER=docsworker-xlarge\nGATSBY_PARSER_BRANCH=master\nPATH_PREFIX=spark-connector/madelinezec/DOP-1253/docsworker-xlarge/master\n`;
    expect(await builder.writeEnvVars()).toEqual(envVars); 
  });

  it('reg push job should not generate path prefix field in job', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    const testJob = new GitHubJob(testRegStaging);

    const publishedBranchesObj = {};
    const body = `prefix: 'spark-connector'
version:
  published:
    - '2.13'
    - '2.12'
  active:
    - '2.13'
    - '2.12'
    - '2.11'
  stable: ''
  upcoming: ''
git:
  branches:
    manual: 'master'
    published:
      - 'master'
      - 'v2.12'
      - 'v2.11'
      # the branches/published list **must** be ordered from most to
      # least recent release.
...`
    const yamlParsed = yaml.safeLoad(body);
    publishedBranchesObj['status'] = 'success';
    publishedBranchesObj['content'] = yamlParsed;

    workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue(publishedBranchesObj)
    workerUtils.getServerUser = jest.fn().mockReturnValue('docsworker-xlarge');
    await testJob.constructPrefix(false)
    expect(testJob.currentJob.payload.pathPrefix).toEqual(undefined);
    expect(testJob.currentJob.payload.mutPrefix).toEqual(undefined)
    
    //check string written to .env.production
    const builder = new GatsbyAdapter(testJob);
    const envVars = `GATSBY_PARSER_USER=docsworker-xlarge\nGATSBY_PARSER_BRANCH=master\n`;
    expect(await builder.writeEnvVars()).toEqual(envVars); 
  
  });
});
