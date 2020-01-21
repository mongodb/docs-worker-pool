const StagingUtils = require("./stagingUtils");

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

  const upstreamConfig = await StagingUtils.checkUpstreamConfiguration(branchName);
  const upstreamName = StagingUtils.getUpstreamName(upstreamConfig).trim(); //remove \n
  
  const doesRemoteHaveLocalBranch = await StagingUtils.doesRemoteHaveLocalBranch(branchName);
  const branchNameForPayload = doesRemoteHaveLocalBranch ? branchName : upstreamName;

  // toggle btwn create patch from commits or what you have saved locally
  if (patchFlag === "commit") {

    const { firstCommit, lastCommit } = await StagingUtils.getGitCommits();
    const patch = await StagingUtils.getGitPatchFromCommits(
      firstCommit,
      lastCommit
    );
    const payLoad = await StagingUtils.createPayload(
      repoName,
      branchNameForPayload,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );

    try {
      StagingUtils.insertJob(
        payLoad,
        `Github Push: ${userName}/repoName`,
        userName,
        userEmail
      );
    } catch (error) {
      console.error(err);
    }
  }

  if (patchFlag === "local") {
    const patch = await StagingUtils.getGitPatchFromLocal(upstreamName);
    const payLoad = await StagingUtils.createPayload(
      repoName,
      branchNameForPayload,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );

    try {
      StagingUtils.insertJob(
        payLoad,
        `Github Push: ${userName}/repoName`,
        userName,
        userEmail
      );
    } catch (error) {
      console.error(err);
    }


  }

  await StagingUtils.deletePatchFile();
}

main();
