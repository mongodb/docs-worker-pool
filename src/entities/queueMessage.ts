import { JobStatus } from './job';

export class JobQueueMessage {
  jobId: string;
  jobStatus: JobStatus;
  tries: number;
  xrayTraceId?: string = process.env._X_AMZN_TRACE_ID;
  taskId?: string;

  constructor(jobId: string, status: JobStatus, tries = 0, taskId?: string) {
    this.jobId = jobId;
    this.jobStatus = status;
    this.tries = tries;

    if (taskId) this.taskId = taskId;
  }
}
