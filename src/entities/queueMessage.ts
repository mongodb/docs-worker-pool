import { timingSafeEqual } from 'crypto';
import { JobStatus } from './job';

export class JobQueueMessage {
  jobId: string;
  jobStatus: JobStatus;
  tries: number;
  taskId?: string;

  constructor(jobId: string, status: JobStatus, tries = 0, taskId?: string) {
    this.jobId = jobId;
    this.jobStatus = status;
    this.tries = tries;

    if (taskId) this.taskId = taskId;
  }
}
