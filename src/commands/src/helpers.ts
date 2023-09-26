import { SpawnOptions, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const openAsync = promisify(fs.open);
const closeAsync = promisify(fs.close);
const existsAsync = promisify(fs.exists);

export class ExecuteCommandError extends Error {
  data: unknown;
  constructor(message: string, data: unknown) {
    super(message);
    this.data = data;
  }
}

interface CliCommandParams {
  command: string;
  args?: readonly string[];
  options?: SpawnOptions;
  writeStream?: fs.WriteStream;
}

interface CliCommandResponse {
  stdout: string;
  stderr: string;
}

export async function executeCliCommand({
  command,
  args = [],
  options = {},
  writeStream,
}: CliCommandParams): Promise<CliCommandResponse> {
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const executedCommand = spawn(command, args, options);

    if (writeStream) executedCommand.stdout?.pipe(writeStream);

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

export async function executeAndWriteToFile() {
  return null;
}

export async function readFileAndExec(command: string, filePath: string, args?: string[]): Promise<CliCommandResponse> {
  const fileId = await openAsync(filePath, 'r');
  const response = await executeCliCommand({
    command,
    args,
    options: { stdio: [fileId, process.stdout, process.stderr] },
  });

  await closeAsync(fileId);

  return response;
}

export async function getPatchId(repoDir: string): Promise<string> {
  const filePath = path.join(repoDir, 'myPatch.patch');

  const { stdout: gitPatchId } = await readFileAndExec('git', filePath, ['patch-id']);

  return gitPatchId.slice(0, 7);
}

export async function getCommitHash(): Promise<string> {
  // equivalent to git rev-parse --short HEAD
  const response = await executeCliCommand({ command: 'git', args: ['rev-parse', '--short', 'HEAD'] });

  return response.stdout;
}

export const checkIfPatched = async (repoDir: string) => !(await existsAsync(path.join(repoDir, 'myPatch.patch')));
export const getRepoDir = (repoName: string) => path.join(__dirname, `repos/${repoName}`);

export const RSTSPEC_FLAG =
  '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';
