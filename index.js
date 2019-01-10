const worker   =  require('./worker');

worker.startServer().then(function() {
    worker.work();
}).catch(err => {
	console.log("ERROR: " + err);
	worker.setLive(false);
});