import { AuthorizationError, InvalidJobError } from "../errors/errors";
import {validator} from "validator";
import { IJob } from "../entities/job";
import { IFileSystemServices } from "../services/fileServices";
import { RepoEntitlementsRepository } from "../repositories/repoEntitlementsRepository";

export interface IJobValidator {
    throwIfJobInvalid(job: IJob): void;
    throwIfBranchNotConfigured(job: IJob): Promise<void>;
    throwIfUserNotEntitled(job: IJob): Promise<void>;
    throwIfItIsNotPublishable(job:IJob): void;
}

export class JobValidator implements IJobValidator{
    _fileSystemService: IFileSystemServices;
    _repoEntitlementRepository: RepoEntitlementsRepository;
    constructor(fileSystemService:IFileSystemServices, repoEntitlementRepository: RepoEntitlementsRepository) {
        this._fileSystemService = fileSystemService;
        this._repoEntitlementRepository = repoEntitlementRepository;
    }

    async throwIfUserNotEntitled(job: IJob): Promise<void> {
          const entitlementsObject = await this._repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job.user);
          if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.indexOf(`${job.payload.repoOwner}/${job.payload.repoName}`) === -1) {
            throw new AuthorizationError(`${job.user} is not entitled for repo ${job.payload.repoName}`);
          }
    }

    async throwIfBranchNotConfigured(job: IJob): Promise<void> {
        let response = await this._fileSystemService.downloadYaml(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/${job.payload.repoName}.yaml`);
        if (response['status'] == 'success') {
            job.payload.publishedBranches = response['content'];
        } else {
            throw new AuthorizationError(`Invalid publish branches file for ${job.payload.repoName}`);
        }
    }

    throwIfItIsNotPublishable(job:IJob): void {
        const publishedBranches = job.payload.publishedBranches.git.branches.published;
        job.payload["stableBranch"] = ( job.payload.publishedBranches.content.version.stable === job.payload.branchName && (job.payload.primaryAlias || ! job.payload.aliased) )   ? '-g' : "";
        if ( !publishedBranches.includes(job.payload.branchName)) {
            throw new AuthorizationError(`${job.payload.branchName} is not configured for publish`);
        }
    }

    public throwIfJobInvalid(job: IJob): void {
        this._validateInput(job);
        this.throwIfUserNotEntitled(job);
        this.throwIfBranchNotConfigured(job);
        this.throwIfItIsNotPublishable(job);
    }

    private _validateInput(job: IJob): void {
        if (!(job.payload.jobType in ["githubPush", "productionDeploy", "publishDochub", "regression"])) {
            throw new InvalidJobError("Invalid JobType"); 
        }
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