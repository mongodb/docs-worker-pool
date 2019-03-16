const workerUtils = require('../../utils/utils');

const numFilesInTestsMongo = 5;

describe('Mongo Tests', () => {
  beforeAll(async () => {
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
