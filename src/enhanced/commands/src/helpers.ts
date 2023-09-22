import {
  SpawnOptions,
  SpawnOptionsWithStdioTuple,
  SpawnOptionsWithoutStdio,
  StdioNull,
  StdioPipe,
  spawn,
} from 'child_process';

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
  const executedCommand = spawn(command, args, options);
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    executedCommand.stdout?.on('data', (data: Buffer) => {
      stdout.push(data.toString());
    });

    executedCommand.stderr?.on('data', (data: Buffer) => {
      stderr.push(data.toString());
    });

    executedCommand.on('error', (err) => {
      reject(new ExecuteCommandError('The command failed', err));
    });

    resolve({
      stdout: stdout.join(),
      stderr: stderr.join(),
    });
  });
}
