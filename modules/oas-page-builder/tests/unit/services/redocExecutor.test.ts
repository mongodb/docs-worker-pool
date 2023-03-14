import { RedocExecutor } from '../../../src/services/redocExecutor';
import cp from 'child_process';

jest.mock('child_process');
// @ts-ignore
cp.exec.mockImplementation((command: string, callback: (a: null, b: string) => void) => {
  callback(null, command);
});

describe('RedocExecutor', () => {
  const testRedocPath = '/path/to/redoc/cli/index.js';
  const testSiteUrl = 'https://mongodb.com/docs';
  const testSiteTitle = 'Test Docs';
  const testSpecSource = '/path/to/spec.json';
  const testOutputPath = '/path/to/output/index.html';

  it('calls the Redoc build command with expected parameters', async () => {
    const redocExecutor = new RedocExecutor(testRedocPath, testSiteUrl, testSiteTitle);
    await redocExecutor.execute(testSpecSource, testOutputPath);

    const expectedOptions = {
      backNavigationPath: testSiteUrl,
      siteTitle: testSiteTitle,
    };
    const expectedCommand = `node ${testRedocPath} build ${testSpecSource} --output ${testOutputPath} --options options.json`;
    expect(cp.exec).toBeCalledWith(expectedCommand, expect.anything());
  });

  it('accepts additional build options', async () => {
    const redocExecutor = new RedocExecutor(testRedocPath, testSiteUrl, testSiteTitle);
    const testBuildOptions = {
      ignoreIncompatibleTypes: true,
    };
    await redocExecutor.execute(testSpecSource, testOutputPath, testBuildOptions);

    // Options should be concatenated together
    const expectedOptions = {
      backNavigationPath: testSiteUrl,
      siteTitle: testSiteTitle,
      ignoreIncompatibleTypes: true,
    };
    const expectedCommand = `node ${testRedocPath} build ${testSpecSource} --output ${testOutputPath} --options options.json`;
    expect(cp.exec).toBeCalledWith(expectedCommand, expect.anything());
  });
});
