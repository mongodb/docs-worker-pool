import { RedocExecutor } from '../../../src/services/redocExecutor';
import cp from 'child_process';

// jest.mock('child_process').mockImplementation(() => {});

// const mockCpExec = jest.spyOn(cp, 'exec');
// // @ts-ignore
// mockCpExec.mockImplementation(() => {});

// jest.mock('child_process', () => ({
//   exec: jest.fn(() => Promise.resolve({ stdout: 'foo', stderr: 'bar' }))
// }));

jest.mock('child_process');
// @ts-ignore
cp.exec.mockImplementation((command: string, callback: any) => {
  callback(null, command);
});

describe('RedocExecutor', () => {
  it('calls the Redoc build command with expected parameters', async () => {
    const testRedocPath = '/path/to/redoc/cli/index.js';
    const testSiteUrl = 'https://mongodb.com/docs';
    const testSiteTitle = 'Test Docs';
    const redocExecutor = new RedocExecutor(testRedocPath, testSiteUrl, testSiteTitle);

    const testSpecSource = '/path/to/spec.json';
    const testOutputPath = '/path/to/output/index.html';
    await redocExecutor.execute(testSpecSource, testOutputPath);

    const expectedOptions = {
      customOptions: {
        backNavigationPath: testSiteUrl,
        siteTitle: testSiteTitle,
      },
    };
    const expectedCommand = `node ${testRedocPath} build ${testSpecSource} --output ${testOutputPath} --options '${JSON.stringify(
      expectedOptions
    )}'`;
    expect(cp.exec).toBeCalledWith(expectedCommand, expect.anything());
  });
});
