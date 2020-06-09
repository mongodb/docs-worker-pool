exports = function(commitHash, testJobs, prodJobs){
  const repos = context.functions.execute('getReposApprovedForTesting');
  var summaryMsg = 'This is the summary of the regression tests:\n'

  repos.forEach((repo) => {
    console.log(repo.name)
    const testJob = testJobs[repo.name];
    const prodJob = prodJobs[repo.name];
    let testTime;
    let prodTime;
    let testLink;
    let prodLink;
    let testLinkCode;
    let prodLinkCode;

    //compare status
    const testStatus = testJob.status;
    const prodStatus = prodJob.status;
  
    summaryMsg += `${repo.name} on staging: ${testStatus} \n ${repo.name} on production: ${prodStatus}\n\n`
  });
  
  context.functions.execute('sendSummaryOnSlack', summaryMsg);

};