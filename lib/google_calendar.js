"use strict";

var googleAPIKey = require('../secrets.js').googleAPIKey;
var config = require('../config.js').gCal;

var calendars = config.calendars;

var log = require('../log.js');

var https = require('https');
var Moment = require('../node_modules/moment-timezone');

var GoogleCalendar = function(){
	this.events = {};

	this.intervals = {};

	Object.keys(calendars).forEach(function(cal){
		this.getEvents(cal);
		this.intervals[cal] = setInterval(this.getEvents.bind(this, cal), config.interval);
	}, this);
}

var gc = GoogleCalendar.prototype;

gc.getEvents = function(calendarShort){
	log.info("Downloading calendar data for calendar:", calendarShort);
	var calendar = calendars[calendarShort];

	var url = config.url.replace('%calendar%', calendar);

	if(!calendar){
		return;
	}

	var params = config.params.replace("%key%", googleAPIKey);
	var now = (new Moment).tz(config.timeZone);
	now = now.format("YYYY-MM-DDThh:mm:ss") + "Z";
	params = params.replace("%after%", now);
	url += params;

	https.get(url, this.onConnection.bind(this, calendarShort));
}

gc.onConnection = function(calendarShort, res){
	var data = "";
	var me = this;

	res.on('data', function(buffer){
		data += buffer.toString('utf8');
	});
	res.on('end', function(){
		try{
			var json = JSON.parse(data);
		}
		catch(e){
			if(!(e instanceof SyntaxError)){
				throw e;
			}
			log.error("Got faulty data from Google API :(");
			log.error(data);
			return;
		}
		me.onData(calendarShort, json);
	});
}

gc.onData = function(calendarShort, data){
	if(!data || !data.items){
		log.error("Failed parsing Google Calendar data");
		return;
	}
	data = data.items;
	data.forEach(this.processEvent, this);

	this.events[calendarShort] = data;
	
	log.info("Calendar data for", calendarShort, "parsed and loaded");
}

gc.processEvent = function(ev){
	ev.start = this.parseGoogleTime(ev.start);
	ev.end = this.parseGoogleTime(ev.end);
}

gc.parseGoogleTime = function(gTime){
	return new Moment(gTime.dateTime);
}

gc.getNextEvents = function(calendar, now){
	var events = this.events[calendar];

	var result = [];

	if(!events){
		return result;
	}

	if(!Moment.isMoment(now)){
		now = new Moment;
	}

	var i, l, ev, lastEv;
	for(i=0, l=events.length; i<l; i++){
		ev = events[i];

		//We find all the entries that end after now.
		if(now.isBefore(ev.end)){
			lastEv = ev;
			result.push(ev);

			//If we find the entry that starts before now, we stop.
			if(now.isBefore(ev.start)){
				break;
			}
		}
	}

	//We continue looking for events that happen at the same time as
	//the last event found
	for(i++;i<l; i++){
		ev = events[i];
		if(ev.start.isBefore(lastEv.end) && !ev.start.isSame(lastEv.end)){
			result.push(ev);
		}
		else{
			break;
		}
	}
	return result;
}

module.exports = new GoogleCalendar;

