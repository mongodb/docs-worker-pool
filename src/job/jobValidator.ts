import { AuthorizationError, InvalidJobError } from "../errors/errors";
import validator from "validator";
import { IJob } from "../entities/job";
import { IFileSystemServices } from "../services/fileServices";
import { RepoEntitlementsRepository } from "../repositories/repoEntitlementsRepository";
import { IConfig } from "config";

export interface IJobValidator {
    throwIfJobInvalid(job: IJob): Promise<void>;
    throwIfBranchNotConfigured(job: IJob): Promise<void>;
    throwIfUserNotEntitled(job: IJob): Promise<void>;
    throwIfItIsNotPublishable(job: IJob): void;
}

export class JobValidator implements IJobValidator {
    _fileSystemService: IFileSystemServices;
    _repoEntitlementRepository: RepoEntitlementsRepository;
    _config: IConfig;
    constructor(fileSystemService: IFileSystemServices, repoEntitlementRepository: RepoEntitlementsRepository, config:IConfig) {
        this._fileSystemService = fileSystemService;
        this._repoEntitlementRepository = repoEntitlementRepository;
        this._config = config
    }

    async throwIfUserNotEntitled(job: IJob): Promise<void> {
        const entitlementsObject = await this._repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job.user);
        if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.indexOf(`${job.payload.repoOwner}/${job.payload.repoName}`) === -1) {
            throw new AuthorizationError(`${job.user} is not entitled for repo ${job.payload.repoName}`);
        }
    }

    async throwIfBranchNotConfigured(job: IJob): Promise<void> {
        const publishBranches = this._config.get<any>('publishBranchesUrl');
        const env = this._config.get<string>('env');
        let response = await this._fileSystemService.downloadYaml(`${publishBranches[env]}/${job.payload.repoName}.yaml`);
        if (response['status'] == 'success') {
            job.payload.publishedBranches = response['content'];
        } else {
            throw new AuthorizationError(`Invalid publish branches file for ${job.payload.repoName}`);
        }
    }

    throwIfItIsNotPublishable(job: IJob): void {
        let publishedBranches = [''];
        if (job.payload.publishedBranches) {
            publishedBranches = job.payload.publishedBranches.git.branches.published;
            job.payload["stableBranch"] = (job.payload.publishedBranches.version.stable === job.payload.branchName && (job.payload.primaryAlias || !job.payload.aliased)) ? '-g' : "";
        }
        if (!publishedBranches.includes(job.payload.branchName)) {
            throw new AuthorizationError(`${job.payload.branchName} is not configured for publish`);
        }
    }

    public async throwIfJobInvalid(job: IJob): Promise<void> {
        this._validateInput(job);
        if (this.isProd(job.payload.jobType)) {
            await this.throwIfUserNotEntitled(job);
        }
    }

    private isProd(jobType: string): boolean {
        return jobType === 'productionDeploy';
    }

    private _validateInput(job: IJob): void {
        if (!(["githubPush", "productionDeploy", "publishDochub", "regression"].includes(job.payload.jobType))) {
            throw new InvalidJobError("Invalid JobType");
        }
        if (!job.payload.repoName || !this.safeString(job.payload.repoName)) {
            throw new InvalidJobError("Invalid Reponame");
        }
        if (!job.payload.branchName || !this.safeString(job.payload.branchName)) {
            throw new InvalidJobError("Invalid Branchname");
        }
        if (!job.payload.repoOwner || !this.safeString(job.payload.repoOwner)) {
            throw new InvalidJobError("Invalid RepoOwner");
        }
    }

    private safeString(stringToCheck: string) {
        return (
            validator.isAscii(stringToCheck) &&
            validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
        );
    }

}