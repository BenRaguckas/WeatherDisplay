"use strict";
const $ = (selector) => document.querySelector(selector);       //  Nicer bread and butter
const $$ = (selector) => document.querySelectorAll(selector);   //  Nicer bread in bulk

/**Levenshtein distance implementation in javascript
 * This was note made by me. The source can be found here: https://gist.github.com/andrei-m/982927#gistcomment-1797205
 * Compares a string to another sting. This is case sensitive.
 * @param {String} string String to which to compare to
 * @returns {Number}
 */
String.prototype.levenstein = function(string) {
    var a = this, b = string + "", m = [], i, j, min = Math.min;

    if (!(a && b)) return (b || a).length;

    for (i = 0; i <= b.length; m[i] = [i++]);
    for (j = 0; j <= a.length; m[0][j] = j++);

    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            m[i][j] = b.charAt(i - 1) == a.charAt(j - 1)
                ? m[i - 1][j - 1]
                : m[i][j] = min(
                    m[i - 1][j - 1] + 1, 
                    min(m[i][j - 1] + 1, m[i - 1 ][j] + 1))
        }
    }

    return m[b.length][a.length];
};

//  Global default variables    
var city_list_full;
var city_list;
var city_current;
var country_current;
var country_list;
var auto_complete_list;
var last_data;
var chartBox;

//  Set of minor functions to alter information for more appealing look.
const parseDay = (day) => {
    switch((day)%7){
        case 0:
            return "Mon";
        case 1:
            return "Tue";
        case 2:
            return "Wed";
        case 3:
            return "Thu";
        case 4:
            return "Fri";
        case 5:
            return "Sat";
        case 6:
            return "Sun";
        default:
            return null;
    }
};
const windDirection = (deg) => {
    if (deg >= 337.5 || deg < 22.5)         //  North
        return "&#8593;";
    else if (deg >= 22.5 && deg < 67.5)     //  North-East
        return "&#8599;";
    else if (deg >= 67.5 && deg < 112.5)    //  East
        return "&#8594;";
    else if (deg >= 112.5 && deg < 157.5)   //  Sout-East
        return "&#8600;";
    else if (deg >= 157.5 && deg < 202.5)   //  South
        return "&#8595;";
    else if (deg >= 202.5 && deg < 247.5)   //  South-West
        return "&#8601;";
    else if (deg >= 247.5 && deg < 292.5)   //  West
        return "&#8592;";
    else if (deg >= 292.5 && deg < 337.5)   //  North-west
        return "&#8598;";
    else
        return "O";
};
const addZero = (i) => {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
};
const toTemp = (k, measurement = false) => {
    var temp = "";
    if (measurement)
        if ($("#imperial").checked)
            temp = "&#x2109;";
        else
            temp = "&#x2103;";
    if ($("#imperial").checked)
        return ((parseFloat(k)-273.15)*9/5+32).toFixed(2)+temp;
    else
        return (parseFloat(k)-273.15).toFixed(2)+temp;
};
const toSpeed = (ms, measurment = false) => {
    var temp = "";
    if (measurment)
        if ($("#imperial").checked)
            temp = " mph"
        else
            temp = " m/s";
    if ($("#imperial").checked)
        return ms.toFixed(2) + temp;
    else
        return (parseFloat(ms) * 2.237).toFixed(2) +temp;
};

//  Page load executions
document.addEventListener("DOMContentLoaded", () => {
    //  Country dopdown button
    $("#countryButton").addEventListener('click', () => {
        if ($("#countryList").style.display == "block"){
            show($("#countryList"), false);
        }
        else{
            show($("#countryList"), true);
            buildCountryTable();
        }
    });
    //  Search button
    $("#searchButton").addEventListener("click", () => {
        //  Execute search based on first suggestion
        if ($("#suggList").firstElementChild){
            var searchID = (searchCityName($("#suggList").firstElementChild.getAttribute("data-W"),city_list));
            if (searchID != -1)
                getWeatherDataID(searchID);
        }
    });
    //  Show autocomplete suggestions when IN focus of searchBox
    $("#searchBox").addEventListener("focus", () => {
        show($("#suggList"),true);
    });
    //  Hide autocomplete suggestions when NOT IN focus of searchBox
    $("#searchBox").addEventListener("blur", () => {
        show($("#suggList"),false);
    });
    //  Execute page load
    loadPage();
});

/** Draws line chart.
 * Default color is Pink.
 * @param {Element} chartElm element of canvas to edit
 * @param {Array} labelArray List of labels
 * @param {Array} dataArray List of data
 * @param {String} colorBG RGBA color for area under the graph
 * @param {String} colorLine RGBA color for Line
 */
const drawChart = (chartElm, labelArray, dataArray, colorBG="rgba(255,99,132,0.2)", colorLine="rgba(255,99,132,1)") => {
	var dataSet = {
		labels: labelArray,
		datasets: [{
            backgroundColor: colorBG,
            borderColor: colorLine,
            borderWidth: 3,
            data: dataArray,
		}]
    };
    var optionSet = {
        legend: {
            display: false
        },
		maintainAspectRatio: true,
		scales: {
		    yAxes: [{
                gridLines: {
                    display: true,
                    color: "rgba(0,0,0,0.05)"
			    }
		    }],
		    xAxes: [{
                gridLines: {
                    display: true,
                    color: "rgba(0,0,0,0.2)"
                }
		    }]
        }
    };
    //  Destroy old chart if present
    if (chartBox)
        chartBox.destroy();
    //  Create new chart
    chartBox = new Chart(chartElm,{
        type: "line",
        data: dataSet,
        options: optionSet
    });
};

/** Main method for building weather display.
 * Pretty much does everything. Builds the page content, attaches eventListeners to buttons.
 * @param {Element} divBox Which div to edit
 * @param {Object} data from 5d-3h openweather call
 */
const buildWeatherDisplay = (divBox, data) => {
    var outputHTML = "<h1 class='w3-center'>"+ data.city.name;
    if (checkFavorite(data.city.name))
        outputHTML += "<a id='favorite' class='w3-right'><i class='fa fa-star' aria-hidden='true'></i></a></h1>"
    else
        outputHTML += "<a id='favorite' class='w3-right'><i class='fa fa-star-o' aria-hidden='true'></i></a></h1>"
    var tempTime;
    for (let i = 0; i < data.list.length; i+=8){
        tempTime = new Date(data.list[i].dt*1000);
        //  Make first entry Selected and active
        if (i == 0){
            outputHTML += "<div data-id='"+i+"' id='weatherCardActive' class='w3-col m4 w3-padding-small'> <div class='w3-card w3-container takeFull'>";
        }
        else {
            outputHTML += "<div data-id='"+i+"' id='weatherCard' class='w3-col m2 w3-padding-small'> <div class='w3-card w3-container takeFull'>";
        }
        //  Create the Date entry
        outputHTML += "<p class='w3-center'>"+addZero(tempTime.getDate())+" / "+addZero(tempTime.getMonth()+1)+"</p>";
        //  Create Weekday entry
        outputHTML += "<h3 class='w3-center'>"+parseDay(tempTime.getDay())+"</h4>";
        //  Create weather icon
        outputHTML += "<img class='center' src='http://openweathermap.org/img/wn/" + data.list[i].weather[0].icon + "@2x.png'></img>";
        //  Description
        outputHTML += "<p class='w3-center subtext'>"+ data.list[i].weather[0].description +"</p>"
        //  Create Hour display
        outputHTML += "<p class='w3-center'>"+addZero(tempTime.getHours())+":"+addZero(tempTime.getMinutes())+"</p>";
        //  Create Clickable displays
        if (i == 0){
            //  Create Humidity display
            outputHTML += "<p id='dispHUM' class='humid'><i class='fa fa-tint' aria-hidden='true'></i> "+data.list[i].main.humidity+"%</p>";
            //  Create Temperature display
            outputHTML += "<p id='dispTEM' class='tempe'><i class='fa fa-thermometer-empty' aria-hidden='true'></i> "+toTemp(data.list[i].main.temp,true)+"</p>";
            //  Wind direction / speed
            outputHTML += "<p id='dispWIN' class='winds'>"+windDirection(data.list[i].wind.deg)+" "+toSpeed(data.list[i].wind.speed,true)+"</p>"
        }
        else {
            //  Create Humidity display
            outputHTML += "<p class='humid'><i class='fa fa-tint' aria-hidden='true'></i> "+data.list[i].main.humidity+"%</p>";
            //  Create Temperature display
            outputHTML += "<p class='tempe'><i class='fa fa-thermometer-empty' aria-hidden='true'></i> "+toTemp(data.list[i].main.temp,true)+"</p>";
            //  Wind direction / speed
            outputHTML += "<p class='winds'>"+windDirection(data.list[i].wind.deg)+" "+toSpeed(data.list[i].wind.speed,true)+"</p>"
        }
        outputHTML += "</div></div>";
    }
    divBox.innerHTML = outputHTML;
    $$("#weatherCard").forEach(button => {
        button.addEventListener("click", () => {
            cycleTarget(button);
        });
    });
    //  Use for each for easier self refference
    $$("#weatherCardActive").forEach(button => {
        button.addEventListener("click", () => {
            cycleTarget(button);
        });
    });
    //  Create click listeners for each measurement and include a check
    $$(".humid").forEach(button => {
        button.addEventListener("click", () =>{
            if(button.id == "dispHUM")
                displayHum(button.parentElement.parentElement.getAttribute("data-id"));
        });
    });
    $$(".tempe").forEach(button => {
        button.addEventListener("click", () =>{
            if(button.id == "dispTEM")
                displayTem(button.parentElement.parentElement.getAttribute("data-id"));
        });
    });
    $$(".winds").forEach(button => {
        button.addEventListener("click", () =>{
            if(button.id == "dispWIN")
                displayWin(button.parentElement.parentElement.getAttribute("data-id"));
        });
    });
    $("#favorite").addEventListener("click", () =>{
        if (addFavorite(data.city.name))
            $("#favorite").firstElementChild.className = "fa fa-star";
        else
            $("#favorite").firstElementChild.className = "fa fa-star-o";
    });
    const cycleTarget = (button) => {
        if (button.id == "weatherCard"){
            //  Deal with the last active card
            var activeC = $("#weatherCardActive");
            var tempID = activeC.getAttribute("data-id");
            var tempTime = new Date(last_data.list[tempID].dt*1000);
            activeC.setAttribute("href", "#"+parseDay(tempTime.getDay()) );
            activeC.id = "weatherCard";
            activeC.className = "w3-col m2 w3-padding-small";    //  Simply replace className as they are not dynamically changed
            //  Remove IDs from child buttons
            activeC.firstElementChild.childNodes[5].removeAttribute("id");
            activeC.firstElementChild.childNodes[6].removeAttribute("id");
            activeC.firstElementChild.childNodes[7].removeAttribute("id");
            //  Address this active card
            button.removeAttribute("href");
            button.id = "weatherCardActive";
            button.className = "w3-col m4 w3-padding-small";     //  Simply replace className as they are not dynamically changed
            //  Attach button ids 
            button.firstElementChild.childNodes[5].setAttribute("id", "dispHUM");
            button.firstElementChild.childNodes[6].setAttribute("id", "dispTEM");
            button.firstElementChild.childNodes[7].setAttribute("id", "dispWIN");
        }
    };
};

/** Builds humidity table
 * @param {int} index id where to start 24 cycle
 */
const displayHum = (index) => {
    var cLabel = [];
    var cData = [];
    for (let i = index; i < (parseInt(index) + 8); i++){
        cData.push(last_data.list[i].main.humidity);
        var tempTime = new Date(last_data.list[i].dt*1000);
        cLabel.push(tempTime.getDate()+"/"+(tempTime.getMonth()+1)+" "+addZero(tempTime.getHours())+":"+addZero(tempTime.getMinutes()));
    }
    drawChart( $("#chart"), cLabel, cData, "rgba(20,20,175,0.2)", "rgba(20,20,175,1)");
};
/** Builds temperature table
* @param {int} index id where to start 24 cycle
*/
const displayTem = (index) => {
    var cLabel = [];
    var cData = [];
    for (let i = index; i < (parseInt(index) + 8); i++){
        cData.push(toTemp(last_data.list[i].main.temp));
        var tempTime = new Date(last_data.list[i].dt*1000);
        cLabel.push(tempTime.getDate()+"/"+(tempTime.getMonth()+1)+" "+addZero(tempTime.getHours())+":"+addZero(tempTime.getMinutes()));
    }
    drawChart( $("#chart"), cLabel, cData, "rgba(175,20,20,0.2)", "rgba(175,20,20,1)");
};
/** Builds wind speed table
 * @param {int} index id where to start 24 cycle
 */
const displayWin = (index) => {
    var cLabel = [];
    var cData = [];
    for (let i = index; i < (parseInt(index) + 8); i++){
        cData.push(toSpeed(last_data.list[i].wind.speed));
        var tempTime = new Date(last_data.list[i].dt*1000);
        cLabel.push(tempTime.getDate()+"/"+(tempTime.getMonth()+1)+" "+addZero(tempTime.getHours())+":"+addZero(tempTime.getMinutes()));
    }
    drawChart( $("#chart"), cLabel, cData, "rgba(20,175,20,0.2)", "rgba(20,175,20,1)");
};

/** Change country code to specified value.
 * Only changes country for current use.
 * Will load city_list_full if required.
 * @param {String} code of the country to change to
 */
const changeCountry = (code) => {
    show($("#countryList"), false);
    if (code != country_current){
        country_current = code;
        $("#countryButton").firstElementChild.src = "https://www.countryflags.io/" + code + "/flat/32.png";
        if (typeof city_list_full === 'undefined' || city_list_full === null){
            show($("#loading"),true);
            decompressDataFromLink("data/city.list.json.gz").then(response => {
                city_list_full = response;
                city_list = getCityList(country_current,city_list_full);
                auto_complete_list = getCityNames(city_list);
                show($("#loading"),false);
            });
        }
        else {
            city_list = getCityList(country_current,city_list_full);
            auto_complete_list = getCityNames(city_list);
        }
    }
};

/** Builds the country table and resizes it depending on page width.
 * Needs to be separated into 2 methods.
 */
const buildCountryTable = () => {
    //  Resize the box to better suit display width
    if (getPageWidth() > 1280) {
        $("#countryList").style.width = "964px";
        $("#countryList").style.height = "";
    }
    else if (getPageWidth() > 760) {
        $("#countryList").style.width = "759px";
        $("#countryList").style.height = "610px";
    }
    else {
        $("#countryList").style.width = "389px";
        $("#countryList").style.height = "496px";
    }
    //  Build country list only once
    if ($("#countryList").innerHTML == "") {
        var outputHTML = "";
        country_list.forEach(country => {
            outputHTML += "<a id='selC' data-C='" + country + "' class='w3-button w3-light-gray w3-left countryPad'><img class='countryImg' src='https://www.countryflags.io/" + country + "/flat/32.png'> " + country + "</a>";
        });
        $("#countryList").innerHTML = outputHTML;
        //  Attach an event listener to each button
        $$("#selC").forEach(button => {
            button.addEventListener("click", () => {
                changeCountry(button.getAttribute("data-C"));
            });
        });
    }
};

/** Load country_list.json into memory.
 */
const loadCountryList = () => {
    return new Promise((resolve) =>{
        const xhr = new XMLHttpRequest();
        xhr.responseType = "json";
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                resolve(xhr.response);
            }
        };
        xhr.onerror = e => console.log(e.message);
        xhr.open("GET","data/country_list.json");
        xhr.send();
    });
};

/** Will initialize an event listener for given textbox to allow autocompletion suggestions to show up as typing occurs.
 * Will only show if there are more than 2 letters typed.
 * Will only display 7 closest matches.
 * Hughligts matched letters.
 * Case insensitive.
 * @param {Element} textBox search input element
 * @param {Element} suggList display div element
 */
const initAutoComplete = (textBox, suggList) => {
    //  Attach event listener to given input field.
    var suggestion_list;
    textBox.addEventListener('input', () => {
        var input = textBox.value.toLowerCase();
        if (input.length > 2){
            var temp = matchStrings(input,auto_complete_list);
            //  If the list has more elements sort them from closest match
            if (temp.length > 0){
                temp.sort((a,b) => {
                    var x = input.levenstein(a.toLowerCase());
                    var y = input.levenstein(b.toLowerCase());
                    return x-y;
                });
                //  If an exact match is found (case insensitive), ONLY display that 1 element. Else display 7.
                if (input.levenstein(temp[0].toLowerCase()) == 0)
                    temp.length = 1;
                else
                    temp.length = Math.min(temp.length,7);
            }
            suggestion_list = temp;
            populateList(input,temp);
        }
        else{
            suggestion_list = temp;
            populateList();
        }
    });
    /** Will check given string inside an array of Strings and return all soft matches.
     * Unable to find source of inspiration for the use of RegExt().
     * @param {String} searchString identifying term to search for.
     * @param {Array} searchArray array to search through.
     */
    function matchStrings(searchString,searchArray) {
        var reg = new RegExp(searchString.split('').join('\\w*').replace(/\W/, ""), 'i');
        return searchArray.filter(function(value) {
            if (value.match(reg)) {
                return value;
            }
        });
    };
    // Need to allow click on elements and some editing polish !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    /** Will create paragraph elements for suggestion list.
     * Will also highlight matching letters.
     * @param {String} searchTerm Identifying term for highlighting.
     * @param {Array} popData Array of strings to populate list.
     */
    function populateList(searchTerm,popData){
        var outputHTML = "";
        if (popData != null){
            popData.forEach(entry => {
                var search_index = 0;
                outputHTML += "<p data-W='"+entry+"'>";
                for(let i = 0, c = [...entry]; i < c.length; i++){
                    if (c[i].toLowerCase() == searchTerm.charAt(search_index)){
                        outputHTML += "<b>" + c[i] + "</b>";
                        search_index++;
                    }
                    else{
                        outputHTML += c[i];
                    }
                }
                outputHTML += "</p>";
            });
        }
        suggList.innerHTML = outputHTML;
    };
    textBox.addEventListener('keydown', (e) => {
        // if (e.keyCode == 40)    // arrow down
        // if (e.keyCode == 38)    // arrow up
        if (e.keyCode == 13) {  //  Enter
            //  Execute search based on first closest response
            if (suggestion_list != null && suggestion_list.length > 0){
                var searchID = searchCityName(suggestion_list[0],city_list);
                if (searchID != -1){ //  May not be needed as this likely is checking a guaranteed valid value
                    getWeatherDataID(searchID);
                    textBox.value = suggestion_list[0];
                    $(':focus').blur();
                }
            }
        }
    });
};

/** Matches city by name in given Array and returns its ID
 * @param {String} name City name to find
 * @param {Array} city_array array containing full city information
 */
const searchCityName = (name, city_array) => {
    var temp = city_array.find((entry) => {
        if (entry.name == name)
            return true;
        });
    if (temp)
        return temp.id;
    else
        return -1;
};

/**Checks for "default_country" / Country Code in localStorage.
 * If NOT found checks for country based on IP and saves country code in localStorage("default_country") and removes "default_city_list" and "default_city".
 * It also checks country into memory under "country_current".
 * @returns a Promise with boolean. If country found "true", else "false".
 */
const checkDefaultCountry = () => {
    return new Promise((resolve) => {
        //  Check if "default_country" IS NOT in localStorage.
        if (localStorage.getItem("default_country") === null || localStorage.getItem("default_country") == "undefined" || localStorage.getItem("default_country") == "") {
            getCountry().then(response => {
                localStorage.setItem("default_country",response);
                country_current = response;
                $("#countryButton").firstElementChild.src = "https://www.countryflags.io/" + response + "/flat/32.png";
                //  Remove "default_city_list" and "default_city" to avoid any potential issues
                localStorage.removeItem("default_city_list");
                localStorage.removeItem("default_city");
                resolve(false);
            });
        }
        //  else - default country IS in localStorage.
        else {
            country_current = localStorage.getItem("default_country");
            $("#countryButton").firstElementChild.src = "https://www.countryflags.io/" + localStorage.getItem("default_country") + "/flat/32.png";
            resolve(true);
        }
    });
};

/**Checks for "default_city_list" / Compressed city list in localStorage.
 * !!! This should RUN AFTER checkDefaultCountry() as it is dependant on its return in certain cases. !!!
 * If NOT found. Downloads and decompresses "city.list.json.gz" and saves it to "city_list_full".
 * Extracts city list either from localStorage or from "city_list_full" and saves it to "city_list"
 * Saves default_city_list into localStorage if not already present.
 * @returns a Promise with boolean. If city list found "true", else "false".
 */
const checkDefaultCityList = () => {
    return new Promise((resolve) => {
        //  Check if "default_city_list" is NOT in localStorage
        if (localStorage.getItem("default_city_list") === null || localStorage.getItem("default_city_list") == "undefined" || localStorage.getItem("default_city_list") == ""){
            localStorage.removeItem("default_city");    //  Remove a blank values just in case. MAY BE USLESS!
            //  Calls to download and decompress data from "city.list.json.gz"
            decompressDataFromLink("data/city.list.json.gz").then(response => {
                city_list_full = response;
                city_list = getCityList(country_current,city_list_full);
                //  Compress data into localStorage
                localStorage.setItem("default_city_list",defData(city_list));
                resolve(false);
            });
        }
        else{
            //  Decompress data from localStorage
            city_list = infData(localStorage.getItem("default_city_list"));
            resolve(true);
        }
    });
};

/** Will add given city name and coresponding id to local storage as a string JSON file.
 * Will overwrite any previous entries or remove current entry if its the same.
 * @param {String} name City name to add to the list
 * @returns {boolean}
 */
const addFavorite = (name) => {
    if (localStorage.getItem("default_city")){
        if (name == JSON.parse(localStorage.getItem("default_city")).name){
            localStorage.removeItem("default_city");
            return false;
        }
        else
            localStorage.setItem("default_city","{\"name\":\""+name+"\",\"id\":\""+searchCityName(name,city_list)+"\"}");
    }
    else
        localStorage.setItem("default_city","{\"name\":\""+name+"\",\"id\":\""+searchCityName(name,city_list)+"\"}");
    return true;
};

const checkFavorite = (name) => {
    if(localStorage.getItem("default_city"))
        if (name == JSON.parse(localStorage.getItem("default_city")).name)
            return true;
        else
            return false;
};

/** Will check localStorage for "default_city"
 * 
 */
const checkDefaultCity = () => {
    if (localStorage.getItem("default_city") === null || localStorage.getItem("default_city") == "undefined" || localStorage.getItem("default_city") == ""){
        getWeatherDataID(city_list[parseInt(Math.random()*city_list.length)].id);   //  Get random city from city_list
        return false;
    }
    else{
        getWeatherDataID(JSON.parse(localStorage.getItem("default_city")).id);
        return true;
    }
};

/** Will take city names from given Array and return them in a single array.
 * @param {Array} array containing full city data
 */
const getCityNames = (array) => {
    var temp = [];
    array.forEach(entry => {
        temp.push(entry.name);
    });
    return temp;
};

/** Executes a series of regular and async functions every time the page is loaded.
 * Once finished loading screen will be hidden.
 */
const loadPage = async () => {
    var loadList = [];
    var temp;
    temp = await checkDefaultCountry();
    loadList.push({Default_country_found:temp});
    temp = await checkDefaultCityList();
    loadList.push({Default_city_list_found:temp});
    temp = checkDefaultCity();
    loadList.push({Default_city_found:temp});
    console.log(loadList);
    //  Load country List
    country_list = await loadCountryList();
    country_list.sort();
    buildCountryTable();
    auto_complete_list = getCityNames(city_list);
    //  Initiate autocomplete
    initAutoComplete($("#searchBox"), $("#suggList"));
    show($("#loading"),false);
};

/**====================================================================================================
 *  ██████  ██████  ███    ███ ██████  ██      ███████ ████████ ███████ 
 * ██      ██    ██ ████  ████ ██   ██ ██      ██         ██    ██      
 * ██      ██    ██ ██ ████ ██ ██████  ██      █████      ██    █████   
 * ██      ██    ██ ██  ██  ██ ██      ██      ██         ██    ██      
 *  ██████  ██████  ██      ██ ██      ███████ ███████    ██    ███████
 */

/**Get country based on IP of the user.
 * returns a Promise with country code.
 */
const getCountry = () => {
    return new Promise((resolve) => {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "json";
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200){
                resolve(xhr.response.countryCode);
            }
        }
        xhr.open("GET", "http://ip-api.com/json");
        xhr.send();
    });
};

/**Decompresses a gZip file and returns its contents as JSON.
 * @param {String} link File link to be downloaded and decompressed.
 */
const decompressDataFromLink = (link) => {
    return new Promise((resolve) =>{
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var byteArray = new Uint8Array(xhr.response);
                var rawData = pako.inflate(byteArray, {to: "string"});
                var data = JSON.parse(rawData);
                resolve(data);
            }
        };
        xhr.open("GET", link);
        xhr.send();
    });
};

/**Complie city list for matching country code 
 * @param {String} code of the country to which to get cities of
 * @param {JSON} source data source to use
 * @param {JSON} returns array that contains city: id / name / state / country / coordinates
 */
const getCityList = (code,source) => {
    var temp = [];
    source.forEach(entry => {
        if (entry.country == code)
            temp.push(entry);
    });
    return temp;
};

/**Deflates given JSON object data to a compressed string
 * @param {JSON} data JSON object to be deflated
 * @returns {String} Deflated data
 */
const defData = (data) => {
    return pako.gzip(JSON.stringify(data),{ to: 'string' });
};

/** Inflates compressed data String
 * @param {String} data String of data to inflate
 * @returns {JSON} Returns a parsed JSON object
 */
const infData = (data) => {
    return JSON.parse(pako.ungzip(data,{ to: 'string' }));
};

/** Will request 5 Day 3 hour forecast from open weather map using cityID as input.
 * Saves data under "last_data".
 * Builds page immediately after recieving response.
 * @param {int} cityID for which to get data for
 */
const getWeatherDataID = (cityID) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "json";
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            // console.log(xhr.response);
            last_data = xhr.response;
            buildWeatherDisplay($("#weatherDisplay"),xhr.response);
        }
    };
    xhr.onerror = e => console.log(e.message);
    xhr.open("GET","http://api.openweathermap.org/data/2.5/forecast?id=" + cityID + "&mode=json&appid=OpenWeatherMapAppID");
    xhr.send();
};

//  Returns some sort of dimensional display for current page width.
const getPageWidth = () => {
    return Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.documentElement.clientWidth
    );
};

/** Allows to change element display to show or hide.
 * @param {Element} elm element to show or hide
 * @param {boolean} value true = block, false = none 
 */
function show(elm, value) {
    elm.style.display = value ? 'block' : 'none';
}

/**====================================================================================================
 * ██     ██ ██ ██████  
 * ██     ██ ██ ██   ██ 
 * ██  █  ██ ██ ██████  
 * ██ ███ ██ ██ ██      
 *  ███ ███  ██ ██   
 */

function getFile(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
}

const getCountryList = (DATA) => {
    var lookup = {};
    var items = DATA;
    var result = [];
    
    for (var item, i = 0; item = items[i++];) {
        var country = item.country;

        if (!(country in lookup)) {
            lookup[country] = 1;
            result.push(country);
        }
    }
    console.log(result);
};