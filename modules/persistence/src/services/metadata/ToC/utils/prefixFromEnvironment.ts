import { DocsetsDocument } from '../../repos_branches';

export const prefixFromEnvironment = (repoBranchEntry: DocsetsDocument) => {
  const env = process.env.SNOOTY_ENV ?? 'dotcomprd';
  return {
    url: repoBranchEntry.url[env],
    prefix: repoBranchEntry.prefix[env],
  };
};
