const ip = require('ip');

class Monitor {
  // pass in a job payload to setup class
  constructor(config, logger) {
    if (!logger) {
      console.log('log mechanism empty');
    }
    if (!config) {
      console.log('no config for monitor');
    }
    this.config = config;
    this.ip = ip.address();
    this.status = 'initializing';
    this.logger = logger;
  }

  // env config
  setXlarge(style) {
    if (style !== undefined) {
      this.config.isXlarge = style;
    }
  }

  // for now this tells us the db we connect to
  // TODO: abstract DB_NAME to an environment setting
  setEnvType(type) {
    if (type) {
      this.config.envType = type;
    }
  }

  // get base path for public/private repos
  reportStatus(status) {
    if (!this.logger) {
      console.log(`log mechanism empty for status report: ${status}`);
      return;
    }
    this.status = status;
    this.updateTime = new Date();
    this.logger.reportStatus(this);
  }
}

module.exports = { Monitor };
