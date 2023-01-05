import { BranchEntry } from '../../associated_products';

export const prefixFromEnvironment = (repoBranchEntry: BranchEntry) => {
  const env = process.env.SNOOTY_ENV ?? 'dotcomprd';
  return {
    url: repoBranchEntry.url[env],
    prefix: repoBranchEntry.prefix[env],
  };
};
