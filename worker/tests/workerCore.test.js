const worker = require('../worker');
const mongo = require('../utils/mongo');
const workerUtils = require('../utils/utils');

// Valid job with jobType for testing purposes
const validJob = {
    _id: 'sampleId',
    payload: { jobType: 'githubPush' },
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 2,
    status: 'inQueue',
    numFailures: 0,
    failures: [],
    result: null,
};

// Invalid job for testing purposes
const invalidJob = {
    _id: 'sampleId',
    payload: { jobType: 'notARealJobType' },
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 2,
    status: 'inQueue',
    numFailures: 0,
    failures: [],
    result: null,
};

// For testing purposes
let runGithubPushMock;
let promiseTimeoutSSpy;


describe('Worker.Work() Tests', () => {
    beforeAll(() => {
        workerUtils.resetDirectory('work/');
        workerUtils.logInMongo = jest.fn().mockResolvedValue();
    });

    afterAll(() => {
        workerUtils.resetDirectory('work/');
    });

    beforeEach(() => {
        jest.useFakeTimers();

        // Set Mongo Jobs to resolve automatically
        mongo.getNextJob = jest.fn().mockResolvedValue({ value: validJob });
        mongo.finishJobWithResult = jest.fn().mockResolvedValue();
        mongo.finishJobWithFailure = jest.fn().mockResolvedValue();
        workerUtils.retry = jest.fn().mockResolvedValue();

        // Change the gitHubPushJob to be our mock
        runGithubPushMock = jest.fn().mockResolvedValue();
        worker.addJobTypeToFunc('githubPush', runGithubPushMock);

        // Spy on the timeout function
        promiseTimeoutSSpy = jest.spyOn(workerUtils, 'promiseTimeoutS');
        promiseTimeoutSSpy.mockClear();
    });

    /** ******************************************************************
     *                  If everything resolves                          *
     ******************************************************************* */
    it('work() --> all promises resolve', async () => {
        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        jest.clearAllTimers();
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(0);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(3);
    });

    /** *******************************************************************
     *                  getNextJob() returns no job                      *
     ******************************************************************** */
    it('work() --> getNextJob() returns no job', async () => {
        // Set getNextJob to not return job
        mongo.getNextJob = jest.fn().mockResolvedValue();

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(0);
        // expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(1);
    });

    /** ******************************************************************
     *              getNextJob() returns job with no value              *
     ******************************************************************* */
    it('work() --> getNextJob() returns job with no value', async () => {
        // Set getNextJob to not return job
        mongo.getNextJob = jest.fn().mockResolvedValue({ value: undefined });

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(0);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(1);
    });

    /** ******************************************************************
     *                  getNextJob() returns invalid job                *
     ******************************************************************* */
    it('work() --> getNextJob returns invalid jobType', async () => {
        // Set getNextJob to return an invalid job
        mongo.getNextJob = jest.fn().mockResolvedValue({ value: invalidJob });

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure.mock.calls[0][2]).toMatch(/Job type of .* not recognized/);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(1);
    });

    /** ******************************************************************
     *                     runGithubPushJob() rejects                   *
     ******************************************************************* */
    it('work() --> runGithubPushJob() rejects', async () => {
        // Set runGithubPushMock to reject and update dictionary
        runGithubPushMock = jest.fn().mockRejectedValue('runGithubPush Failed');
        worker.addJobTypeToFunc('githubPush', runGithubPushMock);

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure.mock.calls[0][2]).toMatch(/runGithubPush Failed/);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(2);
    });

    /** ******************************************************************
     *                 finishJobWithResult() rejects                    *
     ******************************************************************* */
    it('work() --> finishJobWithResult() rejects', async () => {
        // Set finishJobWithResult to reject
        mongo.finishJobWithResult = jest.fn().mockRejectedValue('finishJobWithResult failed');

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure.mock.calls[0][2]).toMatch(/finishJobWithResult failed/);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(3);
    });

    /** ******************************************************************
     *                          retry() rejects                         *
     ******************************************************************* */
    it('work() --> retry() rejects', async () => {
        // Set getNextJob to return an invalid job
        workerUtils.retry = jest.fn().mockRejectedValue('Reject');
        mongo.getNextJob = jest.fn().mockResolvedValue({ value: invalidJob });

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(promiseTimeoutSSpy).toHaveBeenCalledTimes(1);
    });

    /** ******************************************************************
     *                     getNextJob() times-out                       *
     ******************************************************************* */
    it('work() --> getNextJob() times-out', async () => {
        // Set getNextJob to not return job
        workerUtils.promiseTimeoutS = jest.fn().mockRejectedValue('rejected');

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(0);
        expect(workerUtils.promiseTimeoutS).toHaveBeenCalledTimes(1);
    });

    /** ******************************************************************
     *                      runGithubPush() times-out                   *
     ******************************************************************* */
    it('work() --> runGithubPush() times-out', async () => {
        // Set getNextJob to not return job
        workerUtils.promiseTimeoutS = jest.fn().mockResolvedValueOnce({ value: validJob }).mockRejectedValue('Timed out!');

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(0);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure.mock.calls[0][2]).toMatch(/Timed out!/);
    });

    /** ******************************************************************
     *                  finishJobWithResult() times-out                 *
     ******************************************************************* */
    it('work() --> finishJobWithResult() times-out', async () => {
        // Set getNextJob to not return job
        workerUtils.promiseTimeoutS = jest.fn().mockResolvedValueOnce({ value: validJob }).mockResolvedValueOnce().mockRejectedValue('Timed out!');

        // Run worker and clear all timers
        await worker.work();
        jest.clearAllTimers();

        // Set Expectations
        expect(mongo.getNextJob).toHaveBeenCalledTimes(1);
        expect(runGithubPushMock).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithResult).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);
        expect(mongo.finishJobWithFailure.mock.calls[0][2]).toMatch(/Timed out!/);
    });
});
