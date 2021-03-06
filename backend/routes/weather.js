const app_id = process.env.WEATHER_API_KEY;


//express is the framework we're going to use to handle requests
const express = require('express')

//request module is needed to make a request to a web service
const request = require('request')

//zipcode module is to get long and latitude from zipcode
const zipcodes = require('zipcodes');

let getDate = require('../utilities/utils').getDate

//request module is needed to make a request to a web service
//const request = require('request')

var router = express.Router()

/**
 * @api {get} /weather Request weather data
 * @apiName GetWeather
 * @apiGroup Weather
 * 
 * @apiHeader {String} authorization JWT provided from Auth get
 * @apiParam {String} zip the zip code to get weather info from
 * 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. Zip code must be a number"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. Longtitude and Latitdue must be a number"
 * 
 * @apiDescription This end point is a pass through to the Open Weather API. 
 * 
 */ 
router.get("/", (req, res) => {
    //validate chatId is not empty or non-number
    if (!req.query.zip) {
      if ((!req.query.lat && !req.query.long)) {
        res.status(400).send({
            message: "Missing required information"
        })
      } else if (isNaN(req.query.lat) || isNaN(req.query.long)) {
        res.status(400).send({
            message: "Malformed parameter. Longtitude and Latitdue must be a number"
        })
      }
    }  else if (isNaN(req.query.zip)) {
      res.status(400).send({
          message: "Malformed parameter. Zip code must be a number"
      })
    }

    // Process the zip code and add lon and lat param to the url
    var url = 'https://api.openweathermap.org/data/2.5/onecall'
    var query = {lat: '', lon: '',exclude: ['minutely','alerts'], units: 'imperial', appid: app_id};
    
    if (req.query.zip) {
      var param = zipcodes.lookup(req.query.zip)
      query.lat = param.latitude
      query.lon = param.longitude
    } else {
      query.lat = req.query.lat
      query.lon = req.query.long
      var param = zipcodes.lookupByCoords(query.lat, query.lon)
    }
    

    //Change query into parameters
    var str = [];
      for (var p in query)  
        if (query.hasOwnProperty(p)) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(query[p]));
        }
    str = str.join("&");
    url += '?' + str
    console.log(url)

    //When this web service gets a request, make a request to the Phish Web service
    request(url, function (error, response, body) {
        if (error) {
            res.send(error)
        } else {
            let resp = response.body
            resp = JSON.parse(resp)
            let offset = resp.timezone_offset
            
            resp.current.dt = getDate((resp.current.dt + offset)*1000)
            for (i in resp.hourly) {
              resp.hourly[i].dt = getDate((resp.hourly[i].dt + offset)*1000)
            }

            for (i in resp.daily) {
              resp.daily[i].dt = getDate((resp.daily[i].dt + offset)*1000)
            }

            resp.City = param.city
            resp.State = param.state
            resp.Country = param.country

            res.send(resp);
        }
    })
})

module.exports = router