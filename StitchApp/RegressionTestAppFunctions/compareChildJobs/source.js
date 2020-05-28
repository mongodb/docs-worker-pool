exports = function(commitHash, testJobs, prodJobs){
  const repos = context.functions.execute('getReposApprovedForTesting');
  var summaryMsg = 'This is the summary of the regression tests:\n'

  repos.forEach((repo) => {
    const testJob = testJobs[repo];
    const prodJob = prodJobs[repo];
    let testTime;
    let prodTime;
    let testLink;
    let prodLink;
    let testLinkCode;
    let prodLinkCode;

    //compare status
    const testStatus = testJob.status;
    const prodStatus = prodJob.status;
  
    summaryMsg += `${repo} on staging: ${testStatus} \n ${repo} on production: ${prodStatus}\n\n`
  });
  
  context.functions.execute('sendSummaryOnSlack', summaryMsg);

};