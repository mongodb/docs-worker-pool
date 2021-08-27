export class CommandExecutorResponse {
    status: string;
    output: Array<string>;
    error:  Array<string>; 
}
export interface ICommandExecutor {
    execute(commands: Array<string>): Promise<CommandExecutorResponse>;
}

export class ShellCommandExecutor implements ICommandExecutor {
    execute(commands: string[]): Promise<CommandExecutorResponse> {
        throw new Error("Method not implemented.");
    }
    
}