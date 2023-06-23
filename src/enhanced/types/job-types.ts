import { JobStatus } from '../../entities/job';

export interface JobsQueuePayload {
  jobId: string;
  jobStatus: JobStatus;
}
