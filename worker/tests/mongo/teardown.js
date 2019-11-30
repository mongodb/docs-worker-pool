module.exports = async function() {
  console.log('Teardown mongod');
  global.__MONGOD__.stop();
};
