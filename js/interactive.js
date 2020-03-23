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
  new L.Control.Zoom({
    position: 'bottomright'
  }).addTo(mymap);

  L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{ maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']
  }).addTo(mymap);



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
    d3.csv('assets/Hospital_Geocoded_Hospital_General_Information.csv'),
    d3.tsv('assets/COVID_data_collection/data/cdc_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/cnn_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/COVIDTrackingProject_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/john_hopkins_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/NYtimes_time_series.csv')
  ]).then(function(datasets) {

    var ushospitals = datasets[8];
    var timeseries = new Map([
      ["CDC", datasets[9]],
      ["CNN", datasets[10]],
      ["COVID Tracking Project", datasets[11]],
      ["John Hopkins", datasets[12]],
      ["New York Times", datasets[13]]
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

    var hospital_display = $("div.hospital-display");
    function updateHospitalListings() {
      hospital_display.empty()
      var quadrilateral = mymap.getBounds();
      var ne_corner = quadrilateral._southWest;
      var sw_corner = quadrilateral._northEast;
      var doms = ushospitals.map(function (d) {
        var DOM = "";
        var lat = parseFloat(d.Latitude);
        var lng = parseFloat(d.Longitude);
        if(!(isNaN(lat) | isNaN(lng))){
          var point = L.latLng(lat, lng);
          if (quadrilateral.contains(point)){
            var hospitalDOM = `
              <div class="hospital">
                <div class="header">
                  <div class="name">${htmlentities.encode(v.lowerCase(d["Facility Name"]).toTitleCase())}</div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/><path d="M0 0h24v24H0V0z" fill="none"/></svg>
                </div>
                <div class="information">
                  <div class="info-item red-border">
                    <i class="fas fa-briefcase-medical"></i>
                    <span>No Test Kits</span>
                  </div>
                  <div class="info-item red-border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M6 8c1.11 0 2-.9 2-2s-.89-2-2-2c-1.1 0-2 .9-2 2s.9 2 2 2zm6 0c1.11 0 2-.9 2-2s-.89-2-2-2c-1.11 0-2 .9-2 2s.9 2 2 2zM6 9.2c-1.67 0-5 .83-5 2.5V13h10v-1.3c0-1.67-3.33-2.5-5-2.5zm6 0c-.25 0-.54.02-.84.06.79.6 1.34 1.4 1.34 2.44V13H17v-1.3c0-1.67-3.33-2.5-5-2.5z"/></svg>
                    <span>Heavy Patient Load</span>
                  </div>
                  <div class="info-item green-border">
                    <i class="fas fa-phone"></i>
                    <span>${d["Phone Number"]}</span>
                  </div>
                  <div class="info-item cursor green-border"
onclick="javascript:window.open('https://www.google.com/maps/dir/?api=1&destination=${d["Address"]}', '_blank');">
                    <i class="fas fa-map-marked-alt"></i>
                    <span>Get Directions</span>
                  </div>
                </div>
              </div>
            `;
            DOM = DOM + hospitalDOM;
          }
        }
        return DOM;
      });

      hospital_display.html(`
        ${doms.join("\n")}
        <script>
          $("div.hospital > div.header > svg").click(function(evt){
            $(this).closest("div.hospital").toggleClass("active");
          });
        </script>
      `);
      $("div.hospital-display > div.hospital").first().addClass("active");
    }
    $("div.info-pane#hospital-info > div.info-header > i.fa-hospital").click(function(evt){
      updateHospitalListings();
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

      len = places[name].t.length;

      nc = places[name].c[len - 1] - places[name].c[len - 2];
      nr = places[name].r[len - 1] - places[name].r[len - 2];
      nd = places[name].d[len - 1] - places[name].d[len - 2];
      na = places[name].a[len - 1] - places[name].a[len - 2];

      if (name == "anhui" || name == "beijing" || name == "chongqing" || name == "fujian" || name == "gansu" || name == "guangdong" ||
        name == "guangxi" || name == "guizhou" || name == "hainan" || name == "hebei" || name == "heilongjiang" || name == "henan" ||
        name == "hubei" || name == "hunan" || name == "neimenggu" || name == "jiangsu" || name == "jiangxi" || name == "jilin" || name == "liaoning" ||
        name == "ningxia" || name == "qinghai" || name == "shaanxi" || name == "shandong" || name == "shanghai" || name == "shanxi" ||
        name == "sichuan" || name == "tianjin" || name == "xinjiang" || name == "yunnan" || name == "zhejiang" || name == "xizang") {
        $("#placename").text(name.toUpperCase() + ", CHINA"); // we don't support china yet
      } else {
        $("#placename").text(name.toUpperCase());
        if (all_columns_in_data.filter(col => name.toLowerCase().toTitleCase() == col).length > 0){
          // If the area is in our data
          $("div.variable-display").empty();
          var DOM = "";
          var selected_date = new Date($("div.info-header > div.info-header-element#pos-3").text().trim());
          timeseries.forEach(function(dataset, source, _){
            function compareTwoDates(d1, d2) {
              // check that two dates are on the same day
              return (d1.getMonth() === d2.getMonth()) &&
                     (d1.getDate() === d2.getDate()) &&
                     (d1.getFullYear() === d2.getFullYear());
            }
            var data = dataset.filter(d => compareTwoDates(d.date, selected_date));
            function hyphenIfNaN(o){
              return (isNaN(o) ? "&nbsp;-&nbsp;" : o);
            }
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
          });
          $("div.variable-display").html(DOM);
        }
      }

    }


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

  // function setColor(enname) {
  //   var id = 0;
  //   var pop = datasets[0][datasets[0].length - 1][enname];

  //   if (pop != undefined) {
  //     pop = +pop.toString().split("-")[0] - +pop.toString().split("-")[2] - +pop.toString().split("-")[3]; // remaining confirmed
  //   } else {
    //     pop = 0;
    //     // return "#00000000";
    //   }

    //   if (pop >= 10000) {
    //     id = 5;
    //   } else if (pop > 1000 && pop <= 10000) {
    //     id = 4;
    //   } else if (pop > 250 && pop <= 1000) {
    //     id = 3;
    //   } else if (pop > 100 && pop <= 250) {
    //     id = 2;
    //   } else if (pop > 10 && pop <= 100) {
    //     id = 1;
    //   } else if (pop > 0 && pop <= 10) {
    //     id = 0;
    //   } else {
    //     id = -1;
    //     return "#00000000";
    //   }
    //   return colors[id];
    // }


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
    }

    // 3.2.3 reset the hightlighted feature when the mouse is out of its region.
    function resetHighlight(e) {
      areas.resetStyle(e.target);
    }

    // 3.3 add these event the layer obejct.
    function onEachFeature(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        click: zoomToFeature,
        mouseout: resetHighlight
      });
    }

    var areas = new L.TopoJSON(datasets[1], {
      style: style,
      onEachFeature: onEachFeature
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
