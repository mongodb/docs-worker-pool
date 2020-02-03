const StagingUtils = require("./stagingUtils");

async function main() {

  const patchFlag = process.argv[2];
  const buildSize = process.argv[3];
  
  let url;
  let upstreamConfig;
  let upstreamName;
  let doesRemoteHaveLocalBranch;
  let branchName;
  let repoName;
  let userEmail;
  const newHead = "newHead";
  
  try {
    StagingUtils.validateConfiguration();
  } catch (error) {
    return
  }

  if (patchFlag === undefined) {
    console.log(
      'You need a patch flag("commit" or "local") in your make command'
    );
    return;
  }

  let invalidFlag = false;

  if (patchFlag !== "local" && patchFlag !== "commit") {
    console.log(
      'Invalid patch flag. Use "commit" to stage a build from the committed work you have locally or use "local" to stage a build from the uncommitted work you have locally'
    );
    invalidFlag = true;
  }

  if (invalidFlag === true) {
    return;
  }
  
  try {
    userEmail = await StagingUtils.getGitEmail();
  } catch (error) {
    return
  }
  
  try {
    url = await StagingUtils.getRepoInfo();
  } catch (error) {
    return
  }

  const repoOwner = StagingUtils.getGitUser(url);

  try {
    repoName = StagingUtils.getRepoName(url);
  } catch (error) {
    return
  }

  try {
    branchName = await StagingUtils.getBranchName();
  } catch (error) {
    return
  }

  try {
    upstreamConfig = await StagingUtils.checkUpstreamConfiguration(branchName);
  } catch (error) {
    return
  }
  
  try {
    upstreamName = StagingUtils.getUpstreamName(upstreamConfig).trim(); //remove \n
  } catch (error) {
    return
  }
  
  try {
    doesRemoteHaveLocalBranch = await StagingUtils.doesRemoteHaveLocalBranch(branchName);
  } catch (error) {
    return;
  }
  
  const branchNameForPayload = doesRemoteHaveLocalBranch ? branchName : upstreamName;

  // toggle btwn create patch from commits or what you have saved locally
  if (patchFlag === "commit") {
    let firstCommit; 
    let lastCommit;

    try {
      const commits = await StagingUtils.getGitCommits();
      firstCommit = commits[0];
      lastCommit = commits[1];
    } catch (error) {
      console.error(error);
      return;
    }

    const patch = await StagingUtils.getGitPatchFromCommits(
      firstCommit,
      lastCommit
    );
    const payLoad = StagingUtils.createPayload(
      repoName,
      branchNameForPayload,
      repoOwner,
      url,
      patch,
      buildSize,
      newHead
    );

    try {
      StagingUtils.insertJob(
        payLoad,
        `Github Push: ${repoOwner}/${repoName}`,
        repoOwner,
        userEmail
      );
    } catch (error) {
      console.error(err);
    }
  }

  if (patchFlag === "local") {
    const patch = await StagingUtils.getGitPatchFromLocal(upstreamName);
    const payLoad = StagingUtils.createPayload(
      repoName,
      branchNameForPayload,
      repoOwner,
      url,
      patch,
      buildSize,
      newHead
    );

    try {
      await StagingUtils.insertJob(
        payLoad,
        `Github Push: ${repoOwner}/${repoName}`,
        repoOwner,
        userEmail
      );
    } catch (error) {
      console.error(err);
    }


  }

  await StagingUtils.deletePatchFile();
}

main();
