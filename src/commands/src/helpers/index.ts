import { SpawnOptions, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';

const openAsync = promisify(fs.open);
const closeAsync = promisify(fs.close);
const existsAsync = promisify(fs.exists);

const EPIPE_CODE = 'EPIPE';
const EPIPE_ERRNO = -32;
const EPIPE_SYSCALL = 'write';

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

interface StdinError {
  errno: number;
  code: string;
  syscall: string;
}
/**
 * Method to replicate piping output from one command to another e.g. `yes | mut-publish public`
 * @param {CliCommandParams} cmdFromParams The command we want to pipe output from to another command
 * @param {CliCommandParams} cmdToParams The command that receives input from another command
 * @returns {CliCommandResponse} The `CliCommandResponse` from the cmdTo command
 */
export async function executeAndPipeCommands(
  cmdFromParams: CliCommandParams,
  cmdToParams: CliCommandParams
): Promise<CliCommandResponse> {
  return new Promise((resolve, reject) => {
    let hasRejected = false;

    const cmdFrom = spawn(cmdFromParams.command, cmdFromParams.args || [], cmdFromParams.options || {});
    const cmdTo = spawn(cmdToParams.command, cmdToParams.args || [], cmdToParams.options || {});

    cmdFrom.stdout?.on('data', (data: Buffer) => {
      // For some commands, the command that is being written to
      // will end before the first command finishes. In some cases,
      // we do want this to happen. For example, the cli command `yes` will
      // infinitely output yes to the terminal as a way of automatically responding
      // to prompts from the subsequent command. Once the second command completes,
      // we don't want `yes` to continue to run, so we kill the command.
      if (!cmdTo.stdin?.writable) {
        cmdFrom.kill();
        return;
      }

      // this is where we pipe data from the first command to the second command.
      cmdTo.stdin?.write(data);
    });

    cmdTo.stdin?.on('error', (err: StdinError) => {
      // the error event for the cmdTo stdin gets called whenever it closes prematurely,
      // but this is expected in certain situations e.g. when using the `yes` command.
      // If this condition is met, we know that this expected, and ignore it otherwise we throw.
      // If we don't check, we get an unhandled error exception.
      if (err.code === EPIPE_CODE && err.syscall === EPIPE_SYSCALL && err.errno === EPIPE_ERRNO) {
        console.log('stdin done');
        return;
      }

      reject(new ExecuteCommandError('The first command stdin (cmdTo) failed', err));
      hasRejected = true;
    });

    cmdFrom.stdout?.on('error', (err) => {
      console.log('error on cmdFrom out', err);
    });

    cmdFrom.on('error', (err) => {
      reject(new ExecuteCommandError('The first command (cmdTo) failed', err));
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
          console.error('output', outputText.join(''));
        }

        if (errorText) {
          console.error('error', errorText.join(''));
        }

        reject(new ExecuteCommandError('The command failed', { exitCode, outputText, errorText }));
        return;
      }

      resolve({
        outputText: outputText.join(''),
        errorText: errorText.join(''),
      });
    });
  });
}

/**
 * A promisified way to execute CLI commands. This approach uses spawn instead of exec, which
 * is a safer way of executing CLI commands. Also, spawn allows us to stream input and output in real-time.
 * @param {string} command The CLI command we want to execute
 * @param {string[] | undefined} args Arguments we want to provide to the command
 * @param {SpawnOptions | undefined} options Options to configure the spawn function
 * @param {fs.WriteStream | undefined} writeStream A writable stream object to pipe output to.
 * For example, we can `mimic ls >> directory.txt` by creating a `WriteStream` object to write to
 * `directory.txt`, and then provide the `WriteStream` so that we can pipe the output from the `ls`
 * command to the `WriteStream`.
 * @returns {Promise<CliCommandResponse>} An object containing the CLI output from `stdout` and `stderr`.
 * stdout is the `outputText` property, and `stderr` is the `errorText` property.
 */
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
          console.error(outputText.join(''));
        }

        if (errorText) {
          console.error(errorText.join(''));
        }

        reject(new ExecuteCommandError('The command failed', exitCode));
        return;
      }

      resolve({
        outputText: outputText.join(''),
        errorText: errorText.join(''),
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

export async function getCommitBranch(repoDir: string): Promise<string> {
  // equivalent to git rev-parse --abbrev-ref HEAD
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
