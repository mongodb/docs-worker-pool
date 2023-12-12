import { executeCliCommand } from '../../../src/commands/src/helpers';

export async function handler() {
  try {
    const results = await executeCliCommand({
      command: 'snooty',
      args: ['create-cache'],
    });

    console.log('results', results);
  } catch (e) {
    console.error('got error', e);
  }
  return null;
}
