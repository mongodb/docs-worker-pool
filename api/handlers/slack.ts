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

// export async function buildEntitledBranchList(entitlement: any, repoBranchesRepository: RepoBranchesRepository) {
//   const entitledBranches: string[] = [];
//   for (const repo of entitlement.repos) {
//     const [repoOwner, repoName, directoryPath] = repo.split('/');
//     const branches = await repoBranchesRepository.getRepoBranches(repoName, directoryPath);
//     for (const branch of branches) {
//       const buildWithSnooty = branch['buildsWithSnooty'];
//       if (buildWithSnooty) {
//         const active = branch['active'];
//         const repoPath = `${repoOwner}/${repoName}${directoryPath ? '/' + directoryPath : ''}/${
//           branch['gitBranchName']
//         }`;
//         if (!active) {
//           entitledBranches.push(`(!inactive) ${repoPath}`);
//         } else {
//           entitledBranches.push(repoPath);
//         }
//       }
//     }
//   }
//   return entitledBranches.sort();
// }

//if person is admin, get all prod deployable repos
export async function buildEntitledGroupsList(entitlement: any, repoBranchesRepository: RepoBranchesRepository) {
  const repoOptions: any[] = [];
  for (const repo of entitlement.repos) {
    const [repoOwner, repoName, directoryPath] = repo.split('/');

    const branches = await repoBranchesRepository.getRepoBranches(repoName, directoryPath);
    const options: any[] = [];
    for (const branch of branches) {
      const buildWithSnooty = branch['buildsWithSnooty'];
      if (buildWithSnooty) {
        const active = branch['active'];
        const branchName = `${directoryPath ? '/' + directoryPath : ''}/${branch['gitBranchName']}`;
        const repoPath = `${repoOwner}/${repoName}/${branchName}`;
        let txt: string;
        if (!active) {
          txt = `(!inactive) ${branchName}`;
        } else {
          txt = branchName;
        }
        options.push({
          text: {
            type: 'plain_text',
            text: txt,
          },
          value: repoPath,
        });
      }
    }

    //create a sort function to sort the options by their text
    const repoOption = {
      label: {
        type: 'plain_text',
        text: repoName,
      },
      options: options.sort((branchOne, branchTwo) => {
        return branchOne.text.text.localeCompare(branchTwo.text.text);
      }),
    };
    repoOptions.push(repoOption);
  }
  return repoOptions;
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
