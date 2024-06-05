import { AuthorizationError, InvalidJobError } from '../errors/errors';
import validator from 'validator';
import type { Job } from '../entities/job';
import { IFileSystemServices } from '../services/fileServices';
import { RepoEntitlementsRepository } from '../repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { DocsetsRepository } from '../repositories/docsetsRepository';
import { MONOREPO_NAME } from '../monorepo/utils/monorepo-constants';

export interface IJobValidator {
  throwIfJobInvalid(job: Job): Promise<void>;
  throwIfBranchNotConfigured(job: Job): Promise<void>;
  throwIfUserNotEntitled(job: Job): Promise<void>;
  throwIfNotPublishable(job: Job): void;
}

export class JobValidator implements IJobValidator {
  _fileSystemService: IFileSystemServices;
  _repoEntitlementRepository: RepoEntitlementsRepository;
  _repoBranchesRepository: RepoBranchesRepository;
  _docsetsRepository: DocsetsRepository;
  constructor(
    fileSystemService: IFileSystemServices,
    repoEntitlementRepository: RepoEntitlementsRepository,
    repoBranchesRepository: RepoBranchesRepository,
    docsetsRepository: DocsetsRepository
  ) {
    this._fileSystemService = fileSystemService;
    this._repoEntitlementRepository = repoEntitlementRepository;
    this._repoBranchesRepository = repoBranchesRepository;
    this._docsetsRepository = docsetsRepository;
  }

  async throwIfUserNotEntitled(job: Job): Promise<void> {
    try {
      const admin = await this._repoEntitlementRepository.getIsAdmin(job.user);
      if (admin) return;
    } catch (e) {
      throw new InvalidJobError(`Invalid job user: ${job.user}`);
    }
    const entitlementsObject = await this._repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job.user);
    const entitlementToFind = `${job.payload.repoOwner}/${job.payload.repoName}${
      job.payload.repoName === MONOREPO_NAME ? `/${job.payload.directory}` : ``
    }`;
    if (!entitlementsObject?.repos?.includes(entitlementToFind)) {
      throw new AuthorizationError(`${job.user} is not entitled for repo ${entitlementToFind}`);
    }
  }

  async throwIfBranchNotConfigured(job: Job): Promise<void> {
    job.payload.repoBranches = await this._docsetsRepository.getRepoBranchesByRepoName(
      job.payload.repoName,
      job.payload.project
    );
    if (!job.payload?.repoBranches) {
      throw new AuthorizationError(`repoBranches not found for ${job.payload.repoName}`);
    }
  }

  throwIfNotPublishable(job: Job): void {
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

  public async throwIfJobInvalid(job: Job): Promise<void> {
    this._validateInput(job);
    if (this.isProd(job.payload.jobType)) {
      await this.throwIfUserNotEntitled(job);
    }
  }

  private isProd(jobType: string): boolean {
    return jobType === 'productionDeploy';
  }

  private _validateInput(job: Job): void {
    if (!job.payload.project) {
      throw new InvalidJobError('Invalid project');
    }
    // TODO: Use formalized JobTypes from job.ts
    const validJobTypes = ['githubPush', 'productionDeploy', 'publishDochub', 'regression', 'manifestGeneration'];
    if (!validJobTypes.includes(job.payload.jobType)) {
      throw new InvalidJobError(`Invalid JobType: ${job.payload.jobType}.`);
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
