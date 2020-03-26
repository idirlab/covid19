(function(window){ // https://ourcodeworld.com/articles/read/188/encode-and-decode-html-entities-using-pure-javascript
	window.htmlentities = {
		encode : function(str) {
			var buf = [];

			for (var i=str.length-1;i>=0;i--) {
				buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
			}

			return buf.join('');
		},
		decode : function(str) {
			return str.replace(/&#(\d+);/g, function(match, dec) {
				return String.fromCharCode(dec);
			});
		}
	};
})(window);
$(document).ready(function(){

  var mymap = L.map('map', {
    zoomControl: false,
    zoom: 0,
    maxZoom: 10,
    minZoom: 0,
    worldCopyJump: true,
  }).fitWorld().setView([37, -107], 5)
  $("body > main > div#map").toggleClass("closed");
  new L.Control.Zoom({
    position: 'bottomright'
  }).addTo(mymap);

  L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
  }).addTo(mymap);

  var added = false;

  var chart, rchart;

  var colors = chroma.scale('YlOrRd').mode('lch').colors(6);
  for (i = 0; i < 6; i++) {
    $('head').append($("<style> .region-color-" + (i + 1).toString() + " { color: " + colors[i] + "; font-size: 15px; text-shadow: 0 0 3px #ffffff;} </style>"));
    $('head').append($("<style> .legend-color-" + (i + 1).toString() + " { background: " + colors[i] + "; font-size: 15px; text-shadow: 0 0 3px #ffffff;} </style>"));
  }


  var cases= new L.MarkerClusterGroup({
    spiderfyOnMaxZoom: true,
    singleMarkerMode: true,
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      cnt = cluster.getChildCount()
      return L.divIcon({
        html: '<i class="fas fa-map-marker community community-marker fa-3x" ><br><span style="text-align: center; margin: 0px; width: 30px; position: absolute; left: -2px; top: 5px;font-size:12px; color:white">'+cnt+'</span></i>',
      });
    }
  }).addTo(mymap);


  Promise.all([
    d3.csv('assets/virus.csv'),
    d3.json("assets/all-topo-15.json"),
    d3.csv('assets/communities.csv'),
    d3.csv('assets/timestamp.txt'),
    d3.csv('assets/cases.csv'),
    d3.csv('assets/united-states.txt'),
    d3.csv('assets/canada-city.txt'),
    d3.csv('assets/old-name.csv'),
    d3.tsv('assets/COVID_data_collection/data/cdc_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/cnn_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/COVIDTrackingProject_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/john_hopkins_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/NYtimes_time_series.csv'),
    d3.json("assets/counties.json"),
    d3.json("assets/num2state.json")
  ]).then(function(datasets) {

    var usstates = datasets[14];
    var uscounties = datasets[13];
    function municipalityPostfix (stateString) {
      var stateUpper = stateString.toUpperCase();
      const boroughs = [
        "CONNECTICUT",
        "NEW JERSEY",
        "PENNSYLVANIA"
      ];
      const parishes = ["LOUISIANA"];
      if (boroughs.filter(s => s === stateUpper).length > 0){
        return "Borough";
      } else if (parishes.filter(s => s === stateUpper).length > 0) {
        return "Parish"
      } else {
        return "County";
      }
    }
    var timeseries = new Map([
      ["CDC", datasets[8]],
      ["CNN", datasets[9]],
      ["COVID Tracking Project", datasets[10]],
      ["John Hopkins", datasets[11]],
      ["New York Times", datasets[12]]
    ]);
    function unique(value, index, self) {
        return self.indexOf(value) === index;
    }
    var all_columns_in_data = Array.from(timeseries.values()).map(
      dataset => dataset.columns
    ).flat().filter(unique); // used to filter for supported locations for covid19 figures

    // This section transforms the source data for later use.
    var value_extract_regex = /([\d-]+)-([\d-]+)/;
    timeseries.forEach(function(dataset, source, _){
      console.log(`Source: ${source}`);
      dataset.forEach(function(d){
        d.date = new Date(d.date);
        dataset.columns.filter(col => col !== "date")
                       .forEach(function(col){
                         var element = d[col];
                         var cases_string = element.match(value_extract_regex)[1];
                         var deaths_string = element.match(value_extract_regex)[2];
                         var cases = parseInt(cases_string);
                         var deaths = parseInt(deaths_string);
                         d[col] = new Map([
                           ["cases", cases],
                           ["deaths", deaths],
                           ["recoveries", NaN]
                         ]);
                       });
      });
    });

    $("#date").text("Last update: " + datasets[3][0].timestamp.split(".")[0] + " PST");

    datasets[4].forEach(function(d) {
      //console.log(d.id)
      // var customPopup = "<p>Patient details: <br>&nbsp;&nbsp;" + d.note + "<br><br>Identified on <br>&nbsp;&nbsp;" + d.date + "</p>"
      var customPopup = "<p>Male, 20's, Stable</p>"
      var customOptions = {
        'maxWidth': '100',
        'className' : 'customPopup'
      }
      L.marker([parseFloat(d.lat), parseFloat(d.lng)]).bindPopup(customPopup, customOptions).addTo(cases);
    })



    var latest = datasets[0][datasets[0].length - 1];

    var top = {},
      ustop = {},
      cntop = {};
    top["china"] = 0;
    Object.keys(latest).forEach(function(d) {
      value = tc(datasets[0][datasets[0].length - 1][d]);
      if (datasets[7]["columns"].includes(d)) {
        top["china"] += +value;
        cntop[d] = value;

      } else if (datasets[6]["columns"].includes(d)) {
        ;
      } else if (datasets[5]["columns"].includes(d)) {
        ustop[d] = value;
      } else if(d != "datetime"){
        top[d] = value;
      }

    })


    function sortJsObject(obj) {
      items = Object.keys(obj).map(function(key) {
        return [key, obj[key]];
      });
      items.sort(function(first, second) {
        return second[1] - first[1];
      });
      sorted_obj = {}
      $.each(items, function(k, v) {
        use_key = v[0]
        use_value = v[1]
        sorted_obj[use_key] = use_value
      })
      return (sorted_obj)
    }


    stop = sortJsObject(top);
    sustop = sortJsObject(ustop);


    var places = {};

    function calPlace(name) {
      var place = {}
      place[name] = {
        't': ['t'],
        'c': ['Aggr. Confirmed'],
        's': ['s'],
        'r': ['Recovered'],
        'd': ['Death'],
        'a': ['Active Confirmed']
      }
      datasets[0].forEach(function(d) {
        var USTd = new Date(d["datetime"]);

        place[name].t.push(USTd.setHours(USTd.getHours() + 8));

        cf = 0, sp = 0, rc = 0, dd = 0, active = 0;
        current = d;
        delete current["datetime"];

        if (name == "Global Trend") {

          Object.values(current).forEach(function(d) {
            if (d == undefined) {
              d = "0"
            };
            items = d.split("-");
            switch (items.length) {
              case 4:
                dd += +items[3];
              case 3:
                rc += +items[2];
              case 2:
                sp += +items[1];
              case 1:
                cf += +items[0];
                break;
            };
            active = cf - dd - rc;
          });

          cf -= (tc(current["alabama"]) + tc(current["alaska"]) + tc(current["arizona"]) + tc(current["arkansas"]) + tc(current["california"]) + tc(current["colorado"]) + tc(current["connecticut"]) + tc(current["delaware"]) + tc(current[
            "florida"]) + tc(current["georgia usa"]) + tc(current["hawaii"]) + tc(current["idaho"]) + tc(current["illinois"]) + tc(current["indiana"]) + tc(current["iowa"]) + tc(current["kansas"]) + tc(current["kentucky"]) + tc(current[
              "louisiana"]) + tc(current["maine"]) + tc(current["maryland"]) + tc(current["massachusetts"]) + tc(current["michigan"]) + tc(current["minnesota"]) + tc(current["mississippi"]) + tc(current["missouri"]) + tc(current[
                "montana"]) + tc(
                  current["nebraska"]) + tc(current["nevada"]) + tc(current["new hampshire"]) + tc(current["new jersey"]) + tc(current["new mexico"]) + tc(current["new york"]) + tc(current["north carolina"]) + tc(current["north dakota"]) +
            tc(current[
              "ohio"]) + tc(current["oklahoma"]) + tc(current["oregon"]) + tc(current["pennsylvania"]) + tc(current["rhode island"]) + tc(current["south carolina"]) + tc(current["south dakota"]) + tc(current["tennessee"]) + tc(current[
                "texas"]) +
            tc(current["utah"]) + tc(current["vermont"]) + tc(current["virginia"]) + tc(current["washington"]) + tc(current["west virginia"]) + tc(current["canada"]));

          rc -= (tr(current["alabama"]) + tr(current["alaska"]) + tr(current["arizona"]) + tr(current["arkansas"]) + tr(current["california"]) + tr(current["colorado"]) + tr(current["connecticut"]) + tr(current["delaware"]) + tr(current[
            "florida"]) + tr(current["georgia usa"]) + tr(current["hawaii"]) + tr(current["idaho"]) + tr(current["illinois"]) + tr(current["indiana"]) + tr(current["iowa"]) + tr(current["kansas"]) + tr(current["kentucky"]) + tr(current[
              "louisiana"]) + tr(current["maine"]) + tr(current["maryland"]) + tr(current["massachusetts"]) + tr(current["michigan"]) + tr(current["minnesota"]) + tr(current["mississippi"]) + tr(current["missouri"]) + tr(current[
                "montana"]) + tc(
                  current["nebraska"]) + tr(current["nevada"]) + tr(current["new hampshire"]) + tr(current["new jersey"]) + tr(current["new mexico"]) + tr(current["new york"]) + tr(current["north carolina"]) + tr(current["north dakota"]) +
            tr(current[
              "ohio"]) + tr(current["oklahoma"]) + tr(current["oregon"]) + tr(current["pennsylvania"]) + tr(current["rhode island"]) + tr(current["south carolina"]) + tr(current["south dakota"]) + tr(current["tennessee"]) + tr(current[
                "texas"]) +
            tr(current["utah"]) + tr(current["vermont"]) + tr(current["virginia"]) + tr(current["washington"]) + tr(current["west virginia"]) + tr(current["canada"]));

          dd -= (td(current["alabama"]) + td(current["alaska"]) + td(current["arizona"]) + td(current["arkansas"]) + td(current["california"]) + td(current["colorado"]) + td(current["connecticut"]) + td(current["delaware"]) + td(current[
            "florida"]) + td(current["georgia usa"]) + td(current["hawaii"]) + td(current["idaho"]) + td(current["illinois"]) + td(current["indiana"]) + td(current["iowa"]) + td(current["kansas"]) + td(current["kentucky"]) + td(current[
              "louisiana"]) + td(current["maine"]) + td(current["maryland"]) + td(current["massachusetts"]) + td(current["michigan"]) + td(current["minnesota"]) + td(current["mississippi"]) + td(current["missouri"]) + td(current[
                "montana"]) + tc(
                  current["nebraska"]) + td(current["nevada"]) + td(current["new hampshire"]) + td(current["new jersey"]) + td(current["new mexico"]) + td(current["new york"]) + td(current["north carolina"]) + td(current["north dakota"]) +
            td(current[
              "ohio"]) + td(current["oklahoma"]) + td(current["oregon"]) + td(current["pennsylvania"]) + td(current["rhode island"]) + td(current["south carolina"]) + td(current["south dakota"]) + td(current["tennessee"]) + td(current[
                "texas"]) +
            td(current["utah"]) + td(current["vermont"]) + td(current["virginia"]) + td(current["washington"]) + td(current["west virginia"]) + td(current["canada"]));

        } else if (name == "china") {


          for (const [key, value] of Object.entries(current)) {

            if (key == "anhui" || key == "beijing" || key == "chongqing" || key == "fujian" || key == "gansu" || key == "guangdong" ||
              key == "guangxi" || key == "guizhou" || key == "hainan" || key == "hebei" || key == "heilongjiang" || key == "henan" || key == "hongkong" ||
              key == "hubei" || key == "hunan" || key == "neimenggu" || key == "jiangsu" || key == "jiangxi" || key == "jilin" || key == "liaoning" ||
              key == "macau" || key == "ningxia" || key == "qinghai" || key == "shaanxi" || key == "shandong" || key == "shanghai" || key == "shanxi" ||
              key == "sichuan" || key == "taiwan" || key == "tianjin" || key == "xinjiang" || key == "yunnan" || key == "zhejiang" || key == "xizang") {

              if (value == undefined) {
                value = "0"
              };
              items = value.split("-");
              switch (items.length) {
                case 4:
                  dd += +items[3];
                case 3:
                  rc += +items[2];
                case 2:
                  sp += +items[1];
                case 1:
                  cf += +items[0];
                  break;
              };
              active = cf - dd - rc;
            }
          }


        } else {


          d = current[name];
          if (d == undefined) {
            d = "0"
          };
          items = d.split("-");
          switch (items.length) {
            case 4:
              dd += +items[3];
            case 3:
              rc += +items[2];
            case 2:
              sp += +items[1];
            case 1:
              cf += +items[0];
              break;
          };
          active = cf - dd - rc;

        }
        active = cf - dd - rc;
        place[name].c.push(cf);
        //place[name].s.push(sp);
        place[name].r.push(rc);
        place[name].d.push(dd);
        place[name].a.push(active);

      });

      return place[name];
    }

    function showPlace(name) {
      var is_global = name.toUpperCase() === "GLOBAL TREND";
      if (!is_global){ // Don't do this when first loading the web-page but for subsequent triggers
        $("div.variable-display").empty();
        $("div.variable-display").html(`
          <div id="variable-loading-placeholder">
            Loading
          </div>
        `);
        var selected_date = new Date($("div.info-header > div.info-header-element#pos-3").text().trim());
        // Start with this DOM, if it isn't changed then it is accurate and will be displayed.
        // Else the data will replace it.
        var DOM = `
          <div id="variable-loading-no-data">
            No data for DATE=${moment(selected_date).format("MM/DD/YYYY")} AND LOCATION=${name}. </br>
            Please try somewhere in the US after 03/19/2020.
          </div>
        `;
      }

      if (name == "anhui" || name == "beijing" || name == "chongqing" || name == "fujian" || name == "gansu" || name == "guangdong" ||
        name == "guangxi" || name == "guizhou" || name == "hainan" || name == "hebei" || name == "heilongjiang" || name == "henan" ||
        name == "hubei" || name == "hunan" || name == "neimenggu" || name == "jiangsu" || name == "jiangxi" || name == "jilin" || name == "liaoning" ||
        name == "ningxia" || name == "qinghai" || name == "shaanxi" || name == "shandong" || name == "shanghai" || name == "shanxi" ||
        name == "sichuan" || name == "tianjin" || name == "xinjiang" || name == "yunnan" || name == "zhejiang" || name == "xizang") {
        $("#placename").text(name.toUpperCase() + ", CHINA"); // we don't support china yet
      } else {
        $("#placename").text(name.toUpperCase());

        function compareTwoDates(d1, d2) {
          // check that two dates are on the same day
          return (d1.getMonth() === d2.getMonth()) &&
                 (d1.getDate() === d2.getDate()) &&
                 (d1.getFullYear() === d2.getFullYear());
        }
        // Boolean to see if the data covers the date the user is interested in
        if (!is_global){
          var data_covers_this_date = Array.from(timeseries.values())
                                           .map(dataset =>
                                             Array.from(
                                               dataset.filter(d => compareTwoDates(selected_date, d.date))
                                             ).length > 0)
                                           .reduce((acc, next) => acc || next);
          // Boolean to see if the location the user is interested in is in the data
          var data_covers_this_location =
            (all_columns_in_data.filter(col => name.toLowerCase().toTitleCase() == col).length > 0);
        }
        if (!is_global && data_covers_this_date && data_covers_this_location){
          // If the area is in our data and we have at least one data source that covers that day
          DOM = "";
          timeseries.forEach(function(dataset, source, _){
            var data = dataset.filter(d => compareTwoDates(d.date, selected_date));
            function hyphenIfNaN(o){
              return (isNaN(o) ? "&nbsp;-&nbsp;" : o);
            }
            if(data.length > 0){
              var state_data = data[0][name.toTitleCase()];
              var cases_string = hyphenIfNaN(state_data.get("cases"));
              var deaths_string = hyphenIfNaN(state_data.get("deaths"));
              var recoveries_string = hyphenIfNaN(state_data.get("recoveries"));
              var sourceDOM = `
                <div class="variable">
                  <div class="source">${source}</div>
                  <div class="figures">
                    <div class="figure">
                      <i class="fas fa-hospital-symbol"></i>
                      <span>${cases_string}</span>
                    </div>
                    <div class="figure">
                      <i class="fas fa-skull"></i>
                      <span>${deaths_string}</span>
                    </div>
                    <div class="figure">
                      <i class="fas fa-user-check"></i>
                      <span>${recoveries_string}</span>
                    </div>
                  </div>
                </div>
              `;
              DOM = DOM + sourceDOM;
            }
          });
        }
        if (!is_global){
          $("div.variable-display").html(DOM);
        }
      }
    }


    var date_div = $("div.info-pane#aggregate-date-window > div.info-header > div.date-element#pos-3");
    date_div.on('DOMSubtreeModified', function(){
      var name = $("div#location-information-container > p > span#placename").text().trim().toLowerCase();
      showPlace(name);
    });
    $("div.info-pane#aggregate-date-window > div.info-header > div.arrow").click(function(evt){
      var arrow_position = $(this).attr("id");

      var date_str = date_div.text();
      var selected_date = moment(new Date(date_str));
      var dates = ["pos-2", "pos-3", "pos-4"].map(id =>
        moment(new Date(
          $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${id}`).text()
        ))
      );
      var new_dates = (arrow_position === "pos-1") || (arrow_position === "pos-2") ?
                      dates.map(d => d.subtract(1, "days")) :
                      dates.map(d => d.add(1, "days"));
      // Now update the dates
      new_dates.forEach(function(new_date, idx){
        var pos_id = `pos-${idx + 2}`;
        var date_str = new_date.format("MM/DD/YYYY");
        $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`).text(date_str);
      });

    });

    function setFill(enname) {
      var pop = datasets[0][datasets[0].length - 1][enname];
      if (pop == "" || pop == undefined || pop.toString().split("-")[0] == "0") {
        return 'url(img/texture-s.png)'; //non-case country, 0 aggregate confirm
      } else {
        pop = +pop.toString().split("-")[0] - +pop.toString().split("-")[2] - +pop.toString().split("-")[3]; // remaining confirmed
      }
      if (pop == 0) {
        return 'url(img/texture-sg.png)'; // 0 active confirm
      } else {
        return 'url()';
      }
    }

    function style(feature) {
      if (feature.properties.enname == "us" || feature.properties.enname == "canada") {
        return {
          fillColor: '#dc3545',
          fillOpacity: 0,
          opacity: 0,
        };
      } else {
        return {
          fill: setFill(feature.properties.enname),
          // fillColor: setColor(feature.properties.enname),
          fillOpacity: 0.4,
          weight: 0.5,
          opacity: 1,
          color: '#b4b4b4',
          dashArray: '2'
        };
      }
    }

    function countyStyle(feature) {
      return {
        fill: setFill(feature.properties.enname),
        // fillColor: setColor(feature.properties.enname),
        fillOpacity: 0.1,
        weight: 0.5,
        opacity: 1,
        color: '#DC143C',
        // dashArray: '2'
      };
    }



    function highlightCountyFeature(e) {
      // e indicates the current event
      var layer = e.target; //the target capture the object which the event associates with
      layer.setStyle({
        weight: 2,
        opacity: 0.8,
        color: '#DC143C', // county border
        fillColor: '#FFFFFF', // county color
        fillOpacity: 0.1
      });
      // bring the layer to the front.
      layer.bringToFront();
      if (e.target.feature.properties.enname == "us" || e.target.feature.properties.enname == "canada") {
        layer.bringToBack();
      }
    }

    function highlightFeature(e) {
      // e indicates the current event
      var layer = e.target; //the target capture the object which the event associates with
      layer.setStyle({
        weight: 2,
        opacity: 0.8,
        color: '#DC143C', // state border
        fillColor: '#FFFFFF', // state color
        fillOpacity: 0.1
      });
      // bring the layer to the front.
      layer.bringToFront();

      if (e.target.feature.properties.enname == "us" || e.target.feature.properties.enname == "canada") {
        layer.bringToBack();
      }
    }

    // 3.2.2 zoom to the highlighted feature when the mouse is clicking onto it.
    function zoomToFeature(e) {
      // mymap.fitBounds(e.target.getBounds());
      L.DomEvent.stopPropagation(e);
      $("#hint").text("Click here to the global trend.");
      displayPlace(e.target.feature.properties.enname)

      counties_feat = []
      for (let i = 0; i < uscounties.features.length; i++) {
        const feat = uscounties.features[i];
        if(usstates[feat.properties.STATE]==e.target.feature.properties.enname){
          counties_feat.push(feat)
        }
      }
      try{
        mymap.removeLayer(counties)
      } catch(err) {
        console.log(err)
      }


      counties = new L.geoJSON(counties_feat, {
        // TODO: add
        style: countyStyle,
        onEachFeature: onEachCountyFeature
      }).addTo(mymap);
      mymap.fitBounds(counties.getBounds());
    }

    // TODO:
    function zoomToCountyFeature(e) {
      console.log("zooming to county");
      var state = usstates[parseInt(e.target.feature.properties.STATE)].toTitleCase(); // to be used for filter
      var county = `${e.target.feature.properties.NAME.toTitleCase()} ${municipalityPostfix(state)}`;
      showPlace(county);
    }

    // 3.2.3 reset the hightlighted feature when the mouse is out of its region.
    function resetHighlight(e) {
      areas.resetStyle(e.target);
      // mymap.removeLayer(counties)
      // mymap.eachLayer(function(layer) {
      //   if(layer.myTag && layer.myTag==="counties") {
      //     mymap.removeLayer(layer)
      //   }
      // })
    }

    function resetCountyHighlight(e) {
      counties.resetStyle(e.target);
      // mymap.removeLayer(counties)
    }

    // 3.3 add these event the layer obejct.
    function onEachStateFeature(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        click: zoomToFeature,
        mouseout: resetHighlight
      });
    }

    function onEachCountyFeature(feature, layer) {
      layer.myTag = 'counties'
      layer.on({
        mouseover: highlightCountyFeature,
        click: zoomToCountyFeature,
        mouseout: resetCountyHighlight
      });
    }

    var areas = new L.TopoJSON(datasets[1], {
      style: style,
      onEachFeature: onEachStateFeature
    }).addTo(mymap);



    $("#hint").on("click", function() {
      places["Global Trend"] = calPlace("Global Trend");
      showPlace("Global Trend");
      // calCounts(global);
      chart.load({
        columns: [places["Global Trend"].c, places["Global Trend"].a, places["Global Trend"].r, places["Global Trend"].d],
        unload: ['Aggr. Confirmed', 'Active Confirmed', 'Recovered', 'Death'],
      });

      $("#hint").text("Click a place to review local trend.");

    });

    mymap.on('click', onMapClick);


    function onMapClick(e) {
      $("#hint").click();
    }


    places["Global Trend"] = calPlace("Global Trend");
    showPlace("Global Trend");


    chart = c3.generate({
      size: {
        height: 280,
        width: 460
      },
      data: {
        x: "t",
        y: "confirmed",
        columns: [places["Global Trend"].t, places["Global Trend"].c, places["Global Trend"].a, places["Global Trend"].r, places["Global Trend"].d],
        type: 'line',
        axes: {
          confirmed: 'y'
        },
        colors: {
          'Aggr. Confirmed': '#dc3545',
          // Suspected: 'orange',
          'Active Confirmed': 'orange',
          Recovered: '#28a745',
          Death: '#5d4f72e8'
        }
      },
      zoom: {
        enabled: true
      },
      axis: {
        x: {
          type: "timeseries",
          tick: {
            format: "%b %d",
            centered: true,
            fit: true,
            count: 8
          }
        },
        y: {
          label: {
            text: 'Cases',
            position: 'outer-middle'
          },
          min: 0,
          padding: {
            bottom: 0
          },
          type: 'linear'
        }
      },
      point: {
        r: 3,
        focus: {
          expand: {
            r: 5
          }
        }
      },
      zoom: {
        // rescale: true,
        enabled: false,
        type: "scroll",
      },
      tooltip: {
        linked: true,
      },
      legend: {
        position: 'inset',
        inset: {
          anchor: "top-left",
          y: 10
        },
      },
      bindto: "#total-chart"
    });


    function displayPlace(name) {

      places[name] = calPlace(name);
      showPlace(name);

      chart.load({
        columns: [places[name].c, places[name].a, places[name].r, places[name].d],
        unload: ['Aggr. Confirmed', 'Active Confirmed', 'Recovered', 'Death'],
      });

    }

    $('#areaSwitcher').change(function() {

      $('.loader').show();

      $("#rankingToggle").css('visibility', 'visible');

      $("#table").css("visibility", "visible");
      $(".leaflet-control-container").css("visibility", "hidden");


      len = places["Global Trend"].t.length
      showLen = 25
      $("thead").html('<th scope="col" style="text-align:right; width:120px !important"><b>Country</b></th>');
      $("thead").append("<th style='text-align:center' >Active Confirmed</th>");

      Object.values(places["Global Trend"].t.slice(len - 1 - showLen, len - 1)).forEach(function(d) {
        //label = new Date(new Date(d).setHours(new Date(d).getHours() + 8)).toString().substring(4,10);
        label = (new Date(d)).toString().substring(4, 10);
        // console.log(label);
        $("thead").append("<th style='text-align:center' >" + label + "</th>");
      });


      $("tbody").html('');
      makeTable();


      $('.loader').fadeOut("slow");

    })


    $('#panelSwitcher').change(function() {
      $('.loader').show();

      if (document.getElementById('panelSwitcher').checked == false) {
        $("#table").css("visibility", "hidden");
        $("#rankingToggle").css("visibility", "hidden");
        $(".leaflet-control-container").css("visibility", "visible");

        $("thead").html('');
        $("tbody").html('');


      } else {

        $("#rankingToggle").css('visibility', 'visible');

        $("#table").css("visibility", "visible");
        $(".leaflet-control-container").css("visibility", "hidden");


        len = places["Global Trend"].t.length
        showLen = 20
        $("thead").html('<th scope="col" style="text-align:right; width:120px !important"><b>Country</b></th>');
        $("thead").append("<th style='text-align:center' >Active Confirmed</th>");

        Object.values(places["Global Trend"].t.slice(len - 1 - showLen, len - 1)).forEach(function(d) {
          //label = new Date(new Date(d).setHours(new Date(d).getHours() + 8)).toString().substring(4,10);
          label = (new Date(d)).toString().substring(4, 10);
          // console.log(label);
          $("thead").append("<th style='text-align:center' >" + label + "</th>");
        });


        $("tbody").html('');


        makeTable();


      }
      $('.loader').fadeOut("slow");

    })

    $(".leaflet-control-attribution")
      .css("background-color", "transparent")
      .html("");



  });
});
