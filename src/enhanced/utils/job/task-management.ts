import axios from 'axios';
export async function protectTask() {
  const { ECS_AGENT_URI } = process.env;

  if (!ECS_AGENT_URI) throw new Error('ERROR! No agent URI defined');

  try {
    await axios.put(`${ECS_AGENT_URI}/task-protection/v1/state`, {
      ProtectionEnabled: true,
    });
  } catch (e) {
    console.error('ERROR! Could not protect task', e);
    throw e;
  }
}
