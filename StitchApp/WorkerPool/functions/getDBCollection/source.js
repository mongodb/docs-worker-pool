exports = function(arg){
  const db_name = context.values.get("db_name");
  const coll_name = context.values.get("coll_name");
  return {
    'db_name': db_name,
    'coll_name': coll_name
  };
};