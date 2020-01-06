const fastlyToken = process.env.FASTLY_TOKEN;
const fastlyServiceId = process.env.FASTLY_SERVICE_ID;
const dochubMap = process.env.FASTLY_DOCHUB_MAP;
const atlasUsername = process.env.MONGO_ATLAS_USERNAME;
const atlasPassword = process.env.MONGO_ATLAS_PASSWORD;
const xlarge = process.env.XLARGE;
const jobDb = process.env.DB_NAME;

class EnvironmentClass {
  static getDB() {
    if (jobDb === undefined) {
      return 'pool_test';
    }
    return jobDb;
  }

  static getXlarge() {
    if (xlarge === undefined) {
      return false;
    }
    if (xlarge === 'true') {
      return true;
    }
    return false;
  }

  static getFastlyToken() {
    return fastlyToken;
  }

  static getDochubMap() {
    if (dochubMap === undefined) {
      return 'dochubMap';
    }
    return dochubMap;
  }

  static getAtlasUsername() {
    if (atlasUsername === undefined) {
      return 'usernameTest';
    }
    return atlasUsername;
  }

  static getAtlasPassword() {
    if (atlasPassword == undefined) {
      return 'passwordTest';
    }
    return atlasPassword;
  }

  static getFastlyServiceId() {
    if (fastlyServiceId === undefined) {
      return 'testId';
    }
    return fastlyServiceId;
  }
}

module.exports = {
  EnvironmentClass: EnvironmentClass
};
