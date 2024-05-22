import { ShellCommandExecutor } from '../../../src/services/commandExecutor';
import cp from 'child_process';

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
    test('ShellCommandExecutor returns correct output on success', async () => {
      const command = ["echo 'stdout output'", "echo 'stderr output' >&2"];
      const resp = await commandExecutor.execute(command);

      expect(resp.error.toString()).toStrictEqual('stderr output\n');
      expect(resp.output).toBe('stdout output');
      expect(resp.status).toBe('success');
    });

    test('ShellCommandExecutor properly throws on system level error', async () => {
      const command = ["echo 'stdout output'", "echo 'stderr output' >&2", 'exit 1'];
      const resp = await commandExecutor.execute(command);

      // This is a strange interface, but I'm just here to fix a bug, not change the interface.
      // The type of resp.error can be either a string or an Error instance.
      expect(resp.error.toString()).toStrictEqual(
        "Error: Command failed: echo 'stdout output' && echo 'stderr output' >&2 && exit 1\nstderr output\n"
      );
      expect(resp.output).toBe('stdout output');
      expect(resp.status).toBe('failed');
    });
  });
});
