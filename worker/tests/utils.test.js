const workerUtils = require('../utils/utils');

const numFilesInTestsMongo = 5;

describe('Mongo Tests', () => {
    beforeAll(async () => {
        await expect(workerUtils.resetDirectory('work/')).resolves.toBeUndefined();
    });


    // Testing For getFilesInDir()
    it('getFilesInDir()', async () => {
        const expectedFiles = [
            'tests/mongo/globalConfig.json',
            'tests/mongo/mongo-environment.js',
            'tests/mongo/setup.js',
            'tests/mongo/teardown.js',
            'tests/mongo/testFolder/sample.txt',
        ];

        // Find files with all extensions in tests/mongo
        let files = workerUtils.getFilesInDir('tests/mongo');
        expect(files).toHaveLength(expectedFiles.length);
        expect(files).toEqual(expect.arrayContaining(expectedFiles));

        // Find only files with .json extension in tests/mongo
        files = workerUtils.getFilesInDir('tests/mongo', 'json');
        expect(files).toHaveLength(1);
        expect(files).toEqual(expect.arrayContaining(['tests/mongo/globalConfig.json']));
    });


    // Testing For promiseTimeoutS()
    it('promiseTimeoutS() resolves', async () => {
        const promise = workerUtils.resolveAfterNSeconds(0.005);
        await expect(workerUtils.promiseTimeoutS(1, promise, 'ShouldErr')).resolves.toBeUndefined();
    });

    it('promiseTimeoutS() rejects', async () => {
        const promise = workerUtils.resolveAfterNSeconds(0.01);
        await expect(workerUtils.promiseTimeoutS(0.005, promise, 'ShouldErr')).rejects.toBeTruthy();
    });


    // resolveAfterNSeconds For getFilesInDir()
    it('resolveAfterNSeconds()', () => {
        jest.useFakeTimers();
        workerUtils.resolveAfterNSeconds(5);
        expect(setTimeout).toHaveBeenCalledTimes(1);
    });

    // Testing For getFilesInDir()
    it('uploadFileToS3Bucket()', async () => {
        workerUtils.s3PutObject = jest.fn().mockResolvedValue(1);
        await expect(workerUtils.uploadFileToS3Bucket('tests/mongo/setup.js', 'bucket')).resolves.toEqual(1);
    });


    // Testing For uploadDirectoryToS3Bucket()
    it('uploadDirectoryToS3Bucket()', async () => {
        workerUtils.uploadFileToS3Bucket = jest.fn().mockResolvedValue(1);
        await expect(workerUtils.uploadDirectoryToS3Bucket({}, 'tests/mongo/', 'bucket')).resolves.toEqual(
            new Array(numFilesInTestsMongo).fill(1),
        );
        expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
    });

    it('uploadDirectoryToS3Bucket()', async () => {
        workerUtils.uploadFileToS3Bucket = jest.fn().mockResolvedValueOnce(1).mockRejectedValue(1);
        await expect(workerUtils.uploadDirectoryToS3Bucket({}, 'tests/mongo/', 'bucket')).rejects.toEqual(1);
        expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
    });

    it('uploadDirectoryToS3Bucket()', async () => {
        workerUtils.uploadFileToS3Bucket = jest.fn().mockRejectedValueOnce(1);
        await expect(workerUtils.uploadDirectoryToS3Bucket({}, 'tests/mongo/', 'bucket')).rejects.toEqual(1);
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
});
