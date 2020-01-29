const workerUtils = require("./utils");

class LoggerClass {
  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
  }

  sendSlackMsg(message) {
    workerUtils.populateCommunicationMessageInMongo(this.currentJob, message);
  }

  save(message) {
    workerUtils.logInMongo(this.currentJob, message);
  }
}
module.exports = {
   LoggerClass: LoggerClass
  };