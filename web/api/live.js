"use strict";

var twitch = require('../../lib/twitch.js');
var calendar = require('../../lib/google_calendar.js');
var config = require('../../config.js').gCal;


module.exports = function(app){

	app.get('/live', function (req, res) {
		var lrrEvents = calendar.getNextEvents("lrr");
		lrrEvents.forEach((event) => {
			event.location = "http://twitch.tv/loadingreadyrun";
		});
		var fanEvents = calendar.getNextEvents("fan");
		var tz = config.timeZone;
		var out = {
			lrrEvents: lrrEvents,
			fanEvents: fanEvents,
			Twitch: twitch.getData()
		};
		res.send(JSON.stringify(out));
	});
};
