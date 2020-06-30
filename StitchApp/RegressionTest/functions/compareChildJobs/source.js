/* Once all child processes have finished, retrieveChildJob()calls this function. 
  This function takes in two arrays of completed jobs, one for each of the environments.
  
  Currently, it only compares the status outcomes (completed or failed) between building 
  a job in staging vs in prod.
  
  Once comparisons are complete, the results are sent to the admins via slackbot message.
  
*/
exports = function(testJobs, prodJobs){
  const repos = context.functions.execute('getReposApprovedForTesting');
  var summaryMsg = 'This is the summary of the regression tests:\n'

  repos.forEach((repo) => {
    console.log(repo.name)
    const testJob = testJobs[repo.name];
    const prodJob = prodJobs[repo.name];

    //compare status
    const testStatus = testJob.status;
    const prodStatus = prodJob.status;
  
    summaryMsg += `${repo.name} on staging: ${testStatus} \n ${repo.name} on production: ${prodStatus}\n\n`
  });
  
  context.functions.execute('sendSummaryOnSlack', summaryMsg);

};