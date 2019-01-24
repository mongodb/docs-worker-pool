// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient("workerpool-boxgs");

stitchClient.auth.loginWithCredential(new stitch.AnonymousCredential()).then(user => {
	console.log(`Logged in as anonymous user with id ${user.id}`);

	// Get Atlas client
	// const mongoClient = stitchClient.getServiceClient(
	// 	stitch.RemoteMongoClient.factory,
	// 	"mongodb-atlas"
	// );
	
	// Get a reference to the items database
	// const itemsCollection = mongoClient.db("pool").collection("queue");

	/***************************************************************************** 
	 *                 Get the current job by its _id field                      *
	 *****************************************************************************/
    const url = new URL(window.location.href);
    const dict = {};
    url.searchParams.forEach((v,k) => { dict[k] = v });

    // console.log(dict["jobId"])
    // let id = new ObjectId.createFromHexString(dict["jobId"]);
    // console.log(id);
    // console.log(id.id)
    // console.log(id.id.length)
	// itemsCollection.find({_id: id}, {limit: 1}).first().then(result => {
    //     if (result) {
    //         console.log(result)
    //         job = {
    //             _id: result._id.toString(), 
    //             title: result.title, 
    //             user: result.user, 
    //             email: result.email, 
    //             priority: result.priority, 
    //             status: result.status, 
    //             createdTime: formatDate(result.createdTime), 
    //             startTime: formatDate(result.startTime), 
    //             endTime: formatDate(result.endTime), 
    //             numFailures: result.numFailures, 
    //             failures: result.failures, 
    //             result: result.result,
    //             payload: result.payload,
    //         }
    
    //         for(i in job.failures) {
    //             job.failures[i].time = formatDate(job.failures[i].time);
    //         }
    //         $('#json-renderer').jsonViewer(job); 
    //     } else {
    //         console.log("Couldnt find job")
    //     }
	// }).catch(err => {
	// 	console.log(err);
    // });
    
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