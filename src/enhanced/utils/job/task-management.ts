import axios from 'axios';

interface ProtectionPutResponse {
  failure?: {
    Arn: string;
    Detail: string | null;
    Reason: string;
  };
}

/**
 * Protecting the task will prevent the task from being deleted when we do a deploy/update.
 * This means that the job will not be lost, and will continue to process like normal.
 */
export async function protectTask() {
  const { ECS_AGENT_URI } = process.env;

  if (!ECS_AGENT_URI) throw new Error('ERROR! No agent URI defined');

  try {
    const { failure } = (
      await axios.put<ProtectionPutResponse>(`${ECS_AGENT_URI}/task-protection/v1/state`, {
        ProtectionEnabled: true,
      })
    ).data;

    if (failure) {
      const { Reason, Detail } = failure;
      throw new Error(`ERROR! Could not protect task. Reason: ${Reason} \n Details: ${Detail}`);
    }
  } catch (e) {
    console.error('ERROR! Could not protect task', e);
    process.exitCode = 1;
    throw e;
  }
}
