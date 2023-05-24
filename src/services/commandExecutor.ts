import { promisify } from 'util';
import cp, { ExecOptions, ExecException, ChildProcess } from 'child_process';
import c from 'config';

// Hard assign the overloaded function signature to a variable, for promisifying purposes
// If this isn't done, promisify doesn't know which signature to pick, and throws a type error
const execWithOptions: (
  command: string,
  options: ExecOptions,
  callback?: (error: ExecException | null, stdout: string, stderr: string) => void
) => ChildProcess = cp.exec;

// This type inference for the overloaded Promisify signature is incorrectly inferring Promise<string>
// The expected return signature is a Promise<{stdout:string, stderr:string}>
const exec = promisify(execWithOptions) as any;

export class CommandExecutorResponse {
  status: string;
  output: string;
  error: string;
}

export interface ICommandExecutor {
  execute(commands: Array<string>, cwd?: string): Promise<CommandExecutorResponse>;
}

export interface IJobCommandExecutor extends ICommandExecutor {
  getServerUser(): Promise<CommandExecutorResponse>;
}

export interface IGithubCommandExecutor {
  checkoutBranchForSpecificHead(
    repoDirName: string,
    branchName: string,
    commitHash: string
  ): Promise<CommandExecutorResponse>;
  pullRepo(
    repoDirName: string,
    branchName: string,
    commitHash: string | null | undefined
  ): Promise<CommandExecutorResponse>;
  applyPatch(repoDirName: string, patchName: string): Promise<CommandExecutorResponse>;
}

export class ShellCommandExecutor implements ICommandExecutor {
  async execute(commands: string[], cwd?: string): Promise<CommandExecutorResponse> {
    const exec = promisify(cp.exec);
    const resp = new CommandExecutorResponse();
    try {
      const options: { maxBuffer: number; cwd?: string } = {
        maxBuffer: c.get('MAX_STDOUT_BUFFER_SIZE'),
      };

      if (cwd) {
        options.cwd = cwd;
      }
      const { stdout, stderr } = await exec(commands.join(' && '), options);

      resp.output = stdout.trim();
      resp.error = stderr;
      resp.status = 'success';
      return resp;
    } catch (error) {
      resp.output = '';
      resp.error = error;
      resp.status = 'failed';
    }
    return resp;
  }
}

export class JobSpecificCommandExecutor extends ShellCommandExecutor implements IJobCommandExecutor {
  async getServerUser(): Promise<CommandExecutorResponse> {
    return await this.execute(['whoami']);
  }
}

export class GithubCommandExecutor extends ShellCommandExecutor implements IGithubCommandExecutor {
  async applyPatch(repoDirName: string, patchName: string) {
    const patchCommand = [`cd repos/${repoDirName}`, `patch -p1 < ${patchName}`];
    return await this.execute(patchCommand);
  }

  async checkoutBranchForSpecificHead(
    repoDirName: string,
    branchName: string,
    newHead: string
  ): Promise<CommandExecutorResponse> {
    const commitCheckCommands = [
      `cd repos/${repoDirName}`,
      `git fetch`,
      `git checkout ${branchName}`,
      `git branch ${branchName} --contains ${newHead}`,
    ];

    return await this.execute(commitCheckCommands);
  }

  async pullRepo(
    repoDirName: string,
    branchName: string,
    newHead: string | null | undefined = null
  ): Promise<CommandExecutorResponse> {
    const pullRepoCommands = [`cd repos/${repoDirName}`, `git checkout ${branchName}`, `git pull origin ${branchName}`];
    if (newHead) {
      pullRepoCommands.push(`git checkout ${newHead} .`);
    }
    return await this.execute(pullRepoCommands);
  }
}
