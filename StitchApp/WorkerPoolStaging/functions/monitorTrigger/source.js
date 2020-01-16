exports = async function(arg){
  
  const db_name = context.values.get('db_name');
  const coll_name = 'monitor';
  
  // get the monitor collection
  const heartbeatDocsColl = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  
  //10 minute interval
  const date = new Date().valueOf()-(10*60*1000);

  const query = {"monitor.updateTime":{$lte: new Date(date)}};

  const projection = { "monitor":1 };
  
  const admins = context.functions.execute("getAdmins");
  
  let message;
  
  heartbeatDocsColl.find(query, projection)
  .sort({ "monitor.ip": 1 })
  .toArray()
  .then(items => {
    console.log(`Successfully found ${items.length} documents.`)
    items.forEach(element => {
      if (!element.monitor.numMessages ||
      element.monitor.numMessages < 3) {
      message = 'instance stuck: ' + JSON.stringify(element);
      admins.forEach(admin=>context.functions.execute("sendMonitoringAlert", message, admin));
      monitorNumber = element.monitor.numMessages ? (element.monitor.numMessages + 1): 1;
      heartbeatDocsColl.updateOne(
          { _id: element._id },
          { $set: { "monitor.numMessages": monitorNumber }}
          );
      }
    });
    return items
  })
  .catch(err => console.error(`Failed to find documents: ${err}`))
  
  
  // check for stale jobs
  
  console.log('checking for stale jobs');
  const coll_nameStale = 'queue';
  // get the queue collection
  const queueColl = context.services.get("mongodb-atlas").db(db_name).collection(coll_nameStale);
  
  const staleDate = new Date().valueOf()-(5*60*1000);

  const queryStale = {"status": "inQueue", "createdTime":{$lte: new Date(staleDate)}};
  
  return queueColl.find(queryStale)
  .toArray()
  .then(items => {
    if(items.length === 0) {
      return;
    }
    console.log(`Successfully found ${items.length} stale documents.`);
    items.forEach(element => {
      message = `******** \n job stuck in  ${db_name} \n user: ${element.email} \n repo: ${element.payload.repoName} \n xlarge: ${element.payload.isXlarge}`;
      admins.forEach(admin=>context.functions.execute("sendMonitoringAlert", message, admin));
  
    return items;
    });
  })
  .catch(err => console.error(`Failed to find documents: ${err}`));
  
  return {arg: arg};
}