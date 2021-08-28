import { InvalidJobError } from "../errors/errors";
import {validator} from "validator";
import { IDBConnector } from "../services/db";
import { IJob } from "../entities/job";

export interface IJobValidator {
    throwIfJobInvalid(job: IJob): void;
    verifyBranchConfiguredForPublish(job: IJob): Promise<void>;
    verifyUserIsEntitled(job: IJob): Promise<void>;
}

export class JobValidator implements IJobValidator{
    _dbConnector: IDBConnector;
    constructor(dbConnector: IDBConnector) {
        this._dbConnector = dbConnector;
    }

    verifyUserIsEntitled(job: IJob): Promise<void> {
        throw new InvalidJobError(`${job.user} is not authorized.`);
    }


    verifyBranchConfiguredForPublish(job: IJob): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public throwIfJobInvalid(job: IJob): void {
        this._validateInput(job);
        this.verifyUserIsEntitled(job);
        this.verifyBranchConfiguredForPublish(job);
    }

    private _validateInput(job: IJob): void {
        if ( !job.payload.repoName || !this.safeString(job.payload.repoName)) {
            throw new InvalidJobError("Invalid Reponame");
        }
        if ( !job.payload.branchName || !this.safeString(job.payload.branchName)) {
            throw new InvalidJobError("Invalid Branchname");
        }
        if ( !job.payload.repoOwner || !this.safeString(job.payload.repoOwner)) {
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