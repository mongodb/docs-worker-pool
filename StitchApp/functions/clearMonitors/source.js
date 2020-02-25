exports = function() {
  
  const db_name = context.values.get('db_name');
  const coll_name = 'monitor';
  // get the queue collection
  const heartbeatDocsColl = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  
  const query = {"monitor.numMessages":{$gte: 2}};
  
  return heartbeatDocsColl.find(query)
  .sort({ "monitor.ip": 1 })
  .toArray()
  .then(items => {
    if(items.length === 0) {
      return;
    }
    console.log(`Successfully found ${items.length} documents.`)
    items.forEach(element => {
      heartbeatDocsColl.updateOne(
          { _id: element._id },
          { $set: { "monitor.numMessages": 0 }})});
    return items
  })
  .catch(err => console.error(`Failed to find documents: ${err}`))

};
