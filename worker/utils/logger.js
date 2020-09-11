const workerUtils = require('./utils');

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

    static trimOutputForUserFacingLogMessages(output) {
        let trimmedOutput = '';
        const splitOutput = output.split('\n');
        splitOutput.forEach((line) => {
            if (line.indexOf('WARNING') > -1 || line.indexOf('ERROR') > -1 || line.indexOf('INFO') > -1) {
                trimmedOutput = trimmedOutput.concat(line).concat('\n');
            }
        });
        return trimmedOutput.replace(/\n$/, '');
    }

    async filterOutputForUserLogs(buildOutput) {
        const outputString = await LoggerClass.trimOutputForUserFacingLogMessages(buildOutput);
        if (outputString !== '') {
            await this.sendSlackMsg(outputString);
        }
    }
}


module.exports = {
    LoggerClass,
};
