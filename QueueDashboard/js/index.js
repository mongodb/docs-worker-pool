// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient("workerpool-boxgs");

stitchClient.auth.loginWithCredential(new stitch.AnonymousCredential()).then(user => {
	console.log(`Logged in as anonymous user with id ${user.id}`);

	// Get Atlas client
	const mongoClient = stitchClient.getServiceClient(
		stitch.RemoteMongoClient.factory,
		"mongodb-atlas"
	  );
	
	// Get a reference to the items database
	const itemsCollection = mongoClient.db("pool").collection("queue");


	
	/***************************************************************************** 
	 *       Get the distributions of the status of jobs in the queue            *
	 *****************************************************************************/
	const statusAggregation = [
		{$group: {_id: "$status", count: { $sum: 1 }}}  
	];

	itemsCollection.aggregate(statusAggregation).asArray().then(results => {
		let statuses = {inQueue: 0, inProgress: 0, completed: 0, failed: 0};
		for (i in results) {
			statuses[results[i]._id] = results[i].count
		}
		document.getElementById('numFailed').innerHTML = statuses.failed;
   	  	document.getElementById('numCompleted').innerHTML = statuses.completed;
   	  	document.getElementById('numInProgress').innerHTML = statuses.inProgress;
   	  	document.getElementById('numInQueue').innerHTML = statuses.inQueue;
	}).catch(err => {
		console.log(err);
	});

	/***************************************************************************** 
	 *       Get the distributions of the names of jobs in the queue             *
	 *****************************************************************************/
	const jobNameAggregation = [
		{$group: {_id: "$title", count: { $sum: 1 }}}
	];

	itemsCollection.aggregate(jobNameAggregation).asArray().then(results => {
		data = [];
   		for (i in results) {
   			data.push({
   				label: results[i]._id, 
   				value: results[i].count,
   			});
   		}
   		Morris.Donut({
   		    element: 'morris-donut-chart',
   		    data: data,
   		    resize: true
   		});
	}).catch(err => {
		console.log(err);
	});

	/***************************************************************************** 
	 *                 Get the last 10 jobs added to the queue                   *
	 *****************************************************************************/
	let symbolsDict = {
		inQueue: 'fa fa-list-alt', 
		inProgress: 'fa fa-refresh',
		completed: 'fa fa-check-circle-o', 
		failed: 'fa fa-times-circle-o'
	}
	
	let n = 10;
	let options = {
		projection: {_id: 1, title: 1, createdTime: 1, status: 1}, 
		limit: n, 
		sort: {createdTime: -1}
	}

	itemsCollection.find({}, options).asArray().then(results => {
		let str = "";
		for (i in results) {
			let job = results[i];
			str += '<a href="job.html?jobId=' + job._id + '" class="list-group-item"><i class="'
			if (job.status in symbolsDict) {
				str += symbolsDict[job.status];
			}
   			str += '"></i> ' + job.title;
   			str += '<span class="pull-right text-muted small"><em>' + formatDate(job.createdTime) + '</em></span></a>';
		}
		document.getElementById('last10Jobs').innerHTML = str;
	}).catch(err => {
		console.log(err);
	});

	/***************************************************************************** 
	 *                 Find Jobs That Do Not Make Any Sense                      *
	 *****************************************************************************/
	let oneHourAgo = new Date();
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);

	statuses = {
		inQueue: {status: "inQueue", '$or': [{createdTime: null}, {startTime: {$ne: null}}, {endTime: {$ne: null}}, {numFailures: {$gte: 3}}]},
		inProgress: {status: "inProgress", '$or': [{createdTime: null}, {startTime: null}, {endTime: {$ne: null}}, {numFailures: {$gte: 3}}, {startTime: {$lte: oneHourAgo}}]}, 
		completed: {status: "completed", '$or': [{createdTime: null}, {startTime: null}, {endTime: null}, {numFailures: {$gte: 3}}]},
		failed: {status: "failed", '$or': [{createdTime: null},{startTime: {$ne: null}}, {endTime: {$ne: null}},  {numFailures: {$lt: 3}}]},
	}; 
	itemsCollection.find({status: {$nin: Object.keys(statuses)}}, options).asArray().then(results => {
		let str = "";
		for (i in results) {
			let job = results[i];
			console.log("Invalid Status " + JSON.stringify(job));
			str += '<a href="job.html?jobId=' + job._id + '" class="list-group-item"><i class=""></i> ' + job.title;
   			str += '<span class="pull-right text-muted small"><em>' + formatDate(job.createdTime) + '</em></span></a>';
		}
		document.getElementById('oddJobs').innerHTML += str;
	}).catch(err => {
		console.log(err);
	});

	for (status in statuses) {
		itemsCollection.find(statuses[status], options).asArray().then(results => {
			let str = "";
			for (i in results) {
				let job = results[i];
				console.log("Invalid Job: " + JSON.stringify(job));
				str += '<a href="job.html?jobId=' + job._id + '" class="list-group-item"><i class=""></i> ' + job.title;
				   str += '<span class="pull-right text-muted small"><em>' + formatDate(job.createdTime) + '</em></span></a>';
			}
			document.getElementById('oddJobs').innerHTML += str;
		}).catch(err => {
			console.log(err);
		});
	}
 });
