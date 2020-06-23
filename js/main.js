var local_testing = false;
var api_url = null;

jQuery.get('config.txt', function(data) {
  console.log(data)

  var folder_defined_path = data.trim(' \r\t\n') == "PROD" ? "https://idir.uta.edu/covid-19-api" : "https://idir.uta.edu/covid-19-api-dev"
  api_url = local_testing ? "http://localhost:2222" : folder_defined_path;
});

function resolveWhenApiUrlSet() {
  return new Promise(resolve => {
    checkApiUrl(resolve);
  })
}

function checkApiUrl(resolve) {
  if (api_url == null) {
    setTimeout(checkApiUrl, 200, resolve);
    return;
  }
  resolve('done');
  console.log(api_url);
}

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

function close_misinfo_info() {
  console.log("close");
  $("div.response-area,div#misinformation-info.misinfo").attr("selected_lvl", "disable");
}
function close_hos_info() {
  console.log("close");
  $("div.response-area,div#hospital-info.hospital").attr("selected_lvl", "disable");
}
function close_tw_info() {
  console.log("close");
  if($("div#twitter-info.twitter").attr("selected_lvl") == "disable") {
    $("div#twitter-info.twitter").attr("selected_lvl",
                                       $("span.selected-level.hidden").text());
  } else {
    $("div#twitter-info.twitter").attr("selected_lvl", "disable");
  }
}

function closeBar() {

  var flagmap = {false:  "hidden",
                 true:   "visible"};
  $("div#hospital-info.hospital").attr("sidebarstatus",flagmap[!flag]);
  $("div#twitter-info.twitter").attr("sidebarstatus",flagmap[!flag]);
  var button = document.getElementById("btn-close_bar")
  if (flag) {
    flag = false;
    // document.getElementById("aggregate-date-window").style.width = "0px";
    // document.getElementById("location-information-container").style.width = "0px"
    // document.getElementById("hospital-info").style.width = "0px"
    document.getElementById("left-side-bar").style.width = "0px"
    button.style.left = "0px";
    button.style.transform = 'rotate('+180+'deg)'
  } else {
    flag = true;
    // document.getElementById("aggregate-date-window").style.width = "400px";
    // document.getElementById("location-information-container").style.width = "400px"
    // document.getElementById("hospital-info").style.width = "400px"
    document.getElementById("left-side-bar").style.width = "400px"
    button.style.left = "420px";
    button.style.transform = 'rotate('+0+'deg)'
  }
  // flag -> true for open
  // flag -> false for closed
  $("div#floating-side-panel-info-container").css("display", flag ? "block" : "none")
  $("div#aggregate-date-window > div.info-header").css("display", flag ? "block" : "none")
  $("div#aggregate-date-window > div.variable-toggle").css("display", flag ? "block" : "none")
  $("div.response-area").css("display", flag ? "block" : "none")

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

function getLatestDate() {
  if (api_url == null) {
    console.log('waiting for api url')
    setTimeout(getLatestDate, 200);
    return;
  }
  corsHTTP(api_url + "/api/v1/querylatestdate", (date) => {globalMaxDate = moment(date, "YYYY-MM-DD")});
}
getLatestDate();
createDatePicker();

function pickDate() {
  console.log(datePickerVar)
  var picker = datePickerVar.pickadate('picker')
  picker.set('select', moment($('#pos-3').text(), "MM/DD/YYYY").toDate())
  return;
}

function createDatePicker() {
  if (globalMaxDate == null) {
    console.log('waiting to create picker')
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
      datestrs.forEach(function(date_str, idx){
        var pos_id = `pos-${2 + idx}`;
        var selector = `div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`;
        $(selector).text(date_str);

        $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`).text(date_str);
        if (globalMaxDate.format(globalDateFormat) < date_str || date_str < globalMinDate.format(globalDateFormat)) {
          $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`).addClass('inactive')
          if (idx == 0) {
            $(`div.info-pane#aggregate-date-window > div.info-header > div.arrow.icon-container#pos-1`).addClass('inactive')
          } else if (idx == 2) {
            $(`div.info-pane#aggregate-date-window > div.info-header > div.arrow.icon-container#pos-5`).addClass('inactive')
          }
        } else {
          $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`).removeClass('inactive')
          if (idx == 0) {
            $(`div.info-pane#aggregate-date-window > div.info-header > div.arrow.icon-container#pos-1`).removeClass('inactive')
          } else if (idx == 2) {
            $(`div.info-pane#aggregate-date-window > div.info-header > div.arrow.icon-container#pos-5`).removeClass('inactive')
          }
        }
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
  $("div.chart_panel").css("display","none");
}
