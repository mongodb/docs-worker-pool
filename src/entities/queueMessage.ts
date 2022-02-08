import { timingSafeEqual } from 'crypto';
import { JobStatus } from './job';

export class JobQueueMessage {
  jobId: string;
  jobStatus: JobStatus;
  tries: number;
  constructor(jobId: string, status: JobStatus, tries = 0) {
    this.jobId = jobId;
    this.jobStatus = status;
    this.tries = tries;
  }
}
