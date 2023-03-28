import { normalizePath } from './normalizePath';

export const getRedocOptionsPath = (redocPath: string) => {
  const baseRedocDir = redocPath.split('cli/')[0];
  return normalizePath(`${baseRedocDir}/options.json`);
};
