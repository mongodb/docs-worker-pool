import { executeCliCommand } from '../../../src/commands/src/helpers';

interface TestEvent {
  repoName: string;
}

export async function handler(event: TestEvent) {
  console.log('event', event);

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
