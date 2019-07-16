// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient(window.STITCH_APP_ID);

const url = new URL(window.location.href);
const dict = {};
url.searchParams.forEach((v,k) => { dict[k] = v });

const typeToName = {
    jobsInQueue: "Jobs Currently in Queue", 
    jobsInProgress: "Jobs Currently in Progress", 
    jobsFailed: "Jobs That Have Failed", 
    jobsCompleted: "Jobs That Have Succeeded", 
    jobsAll: "All Jobs", 
    jobsUser: "Jobs Submitted by: " + dict["user"],
}

const type = dict["type"];
if (type in typeToName) {
    const firstChild = document.getElementById('tableName').firstChild;
    const newChild   = document.createTextNode(typeToName[type]);
    document.getElementById('tableName').replaceChild(newChild, firstChild);
}

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
    const statusToClass = {
        inQueue: "info", 
        inProgress: "warning", 
        completed: "success", 
        failed: "danger"
    };

    var query = {};
    if (type === "jobsInQueue") {
        query = { status: "inQueue"};
    } else if (type === "jobsInProgress") {
        query = {status: "inProgress"};
    } else if (type === "jobsCompleted") {
        query = {status: "completed"};
    } else if (type === "jobsFailed") {
        query = {status: "failed"};
    } else if (type === "jobsUser")  {
        query = {user: dict["user"]};
    }

    const options = {
        projection: {failures: 0, result: 0, payload: 0}, 
        limit: 20,
        sort: {createdTime: -1},
    }

    itemsCollection.find(query, options).asArray().then(results => {
		for (let i = 0; i < results.length ; i++) {
            const job = results[i];

            const rowElement = document.createElement("tr");
            rowElement.className = "clickable-row";

            if (type === "jobsAll" || type === "jobsUser") {
                if (job.status in statusToClass) {
                    rowElement.className += " " + statusToClass[job.status];
                }
            } else if (i % 2 === 0) {
                rowElement.className += " even";
            } else {
                rowElement.className += " odd";
            }

            var tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(job._id));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(job.title));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(job.user));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(job.priority));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(formatDate(job.createdTime)));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(formatDate(job.startTime)));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(formatDate(job.endTime)));
            rowElement.appendChild(tdElement);

            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(job.numFailures));
            rowElement.appendChild(tdElement);

            document.getElementById("jobsTable").appendChild(rowElement);
        }
        
        const jobTable = $('#jobTable').DataTable({
            responsive: true, 
        });
        jobTable.column(0).visible(false);
        $('#jobTable').on('click', 'tbody tr', function() {
            window.location = "job.html?jobId=" + jobTable.row(this).data()[0];
        })
	}).catch(err => {
		console.log(err);
	});
 });
