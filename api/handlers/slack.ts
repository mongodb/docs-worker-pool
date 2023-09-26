import * as c from 'config';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';

export function isUserEntitled(entitlementsObject: any): boolean {
  return (entitlementsObject?.repos?.length ?? 0) > 0;
}

export function isRestrictedToDeploy(userId: string): boolean {
  const { restrictedProdDeploy, entitledSlackUsers } = c.get<any>('prodDeploy');
  return restrictedProdDeploy && !entitledSlackUsers.includes(userId);
}

export function prepResponse(statusCode, contentType, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body,
  };
}

export async function buildEntitledBranchList(entitlement: any, repoBranchesRepository: RepoBranchesRepository) {
  const entitledBranches: string[] = [];
  for (const repo of entitlement.repos) {
    const [repoOwner, repoName] = repo.split('/');
    const branches = await repoBranchesRepository.getRepoBranches(repoName);
    for (const branch of branches) {
      let buildWithSnooty = true;
      if ('buildsWithSnooty' in branch) {
        buildWithSnooty = branch['buildsWithSnooty'];
      }
      if (buildWithSnooty) {
        entitledBranches.push(`${repoOwner}/${repoName}/${branch['gitBranchName']}`);
      }
    }
  }
  return entitledBranches.sort();
}

export function getQSString(qs: string) {
  const key_val = {};
  const arr = qs.split('&');
  if (arr) {
    arr.forEach((keyval) => {
      const kvpair = keyval.split('=');
      key_val[kvpair[0]] = kvpair[1];
    });
  }
  return key_val;
}
