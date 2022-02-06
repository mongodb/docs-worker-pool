import { JobStatus } from './job';

export class JobQueueMessage {
  jobId: string;
  jobStatus: JobStatus;
  constructor(jobId: string, status: JobStatus) {
    this.jobId = jobId;
    this.jobStatus = status;
  }
}
