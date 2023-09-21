import { spawn } from 'child_process';

export class ExecuteCommandError extends Error {
  data: unknown;
  constructor(message: string, data: unknown) {
    super(message);
    this.data = data;
  }
}
export async function executeCliCommand<T = unknown>(command: string, args?: readonly string[]): Promise<T> {
  const executedCommand = spawn(command, args);
  return new Promise((resolve, reject) => {
    executedCommand.stdout.on('data', (data) => {
      resolve(data as T);
    });

    executedCommand.stderr.on('data', (data) => {
      reject(new ExecuteCommandError('The command failed', data));
    });
  });
}
