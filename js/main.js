var local_testing = false;
var api_url = local_testing ? "http://localhost:2222" : "https://idir.uta.edu/covid-19-api-dev-2";

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
  // flag -> true for open
  // flag -> false for closed
  $("div#floating-side-panel-info-container").css("display", flag ? "block" : "none")
  $("div#aggregate-date-window > div.info-header").css("display", flag ? "block" : "none")
  $("div#aggregate-date-window > div.variable-toggle").css("display", flag ? "block" : "none")

  // toggle the map to get wider to cover the closed area
  $("body > main > div#map").toggleClass("closed");
}

// const picker = pickadate.create()
// const element = document.getElementById('pickadate')
// pickadate.render(element, picker)

var globalDateFormat = "MM/DD/YYYY";
var globalMinDate = moment("01/23/2020", globalDateFormat);
var globalMaxDate = null;
var datePickerVar = null;

function resolveWhenMaxDateLoaded() {
  return new Promise(resolve => {
    checkMaxDate(resolve);
  }) 
}

function checkMaxDate(resolve) {
  if (globalMaxDate == null) {
    setTimeout(checkMaxDate, 200, resolve);
    return;
  } else {
    resolve('done');
  }
}

corsHTTP(api_url + "/api/v1/querylatestdate", (date) => {globalMaxDate = moment(date, "YYYY-MM-DD")});
createDatePicker();

function pickDate() {
  return;
}

function createDatePicker() {
  if (globalMaxDate == null) {
    console.log('wiating')
    setTimeout(createDatePicker, 200);
    return;
  }

  datePickerVar = $('#datepicker').pickadate({
    min: globalMinDate.toDate(),
    max: globalMaxDate.toDate(),
    onSet:function(datecontainer){
      if (!('select' in datecontainer)) return;
 
      function getDate(){
        return moment(new Date(datecontainer.select));
      }
      var dates = [getDate().subtract(1, "days"),
                   getDate(),
                   getDate().add(1, "days")];
      var datestrs = dates.map(d => d.format(globalDateFormat));
      datestrs.forEach(function(datestr, idx){
        var id = `pos-${2 + idx}`;
        var selector = `div.info-pane#aggregate-date-window > div.info-header > div.date-element#${id}`;
        $(selector).text(datestr);
      });
    }
  });
}

var flag_chatbot = true
function open_chatbot() {
  if(flag_chatbot) {
    flag_chatbot = false
    document.getElementById("juji_html").style.bottom = "0px"

  } else {
    flag_chatbot = true
    document.getElementById("juji_html").style.bottom = "-435px"
  }

}

// -- Uncomment this section to set the current date on load
//[1, 2, 3].map(i => i - 2)
//         .map(i => [i,
//                    i < 0 ? moment().subtract(-1 * i, "days") : moment().add(i, "days")])
//         .forEach(tup => $(`div#pos-${ tup[0] + 3 }`).text(tup[1].format("MM/DD/YYYY")))
// -- Uncomment this section to set the current date on load
$("div#pos-2")


function close_chart() {
  $("div.chart_panel").css("display","none")
}
