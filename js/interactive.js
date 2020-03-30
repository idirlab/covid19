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
    d3.tsv('assets/COVID_data_collection/data/johns_hopkins_states_time_series.csv'),
    d3.tsv('assets/COVID_data_collection/data/NYtimes_time_series.csv'),
    d3.json("assets/counties.json"),
    d3.json("assets/num2state.json")
  ]).then(function(datasets) {

    var hyph = "&nbsp;-&nbsp;";
    function compareTwoDates(d1, d2) {
      // check that two dates are on the same day
      return (d1.month() === d2.month()) &&
             (d1.date() === d2.date()) &&
             (d1.year() === d2.year());
    }

    $("div.side-panel#left-side-bar > div#aggregate-date-window").scroll();
    $("div.side-panel#left-side-bar > div#aggregate-date-window").animate({scrollTop: 0});
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
    var value_extract_regex = /([\w-]+)-([\w-]+)-([\w-]+)/;
    timeseries.forEach(function(dataset, source, _){
      console.log(`Source: ${source}`);
      dataset.forEach(function(d){
        d.date = moment(d.date, "YYYY-MM-DD");
        dataset.columns.filter(col => col !== "date")
                       .forEach(function(col){
                         var element = d[col];
                         var match = element.match(value_extract_regex);
                         var cases_string = match ? match[1] : hyphenIfNaN(NaN);
                         var deaths_string = match ? match[2] : hyphenIfNaN(NaN);
                         var recoveries_string = match ? match[3] : hyphenIfNaN(NaN);
                         var cases = parseInt(cases_string);
                         var deaths = parseInt(deaths_string);
                         var recoveries = parseInt(recoveries_string);
                         d[col] = new Map([
                           ["cases", cases],
                           ["deaths", deaths],
                           ["recoveries", recoveries]
                         ]);
                       });

        d.US = dataset.columns.filter(col => col !== "date")
                                   .reduce(
                                     (acc, state) => new Map([
                                       ["cases", acc.get("cases") + d[state].get("cases")],
                                       ["deaths", acc.get("deaths") + d[state].get("deaths")],
                                       ["recoveries", acc.get("recoveries") + d[state].get("recoveries")]
                                     ]),
                                     new Map([["cases", 0], ["deaths", 0], ["recoveries", 0]])
                                   );
      });
    });
    function hyphenIfNaN(o){
      return (isNaN(o) ? hyph : o);
    }
    // create US dom tree
    var US_Variables_DOM = Array.from(
      timeseries.entries()
    ).map(function(entry) {
      var source = entry[0];
      var dataset = entry[1];
      var cases = hyph;
      var recovered = hyph;
      var deaths = hyph;
      var selected_date = moment($("div.info-header > div.info-header-element#pos-3").text().trim(),
                                 "MM/DD/YYYY");
      var data = dataset.filter(d => compareTwoDates(selected_date, d.date));

      if (data.length > 0){
        var row = data[0];
        row_cases = row.US.get("cases");
        row_recoveries = row.US.get("recoveries");
        row_deaths = row.US.get("deaths");
        cases = hyphenIfNaN(row.US.get("cases"));
        recovered = hyphenIfNaN(row.US.get("recoveries"));
        deaths = hyphenIfNaN(row.US.get("deaths"));
      }
      return `
        <div class="variable">
          <div class="source">${source}</div>
          <div class="figures">
            <div class="figure">
              <span class="confirmed-count" style="color: rgb(40, 50, 55)">${cases}</span>
            </div>
            <div class="figure">
              <span class="death-count" style="color: rgb(40, 50, 55)">${deaths}</span>
            </div>
            <div class="figure">
              <span class="recovered-count" style="color: rgb(40, 50, 55)">${recovered}</span>
            </div>
          </div>
        </div>
      `;
    });
    var US_States = Array.from(
      [{"State":"Alabama"},{"State":"Alaska"},{"State":"Arizona"},{"State":"Arkansas"},{"State":"California"},{"State":"Colorado"},{"State":"Connecticut"},{"State":"Delaware"},{"State":"Florida"},{"State":"Georgia"},{"State":"Hawaii"},{"State":"Idaho"},{"State":"Illinois"},{"State":"Indiana"},{"State":"Iowa"},{"State":"Kansas"},{"State":"Kentucky"},{"State":"Louisiana"},{"State":"Maine"},{"State":"Maryland"},{"State":"Massachusetts"},{"State":"Michigan"},{"State":"Minnesota"},{"State":"Mississippi"},{"State":"Missouri"},{"State":"Montana"},{"State":"Nebraska"},{"State":"Nevada"},{"State":"New Hampshire"},{"State":"New Jersey"},{"State":"New Mexico"},{"State":"New York"},{"State":"North Carolina"},{"State":"North Dakota"},{"State":"Ohio"},{"State":"Oklahoma"},{"State":"Oregon"},{"State":"Pennsylvania"},{"State":"Rhode Island"},{"State":"South Carolina"},{"State":"South Dakota"},{"State":"Tennessee"},{"State":"Texas"},{"State":"Utah"},{"State":"Vermont"},{"State":"Virginia"},{"State":"Washington"},{"State":"West Virginia"},{"State":"Wisconsin"},{"State":"Wyoming"}]
     .map(d => d["State"]));
    var selected_source = $("span.default-source").text().trim();
    var selected_date = moment($("div.info-header > div.info-header-element#pos-3").text().trim(),
                               "MM/DD/YYYY");
    var default_values_dataset = timeseries.get(selected_source);
    var default_data = default_values_dataset .filter(d => compareTwoDates(selected_date, d.date));
    function get_state_default_values(state) {
      var cases = hyph;
      var deaths = hyph;
      var recovered = hyph;
      if (default_data.length > 0){
        var cases = hyphenIfNaN(default_data[0][state].get("cases"));
        var deaths =  hyphenIfNaN(default_data[0][state].get("recovered"));
        var recovered = hyphenIfNaN(default_data[0][state].get("deaths"));
      }
      var output = {"cases":cases,
                    "recovered":recovered,
                    "deaths":deaths};
      return output;
    }

    var US_State_variables_by_source = Array.from(
      timeseries.entries()
    ).map(function(entry) {
      var source = entry[0];
      var dataset = entry[1];
      var data = dataset.filter(d => compareTwoDates(selected_date, d.date));
      if (data.length > 0){
        var row = data[0];
        var state_stats = US_States.map(state => new Map([
          ["state", state],
          ["stats", row[state]],
          ["counties", []]]));
        var state_variable_DOMS = state_stats.map(function (state_map) {
          var state = state_map.get("state");
          var stats = state_map.get("stats");
          var counties = state_map.get("counties");
          var cases = hyphenIfNaN(stats.get("cases"));
          var deaths = hyphenIfNaN(stats.get("deaths"));
          var recovered = hyphenIfNaN(stats.get("recovered"));

          var output = new Map([[state,
          `
            <div class="variable">
              <div class="source">${source}</div>
              <div class="figures">
                <div class="figure">
                  <span class="confirmed-count" style="color: rgb(40, 50, 55)">${cases}</span>
                </div>
                <div class="figure">
                  <span class="death-count" style="color: rgb(40, 50, 55)">${deaths}</span>
                </div>
                <div class="figure">
                  <span class="recovered-count" style="color: rgb(40, 50, 55)">${recovered}</span>
                </div>
              </div>
            </div>
          `]]);
          return output;
        });
        return state_variable_DOMS;
      } else {
        function make_no_data_string(state) {
          return `
            <div id="variable-loading-no-data">
              No data for DATE=${moment(selected_date).format("MM/DD/YYYY")} AND LOCATION=${state}. </br>
              Please try somewhere in the US after 03/19/2020.
            </div>
          `;
        }
        return US_States.map(state => new Map([[state, make_no_data_string(state)]]));
      }
    }).map(maps => maps.reduce((acc, m) => new Map([...acc, ...m])));
    var US_State_variables = new Map(Array.from(
      US_States.map(state =>
        [state,
         Array.from(
           US_State_variables_by_source.map(source_map =>
             Array.from(
               source_map.entries()
             ).filter(array => array[0] == state)[0][1]
           )
         ).join("\n")
        ]
      )
    ));
    var US_States_DOMs = Array.from(US_State_variables.entries()).map(function(array){
      var state = array[0];
      var variables_DOM = array[1];
      var caseinfostrings = get_state_default_values(state);
      return `
        <div class="geolocation-container" parent="COUNTRY" COUNTRY="US" STATE="${state}" level="STATE" children="COUNTIES">
          <div class="location-information-container">
              <span class="placename">${state}</span>
              <div class="figures">
                <div class="figure">
                  <span class="confirmed-count" style="color: rgb(40, 50, 55)">${caseinfostrings["cases"]}</span>
                </div>
                <div class="figure">
                  <span class="death-count" style="color: rgb(40, 50, 55)">${caseinfostrings["deaths"]}</span>
                </div>
                <div class="figure">
                  <span class="recovered-count" style="color: rgb(40, 50, 55)">${caseinfostrings["recovered"]}</span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/><path d="M0 0h24v24H0V0z" fill="none"/></svg>
          </div>
          <div class="variable-display">
            ${variables_DOM}
          </div>
        </div>
      `;
    });
    var US_States_DOM = US_States_DOMs.join("\n");
    // now get US-level info
    var relevant_rows = timeseries.get(selected_source).filter(d => compareTwoDates(selected_date, d.date));
    var cases = "-";
    var deaths = "-";
    var recovered = "-";
    if(relevant_rows.length > 0){
      var row = relevant_rows[0];
      var us_cases = row["US"].get("cases");
      var us_deaths = row["US"].get("deaths");
      var us_recovered = row["US"].get("recovered");
      if(!isNaN(us_cases)){
        cases = us_cases;
      }
      if(!isNaN(us_deaths)){
        deaths = us_deaths;
      }
      if(!isNaN(us_recovered)){
        recovered = us_recovered;
      }
    }
    var US_dom = `
        <div class="geolocation-container" parent="GLOBAL" country="US" level="COUNTRY" children="STATE">
          <div class="location-information-container">
              <span class="placename">US</span>
              <div class="figures">
                <div class="figure">
                  <span class="confirmed-count" style="color: rgb(40, 50, 55)">${cases}</span>
                </div>
                <div class="figure">
                  <span class="death-count" style="color: rgb(40, 50, 55)">${deaths}</span>
                </div>
                <div class="figure">
                  <span class="recovered-count" style="color: rgb(40, 50, 55)">${recovered}</span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/><path d="M0 0h24v24H0V0z" fill="none"/></svg>
          </div>
          <div class="variable-display">
            ${US_Variables_DOM.join('\n')}
          </div>
          <div class="state-display">
            ${US_States_DOM}
          </div>
        </div>
        <script>
          $(document).ready(function(){
            $("div.geolocation-container[country='US']")
              .filter("div.geolocation-container[level='COUNTRY']")
              .children(".location-information-container").on("click", function(evt){
                var user_clicked_arrow = evt.target.matches("svg");
                if(user_clicked_arrow)
                  return;
                var states_display = $(this).next().next();
                states_display.toggleClass("expanded");
              });
          });
        </script>
    `;
    var GLOBAL_dom = `
      <div class="geolocation-container" children="COUNTRY">
        <div class="location-information-container">
            <span class="placename">GLOBAL</span>
            <div class="figures">
              <div class="figure">
                <span class="confirmed-count" style="color: rgb(40, 50, 55)">${cases}</span>
              </div>
              <div class="figure">
                <span class="death-count" style="color: rgb(40, 50, 55)">${deaths}</span>
              </div>
              <div class="figure">
                <span class="recovered-count" style="color: rgb(40, 50, 55)">${recovered}</span>
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/><path d="M0 0h24v24H0V0z" fill="none"/></svg>
        </div>
        <div class="variable-display">
          ${US_Variables_DOM.join('\n')}
        </div>
        <div class="country-display">
          ${US_dom}
        </div>
      </div>
    `;

    $("div#aggregate-date-window").append(`
      ${GLOBAL_dom}
      <script>
      $(document).ready(function(){
        $("div.location-information-container > svg").click(function(){
          $(this).toggleClass("active");
          var variable_display = $(this).parent().next();
          variable_display.toggleClass("expanded");
        });
        $("div.geolocation-container[children='COUNTRY']")
          .children(".location-information-container").on("click", function(evt){
            var user_clicked_arrow = evt.target.matches("svg");
            if(user_clicked_arrow)
              return;
            var country_display = $(this).next().next();
            var us_location_container = $("div.geolocation-container[level='COUNTRY']")
              .filter("div.geolocation-container[country='US']");
            var state_display = us_location_container.children(".state-display");
            state_display.toggleClass("expanded", false)
            country_display.toggleClass("expanded");
          });
      });
      </script>
    `);

    $("#date").text("Last update: " + datasets[3][0].timestamp.split(".")[0] + " PST");

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
      var is_state = US_States.map(s => s.toLowerCase()).includes(name);
      var is_US = name.toUpperCase() === "US";

      if (is_global) {
        console.log("global");
        // Hide all other infoboxes and show the countires and global units
        $("div.geolocation-container[children!='COUNTRY']")
          .children(".location-information-container")
          .children("svg[class='active']").click();
        $("div.geolocation-container[children='COUNTRY']")
          .children(".location-information-container")
          .children("svg").toggleClass("active", true);
        $("div.geolocation-container[children='COUNTRY']")
          .children(".variable-display").toggleClass("expanded", true);
        $("div.geolocation-container[children='COUNTRY']")
          .children(".country-display").toggleClass("expanded", true);
        $("div.state-display.expanded").toggleClass("expanded", false);
      } else if (is_US){
        // Hide all other infoboxes and show the states and US units
        $("div.geolocation-container[level!='COUNTRY']")
          .filter("div.geolocation-container[country!='US']")
          .children(".location-information-container")
          .children("svg[class='active']").click();
        $("div.geolocation-container[level='COUNTRY']")
          .filter("div.geolocation-container[country='US']")
          .children(".location-information-container")
          .children("svg").toggleClass("active", true);
        $("div.geolocation-container[level='COUNTRY']")
          .filter("div.geolocation-container[country='US']")
          .children(".variable-display").toggleClass("expanded", true);
        $("div.geolocation-container[level='COUNTRY']")
          .filter("div.geolocation-container[country='US']")
          .children(".state-display").toggleClass("expanded", true);
      } else if (is_state) {
        $("div.geolocation-container[level!='STATE']")
          .filter("div.geolocation-container[country!='US']")
          .children(".location-information-container")
          .children("svg[class='active']").click();
        $("div.geolocation-container[level='STATE']")
          .filter("div.geolocation-container[country='US']")
          .filter(`div.geolocation-container[state!='${name.toTitleCase()}']`)
          .children(".location-information-container")
          .children("svg[class='active']").click();
        var us_location_container = $("div.geolocation-container[level='COUNTRY']")
          .filter("div.geolocation-container[country='US']");
        var state_display = us_location_container.children(".state-display");
        state_display.toggleClass("expanded", true)
        us_location_container
          .children(".variable-display").toggleClass("expanded", false);
        us_location_container
          .children(".location-information-container")
          .children("svg")
          .toggleClass("active", false);
        var state_svg = $("div.geolocation-container[level='STATE']")
          .filter(`div.geolocation-container[state='${name.toTitleCase()}']`)
          .children(".location-information-container")
          .children("svg");
        var state_last_variable = $("div.geolocation-container[level='STATE']")
          .filter(`div.geolocation-container[state='${name.toTitleCase()}']`)
          .children(".location-information-container")
          .children(".placename");
        if(!state_svg.attr("class")){
          state_svg.click()
        }
        var container = $("div.side-panel#left-side-bar > div#aggregate-date-window");
        container.scroll();
        container.animate({
          scrollTop: state_last_variable.offset().top - container.offset().top + container.scrollTop()
        });
        console.log("logic to show counties goes here...");
      }

      if (name == "anhui" || name == "beijing" || name == "chongqing" || name == "fujian" || name == "gansu" || name == "guangdong" ||
        name == "guangxi" || name == "guizhou" || name == "hainan" || name == "hebei" || name == "heilongjiang" || name == "henan" ||
        name == "hubei" || name == "hunan" || name == "neimenggu" || name == "jiangsu" || name == "jiangxi" || name == "jilin" || name == "liaoning" ||
        name == "ningxia" || name == "qinghai" || name == "shaanxi" || name == "shandong" || name == "shanghai" || name == "shanxi" ||
        name == "sichuan" || name == "tianjin" || name == "xinjiang" || name == "yunnan" || name == "zhejiang" || name == "xizang") {
        $(".placename.hidden").text(name.toUpperCase() + ", CHINA"); // we don't support china yet
      } else {
        $(".placename.hidden").text(name.toUpperCase());
      }
    }


    var date_div = $("div.info-pane#aggregate-date-window > div.info-header > div.date-element#pos-3");
    $("div.info-pane#aggregate-date-window > div.info-header > div.arrow").click(function(evt){
      var arrow_position = $(this).attr("id");

      var date_str = date_div.text();
      var selected_date = moment(new Date(date_str));
      var dates = ["pos-2", "pos-3", "pos-4"].map(id =>
        moment($(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${id}`).text(),
               "MM/DD/YYYY"));
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
    date_div.on('DOMSubtreeModified', function(){
      var name = $(".placename.hidden").text().trim().toLowerCase();
      showPlace(name);
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
