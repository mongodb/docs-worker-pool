const StagingUtils = require('./stagingUtils');

async function main() {
  const patchFlag = process.argv[2];
  const buildSize = process.argv[3];

  StagingUtils.validateConfiguration();

  if (patchFlag === undefined) {
    console.log(
      'You need a patch flag("commit" or "local") in your make command'
    );
    return;
  }

  let invalidFlag = false;

  if (buildSize !== undefined && buildSize !== "repo") {
    console.log('Invalid build size. Use "world" or "repo"');
    invalidFlag = true;
  }

  if (patchFlag !== "local" && patchFlag !== "commit") {
    console.log(
      'Invalid patch flag. Use "commit" to stage a build from the committed work you have locally or use "local" to stage a build from the uncommitted work you have locally'
    );
    invalidFlag = true;
  }

  if (invalidFlag === true) {
    return;
  }


  const userName = await StagingUtils.getGitUser();
  const userEmail = await StagingUtils.getGitEmail();
  const url = await StagingUtils.getRepoInfo();
  const repoName = StagingUtils.getRepoName(url);
  const branchName = await StagingUtils.getBranchName();
  const newHead = "newHead";
  
  // toggle btwn create patch from commits or what you have saved locally
  if (patchFlag === "commit") {
    const { firstCommit, lastCommit } = await StagingUtils.getGitCommits();
    const patch = await StagingUtils.getGitPatchFromCommits(firstCommit, lastCommit);
    const payLoad = await StagingUtils.createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );
    const success = StagingUtils.insertJob(
      payLoad,
      `Github Push: ${userName}/repoName`,
      userName,
      userEmail
    )
    if (success !== true){
      console.log("Failure!")
    }
  }

  if (patchFlag === "local") {
    const upstreamBranchSet = await StagingUtils.getUpstreamBranch(branchName)
    if (upstreamBranchSet === false){
      return;
    }
    const patch = await StagingUtils.getGitPatchFromLocal(branchName);
    const payLoad = await StagingUtils.createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );
    const success = StagingUtils.insertJob(
      payLoad,
      `Github Push: ${userName}/repoName`,
      userName,
      userEmail
    );

    if (success !== true){
      console.log("Failure!")
    }
    
  }

  await StagingUtils.deletePatchFile();
}

main();
