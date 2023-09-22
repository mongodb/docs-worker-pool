import { SpawnOptions, spawn } from 'child_process';

export class ExecuteCommandError extends Error {
  data: unknown;
  constructor(message: string, data: unknown) {
    super(message);
    this.data = data;
  }
}

interface CliCommandResponse {
  stdout: string;
  stderr: string;
}

export async function executeCliCommand(
  command: string,
  args: readonly string[] = [],
  options: SpawnOptions = {}
): Promise<CliCommandResponse> {
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const executedCommand = spawn(command, args, options);

    executedCommand.stdout?.on('data', (data: Buffer) => {
      stdout.push(data.toString());
    });

    executedCommand.stderr?.on('data', (data: Buffer) => {
      stderr.push(data.toString());
    });

    executedCommand.on('error', (err) => {
      reject(new ExecuteCommandError('The command failed', err));
    });

    executedCommand.on('close', (exitCode) => {
      if (exitCode !== 0) {
        console.error(`ERROR! The command ${command} closed with an exit code other than 0: ${exitCode}.`);
        console.error('Arguments provided: ', args);
        console.error('Options provided: ', options);
      }

      resolve({
        stdout: stdout.join(),
        stderr: stderr.join(),
      });
    });
  });
}
