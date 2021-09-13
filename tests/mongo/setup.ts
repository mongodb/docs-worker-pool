const path = require('path');
const fs = require('fs');
const MongodbMemoryServer = require('mongodb-memory-server');

const globalConfigPath = path.join(__dirname, 'globalConfig.json');

const mongod = new MongodbMemoryServer.default({
  instance: {
    dbName: 'jest',
  },
  binary: {
    version: '3.2.18',
  },
  autoStart: false,
});

module.exports = async () => {
  if (!mongod.isRunning) {
    await mongod.start();
  }

  const mongoConfig = {
    mongoDBName: 'jest',
    mongoUri: await mongod.getConnectionString(),
  };

  fs.writeFileSync(globalConfigPath, JSON.stringify(mongoConfig));

  // Set reference to mongod in order to close the server during teardown.
  global.__MONGOD__ = mongod;
  process.env.MONGO_URL = mongoConfig.mongoUri;
};
