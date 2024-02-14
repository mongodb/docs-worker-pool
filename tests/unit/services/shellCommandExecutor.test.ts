import { ShellCommandExecutor } from '../../../src/services/commandExecutor';
import cp from 'child_process';
jest.mock('child_process');

describe('ShellCommandExecutor Tests', () => {
  let commandExecutor: ShellCommandExecutor;

  beforeEach(() => {
    commandExecutor = new ShellCommandExecutor();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Construct ShellCommandExecutor', () => {
    expect(new ShellCommandExecutor()).toBeDefined();
  });

  describe('ShellCommandExecutor Tests', () => {
    test('ShellCommandExecutor properly throws on system level error', async () => {
      cp.exec.mockImplementation((command, options, callback) => {
        callback(Error('Test error'), { stdErr: 'invalid command', stdout: 'test_repo_project_snooty_name' });
      });
      const resp = await commandExecutor.execute([]);
      expect(resp.error).not.toBe(undefined);
      expect(resp.output).toBe('');
      expect(resp.status).toBe('failed');
      expect(cp.exec).toBeCalledTimes(1);
    });
  });
});
