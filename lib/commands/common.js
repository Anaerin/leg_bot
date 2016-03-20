"use strict";

var twitch = require('../twitch.js');

var log = require('../../log.js');

var Moment = require('moment-timezone');

var SimpleCommands = require('./simple_commands.js');

var Models = require('../models.js');

var Roll = require('roll');

var CommonModule = module.exports = function(channel){
	SimpleCommands.call(this, channel);

}

SimpleCommands.adopt(CommonModule);

var c = CommonModule.prototype;

c.whisperCommands = {
	
	'live': {
		time: 30,
		regex: /^live$/i,
		method: function (match, user, message) {
			var streams = twitch.getData();
			var streamNames = Object.keys(streams);
			
			var streamStrings = [];
			
			streamNames.forEach(function (name) {
				
				if (!streams[name]) {
					return;
				}
				
				var game = streams[name].game || "Something???"
				
				streamStrings.push("http://twitch.tv/" + name + " playing " + game);

			}, this);
			
			if (streamStrings.length == 0) {
				this.channel.whisper(user, null, "No Awesome Channels currently live. :(");
				return;
			}
			
			streamStrings = streamStrings.join(", ");
			this.channel.whisper(user, null, "Awesome Channels currently live: " + streamStrings);
		},
	},	
	'help': {
		time: 30,
		regex: /^h[aeuioy]lp$/i,
		method: function (match, user, message) {
			this.channel.whisper(user, null, match[0] + ": " + "http://anaerins.blogspot.ca/2015/07/legbot.html");
		}
	},
	
	'calendar': {
		time: 30,
		regex: /^calendar$/i,
		method: function (match, user, message) {
			this.channel.whisper(user, null, "You can find the Fan Stream calendar at: http://bit.ly/LRRFanStreamCalendar2");
		}
	},
	
	'lrr': {
		time: 30,
		regex: /^lrr$/i,
		method: function (match, user, message) {
			this.channel.whisper(user, null, "For awesome video content and streams, check out: http://www.loadingreadyrun.com");
		}
	},
	
	'crossing': {
		time: 30,
		regex: /^(crossingfan|crossingfans|fancrossing)$/i,
		method: function (match, user, message) {
			this.channel.whisper(user, null, "If you're a fan streamer and want to cross the streams with other fans, then we're trying arrange things on a spreadsheet here http://bit.ly/CrossingFans Register your interest for what ever multiplayer games you might feel like.");
		}
	}
}


c.commands = {

	'live': {
		time: 30,
		regex: /^live$/i,
		method: function(match, user, message){
			var streams = twitch.getData();
			var streamNames = Object.keys(streams);

			var streamStrings = [];

			streamNames.forEach(function(name){

				if(!streams[name]){
					return;
				}

				var game = streams[name].game || "Something???"

				streamStrings.push("http://twitch.tv/" + name + " playing " + game);

			}, this);

			if(streamStrings.length == 0){
				this.channel.say("No Awesome Channels currently live. :(");
				return;
			}

			streamStrings = streamStrings.join(", ");
			this.channel.say("Awesome Channels currently live: " + streamStrings);
		},
	},	
	'roll': {
		time: 10,
		regex: /^roll$/i,
		method: function (match, user, message) {
			this.channel.say('Roll what?');
		}
	},
	'roll something': {
		time: 10,
		regex: /^roll\s(.+)/i,
		method: function (match, user, message) {
			var thisRoll = new Roll()
			if (thisRoll.validate(match[1])) {
				var result = thisRoll.roll(match[1]);
				this.channel.say("Rolled " + match[1] + " and got " + result.result + " (" + result.rolled + ")");
			} else {
				this.channel.say("Sorry, but '" + match[1] + "' is not a valid roll.");
			}
		}
	},
	'help': {
		time: 30,
		regex: /^h[aeuioy]lp$/i,
		method: function(match, user, message){
			this.channel.say(match[0] + ": " + "http://anaerins.blogspot.ca/2015/07/legbot.html");
		}
	},
	'mods': {
		time: 30,
		regex: /^mods$/i,
		method: function (match, user, message){
			this.channel.whisper(user, "Twitch reports the following mods: " + Object.keys(this.channel.mods).join(', '));
			//this.channel.say("Twitch reports the following mods: " + Object.keys(this.channel.mods).join(', '));
		}
	},

	'game': {
		time: 15,
		regex: /^game$/i,
		method: function(match, user, message){
			var game = this.channel.getGame();
			if(game){
				this.channel.say("Currently playing: " + game);
			}
			else{
				this.channel.say("Not currently playing any game");	
			}
		}
	},

	'game override': {
		time: 1,
		regex: /^game override *(.*)$/i,
		modOnly: true,
		method: function(match, user, message){
			var newGame = match[1] || "off";
			if(newGame.match(/off/i)){
				newGame = undefined;
			}
			this.channel.gameOverride = newGame;
			var game = this.channel.getGame();
			if(game){
                this.channel.say("Now playing: " + game);
                this.channel.newGame();
			}
			else{
				this.channel.sendWS({ 'action': 'GameChanged', 'game': '' });
                if (this.channel.statistics && this.channel.statistics.statistics) {
                    var me = this;
					Object.keys(this.channel.statistics.statistics).forEach(function (statName) {
						me.channel.sendWS({ 'action': 'StatChanged', 'stat': statName, 'value': 0 });
					});
				}
				this.channel.say("Not currently playing any game");	
			}

		}
	},

	'calendar': {
		time: 30,
		regex: /^calendar$/i,
		method: function(match, user, message){
			this.channel.say("You can find the Fan Stream calendar at: http://bit.ly/LRRFanStreamCalendar2");
		}
	},

	'lrr': {
		time: 30,
		regex: /^lrr$/i,
		method: function(match, user, message){
			this.channel.say("For awesome video content and streams, check out: http://www.loadingreadyrun.com");
		}
	},

	'crossing': {
		time: 30,
		regex: /^(crossingfan|crossingfans|fancrossing)$/i,
		method: function(match, user, message){
			this.channel.say("If you're a fan streamer and want to cross the streams with other fans, then we're trying arrange things on a spreadsheet here http://bit.ly/CrossingFans Register your interest for what ever multiplayer games you might feel like.");
		}
	},
	'uptime': {
		time: 30,
		regex: /^uptime$/i,
		method: function(match, user, message){
			var td = this.channel.twitchData();

			var created = td.created_at;
			if(created){
				var startTime = new Moment(td.created_at);
				var now = new Moment();
				var diff = Moment.duration(now.diff(startTime));
				var time = "";
				if (diff.asYears() > 0) time += pluralSuffix(diff.years(),"year");
				if (diff.asMonths() > 0) {
					time += pluralSuffix(diff.months(),"month");
				} else {
					if (diff.asWeeks() > 0) {
						time += pluralSuffix(diff.weeks(),"week");
					}
				}
				if (diff.asDays() > 0) time += pluralSuffix(diff.days(),"day");
				if (diff.asHours() > 0) time += pluralSuffix(diff.hours(),"hour");
				if (diff.asMinutes() > 0) time += pluralSuffix(diff.minutes(),"minute");
				time += pluralSuffix(diff.seconds(), "second").replace(", ",".");

				this.log.info("Time:", time);
				this.channel.say("Stream has been live for " + time);
			}
			else{
				this.channel.say("No stream start data available.");
			}
		}
	}
}

function pluralSuffix(value, type) {
	if (value == 1) return value + " " + type + ", ";
	return value + " " + type + "s, ";
}
/*
//Test commands for trolling caffeinatedlemur's chatroom
b.commands['^!adult$'] = function(match, user, message){
	this.channel.say("All the available adults are horrible people.");
}
b.commands['^!advice$'] = function(match, user, message){
	this.channel.say("Rub your wanzer on all the things.");
}
*/
