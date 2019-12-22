const worker = require("./worker");

// Setup the server with startServer()
worker
  .startServer()
  .then(() => {
    // Begin working!
    worker.work();
  })
  .catch(err => {
    console.log(`ERROR: ${err}`);
  });

// Handle SIGINT / SIGTERM from KUBERNETES
process.on("SIGINT", async () => {
  console.log("Received SIGINT");
  await worker.gracefulShutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM");
  await worker.gracefulShutdown();
  process.exit(0);
});
