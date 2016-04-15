"use strict";

var googleAPIKey = require('../secrets.js').googleAPIKey;
var config = require('../config.js').gCal;

var calendars = config.calendars;

var log = require('../log.js');

var https = require('https');
var url = require("url");
var Moment = require('../node_modules/moment-timezone');

var Channel = require('./channel.js');

var Models = require('./models.js');

var newChannels = [];

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

	var localUrl = config.url.replace('%calendar%', calendar);

	if(!calendar){
		return;
	}

	var params = config.params.replace("%key%", googleAPIKey);
	var now = (new Moment).tz(config.timeZone);
	now = now.format("YYYY-MM-DDThh:mm:ss") + "Z";
	params = params.replace("%after%", now);
	localUrl  += params;
	newChannels = [];
	var paramsParsed = url.parse(localUrl);
	paramsParsed.family = 4;
	https.get(paramsParsed, this.onConnection.bind(this, calendarShort));
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
    if (newChannels.length > 0) {
        var me = this;
        newChannels.forEach(me.addChannel);
    }
	this.events[calendarShort] = data;
	
    log.info("Calendar data for", calendarShort, "parsed and loaded");
    log.info(newChannels.length, "channels added to watch");
}

gc.addChannel = function (channelName) {
	Models.Channel.create({ name: channelName, active: false })
		.then(function (newChannel) {
		var newChannelObj = Channel.channelBuilder(newChannel);
	});
}

gc.processEvent = function(ev){
	ev.start = this.parseGoogleTime(ev.start);
    ev.end = this.parseGoogleTime(ev.end);
    if (ev.location) {
        var re = /twitch\.tv\/(([\w\d])+)/i;
        if (re.test(ev.location)) {
            var channelName = ev.location.toString().match(re)[1];
            if (newChannels.indexOf(channelName) == -1) {
                if (!Channel.hasChannel(channelName)) {
                    newChannels.push(channelName);
                }
            }
        }
    }
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

