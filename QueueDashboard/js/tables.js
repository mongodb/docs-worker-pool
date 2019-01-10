// Initialize the App Client
const stitchClient = stitch.Stitch.initializeDefaultAppClient("workerpool-boxgs");

let dict = parseQueryStringToDictionary(document.location.search);
let typeToName = {
    jobsInQueue: "Jobs Currently in Queue", 
    jobsInProgress: "Jobs Currently in Progress", 
    jobsFailed: "Jobs That Have Failed", 
    jobsCompleted: "Jobs That Have Succeded", 
    jobsAll: "All Jobs", 
    jobsUser: "Jobs Submitted by: " + dict["user"],
}
let type = dict["type"];

if (type in typeToName) {
    document.getElementById('tableName').innerHTML = typeToName[type]; 
}

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
    let statusToClass = {
        inQueue: "info", 
        inProgress: "warning", 
        completed: "success", 
        failed: "danger"
    };

    let query = {};
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

    let options = {
        projection: {failures: 0, result: 0, payload: 0}, 
        limit: 20,
        sort: {createdTime: -1},
    }

    itemsCollection.find(query, options).asArray().then(results => {
        let str = "";
		for (i in results) {
            let job = results[i];
            str += '<tr class="clickable-row ' 
            if (type === "jobsAll" || type === "jobsUser") {
                if (job.status in statusToClass) {
                    str += statusToClass[job.status];
                }
            } else if (i % 2 === 0) {
                str += "even";
            } else {
                str += "odd";
            }
            str += '">';
            str += "<td>" + job._id + "</td>";
            str += '<td>' + job.title + '</td>';
            str += '<td>' + job.user + '</td>';
            str += '<td>' + job.priority + '</td>';
            str += '<td>' + formatDate(job.createdTime) + '</td>';
            str += '<td>' + formatDate(job.startTime) + '</td>';
            str += '<td>' + formatDate(job.endTime) + '</td>';
            str += '<td>' + job.numFailures + '</td>';
            str += '</tr>';
        }
        
        document.getElementById('jobsTable').innerHTML = str;
        var jobTable = $('#jobTable').DataTable({
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
