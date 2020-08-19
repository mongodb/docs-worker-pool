const deployjob = require('../../jobTypes/productionDeployJob');
const workerUtils = require('../../utils/utils');
const githubJob = require('../../jobTypes/githubJob');

describe('Test Class', () => {
    // Dont actually reset the directory and dont care about the logging
    beforeAll(() => {
        workerUtils.resetDirectory = jest.fn().mockResolvedValue();
        workerUtils.logInMongo = jest.fn().mockResolvedValue();
        githubJob.buildRepo = jest.fn().mockReturnValueOnce({
            status: 'success',
            stdout: null,
            stderr: null,
        });
        jest.useFakeTimers();
    });

    it('startGithubBuild(: If build is successful --> return true', async () => {
        deployjob.startGithubBuild(null, null);
    });
});
