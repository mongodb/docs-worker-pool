const fastlyMainToken = process.env.FASTLY_MAIN_TOKEN;
const fastlyMainServiceId = process.env.FASTLY_MAIN_SERVICE_ID;

const fastlyDochubServiceId = process.env.FASTLY_DOCHUB_SERVICE_ID;
const fastlyDochubToken = process.env.FASTLY_DOCHUB_TOKEN;

const fastlyAtlasToken = process.env.FASTLY_ATLAS_TOKEN;
const fastlyAtlasServiceId = process.env.FASTLY_ATLAS_SERVICE_ID;

const fastlyDevhubToken = process.env.FASTLY_DEVHUB_TOKEN;
const fastlyDevhubServiceId = process.env.FASTLY_DEVHUB_SERVICE_ID;

const fastlyOpsManagerToken = process.env.FASTLY_OPS_MANAGER_TOKEN;
const fastlyOpsManagerServiceId = process.env.FASTLY_OPS_MANAGER_SERVICE_ID;

const fastlyCloudManagerToken = process.env.FASTLY_CLOUD_MANAGER_TOKEN;
const fastlyCloudManagerServiceId = process.env.FASTLY_CLOUD_MANAGER_SERVICE_ID;


const dochubMap = process.env.FASTLY_DOCHUB_MAP;
const atlasUsername = process.env.MONGO_ATLAS_USERNAME;
const atlasPassword = process.env.MONGO_ATLAS_PASSWORD;
const jobDb = process.env.DB_NAME;
const jobCol = process.env.COL_NAME;
const purgeAll = process.env.PURGE_ALL;

class EnvironmentClass {
  static getDB() {
    if (jobDb === undefined) {
      return 'pool_test';
    }
    return jobDb;
  }

  /* collection name is dynamic to allow mult staging autobuilder instances running
     at same time without picking up each other's jobs */
  static getCollection() {
    if (jobCol === undefined) {
      return 'queue';
    }
    return jobCol;
  }

  static shouldPurgeAll() {
    if (purgeAll === undefined) {
      return false;
    }
    if (purgeAll === 'true') {
      return true;
    }
    return false;
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
    if (atlasPassword === undefined) {
      return 'passwordTest';
    }
    return atlasPassword;
  }

  static getFastlyMainServiceId() {
    return fastlyMainServiceId;
  }

  static getFastlyMainToken() {
    return fastlyMainToken;
  }


  static getFastlyDochubServiceId() {
    if (fastlyDochubServiceId === undefined) {
      return 'testId';
    }
    return fastlyDochubServiceId;
  }

  static getFastlyDochubToken() {
    return fastlyDochubToken;
  }

  static getFastlyAtlasServiceId() {
    return fastlyAtlasServiceId;
  }

  static getFastlyAtlasToken() {
    return fastlyAtlasToken;
  }

  static getFastlyCloudManagerServiceId() {
    return fastlyCloudManagerServiceId;
  }

  static getFastlyCloudManagerToken() {
    return fastlyCloudManagerToken;
  }

  static getFastlyOpsManagerServiceId() {
    return fastlyOpsManagerServiceId;
  }

  static getFastlyOpsManagerToken() {
    return fastlyOpsManagerToken;
  }

  static getFastlyDevhubServiceId() {
    return fastlyDevhubServiceId;
  }

  static getFastlyDevhubToken() {
    return fastlyDevhubToken;
  }

  static getFastlyServiceId(repoName) {
    if (repoName === "cloudgov-docs" || repoName === "cloud-docs") {
      return fastlyAtlasServiceId;
    }
    if (repoName === "devhub-content") {
      return fastlyDevhubServiceId;
    }
    return fastlyMainServiceId;
  }
  static getFastlyToken(repoName) {
    if (repoName === "cloudgov-docs" || repoName === "cloud-docs") {
      return fastlyAtlasToken;
    }  
    if (repoName === "devhub-content") {
      return fastlyDevhubToken;
    }
    return fastlyMainToken;
  }

}

module.exports = {
  EnvironmentClass,
};
