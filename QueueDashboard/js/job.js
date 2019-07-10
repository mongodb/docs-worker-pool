// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient(window.STITCH_APP_ID);

stitchClient.auth.loginWithCredential(new stitch.AnonymousCredential()).then(user => {
	console.log(`Logged in as anonymous user with id ${user.id}`);

	/***************************************************************************** 
	 *                 Get the current job by its _id field                      *
	 *****************************************************************************/
    const url = new URL(window.location.href);
    const dict = {};
    url.searchParams.forEach((v,k) => { dict[k] = v });
    
    // Would like to switch this out eventually
    stitchClient.callFunction("getJobById", [dict["jobId"]]).then(result => {
        const job = {
            _id: result._id.toString(), 
            title: result.title, 
            user: result.user, 
            email: result.email, 
            priority: result.priority, 
            status: result.status, 
            createdTime: formatDate(result.createdTime), 
            startTime: formatDate(result.startTime), 
            endTime: formatDate(result.endTime), 
            numFailures: result.numFailures, 
            failures: result.failures, 
            result: result.result,
            payload: result.payload,
            logs: result.logs,
        }

        for (const failure of job.failures) {
            failure.time = formatDate(failure.time);
        }

        $('#json-renderer').jsonViewer(job);
    }).catch(err => {
        console.log(err)
    }); 
 });