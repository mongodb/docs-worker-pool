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