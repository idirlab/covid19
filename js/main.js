$(window).ready(function() {
  $('.loader').fadeOut("slow");
});



L.TopoJSON = L.GeoJSON.extend({
  addData: function(jsonData) {
    if (jsonData.type === 'Topology') {
      for (key in jsonData.objects) {
        geojson = topojson.feature(jsonData, jsonData.objects[key]);
        L.GeoJSON.prototype.addData.call(this, geojson);
      }
    } else {
      L.GeoJSON.prototype.addData.call(this, jsonData);
    }
  }
});
// Copyright (c) 2013 Ryan Clark

// var createLabelIcon = function(labelClass, labelText) {
//   return L.divIcon({
//     className: labelClass,
//     html: labelText
//   })
// }
//


var worldBounds = L.latLngBounds(
  L.latLng(-60, -100), //Southwest
  L.latLng(80, 15) //Northeast
);



//totalConfirmed
function tc(country) {
  if (country == undefined) {
    country = 0
  } else {
    country = +country.split("-")[0];
  }
  return country;
}

//totalRecovered
function tr(country) {
  if (country.split("-")[2] == undefined) {
    country = 0
  } else {
    country = +country.split("-")[2];
  }
  return country;
}

//totalDeath
function td(country) {
  if (country.split("-")[3] == undefined) {
    country = 0
  } else {
    country = +country.split("-")[3];
  }
  return country;
}

var flag = true

function closeBar() {

  if (flag) {
    flag = false;
    document.getElementById("info").style.width = "0px";
    document.getElementById("location-information-container").style.width = "0px"
    var button = document.getElementById("btn-close_bar")
    button.style.left = "20px";
    button.style.transform = 'rotate('+180+'deg)'
    
    // button.css = "btn-hidden-sidebar"
    // button.style.background = "url(../img/right_arrow.jpg)";

  } else {
    flag = true;
    document.getElementById("info").style.width = "300px";
    document.getElementById("location-information-container").style.width = "300px"
    var button = document.getElementById("btn-close_bar")
    button.style.left = "320px";
    button.style.transform = 'rotate('+360+'deg)'
    // button.css = "btn-open-sidebar"
    // button.style.background = "url(../img/back_arrow.jpg)";


  }
  
}

