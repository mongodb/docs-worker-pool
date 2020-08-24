const job = require('../../jobTypes/githubPushJob');
const GitHubJob = require('../../jobTypes/githubJob').GitHubJobClass;
const workerUtils = require('../../utils/utils');
const yaml = require('js-yaml');

const payloadStagelCommit = {
  repoName: 'docs_build_test',
  branchName: 'DOP-1253', 
  repoOwner: 'mongodb',
  patch: 'foobar',
  patchType: 'commit'
};

const payloadNonVersioned = {
  repoName: 'docs_build_test',
  branchName: 'master', 
  repoOwner: 'mongodb',
  patch: 'foobar',
  patchType: 'commit'
};

const testProdDeployNoVersion = {
  payload: payloadNonVersioned
}
const testPayloadWithPatch = {
  payload: payloadStagelCommit
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

  it('initEnv() properly writes .env.production', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    const testJob = new GitHubJob(testProdDeployNoVersion);
    console.log(testJob)
    const returnObject = {};
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
    returnObject['status'] = 'success';
    returnObject['content'] = yamlParsed;
    //mock 
    // const repoContent = await workerUtils.getRepoPublishedBranches(repoObject)
    // const server_user = await workerUtils.getServerUser()

    // workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue({content: {prefix: 'drivers/node', 
    // version:{
    //   published: 'master',
    //   active:'master',
    //   stable: '',
    //   upcoming: 'master'},
    // git:{
    //   branches:
    //     {manual: 'master',
    //     published:'master',
    //     }
    //   }
    // }
    // });
    workerUtils.getRepoPublishedBranches = jest.fn().mockReturnValue(returnObject)
    workerUtils.getServerUser = jest.fn().mockReturnValue('docsworker-xlarge');
    await testJob.constructPrefix(true)
    // testJob.currentJob.payload.pathPrefix.expect.toEqual(`drivers/node/master`)
    // testJob.currentJob.payload.mutPrefix.expect.toEqual(`drivers/node/master`)
    console.log("after ", testJob)
    
     
  });


});
