function parseQueryStringToDictionary(queryString) {
    var dictionary = {};
     
    // remove the '?' from the beginning of the
    if (queryString.indexOf('?') === 0) {
        queryString = queryString.substr(1);
    }
     
    // Step 1: separate out each key/value pair
    var parts = queryString.split('&');
     
    for(var i = 0; i < parts.length; i++) {
        var p = parts[i];
        // Step 2: Split Key/Value pair
        var keyValuePair = p.split('=');
         
        // Step 3: Add Key/Value pair to Dictionary object
        var key = keyValuePair[0];
        var value = keyValuePair[1];
         
        // decode URI encoded string
        value = decodeURIComponent(value);
        value = value.replace(/\+/g, ' ');
         
        dictionary[key] = value;
    }
     
    // Step 4: Return Dictionary Object
    return dictionary;
}

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