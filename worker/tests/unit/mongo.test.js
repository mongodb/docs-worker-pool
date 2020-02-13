const { MongoClient } = require('mongodb');
const mongo = require('../../utils/mongo');

// Helper function to add n days to the current date
function newDateInNDays(n) {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

// Job 1 should be the first job taken off the queue because of its priority
const job1 = {
  payload: { jobType: 'job1', isXlarge:false },
  createdTime: newDateInNDays(0),
  startTime: null,
  endTime: null,
  priority: 2,
  status: 'inQueue',
  numFailures: 0,
  failures: [],
  result: null,
  logs: {},
};

// Job2 should be the second job taken off the queue because it has the earliest createdTime
const job2 = JSON.parse(JSON.stringify(job1));
job2.payload.jobType = 'job2';
job2.priority = 1;
job2.payload.isXlarge = false;
job2.createdTime = newDateInNDays(-2);

// Job 3 should be the third job taken off the queue because it has the oldest createdTime
const job3 = JSON.parse(JSON.stringify(job2));
job3.payload.jobType = 'job3';
job3.createdTime = newDateInNDays(0);

// Job 4 should not be taken off the queue because its createdTime is after new Date()
const job4 = JSON.parse(JSON.stringify(job2));
job4.payload.jobType = 'job4';
job4.createdTime = newDateInNDays(10);

describe('Mongo Tests', () => {
  let connection;
  let db;

  // Use the mongo in-memory storage engine for testing
  // See tests/mongo/ for details on setup/teardown of this.
  beforeAll(async () => {
    console.log('***** running setup for mongo db unit tests *****');
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true,
    });
    db = await connection.db(global.__MONGO_DB_NAME__);

    // Remove the jobs collection (should be empty anyways)
    db.dropCollection('jobs').catch(err => {
      console.log(err);
    });

    // Put jobs in a random order (shouldnt matter)
    const jobsColl = db.collection('jobs');
    const jobs = [job4, job2, job1, job3];
    await jobsColl.insertMany(jobs);
  });

  // Make sure to close the connection to the in-memory DB
  afterAll(async () => {
    await connection.close();
    await db.close();
  });

  it('setup worked properly', async () => {
    const jobsColl = db.collection('jobs');

    // There should be 4 documents in the collection
    const numJobs = await jobsColl.count();
    expect(numJobs).toEqual(4);

    // Following properties should be found in all of them
    const currJob = await jobsColl.findOne({});
    expect(currJob).toHaveProperty('payload');
    expect(currJob).toHaveProperty('createdTime');
    expect(currJob).toHaveProperty('startTime', null);
    expect(currJob).toHaveProperty('endTime', null);
    expect(currJob).toHaveProperty('priority');
    expect(currJob).toHaveProperty('numFailures', 0);
    expect(currJob).toHaveProperty('failures', []);
    expect(currJob).toHaveProperty('result', null);
  });

  /** ******************************************************************
   *                             getNextJob()                         *
   ******************************************************************* */
  it('getNextJob() should dequeue correct job', async () => {
    const jobsColl = db.collection('jobs');

    // First job out should be job1 because of its priority
    let jobUpdate = await mongo.getNextJob(jobsColl);
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate).toHaveProperty('ok', 1);
    expect(jobUpdate).toHaveProperty('value');
    expect(jobUpdate.value).toHaveProperty('payload', { jobType: 'job1' , isXlarge:false});
    job1._id = jobUpdate.value._id;

    // Second job out should be job2 because of its createdTime
    jobUpdate = await mongo.getNextJob(jobsColl);
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate).toHaveProperty('ok', 1);
    expect(jobUpdate).toHaveProperty('value');
    expect(jobUpdate.value).toHaveProperty('payload', { jobType: 'job2', isXlarge: false});
    job2._id = jobUpdate.value._id;

    // Third item out should be job3 because it is the last possible job
    jobUpdate = await mongo.getNextJob(jobsColl);
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate).toHaveProperty('ok', 1);
    expect(jobUpdate).toHaveProperty('value');
    expect(jobUpdate.value).toHaveProperty('payload', { jobType: 'job3', isXlarge: false });
    job3._id = jobUpdate.value._id;

    // Fourth job shouldnt be dequeued because its createdTime is in 10 days
    jobUpdate = await mongo.getNextJob(jobsColl);
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate).toHaveProperty('ok', 1);
    expect(jobUpdate).toHaveProperty('value');
    expect(jobUpdate.value).toBeNull();

    const j4 = await jobsColl.findOne({ 'payload.jobType': 'job4' });
    job4._id = j4._id;
  }, 5000);

  it('jobs should now all be in the inProgress status except for job4', async () => {
    const jobsColl = db.collection('jobs');

    let currJob = await jobsColl.findOne({ _id: job1._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inProgress');
    expect(currJob.startTime).toBeTruthy();
    expect(currJob.startTime).toBeInstanceOf(Date);
    expect(currJob.startTime.getTime()).toBeLessThanOrEqual(
      new Date().getTime()
    );
    expect(currJob.endTime).toBeNull();

    currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inProgress');
    expect(currJob.startTime).toBeTruthy();
    expect(currJob.startTime).toBeInstanceOf(Date);
    expect(currJob.startTime.getTime()).toBeLessThanOrEqual(
      new Date().getTime()
    );
    expect(currJob.endTime).toBeNull();

    currJob = await jobsColl.findOne({ _id: job3._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inProgress');
    expect(currJob.startTime).toBeTruthy();
    expect(currJob.startTime).toBeInstanceOf(Date);
    expect(currJob.startTime.getTime()).toBeLessThanOrEqual(
      new Date().getTime()
    );
    expect(currJob.endTime).toBeNull();

    currJob = await jobsColl.findOne({ _id: job4._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inQueue');
    expect(currJob.startTime).toBeNull();
    expect(currJob.endTime).toBeNull();
  }, 5000);

  /** ******************************************************************
   *                       finishJobWithResult()                      *
   ******************************************************************* */
  it('finishJobWithResult(queueCollection, job, result) works properly', async () => {
    const jobsColl = db.collection('jobs');

    await mongo.finishJobWithResult(jobsColl, job1, { success: true });
    const currJob = await jobsColl.findOne({ _id: job1._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('completed');
    expect(currJob.endTime).toBeTruthy();
    expect(currJob.endTime).toBeInstanceOf(Date);
    expect(currJob.endTime.getTime()).toBeLessThanOrEqual(new Date().getTime());
    expect(currJob).toHaveProperty('result', { success: true });
  }, 5000);

  it('finishJobWithResult() fails on incorrect jobId', async () => {
    const jobsColl = db.collection('jobs');
    expect.assertions(1);
    await expect(
      mongo.finishJobWithResult(jobsColl, { _id: 'notRealId' }, 'a')
    ).rejects.toBeTruthy();
  }, 5000);

  /** ******************************************************************
   *                       finishJobWithFailure()                     *
   ******************************************************************* */
  it('finishJobWithFailure(queueCollection, job, reason) works properly with numFailure < 2', async () => {
    const jobsColl = db.collection('jobs');

    await mongo.finishJobWithFailure(jobsColl, job2, 'failed job 2');
    let currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inQueue');
    expect(currJob.startTime).toBeNull();
    expect(currJob.numFailures).toEqual(1);
    expect(currJob.failures).toHaveLength(1);
    expect(currJob.failures[0].reason).toEqual('failed job 2');

    await mongo.finishJobWithFailure(jobsColl, job2, 'failed job 2');
    currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('inQueue');
    expect(currJob.startTime).toBeNull();
    expect(currJob.numFailures).toEqual(2);
    expect(currJob.failures).toHaveLength(2);
    expect(currJob.failures[1].reason).toEqual('failed job 2');
  }, 5000);

  it('finishJobWithFailure(queueCollection, job, reason) works properly with numFailure >= 2', async () => {
    const jobsColl = db.collection('jobs');
    job2.numFailures = 2;

    await mongo.finishJobWithFailure(jobsColl, job2, 'failed job 2 (real)');
    const currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob).toBeTruthy();
    expect(currJob.status).toEqual('failed');
    expect(currJob.startTime).toBeNull();
    expect(currJob.numFailures).toEqual(3);
    expect(currJob.failures).toHaveLength(3);
    expect(currJob.failures[2].reason).toEqual('failed job 2 (real)');
  }, 5000);

  it('finishJobWithFailure() fails on incorrect jobId', async () => {
    const jobsColl = db.collection('jobs');
    expect.assertions(1);
    await expect(
      mongo.finishJobWithFailure(
        jobsColl,
        { _id: 'notRealId', numFailures: 0 },
        'a'
      )
    ).rejects.toBeTruthy();
  }, 5000);

  /** ******************************************************************
   *                       logInMongo()                               *
   ******************************************************************* */
  it('logInMongoWorks', async () => {
    const jobsColl = db.collection('jobs');
    mongo.getQueueCollection = jest.fn().mockReturnValue(jobsColl);
    job2.numFailures = 0;

    await mongo.logMessageInMongo(job2, 'message 1');
    let currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob.logs).toHaveProperty('try0');
    expect(currJob.logs.try0).toHaveLength(1);
    expect(currJob.logs.try0[0]).toEqual('message 1');

    await mongo.logMessageInMongo(job2, 'message 2');
    currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob.logs).toHaveProperty('try0');
    expect(currJob.logs.try0).toHaveLength(2);
    expect(currJob.logs.try0[1]).toEqual('message 2');

    job2.numFailures = 1;
    await mongo.logMessageInMongo(job2, 'message 3');
    currJob = await jobsColl.findOne({ _id: job2._id });
    expect(currJob.logs).toHaveProperty('try0');
    expect(currJob.logs.try1).toHaveLength(1);
    expect(currJob.logs.try1[0]).toEqual('message 3');

    mongo.getQueueCollection = jest.fn().mockReturnValue();
    await mongo.logMessageInMongo(job2, 'message 1');
  }, 5000);
});
