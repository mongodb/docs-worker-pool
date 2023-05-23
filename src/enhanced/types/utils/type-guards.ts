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

  const {
    jobType,
    source,
    action,
    repoName,
    branchName,
    url,
    isFork,
    repoOwner,
    stable,
    primaryAlias,
    project,
    prefix,
    urlSlug,
    aliased,
    newHead,
  } = unsafePayload;

  // validate payload
  return (
    typeof jobType === 'string' &&
    typeof source === 'string' &&
    typeof action === 'string' &&
    typeof repoName === 'string' &&
    typeof branchName === 'string' &&
    typeof url === 'string' &&
    typeof isFork === 'boolean' &&
    typeof repoOwner === 'string' &&
    (typeof stable === 'undefined' || typeof stable === 'string') &&
    (typeof primaryAlias === 'undefined' || typeof primaryAlias === 'boolean') &&
    (typeof project === 'undefined' || typeof project === 'string') &&
    (typeof prefix === 'undefined' || typeof prefix === 'string') &&
    (typeof urlSlug === 'undefined' || typeof urlSlug === 'string') &&
    (typeof aliased === 'undefined' || typeof aliased === 'boolean') &&
    (typeof newHead === 'undefined' || typeof newHead === 'string') &&
    (typeof unsafePayload.private === 'undefined' || typeof unsafePayload.private === 'string') // can't object destructure private since it is a reserved word :S
  );
}
