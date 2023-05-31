import { execFileSync } from 'child_process';

export function getCurrentBranch() {
  const branchName = execFileSync('git', ['branch', '--show-current']);

  return branchName.toString();
}
