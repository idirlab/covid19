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
    // document.getElementById("aggregate-date-window").style.width = "0px";
    // document.getElementById("location-information-container").style.width = "0px"
    // document.getElementById("hospital-info").style.width = "0px"
    document.getElementById("left-side-bar").style.width = "0px"
    var button = document.getElementById("btn-close_bar")
    button.style.left = "20px";
    button.style.transform = 'rotate('+180+'deg)'


  } else {
    flag = true;
    // document.getElementById("aggregate-date-window").style.width = "400px";
    // document.getElementById("location-information-container").style.width = "400px"
    // document.getElementById("hospital-info").style.width = "400px"
    document.getElementById("left-side-bar").style.width = "400px"
    var button = document.getElementById("btn-close_bar")
    button.style.left = "420px";
    button.style.transform = 'rotate('+360+'deg)'
  }
  // toggle the map to get wider to cover the closed area
  $("body > main > div#map").toggleClass("closed");
}

// const picker = pickadate.create()
// const element = document.getElementById('pickadate')
// pickadate.render(element, picker)

var $input = $('#datepicker').pickadate({
  onSet:function(datecontainer){
    function getDate(){
      return moment(new Date(datecontainer.select));
    }
    var dates = [getDate().subtract(1, "days"),
                 getDate(),
                 getDate().add(1, "days")];
    var datestrs = dates.map(d => d.format("MM/DD/YYYY"));
    datestrs.forEach(function(datestr, idx){
      var id = `pos-${2 + idx}`;
      var selector = `div.info-pane#aggregate-date-window > div.info-header > div.date-element#${id}`;
      $(selector).text(datestr);
    });
  }
});

function pickDate() {
  console.log('111111')
  if (picker.get('open')) {
    picker.close()
  } else {
    picker.open()
  }
}

