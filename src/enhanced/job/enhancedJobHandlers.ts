import { JobHandler } from '../../job/jobHandler';
import { ManifestJobHandler } from '../../job/manifestJobHandler';
import { ProductionJobHandler } from '../../job/productionJobHandler';
import { RegressionJobHandler } from '../../job/regressionJobHandler';
import { StagingJobHandler } from '../../job/stagingJobHandler';

/**
 * This method overrides the JobHandler's current setEnvironmentVariablesMethod so that it points to
 * the custom buckets that are used in the enhanced app.
 * @param this reference to current object
 */
async function setEnvironmentVariablesEnhanced(this: JobHandler) {
  const repo_info = await this._repoBranchesRepo.getRepoBranchesByRepoName(this.currJob.payload.repoName);

  let env = this._config.get<string>('env');
  this.logger.info(
    this.currJob._id,
    `setEnvironmentVariables for ${this.currJob.payload.repoName} env ${env} jobType ${this.currJob.payload.jobType}`
  );
  if (repo_info?.['bucket'] && repo_info?.['url']) {
    const enhancedBucketName = 'enhancedApp-' + repo_info['bucket'][env]; // Hard coding this for now to simplify testing
    if (this.currJob.payload.regression) {
      env = 'regression';
      process.env.REGRESSION = 'true';
    }
    process.env.BUCKET = enhancedBucketName;
    process.env.URL = repo_info['url'][env];

    // Writers are tying to stage it, so lets update the staging bucket.
    if (env == 'prd' && this.currJob.payload.jobType == 'githubPush') {
      process.env.BUCKET = enhancedBucketName + '-staging';
      process.env.URL = repo_info['url']['stg'];
    }
  }

  if (process.env.BUCKET) {
    this.logger.info(this.currJob._id, process.env.BUCKET);
  }
  if (process.env.URL) {
    this.logger.info(this.currJob._id, process.env.URL);
  }
}

export class EnhancedProductionJobHandler extends ProductionJobHandler {
  override setEnvironmentVariables = setEnvironmentVariablesEnhanced;
}
export class EnhancedStagingJobHandler extends StagingJobHandler {
  override setEnvironmentVariables = setEnvironmentVariablesEnhanced;
}
export class EnhancedRegressionJobHandler extends RegressionJobHandler {
  override setEnvironmentVariables = setEnvironmentVariablesEnhanced;
}
export class EnhancedManifestJobHandler extends ManifestJobHandler {
  override setEnvironmentVariables = setEnvironmentVariablesEnhanced;
}
