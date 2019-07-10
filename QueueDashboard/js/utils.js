function formatDate(date) {
  if (date) {
   let dateStr = date.toLocaleDateString();
   let h = dateStr.getHours;
   function z(n){return (n<10?'0':'')+n}
   dateStr += " - " + (h%12 || 12) + ':' + z(date.getMinutes()) + ' ' + (h<12? 'AM' :'PM');
   return dateStr; 
  }
  return "N/A"
}

(function setup() {
  // determine what stitch app to use based on url
  const isProd = window.location.hostname.indexOf('workerpoolstaging') === -1;

  // by default we set to prod variables
  window.STITCH_APP_ID = 'workerpool-boxgs';
  window.DB_NAME = 'pool';
  window.COLL_NAME = 'queue';

  // if on staging, set different variables
  if (!isProd) {
    window.STITCH_APP_ID = 'workerpoolstaging-qgeyp';
    window.DB_NAME = 'pool_test';
  }
})();