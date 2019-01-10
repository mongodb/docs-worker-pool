const workerUtils = require('../utils/utils');
var awsMock = require('aws-sdk-mock');
const fs   = require('fs-extra');

const numFilesInTestsMongo = 5;

//Functions in Utils: 
// getFilesInDir - DONE
// uploadFileToS3Bucket - 
// uploadDirectoryToS3Bucket - DONE
// resetDirectory - DONE
// cloneGitRepository - DONE
// resolveAfterNSeconds - DONE
// promiseTimeoutS - DONE


describe('Mongo Tests', () => {
  beforeAll(async () => {
    await expect(workerUtils.resetDirectory("work/")).resolves.toBeUndefined();
  });

  /********************************************************************
   *                             retry()                              *
   ********************************************************************/
  it('retry()', async () => {
    // If func resolves --> should only run once
    let mockFunc = jest.fn().mockResolvedValue("val1");
    await expect(workerUtils.retry(mockFunc, 2, 1)).resolves.toEqual("val1");
    expect(mockFunc).toHaveBeenCalledTimes(1);
    
    // If func rejects then resolves --> should run twice
    mockFunc = jest.fn().mockRejectedValueOnce().mockResolvedValue("val2");
    await expect(workerUtils.retry(mockFunc, 2, 1)).resolves.toEqual("val2");
    expect(mockFunc).toHaveBeenCalledTimes(2);

    // // If func rejects --> should run twice and then fail
    mockFunc = jest.fn().mockRejectedValue("rejected");
    await expect(workerUtils.retry(mockFunc, 2, 1)).rejects.toBeTruthy();//toEqual(/Max retries reached with error .* rejected/);
    expect(mockFunc).toHaveBeenCalledTimes(3);
  });
  
  /********************************************************************
   *                         promiseTimeoutS()                        *
   ********************************************************************/
  it('promiseTimeoutS() resolves', async() => {
    let promise = workerUtils.resolveAfterNSeconds(.005);
    expect(workerUtils.promiseTimeoutS(1, promise, "ShouldErr")).resolves.toBeUndefined();
  });

  it('promiseTimeoutS() rejects', async() => {
    let promise = workerUtils.resolveAfterNSeconds(.01);
    expect(workerUtils.promiseTimeoutS(.005, promise, "ShouldErr")).rejects.toBeTruthy();
  });


  /********************************************************************
   *                     resolveAfterNSeconds()                       *
   ********************************************************************/
  it('resolveAfterNSeconds()', () => {
    jest.useFakeTimers();
    workerUtils.resolveAfterNSeconds(5);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });

  /********************************************************************
   *                      uploadFileToS3Bucket()                      *
   ********************************************************************/
  it('uploadFileToS3Bucket()', async () => {
    workerUtils.s3PutObject = jest.fn().mockResolvedValue(1);
    await expect(workerUtils.uploadFileToS3Bucket("tests/mongo/setup.js", "bucket")).resolves.toEqual(1);
  });

  /********************************************************************
   *                     uploadDirectoryToS3Bucket()                  *
   ********************************************************************/
  it('uploadDirectoryToS3Bucket()', async () => {
    workerUtils.uploadFileToS3Bucket = jest.fn().mockResolvedValue(1);
    await expect(workerUtils.uploadDirectoryToS3Bucket("tests/mongo/", "bucket")).resolves.toEqual(
      new Array(numFilesInTestsMongo).fill(1));
    expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
  });

  it('uploadDirectoryToS3Bucket()', async () => {
    workerUtils.uploadFileToS3Bucket = jest.fn().mockResolvedValueOnce(1).mockRejectedValue(1);
    await expect(workerUtils.uploadDirectoryToS3Bucket("tests/mongo/", "bucket")).rejects.toEqual(1);
    expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
  });

  it('uploadDirectoryToS3Bucket()', async () => {
    workerUtils.uploadFileToS3Bucket = jest.fn().mockRejectedValueOnce(1);
    await expect(workerUtils.uploadDirectoryToS3Bucket("tests/mongo/", "bucket")).rejects.toEqual(1);
  });

  /********************************************************************
   *                      gitCloneRepository()                        *
   ********************************************************************/
  // it('cloneGitRepository() resolves', async () => {
  //   const dir = "work/gitSample/";
  //   fs.removeSync(dir); 
	// 	fs.mkdirsSync(dir);
  //   const repo = "https://github.com/tkaye407/ModelTemplating.git";
  //   await expect(workerUtils.cloneGitRepository(repo, "work/gitSample")).resolves.toBeUndefined();
  //   fs.removeSync(dir);
  // }, 2000);
});