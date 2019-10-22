const workerUtils = require('../../utils/utils');
const { MongoClient } = require('mongodb');
const mongo = require('../../utils/mongo');

const numFilesInTestsMongo = 5;

const metaObject = {
  repos: [
    {
      name: 'docs-spark-connector',
      url: 'https://github.com/danielborowski/docs-spark-connector',
    },
  ]
};

const publishedBranchObject = {
  repoOwner: 'danielborowski',
  repoName: 'docs-spark-connector',
};

describe('Mongo Tests', () => {
  let connection;
  let db;

  beforeAll(async () => {
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
    });
    db = await connection.db(global.__MONGO_DB_NAME__);

    // add repos for meta collection
    const metaColl = db.collection('meta');
    await metaColl.insertMany([metaObject]);

    await expect(workerUtils.resetDirectory('work/')).resolves.toBeUndefined();
  });

  // Testing For promiseTimeoutS()
  it('promiseTimeoutS() resolves', async () => {
    const promise = workerUtils.resolveAfterNSeconds(0.005);
    await expect(
      workerUtils.promiseTimeoutS(1, promise, 'ShouldErr')
    ).resolves.toBeUndefined();
  });

  it('promiseTimeoutS() rejects', async () => {
    const promise = workerUtils.resolveAfterNSeconds(0.01);
    await expect(
      workerUtils.promiseTimeoutS(0.005, promise, 'ShouldErr')
    ).rejects.toBeTruthy();
  });

  // resolveAfterNSeconds For getFilesInDir()
  it('resolveAfterNSeconds()', () => {
    jest.useFakeTimers();
    workerUtils.resolveAfterNSeconds(5);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });
  
  //test encrypt job
  it('encryptJob()', () => {
    const digest = workerUtils.encryptJob("test string1", "test string2");
    digest.then(function(value) {
      expect(value).toBe("232d1df9b58c1d7d6c611a9b10eb752687927931bfeb6aea3eae430e056bde7e");
    });
  });

  //test decrypt job
  it('decryptJob()', () => {
    const success = workerUtils.decryptJob("232d1df9b58c1d7d6c611a9b10eb752687927931bfeb6aea3eae430e056bde7e", "test string1", "test string2");
    success.then(function(value) {
     expect(success).toBeTruthy();
    });
  });

  // Testing For getExecPromise()
  it('getExecPromise()', async () => {
    const exec = workerUtils.getExecPromise();
    await expect(exec('ls')).resolves.toBeTruthy();
  });

  it('getExecPromise()', async () => {
    const exec = workerUtils.getExecPromise();
    await expect(exec('lssss')).rejects.toBeTruthy();
  });

  it('get all repos from meta collection', async () => {
    const metaColl = db.collection('meta');
    mongo.getMetaCollection = jest.fn().mockReturnValue(metaColl);
    const repos = await workerUtils.getAllRepos();
    expect(repos).toBeDefined();
    expect(repos).toBeTruthy();
    expect(repos).toBeInstanceOf(Array);
    expect(repos[0]).toHaveProperty('repos');
  });

  it('get published branches for each repo', async () => {
    const pubBranches = await workerUtils.getRepoPublishedBranches(publishedBranchObject);
    expect(pubBranches).toBeDefined();
    expect(pubBranches).toBeInstanceOf(Object);
    expect(pubBranches).toHaveProperty('status', 'success');
    expect(pubBranches).toHaveProperty('content');
    expect(pubBranches.content).toBeInstanceOf(Object);
  });
});
