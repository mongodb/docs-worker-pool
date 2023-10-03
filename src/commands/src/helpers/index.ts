import { SpawnOptions, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';

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
  writeTarget?: Writable;
}

export interface CliCommandResponse {
  outputText: string;
  errorText: string;
}

export async function executeAndPipeCommands(
  cmdFromParams: CliCommandParams,
  cmdToParams: CliCommandParams
): Promise<CliCommandResponse> {
  return new Promise((resolve, reject) => {
    let hasRejected = false;

    const cmdFrom = spawn(cmdFromParams.command, cmdFromParams.args || [], cmdFromParams.options || {});
    const cmdTo = spawn(cmdToParams.command, cmdToParams.args || [], cmdToParams.options || {});

    cmdFrom.stdout?.on('data', (data: Buffer) => {
      cmdTo.stdin?.write(data);
    });

    cmdFrom.on('error', (err) => {
      reject(new ExecuteCommandError('The first command failed', err));
      hasRejected = true;
    });

    const outputText: string[] = [];
    const errorText: string[] = [];

    cmdTo.stdout?.on('data', (data: Buffer) => {
      outputText.push(data.toString());
    });

    cmdTo.stderr?.on('data', (data: Buffer) => {
      errorText.push(data.toString());
    });

    cmdTo.on('error', (err) => {
      reject(new ExecuteCommandError('The second command failed', err));
    });

    cmdTo.on('exit', (exitCode) => {
      // previous command errored out, return so we don't
      // accidentally resolve if the second command somehow still
      // exits without error
      if (hasRejected) return;

      if (exitCode !== 0) {
        console.error(`ERROR! The command ${cmdToParams.command} closed with an exit code other than 0: ${exitCode}.`);
        console.error('Arguments provided: ', cmdToParams.args);
        console.error('Options provided: ', cmdToParams.options);

        if (outputText) {
          console.error(outputText.join());
        }

        if (errorText) {
          console.error(errorText.join());
        }

        reject(new ExecuteCommandError('The command failed', exitCode));
        return;
      }

      resolve({
        outputText: outputText.join(),
        errorText: errorText.join(),
      });
    });
  });
}
export async function executeCliCommand({
  command,
  args = [],
  options = {},
  writeStream,
}: CliCommandParams): Promise<CliCommandResponse> {
  return new Promise((resolve, reject) => {
    const outputText: string[] = [];
    const errorText: string[] = [];

    const executedCommand = spawn(command, args, options);

    if (writeStream) executedCommand.stdout?.pipe(writeStream);
    executedCommand.stdout?.on('data', (data: Buffer) => {
      outputText.push(data.toString());
    });

    executedCommand.stderr?.on('data', (data: Buffer) => {
      errorText.push(data.toString());
    });

    executedCommand.on('error', (err) => {
      reject(new ExecuteCommandError('The command failed', err));
    });

    executedCommand.on('close', (exitCode) => {
      if (writeStream) writeStream.end();

      if (exitCode !== 0) {
        console.error(`ERROR! The command ${command} closed with an exit code other than 0: ${exitCode}.`);
        console.error('Arguments provided: ', args);
        console.error('Options provided: ', options);

        if (outputText) {
          console.error(outputText.join());
        }

        if (errorText) {
          console.error(errorText.join());
        }

        reject(new ExecuteCommandError('The command failed', exitCode));
        return;
      }

      resolve({
        outputText: outputText.join(),
        errorText: errorText.join(),
      });
    });
  });
}

export interface ExecuteIOCommandParams {
  command: string;
  filePath: string;
  args?: string[];
}

/**
 * This function is equivalent to a double redirect
 * e.g. echo "Hello!" >> hello.txt
 * @param param0
 */
export async function executeAndWriteToFile({ command, filePath, args }: ExecuteIOCommandParams) {
  const writeStream = fs.createWriteStream(filePath, {
    flags: 'a+',
  });

  const result = await executeCliCommand({ command, args, writeStream });

  return result;
}

export async function readFileAndExec({
  command,
  filePath,
  args,
}: ExecuteIOCommandParams): Promise<CliCommandResponse> {
  const fileId = await openAsync(filePath, 'r');
  const response = await executeCliCommand({
    command,
    args,
    options: { stdio: [fileId, process.stdout, process.stderr] },
  });

  await closeAsync(fileId);

  return response;
}

export async function getPatchId(repoDir: string): Promise<string | undefined> {
  const filePath = path.join(repoDir, 'myPatch.patch');
  try {
    const { outputText: gitPatchId } = await readFileAndExec({ command: 'git', filePath, args: ['patch-id'] });

    return gitPatchId.slice(0, 7);
  } catch (err) {
    console.warn('No patch ID found');
  }
}

export async function addProjectToEnv(project: string) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path.join(process.cwd(), 'snooty/.env.production'), { flags: 'a+' });

    stream.write(project);
    stream.close();
    stream.on('error', (error) => {
      console.log('Error when writing to file!', error);
      reject(error);
    });
    stream.on('close', resolve);
  });
}
export async function getCommitBranch(repoDir: string): Promise<string> {
  // equivalent to git rev-parse --short HEAD
  const response = await executeCliCommand({
    command: 'git',
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    options: { cwd: repoDir },
  });

  return response.outputText;
}

export async function getCommitHash(repoDir: string): Promise<string> {
  // equivalent to git rev-parse --short HEAD
  const response = await executeCliCommand({
    command: 'git',
    args: ['rev-parse', '--short', 'HEAD'],
    options: { cwd: repoDir },
  });

  return response.outputText;
}

export const checkIfPatched = async (repoDir: string) => !existsAsync(path.join(repoDir, 'myPatch.patch'));
export const getRepoDir = (repoName: string) => path.join(process.cwd(), `repos/${repoName}`);

export const RSTSPEC_FLAG =
  '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';
