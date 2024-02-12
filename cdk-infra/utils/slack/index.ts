import { AutoBuilderEnv } from '../env';

const dashboardUrls: Record<AutoBuilderEnv, string> = {
  stg: `https://workerpoolstaging-qgeyp.mongodbstitch.com/pages/job.html?collName=`,
  prd: `https://workerpool-boxgs.mongodbstitch.com/pages/job.html?collName=`,
  dotcomstg: `https://workerpoolstaging-qgeyp.mongodbstitch.com/pages/job.html?collName=`,
  dotcomprd: `https://workerpool-boxgs.mongodbstitch.com/pages/job.html?collName=`,
  dev: `https://workerpoolstaging-qgeyp.mongodbstitch.com/pages/job.html?collName=`,
};

export function getDashboardUrl(env: AutoBuilderEnv, jobCollection: string) {
  return dashboardUrls[env] + `${jobCollection}&jobId=`;
}
