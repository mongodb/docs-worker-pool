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
    const bucketName =
      process.env.USE_CUSTOM_BUCKETS === 'true'
        ? process.env.FEATURE_NAME + repo_info['bucket'][env]
        : repo_info['bucket'][env];

    if (this.currJob.payload.regression) {
      env = 'regression';
      process.env.REGRESSION = 'true';
    }
    process.env.BUCKET = bucketName;
    process.env.URL = repo_info['url'][env];

    // Writers are tying to stage it, so lets update the staging bucket.
    if (env == 'prd' && this.currJob.payload.jobType == 'githubPush') {
      process.env.BUCKET = bucketName + '-staging';
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
