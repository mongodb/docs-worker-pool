const workerUtils = require('../utils/utils');
var awsMock = require('aws-sdk-mock');
const fs   = require('fs-extra');

const numFilesInTestsMongo = 5;

describe('Mongo Tests', () => {
  beforeAll(async () => {
    await expect(workerUtils.resetDirectory("work/")).resolves.toBeUndefined();
  });
  /********************************************************************
   *                          getFilesInDir()                         *
   ********************************************************************/
  it('getFilesInDir()', async () => {
    let expected_files = [
      'tests/mongo/globalConfig.json',
      'tests/mongo/mongo-environment.js',
      'tests/mongo/setup.js',
      'tests/mongo/teardown.js',
      'tests/mongo/testFolder/sample.txt'
    ]; 

    // Find files with all extensions in tests/mongo
    let files = workerUtils.getFilesInDir("tests/mongo");
    expect(files).toHaveLength(expected_files.length);
    expect(files).toEqual(expect.arrayContaining(expected_files));

    // Find only files with .json extension in tests/mongo
    files = workerUtils.getFilesInDir("tests/mongo", "json");
    expect(files).toHaveLength(1);
    expect(files).toEqual(expect.arrayContaining(["tests/mongo/globalConfig.json"]));
  });

  /********************************************************************
   *                         promiseTimeoutS()                        *
   ********************************************************************/
  it('promiseTimeoutS() resolves', async() => {
    let promise = workerUtils.resolveAfterNSeconds(.005);
    await expect(workerUtils.promiseTimeoutS(1, promise, "ShouldErr")).resolves.toBeUndefined();
  });

  it('promiseTimeoutS() rejects', async() => {
    let promise = workerUtils.resolveAfterNSeconds(.01);
    await expect(workerUtils.promiseTimeoutS(.005, promise, "ShouldErr")).rejects.toBeTruthy();
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
    await expect(workerUtils.uploadDirectoryToS3Bucket({}, "tests/mongo/", "bucket")).resolves.toEqual(
      new Array(numFilesInTestsMongo).fill(1));
    expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
  });

  it('uploadDirectoryToS3Bucket()', async () => {
    workerUtils.uploadFileToS3Bucket = jest.fn().mockResolvedValueOnce(1).mockRejectedValue(1);
    await expect(workerUtils.uploadDirectoryToS3Bucket({}, "tests/mongo/", "bucket")).rejects.toEqual(1);
    expect(workerUtils.uploadFileToS3Bucket).toHaveBeenCalledTimes(numFilesInTestsMongo);
  });

  it('uploadDirectoryToS3Bucket()', async () => {
    workerUtils.uploadFileToS3Bucket = jest.fn().mockRejectedValueOnce(1);
    await expect(workerUtils.uploadDirectoryToS3Bucket({}, "tests/mongo/", "bucket")).rejects.toEqual(1);
  });

  /********************************************************************
   *                          getExecPromise()                        *
   ********************************************************************/
  it('getExecPromise()', async () => {
    let exec = workerUtils.getExecPromise();
    await expect(exec("ls")).resolves.toBeTruthy();
  });

  it('getExecPromise()', async () => {
    let exec = workerUtils.getExecPromise();
    await expect(exec("lssss")).rejects.toBeTruthy();
  });
  
  /********************************************************************
  *                          cloneObject()                        *
  ********************************************************************/
  it('cloneObject()', async () => {
    let obj = {a: 1, b: 2, c: {d: 3} }; 
    let objCopy = workerUtils.cloneObject(obj);
    expect(obj).toMatchObject(obj);
    expect(objCopy).toMatchObject(obj);

    objCopy.b = 4;
    objCopy.c.d = 5;
    expect(obj).toMatchObject(obj);
    expect(objCopy).toMatchObject({a: 1, b: 4, c: {d: 5} });
  });

  it('cloneObject()', async () => {
    let obj; 
    let objCopy = workerUtils.cloneObject(obj);
    expect(obj).toBeUndefined();
    expect(objCopy).toBeUndefined();
  });

  it('cloneObject()', async () => {
    let obj = {a: null}; 
    let objCopy = workerUtils.cloneObject(obj);
    expect(obj).toMatchObject(obj);
    expect(objCopy).toMatchObject(obj);

    objCopy.a = 1;
    expect(obj).toMatchObject(obj);
    expect(objCopy).toMatchObject({a: 1});
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