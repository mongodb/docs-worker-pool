import { isJobStatus } from '../../../entities/job';
import { JobsQueuePayload } from '../job-types';

/**
 * Type guard to provide runtime safety when receiving messages from the JobsQueue.
 * This validates the object we receive from the queue to determine whether or not it has the correct properties.
 * Also, and most importantly, type guards make TypeScript happy!
 * @param obj the message from the queue
 * @returns {boolean} representing whether or not the object is a JobsQueuePayload
 */
export function isJobQueuePayload(obj: unknown): obj is JobsQueuePayload {
  // if obj is not defined or it is not of type object, it is not a proper jobQueue payload
  if (!obj || typeof obj !== 'object') return false;

  const unsafePayload = obj as JobsQueuePayload;

  const { jobId, jobStatus } = unsafePayload;

  // validate payload
  return typeof jobId === 'string' && isJobStatus(jobStatus);
}
