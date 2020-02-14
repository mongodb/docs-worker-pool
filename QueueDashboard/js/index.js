// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient(window.STITCH_APP_ID);

stitchClient.auth.loginWithCredential(new stitch.AnonymousCredential()).then(async user => {
	console.log(`Logged in as anonymous user with id ${user.id}`);

	// Get Atlas client
	const mongoClient = stitchClient.getServiceClient(
		stitch.RemoteMongoClient.factory,
		"mongodb-atlas"
	  );

	const dbValues = await stitchClient.callFunction('getDBCollection');
	
	// Get a reference to the items database
	const itemsCollection = mongoClient.db(dbValues.db_name).collection('queue');

	/***************************************************************************** 
	 *       Get the distributions of the status of jobs in the queue            *
	 *****************************************************************************/
	const statusAggregation = [
		{$group: {_id: "$status", count: { $sum: 1 }}}  
	];

	itemsCollection.aggregate(statusAggregation).asArray().then(results => {
		const statuses = {inQueue: 0, inProgress: 0, completed: 0, failed: 0};

		for (const result of results) {
			statuses[result._id] = result.count
		}

		document.getElementById('numFailed').appendChild(document.createTextNode(statuses.failed));
		document.getElementById('numCompleted').appendChild(document.createTextNode(statuses.completed));
		document.getElementById('numInProgress').appendChild(document.createTextNode(statuses.inProgress));
		document.getElementById('numInQueue').appendChild(document.createTextNode(statuses.inQueue));

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
   		for (const result of results) {
   			data.push({
   				label: result._id, 
   				value: result.count,
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
	const symbolsDict = {
		inQueue: 'fa fa-list-alt', 
		inProgress: 'fa fa-refresh',
		completed: 'fa fa-check-circle-o', 
		failed: 'fa fa-times-circle-o'
	}

	const options = {
		projection: {_id: 1, title: 1, createdTime: 1, status: 1}, 
		limit: 10, 
		sort: {createdTime: -1}
	}

	itemsCollection.find({}, options).asArray().then(results => {
		for (const job of results) {
			const jobElement = document.createElement('a');
			jobElement.href = 'job.html?jobId=' + job._id;
			jobElement.className = "list-group-item";

			// create icon and add
			const iElement = document.createElement("i");
			iElement.className = symbolsDict[job.status];
			jobElement.appendChild(iElement);

			// Add title text
			var textElement = document.createTextNode(" " + job.title);
			jobElement.appendChild(textElement);

			// Add date span
			const spanElement = document.createElement("span");
			spanElement.className = "pull-right text-muted small";
			const emElement = document.createElement("em");
			textElement = document.createTextNode(formatDate(job.createdTime));
			emElement.appendChild(textElement);
			spanElement.appendChild(emElement);
			jobElement.appendChild(spanElement);

			/// add element to DOM
			document.getElementById('last10Jobs').appendChild(jobElement);
		}
	}).catch(err => {
		console.log(err);
	});

	/***************************************************************************** 
	 *                 Find Jobs That Do Not Make Any Sense                      *
	 *****************************************************************************/
	const oneHourAgo = new Date();
	oneHourAgo.setHours(oneHourAgo.getHours() - 1);

	const statuses = {
		inQueue: {status: "inQueue", '$or': [{createdTime: null}, {startTime: {$ne: null}}, {endTime: {$ne: null}}, {numFailures: {$gte: 3}}]},
		inProgress: {status: "inProgress", '$or': [{createdTime: null}, {startTime: null}, {endTime: {$ne: null}}, {numFailures: {$gte: 3}}, {startTime: {$lte: oneHourAgo}}]}, 
		completed: {status: "completed", '$or': [{createdTime: null}, {startTime: null}, {endTime: null}, {numFailures: {$gte: 3}}]},
		failed: {status: "failed", '$or': [{createdTime: null},{startTime: {$ne: null}}, {endTime: {$ne: null}},  {numFailures: {$lt: 3}}]},
	}; 

	itemsCollection.find({status: {$nin: Object.keys(statuses)}}, options).asArray().then(results => {
		for (const job of results) {
			console.log("Invalid Status " + JSON.stringify(job));

			// Create job element
			const jobElement = document.createElement('a');
			jobElement.href = 'job.html?jobId=' + job._id;
			jobElement.className = "list-group-item";

			// Add title text
			var textElement = document.createTextNode(" " + job.title);
			jobElement.appendChild(textElement);

			// Add date span
			const spanElement = document.createElement("span");
			spanElement.className = "pull-right text-muted small";
			const emElement = document.createElement("em");
			textElement = document.createTextNode(formatDate(job.createdTime));
			emElement.appendChild(textElement);
			spanElement.appendChild(emElement);
			jobElement.appendChild(spanElement);

			// add it to dom
			document.getElementById("oddJobs").appendChild(jobElement);
		}
	}).catch(err => {
		console.log(err);
	});
	
	for (const status in statuses) {
		itemsCollection.find(statuses[status], options).asArray().then(results => {
			for (const job of results) {
				console.log("Invalid Job: " + JSON.stringify(job));

				// Create job element
				const jobElement = document.createElement('a');
				jobElement.href = 'job.html?jobId=' + job._id;
				jobElement.className = "list-group-item";

				// Add title text
				var textElement = document.createTextNode(" " + job.title);
				jobElement.appendChild(textElement);

				// Add date span
				const spanElement = document.createElement("span");
				spanElement.className = "pull-right text-muted small";
				const emElement = document.createElement("em");
				textElement = document.createTextNode(formatDate(job.createdTime));
				emElement.appendChild(textElement);
				spanElement.appendChild(emElement);
				jobElement.appendChild(spanElement);

				// add it to dom
				document.getElementById("oddJobs").appendChild(jobElement);
			}
		}).catch(err => {
			console.log(err);
		});
	}
 });
