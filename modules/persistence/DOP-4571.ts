import * as dotenv from 'dotenv';
// dotenv.config() should be invoked immediately, before any other imports, to ensure config is present
dotenv.config();

import { pool, teardown } from './src/services/connector';

const migrate = async () => {
  const db = await pool();
  const collection = db.collection('repos_branches');
  const repos = await collection.find().toArray();

  for (let idx = 0; idx < repos.length; idx++) {
    const problematicBranches: string[] = [];
    const repo = repos[idx];
    // if (repo.branches.length === 1) {
    // 	continue;
    // }
    repo.branches.forEach((branch) => {
      if (
        !branch.publishOriginalBranchName &&
        branch.urlSlug === branch.gitBranchName &&
        !branch.urlAliases?.includes(branch.urlSlug)
      ) {
        problematicBranches.push(branch.gitBranchName);
        branch.publishOriginalBranch = true;
      }
    });
    if (problematicBranches.length) {
      console.log(`updating repo with id ${repo._id} (${repo.repoName}) for branches ${problematicBranches}`);
      await collection.updateOne({ _id: repo._id }, repo);
    }
  }

  await teardown();
};

migrate()
  .then(() => {
    console.log('finished');
  })
  .catch((e) => {
    console.error(e);
  });
