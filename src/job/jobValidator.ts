import { AuthorizationError, InvalidJobError } from '../errors/errors';
import validator from 'validator';
import { IJob } from '../entities/job';
import { IFileSystemServices } from '../services/fileServices';
import { RepoEntitlementsRepository } from '../repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';

export interface IJobValidator {
  throwIfJobInvalid(job: IJob): Promise<void>;
  throwIfBranchNotConfigured(job: IJob): Promise<void>;
  throwIfUserNotEntitled(job: IJob): Promise<void>;
  throwIfNotPublishable(job: IJob): void;
}

export class JobValidator implements IJobValidator {
  _fileSystemService: IFileSystemServices;
  _repoEntitlementRepository: RepoEntitlementsRepository;
  _repoBranchesRepository: RepoBranchesRepository;
  constructor(
    fileSystemService: IFileSystemServices,
    repoEntitlementRepository: RepoEntitlementsRepository,
    repoBranchesRepository: RepoBranchesRepository
  ) {
    this._fileSystemService = fileSystemService;
    this._repoEntitlementRepository = repoEntitlementRepository;
    this._repoBranchesRepository = repoBranchesRepository;
  }

  async throwIfUserNotEntitled(job: IJob): Promise<void> {
    const entitlementsObject = await this._repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job.user);
    if (!entitlementsObject?.repos?.includes(`${job.payload.repoOwner}/${job.payload.repoName}`)) {
      throw new AuthorizationError(`${job.user} is not entitled for repo ${job.payload.repoName}`);
    }
  }

  async throwIfBranchNotConfigured(job: IJob): Promise<void> {
    job.payload.repoBranches = await this._repoBranchesRepository.getRepoBranchesByRepoName(job.payload.repoName);
    if (!job.payload?.repoBranches) {
      throw new AuthorizationError(`repoBranches not found for ${job.payload.repoName}`);
    }
  }

  throwIfNotPublishable(job: IJob): void {
    let found = false;
    if (job?.payload?.repoBranches) {
      job.payload.repoBranches['branches'].forEach((branch) => {
        if (branch['gitBranchName'] === job.payload.branchName) {
          found = true;
          return;
        }
      });
    }
    if (!found) {
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
    if (!['githubPush', 'productionDeploy', 'publishDochub', 'regression'].includes(job.payload.jobType)) {
      throw new InvalidJobError('Invalid JobType');
    }
    if (!job.payload?.repoName || !this.safeString(job.payload.repoName)) {
      throw new InvalidJobError('Invalid Reponame');
    }
    if (!job.payload?.branchName || !this.safeString(job.payload.branchName)) {
      throw new InvalidJobError('Invalid Branchname');
    }
    if (!job.payload?.repoOwner || !this.safeString(job.payload.repoOwner)) {
      throw new InvalidJobError('Invalid RepoOwner');
    }
  }

  private safeString(stringToCheck: string) {
    return validator.isAscii(stringToCheck) && validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/);
  }
}
