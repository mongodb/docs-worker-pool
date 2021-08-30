import { InvalidJobError } from "../errors/errors";
import { JobHandler } from "./jobHandler";
import {validator} from "validator";

export class StagingJobHandler extends JobHandler {
    throwIfJobInvalid(): void {
        if ( !this._currJob.payload.repoName ) {
            throw new InvalidJobError("Reponame is null or empty");
        }
        if ( !this._currJob.payload.branchName ) {
            throw new InvalidJobError("Branchname is null or empty");
        }
    }
    prepCommands(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    build():  Promise<void> {
        throw new Error("Method not implemented.");
    }
    publish():  Promise<void> {
        throw new Error("Method not implemented.");
    }
}