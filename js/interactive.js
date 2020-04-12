function select_default_source() {
  $("div.modal.fade#settings-modal").modal(
    {keyboard: false,
     backdrop: false}
  );
}
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
  var queryURL = "http://localhost:2222/api/v1/sourcequery?level={PLACEHOLDER}";
  var parseSources = (level) => (
    (parseSources) => {
      var sources = parseSources.map(src => `<li class="select-source-item ${level} option"><a class="noHover" href="">${src}</a></li>`);
      var dropdown_contents = sources.reduce((acc, item) => [acc, item].join("\n"));
      var original_src = $(`span.default-source-${level}.hidden`).text();
      var dropdown_DOM = `
       <div class="dropdown-${level}">
         <button class="btn btn-primary dropdown-toggle"
                 style="background-color:rgba(207, 216, 220, 1);border:1px solid rgba(38, 50, 56, 1);color:rgba(38, 50, 56, 1);"
                 type="button"
                 id="dropdownMenu-${level}"
                 data-toggle="dropdown"
                 aria-haspopup="true"
                 aria-expanded="false">${original_src}</span></button>
         <ul class="dropdown-menu"
             aria-labeledby="dropdownMenu-${level}"
             style="background-color:rgba(207, 216, 220, 1);">
           ${dropdown_contents}
         </ul>
       </div>
      `;
      $(`div.source-selector-${level}`).html(dropdown_DOM);
      $(`li.${level}.option`).click(function(){
        var src = $(this).text().trim();
        $(`div.dropdown-${level} > button`).text(src);
        $(`span.default-source-${level}.hidden`).text(src);
      });
      console.log(`sources for level=${level} are: ${dropdown_DOM}`);
    }
  );
  ["global", "country", "state", "county"].forEach(
    function(level){
      var url = queryURL.replace("{PLACEHOLDER}", level);
      console.log(url);
      corsHTTP(url, parseSources(level));
    }
  );

  function getDay(num, str) {
    var today = new Date();
    var nowTime = today.getTime()
    var ms = 24*3600*1000*num
    today.setTime(parseInt(nowTime + ms))
    var oYear = today.getFullYear()
    var oMoth = (today.getMonth() + 1).toString()
    if (oMoth.length <= 1) oMoth = '0' + oMoth
    var oDay = today.getDate().toString()
    if (oDay.length <= 1) oDay = '0' + oDay
    return oMoth + str + oDay+ str+ oYear
  }
  var today = getDay(0, '/')
  var yesterday = getDay(-1, '/')
  var tomorrow = getDay(1, '/')
  document.getElementById("pos-2").innerHTML = yesterday
  document.getElementById("pos-3").innerHTML = today
  document.getElementById("pos-4").innerHTML = tomorrow
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
    d3.json("assets/counties.json"),
    d3.json("assets/num2state.json")
  ]).then(function(datasets) {
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
    var hyph = "&nbsp;-&nbsp;";
    var US_States = Array.from(
      [{"State":"Alabama"},{"State":"Alaska"},{"State":"Arizona"},{"State":"Arkansas"},{"State":"California"},{"State":"Colorado"},{"State":"Connecticut"},{"State":"Delaware"},{"State":"Florida"},{"State":"Georgia"},{"State":"Hawaii"},{"State":"Idaho"},{"State":"Illinois"},{"State":"Indiana"},{"State":"Iowa"},{"State":"Kansas"},{"State":"Kentucky"},{"State":"Louisiana"},{"State":"Maine"},{"State":"Maryland"},{"State":"Massachusetts"},{"State":"Michigan"},{"State":"Minnesota"},{"State":"Mississippi"},{"State":"Missouri"},{"State":"Montana"},{"State":"Nebraska"},{"State":"Nevada"},{"State":"New Hampshire"},{"State":"New Jersey"},{"State":"New Mexico"},{"State":"New York"},{"State":"North Carolina"},{"State":"North Dakota"},{"State":"Ohio"},{"State":"Oklahoma"},{"State":"Oregon"},{"State":"Pennsylvania"},{"State":"Rhode Island"},{"State":"South Carolina"},{"State":"South Dakota"},{"State":"Tennessee"},{"State":"Texas"},{"State":"Utah"},{"State":"Vermont"},{"State":"Virginia"},{"State":"Washington"},{"State":"West Virginia"},{"State":"Wisconsin"},{"State":"Wyoming"}]
     .map(d => d["State"]));

    $("div.side-panel#left-side-bar > div#aggregate-date-window").scroll();
    $("div.side-panel#left-side-bar > div#aggregate-date-window").animate({scrollTop: 0});
    var usstates = datasets[datasets.length - 1];
    var uscounties = datasets[datasets.length - 2];
    var countylist = uscounties.features.map(d => d.properties.NAME);
var source_list = new Map([
 ["CDC", 'cdc_time_series.csv'], // state
 ["CNN", 'cnn_time_series.csv'], // state
 ["COVID Tracking Project", 'COVIDTrackingProject_time_series_with_history.csv'], // state
 ["NY Times", 'NYtimes_us-states.csv'], // state
 ["JHU", new Map([
 ["country", 'JHU_global_time_series.csv'], // global
 ["state", 'johns_hopkins_states_time_series.csv'], // state
 ["county", 'johns_hopkins_counties_time_series.csv'], // county
 ])]]);
    var source_list = Array.from(
      new Map([
        ["CDC", 'cdc_time_series.csv'], // state
        ["CNN", 'cnn_time_series.csv'], // state
        ["COVID Tracking Project", 'COVIDTrackingProject_time_series_with_history.csv'], // state
        ["NY Times", 'NYtimes_us-states.csv'], // state
        ["JHU", new Map([
        ["country", 'JHU_global_time_series.csv'], // global
        ["state", 'johns_hopkins_states_time_series.csv'], // state
        ["county", 'johns_hopkins_counties_time_series.csv'], // county
        ])]]).entries()
    ).map(arr => arr[0]);

    // create US dom tree
    function selected_source() { return $("span.default-source-global").text().trim();}
    function selected_date() { return moment($("div.info-header > div.info-header-element#pos-3").text().trim(), "MM/DD/YYYY"); }

    $("#date").text("Last update: " + datasets[3][0].timestamp.split(".")[0] + " PST");

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

      // data_str = JSON.stringify(datasets[0])
      // console.log("virus.length: ", datasets[0].length)
      // console.log("calPlace name: "+ name)
      // console.log('datasets : '+ data_str)


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

      console.log("place[name]: ", place[name])
      return place[name];
    }

    function showPlace(name, parent=null) {
      // console.log(name)
      name = name.toLowerCase().toTitleCase();
      var is_global = name.toUpperCase() === "GLOBAL";
      var is_state = US_States.map(s => s.toLowerCase()).includes(name.toLowerCase());
      if(is_state)
        $("span.selected-state.hidden").text(name.toLowerCase().toTitleCase());
      var is_US = name.toUpperCase() === "US";
      var is_county = Boolean(name.toUpperCase().includes("COUNTY") |
                              name.toUpperCase().includes("BOROUGH") |
                              name.toUpperCase().includes("PARISH")|
                              (!is_state && countylist.includes(name.toLowerCase().toTitleCase())));
      var county_state = $("span.selected-state.hidden").text();

      function hospital_container_msg_DOM(msg, hidden) {
        return `
            <div id="hospital-info" class="info-pane smaller right ${hidden?'hidden':''}" style="margin-top:48px;">
              <div class="info-header smaller right unset-height ${hidden?'hidden':''}">
                <i class="fas fa-hospital"></i>
                <span class="titile_info">LOCAL HOSPITAL INFO</span>
                <button class="close_hos_info" onclick="close_hos_info()">
                  <i class="fas fa-times-circle" style="font-size: 24px;"></i>
                </button>
              </div>
              <script>
                function close_hos_info() {
                  console.log("close");
                  $("div#hospital-info").css("display","none");
                }
              </script>
              ${msg}
            </div>
            `;
      }
      $("div#floating-side-panel-info-container").html(
        hospital_container_msg_DOM(
          !is_county ? "Please navigate to county level to view hospitals" : "Loading...",
          !is_county ? true : false
        )
      );


      var parseInfo = (info) => {
          // Create side-panel here
          console.log(info.curnode)
          console.log(info.curnode.default_stats)
          var no_data = Object.entries(info.curnode.detailed_stats).length == 0;
          if (no_data) {
            $("div#aggregate-date-window > div.response-area").html(`
              No data for <br/> <tt>DATE = ${selected_date().format("YYYY-MM-DD")}</tt> and <tt>LOCATION = ${name}</tt>
            `);
            return;
          }
          var cases = info.curnode.default_stats[0];
          var deaths = info.curnode.default_stats[1]==-1 ? "NA" : info.curnode.default_stats[1];
          var recovered = info.curnode.default_stats[2]==-1 ? "NA" : info.curnode.default_stats[2];
          var variable_DOMS = Array.from(Object.entries(info.curnode.detailed_stats)).map(src_to_stats =>
            `
             <div class="variable">
               <div class="source">${src_to_stats[0]}</div>
               <div class="figures">
                 <div class="figure">
                   <span class="confirmed-count" style="color: rgb(40, 50, 55)">${src_to_stats[1][0]}</span>
                 </div>
                 <div class="figure">
                   <span class="death-count" style="color: rgb(40, 50, 55)">${src_to_stats[1][1]==-1 ? 'NA': src_to_stats[1][1]}</span>
                 </div>
                 <div class="figure">
                   <span class="recovered-count" style="color: rgb(40, 50, 55)">${src_to_stats[1][2]==-1 ? 'NA': src_to_stats[1][2]}</span>
                 </div>
               </div>
             </div>
           `);
        var variable_DOM = `
          <div class="variable-display expanded">
            ${variable_DOMS.join("\n")}
          </div>
        `;
        function standard_name(string) {
          var out = string.toLowerCase().toTitleCase();
          if (out.toUpperCase() == "US")
            out = "United States";
          return out;
        }
        var placename = standard_name(name)
        var location_info_DOM = `
          <div class="location-information-container root">
              <span class="placename">${placename}</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px" class="active"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"></path><path d="M0 0h24v24H0V0z" fill="none"></path></svg>
          </div>
        `;
        var placename = (s) =>
          standard_name(is_state ? `${s.toLowerCase().toTitleCase()} ${municipalityPostfix(county_state)}`: s);
        var first_order_children_DOM = info.children.map(child_obj => `
          <div class="location-information-container" style="margin-top:12px;">
          <span class="placename">${placename(child_obj.name)}</span>
              <div class="figures">
                <div class="figure">
                  <span class="confirmed-count" style="color: rgb(40, 50, 55)">${child_obj.default_stats[0]}</span>
                </div>
                <div class="figure">
                  <span class="death-count" style="color: rgb(40, 50, 55)">${child_obj.default_stats[1]==-1 ? 'NA': child_obj.default_stats[1]}</span>
                </div>
                <div class="figure">
                  <span class="recovered-count" style="color: rgb(40, 50, 55)">${child_obj.default_stats[2]==-1 ? 'NA': child_obj.default_stats[2]}</span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px" class="active"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"></path><path d="M0 0h24v24H0V0z" fill="none"></path></svg>
          </div>`).join("\n");
        var output_DOM = `
          <div class="geolocation-container">
            ${location_info_DOM}
            ${variable_DOM}
          </div>
          ${first_order_children_DOM}
        `;
        $("div#aggregate-date-window > div.response-area").html(`
          ${output_DOM}
        `);
        $("div.location-information-container.root > svg").click(function(){
          $(this).parent().next().toggleClass("expanded");
        });
        $("div.location-information-container > svg").click(function(){
          $(this).toggleClass("active");
          if($(this).parent().attr("class").split(/\s+/).includes("root"))
            return;
          var placename = $(this).parent().find("span.placename");
          showPlace(placename.text().trim());
        });
      }

      if(parent) {
        //queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery?node=${name+'-'+parent}&date=${selected_date().format("YYYY-MM-DD")}&dsrc=${selected_source()}`
        queryURL = `http://localhost:2222/api/v1/statquery?node=${name+'-'+parent}&date=${selected_date().format("YYYY-MM-DD")}&dsrc=${selected_source()}`
      } else {
        // queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery?node=${name}&date=${selected_date().format("YYYY-MM-DD")}&dsrc=${selected_source()}`
        queryURL = `http://localhost:2222/api/v1/statquery?node=${name}&date=${selected_date().format("YYYY-MM-DD")}&dsrc=${selected_source()}`
      }
      console.log("qwer", queryURL)

      corsHTTP(queryURL, parseInfo)

      if (is_county) {

        // Update hospitals and render hospitals
        var DOM ="";

        var types = ["COUNTY", "BOROUGH", "PARISH"];
        var countyType = null;

        for (var i=0; i<types.length; i++) {
          if (name.toUpperCase().indexOf(" " + types[i]) != -1) {
            countyType = types[i];
            break;
          }
        }

        if (countyType == null) {
          var curDOM = `
          <div id="hospital-info" class="info-pane smaller right hidden">
            <div class="info-header smaller right unset-height hidden">
              <i class="fas fa-hospital"></i>
              <span class="titile_info">LOCAL HOSPITAL INFO</span>
              <button class="close_hos_info" onclick="close_hos_info()">
                  <i class="fas fa-times-circle" style="font-size: 24px;"></i>
                </button>
            </div>
            <script>
              function close_hos_info() {
                console.log("close");
                $("div#hospital-info").css("display","none")
              }
            </script>
            Please navigate to county level to view hospitals
          </div>
          `;

          DOM += curDOM;

          if (!is_global){
            $("div.variable-display").html(DOM);
            adjustHospitalPaneHeight();
          }
        } else {
          var state = county_state.toUpperCase();
          var county = name.toUpperCase().replace(" " + countyType, "");

          var queryURL = `https://services7.arcgis.com/LXCny1HyhQCUSueu/arcgis/rest/services/Definitive_Healthcare_USA_Hospital_Beds/FeatureServer/0/query?where=UPPER(STATE_NAME)%20like%20'%25${state.toUpperCase()}%25'%20AND%20UPPER(COUNTY_NAME)%20like%20'%25${county.toUpperCase()}%25'&outFields=*&outSR=4326&f=json`;
          console.log("Retrieving hospital info for " + county + ", " + state);
          console.log(queryURL);

          var getHospitalHTML = (info) => {
            console.log(info);

            info = info.features;
            var hospitalDOMs = "";

            if (info.length == 0) {
              hospitalDOMs += "This county does not have a major hospital";
            }

            info.sort(function(l, r) {
              return l.attributes.HOSPITAL_NAME < r.attributes.HOSPITAL_NAME ? -1 : 1;
            });

            var maxCapacity = 0;
            for (var i=0; i<info.length; i++) {
              maxCapacity = Math.max(maxCapacity, info[i].attributes.NUM_LICENSED_BEDS);
            }
            console.log(maxCapacity);

            for (var i=0; i<info.length; i++) {
              var cur = info[i].attributes;
              var addr = `${cur.HQ_ADDRESS} ${cur.HQ_CITY}, ${cur.HQ_STATE}, ${cur.HQ_ZIP_CODE}`;

              var sourceDOM = `
              <div class="hospital">
                <div class="header">
                  <div class="name"><full-count style="background: ${cur.BED_UTILIZATION == null ? "purple" : (cur.BED_UTILIZATION < 0.33 ? 'green' : (cur.BED_UTILIZATION < 0.66 ? '#ee7600' : 'red'))}">${cur.BED_UTILIZATION == null ? "No Data" : Math.round(cur.BED_UTILIZATION * 100) + "% Full"}</full-count> ${cur.HOSPITAL_NAME}</div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/><path d="M0 0h24v24H0V0z" fill="none"/></svg>
                </div>
                <div class="information">
                  <div class="info-item blue-border">
                    <i class="fas fa-hospital-alt"></i>
                    <span>${cur.HOSPITAL_TYPE}</span>
                  </div>
                  <div class="info-item ${cur.NUM_LICENSED_BEDS == null ? "black" : cur.NUM_LICENSED_BEDS / maxCapacity < 0.33 ? 'red' : (cur.NUM_LICENSED_BEDS / maxCapacity < 0.66 ? 'orange' : 'green')}-border">
                    <i class="fas fa-bed"></i>
                    <span>${cur.NUM_LICENSED_BEDS == null ? "No Bed Data" : cur.NUM_LICENSED_BEDS + " Total Beds"}${cur.NUM_ICU_BEDS != null ? " (" + cur.NUM_ICU_BEDS + " ICU)" : ""}</span>
                  </div>
                  <div class="info-item ${cur.BED_UTILIZATION == null ? "black" : cur.BED_UTILIZATION < 0.33 ? 'green' : (cur.BED_UTILIZATION < 0.66 ? 'orange' : 'red')}-border">
                    <i class="fas fa-briefcase-medical"></i>
                    <!-- <span>${Math.round(cur.BED_UTILIZATION * 100)}% (${Math.round(cur.BED_UTILIZATION * cur.NUM_LICENSED_BEDS)}/${cur.NUM_LICENSED_BEDS}) of beds occupied</span> -->
                    <span>${cur.BED_UTILIZATION == null ? "No Data for" : Math.round(cur.BED_UTILIZATION *100) + "%"} Average Bed Utilization</span>
                  </div>
                  <div class="info-item ${cur.NUM_STAFFED_BEDS == null ? "black" : cur.NUM_STAFFED_BEDS / cur.NUM_LICENSED_BEDS < 0.33 ? 'red' : (cur.NUM_STAFFED_BEDS / cur.NUM_LICENSED_BEDS < 0.66 ? 'orange' : 'green')}-border">
                    <i class="fas fa-user-nurse"></i>
                    <span>${cur.NUM_LICENSED_BEDS == null || cur.NUM_STAFFED_BEDS == null ? "No Data for Staffed Beds" : Math.round(cur.NUM_STAFFED_BEDS / cur.NUM_LICENSED_BEDS * 100) + "% (" + cur.NUM_STAFFED_BEDS + "/" + cur.NUM_LICENSED_BEDS + ") of Beds Staffed"}</span>
                  </div>
                  <div class="info-item cursor blueviolet-border" onclick="window.open('https://www.google.com/maps/place/${encodeURI(addr)}')">
                    <i class="fas fa-map-marked-alt"></i>
                    <span>Get Directions</span>
                  </div>
                </div>
              </div>
              `
              hospitalDOMs += sourceDOM;
            }

            var retDOM = `
            <div id="hospital-info" class="info-pane smaller right scrollable" style="margin-top:48px;">
              <div class="info-header smaller right unset-height">
                <i class="fas fa-hospital"></i>
                <span class="titile_info">LOCAL HOSPITAL INFO</span>
                <button class="close_hos_info" onclick="close_hos_info()">
                  <i class="fas fa-times-circle" style="font-size: 24px;"></i>
                </button>
              </div>
              <script>
                function close_hos_info() {
                  console.log("close");
                  $("div#hospital-info").css("display","none")
                }
              </script>


              <div class="hospital-display">
                ${hospitalDOMs}
                <script>
                  $("div.hospital > div.header > svg").click(function(evt){
                    $(this).closest("div.hospital").toggleClass("active");
                  });

                </script>
              </div>
            </div>
            `;

            return retDOM;
          }

          var updateLeftPanel = (hosInfo) => {
            DOM = DOM + getHospitalHTML(hosInfo);

            if (!is_global){
              $("div#floating-side-panel-info-container").html(DOM);
              adjustHospitalPaneHeight();
            }
          }

          corsHTTP(queryURL, updateLeftPanel);
        }
      }

    }


    var date_div = $("div.info-pane#aggregate-date-window > div.info-header > div.date-element#pos-3");

    $("div.info-pane#aggregate-date-window > div.info-header > div.arrow").click(function(evt){
      var arrow_position = $(this).attr("id");

      var date_str = date_div.text();
      var selected_date = moment(new Date(date_str));
      var dates = ["pos-2", "pos-3", "pos-4"].map(id =>
        moment($(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${id}`).text(), "MM/DD/YYYY"));
      var new_dates = (arrow_position === "pos-1") || (arrow_position === "pos-2") ?
                      dates.map(d => d.subtract(1, "days")) :
                      dates.map(d => d.add(1, "days"));
      // Now update the dates TODO: bugs time offset by 1 day to real data.
      new_dates.forEach(function(new_date, idx){
        var pos_id = `pos-${idx + 2}`;
        var date_str = new_date.format("MM/DD/YYYY");
        $(`div.info-pane#aggregate-date-window > div.info-header > div.date-element#${pos_id}`).text(date_str);
      });
    });
    date_div.on('DOMSubtreeModified', function(){
      if ($(this).html().length == 0)
        return;
      var name = $(".placename.hidden").text().trim().toLowerCase();
      name_list = name.split(',')
      if (name_list.length == 1) {
        showPlace(name_list[0]);
      } else if (name_list.length == 2) {
        showPlace(name_list[0], name_list[1]);
      }


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
        if(usstates[feat.properties.STATE]==e.target.feature.properties.enname ||
           usstates[feat.properties.STATE]==e.target.feature.properties.enname.split(/\s+/)[0]){
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
      var state = usstates[e.target.feature.properties.STATE].toTitleCase(); // to be used for filter
      var county = `${e.target.feature.properties.NAME.toTitleCase()} ${municipalityPostfix(state)}`;

      $(".placename.hidden").text(county+','+state);

      console.log("county name: " + county);
      showPlace(county, state);

      date_list = []
      date_list.push('t');
      total_list = [];
      total_list.push('Total cases');
      death_list = [];
      death_list.push('Fatal Cases');
      recover_list = [];
      recover_list.push('Recoveries');

      var update_county_Chart = (data) => {

        data_str = JSON.stringify(data)
        console.log('Chart_county_data!!!: ' + data_str)

        for (let index = 0; index < data.length; index++) {

          const element = data[index];
          if (element['stats'].length == 0) {
            break
          }
          if (element['stats'][2] == -1) {
            element['stats'][2] = 0
          }
          
          date_list.push(element['date'])
          total_list.push(element['stats'][0])
          death_list.push(element['stats'][1])
          recover_list.push(element['stats'][2])
        }
        $("div.chart_panel").css("display","block")

        chart.load({
          columns: [date_list, total_list, death_list, recover_list],
          unload: ['t', 'Total cases' , 'Fatal Cases', 'Recoveries'],
        });

      }

      function format_date(num, str) {
        var today = new Date();
        var nowTime = today.getTime()
        var ms = 24*3600*1000*num
        today.setTime(parseInt(nowTime + ms))
        var oYear = today.getFullYear()
        var oMoth = (today.getMonth() + 1).toString()
        if (oMoth.length <= 1) oMoth = '0' + oMoth
        var oDay = today.getDate().toString()
        if (oDay.length <= 1) oDay = '0' + oDay
        return oYear + str + oMoth + str + oDay
      }
      var format_today = format_date(0, '-')

      queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery_timeseries?node=${county}-${state}&dsrc=JHU&date_start=2020-01-23&date_end=${format_today}`
      corsHTTP(queryURL, update_county_Chart);

      console.log('query_county_url: ' + queryURL)
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
      showPlace("Global");
      // calCounts(global);
      // chart.load({
      //   columns: [places["Global Trend"].c, places["Global Trend"].a, places["Global Trend"].r, places["Global Trend"].d],
      //   unload: ['Aggr. Confirmed', 'Active Confirmed', 'Recovered', 'Death'],
      // });

      $("#hint").text("Click a place to review local trend.");

      date_list = []
      date_list.push('t');
      total_list = [];
      total_list.push('Total cases');
      death_list = [];
      death_list.push('Fatal Cases');
      recover_list = [];
      recover_list.push('Recoveries');
      

      var updateChart = (data) => {
        for (let index = 0; index < data.length; index++) {

          const element = data[index];
          if (element['stats'].length == 0) {
            break
          }
          if (element['stats'][2] == -1) {
            element['stats'][2] = 0
          }
          
          date_list.push(element['date'])
          total_list.push(element['stats'][0])
          death_list.push(element['stats'][1])
          recover_list.push(element['stats'][2])
        }

        $("div.chart_panel").css("display","block")

        chart.load({
          columns: [date_list, total_list, death_list, recover_list],
          unload: ['t', 'Total cases' , 'Fatal Cases', 'Recoveries'],
        });

      }

      function format_date(num, str) {
        var today = new Date();
        var nowTime = today.getTime()
        var ms = 24*3600*1000*num
        today.setTime(parseInt(nowTime + ms))
        var oYear = today.getFullYear()
        var oMoth = (today.getMonth() + 1).toString()
        if (oMoth.length <= 1) oMoth = '0' + oMoth
        var oDay = today.getDate().toString()
        if (oDay.length <= 1) oDay = '0' + oDay
        return oYear + str + oMoth + str + oDay
      }
      var format_today = format_date(0, '-')

      queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery_timeseries?node=Global&dsrc=JHU&date_start=2020-01-23&date_end=${format_today}`
      corsHTTP(queryURL, updateChart);

    });

    mymap.on('click', onMapClick);


    function onMapClick(e) {
      $("#hint").click();
    }


    places["Global Trend"] = calPlace("Global Trend");

    showPlace("Global");

    date_list = []
    date_list.push('t');
    total_list = [];
    total_list.push('Total cases');
    death_list = [];
    death_list.push('Fatal Cases');
    recover_list = [];
    recover_list.push('Recoveries');
    

    var updateChart = (data) => {

      data_str = JSON.stringify(data)
      console.log('Chart_data!!!: ' + data_str)
      
      for (let index = 0; index < data.length; index++) {

        const element = data[index];
        if (element['stats'].length == 0) {
          break
        }
        if (element['stats'][2] == -1) {
            element['stats'][2] = 0
          }
        
        date_list.push(element['date'])
        total_list.push(element['stats'][0])
        death_list.push(element['stats'][1])
        recover_list.push(element['stats'][2])
      }
      $("div.chart_panel").css("display","block")

      chart = c3.generate({
        size: {
          height: 280,
          width: 460
        },
        data: {
          x: "t",
          y: "confirmed",
          columns: [date_list, total_list, death_list, recover_list],
          type: 'line',
          axes: {
            confirmed: 'y'
          },
          colors: {
            'Total cases': '#dc3545',
            // Suspected: 'orange',
            // 'Active Confirmed': 'orange',
            'Recoveries': '#28a745',
            'Fatal Cases': '#5d4f72e8'
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

      
    }

    function format_date(num, str) {
      var today = new Date();
      var nowTime = today.getTime()
      var ms = 24*3600*1000*num
      today.setTime(parseInt(nowTime + ms))
      var oYear = today.getFullYear()
      var oMoth = (today.getMonth() + 1).toString()
      if (oMoth.length <= 1) oMoth = '0' + oMoth
      var oDay = today.getDate().toString()
      if (oDay.length <= 1) oDay = '0' + oDay
      return oYear + str + oMoth + str + oDay
    }
    var format_today = format_date(0, '-')

    queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery_timeseries?node=Global&dsrc=JHU&date_start=2020-01-23&date_end=${format_today}`
    corsHTTP(queryURL, updateChart);



    function displayPlace(name) {

      $(".placename.hidden").text(name);
      places[name] = calPlace(name);
      showPlace(name);

      date_list = []
      date_list.push('t');
      total_list = [];
      total_list.push('Total cases');
      death_list = [];
      death_list.push('Fatal Cases');
      recover_list = [];
      recover_list.push('Recoveries');


      var update_state_Chart = (data) => {

        // data_str = JSON.stringify(data)
        // console.log('Chart_state_data!!!: ' + data_str)

        for (let index = 0; index < data.length; index++) {

          const element = data[index];
          if (element['stats'].length == 0) {
            break
          }
          if (element['stats'][2] == -1) {
            element['stats'][2] = 0
          }
          
          date_list.push(element['date'])
          total_list.push(element['stats'][0])
          death_list.push(element['stats'][1])
          recover_list.push(element['stats'][2])
        }

        $("div.chart_panel").css("display","block")

        chart.load({
          columns: [date_list, total_list, death_list, recover_list],
          unload: ['t', 'Total cases' , 'Fatal Cases', 'Recoveries'],
        });

      }

      queryURL = `https://idir.uta.edu/covid-19-api-dev/api/v1/statquery_timeseries?node=${name}&dsrc=JHU&date_start=2020-01-23&date_end=${format_today}`
      corsHTTP(queryURL, update_state_Chart);

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

function adjustHospitalPaneHeight() {
  var sum = 0;
  console.log('asdfasdfsafdf');
  $("div.variable-display").children().each(function() {
    var cls = $(this).attr('class');
    var id = $(this).attr('id');
    console.log($(this));
    if (cls == "variable") {
      sum += 12 + 32;
    } else if (cls == undefined && id == "variable-loading-no-data") {
      sum += $("#variable-loading-no-data").height();
    }
  })
  console.log(sum);
}
