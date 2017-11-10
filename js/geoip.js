(function() {
  "use strict";
  window.addEventListener("load", function() {
    var onSuccess = function(location){
      var subdivision = location.most_specific_subdivision.names.en;
      document.getElementById("subdivision").innerHTML = subdivision;
      var city = location.city.names.en;
      document.getElementById("city").innerHTML = city;
    }

    geoip2.city(onSuccess);
  }, false);
}());