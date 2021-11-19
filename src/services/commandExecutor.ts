import cp from 'child_process';
import c from 'config';

export class CommandExecutorResponse {
    status: string;
    output: any | null;
    error: any | null;
}

export interface ICommandExecutor {
    execute(commands: Array<string>): Promise<CommandExecutorResponse>;
}

export interface IJobCommandExecutor extends ICommandExecutor {
    getSnootyProjectName(repoDirName): Promise<CommandExecutorResponse>;
    getServerUser(): Promise<CommandExecutorResponse>;
}

export interface IGithubCommandExecutor {
    checkoutBranchForSpecificHead(repoDirName:string, branchName:string, commitHash:string): Promise<CommandExecutorResponse>;
    pullRepo(repoDirName:string, branchName:string, commitHash:string| null | undefined): Promise<CommandExecutorResponse>;
    applyPatch(repoDirName:string, patchName:string): Promise<CommandExecutorResponse>;
}

export class ShellCommandExecutor implements ICommandExecutor {
    async execute(commands: string[]): Promise<CommandExecutorResponse> {
        let resp = new CommandExecutorResponse();
        
        try {
            const stdout = cp.execSync(commands.join(' && '), {maxBuffer : c.get('MAX_STDOUT_BUFFER_SIZE')});
            resp.output = stdout?.toString().trim();
            resp.status = 'success';
            return resp;
        } catch (error) {
            resp.output = null;
            resp.error = error;
            resp.error.stdout = error?.stdout?.toString();
            resp.error.stderr = error?.stderr?.toString();
            resp.status = 'failed';
        }
        return resp;
    }
}

export class JobSpecificCommandExecutor extends ShellCommandExecutor implements IJobCommandExecutor {

    async getSnootyProjectName(repoDirName: any): Promise<CommandExecutorResponse> {
        const commands = [
            `. /venv/bin/activate`,
            `cd ~/repos/${repoDirName}`,
            `make get-project-name`
        ];
        return await this.execute(commands);
    }

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