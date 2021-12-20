
import { promisify } from "util";
import cp from 'child_process';

export class CommandExecutorResponse {
    status: string;
    output: any | null;
    error: any | null;
}

export interface ICommandExecutor {
    execute(commands: Array<string>): Promise<CommandExecutorResponse>;
}

export interface IJobCommandExecutor extends ICommandExecutor {
    getServerUser(): Promise<CommandExecutorResponse>;
}

export interface IGithubCommandExecutor {
    checkoutBranchForSpecificHead(repoDirName:string, branchName:string, commitHash:string): Promise<CommandExecutorResponse>;
    pullRepo(repoDirName:string, branchName:string, commitHash:string| null | undefined): Promise<CommandExecutorResponse>;
    applyPatch(repoDirName:string, patchName:string): Promise<CommandExecutorResponse>;
}

export class ShellCommandExecutor implements ICommandExecutor {
    async execute(commands: string[]): Promise<CommandExecutorResponse> {
        let exec = promisify(cp.exec);
        let resp = new CommandExecutorResponse();
        try {
            const {
                stdout,
                stderr
            } = await exec(commands.join(' && '));
            resp.output = stdout.trim();
            resp.error = stderr;
            resp.status = 'success';
            return resp;
        } catch (error) {
            resp.output = null;
            resp.error = error;
            resp.status = 'failed';
        }
        return resp;
    }
}

export class JobSpecificCommandExecutor extends ShellCommandExecutor implements IJobCommandExecutor {

    async getServerUser(): Promise<CommandExecutorResponse> {
        return await this.execute(["whoami"]);
    }
}

export class GithubCommandExecutor extends ShellCommandExecutor implements IGithubCommandExecutor {
    async applyPatch(repoDirName: string, patchName: string) {

        const patchCommand = [
            `cd repos/${repoDirName}`,
            `patch -p1 < ${patchName}`
          ];
        return await this.execute(patchCommand);
    }

    async checkoutBranchForSpecificHead(repoDirName: string, branchName: string, newHead: string): Promise<CommandExecutorResponse> {
        const commitCheckCommands = [
                `cd repos/${repoDirName}`,
                `git fetch`,
                `git checkout ${branchName}`,
                `git branch ${branchName} --contains ${newHead}`
            ];

            return await this.execute(commitCheckCommands);

    }

    async pullRepo(repoDirName: string, branchName: string, newHead: string| null | undefined= null): Promise<CommandExecutorResponse> {
        let pullRepoCommands = [`cd repos/${repoDirName}`, 
        `git checkout ${branchName}`,
        `git pull origin ${branchName}`];
        if (newHead) {
            pullRepoCommands.push(`git checkout ${newHead} .`)
        }
        return await this.execute(pullRepoCommands);
    }
}