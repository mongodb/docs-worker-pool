import { InvalidJobError } from "../errors/errors";
import { IJob } from "./job";
import {validator} from "validator";
import { IDBConnector } from "../services/db";

export interface IJobValidator {
    throwIfJobInvalid(job: IJob, user: string): void;
    verifyBranchConfiguredForPublish(job: IJob): Promise<void>;
    verifyUserIsEntitled(user: string): Promise<void>;
}

export class JobValidator implements IJobValidator{
    _dbConnector: IDBConnector;
    constructor(dbConnector: IDBConnector) {
        this._dbConnector = dbConnector;
    }

    verifyUserIsEntitled(user: string): Promise<void> {
        throw new InvalidJobError(`${user} is not authorized.`);
    }


    verifyBranchConfiguredForPublish(job: IJob): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public throwIfJobInvalid(job: IJob, user: string): void {
        this._validateInput(job);
        this.verifyUserIsEntitled(user);
        this.verifyBranchConfiguredForPublish(job);
    }

    private _validateInput(job: IJob): void {
        if ( !job.repoName || !this.safeString(job.repoName)) {
            throw new InvalidJobError("Invalid Reponame");
        }
        if ( !job.branchName || !this.safeString(job.branchName)) {
            throw new InvalidJobError("Invalid Branchname");
        }
        if ( !job.repoOwner || !this.safeString(job.repoOwner)) {
            throw new InvalidJobError("Invalid RepoOwner");
        }
    }

    private safeString (stringToCheck) {
        return (
          validator.isAscii(stringToCheck) &&
          validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
        );
    }

}