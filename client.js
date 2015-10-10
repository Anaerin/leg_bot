
/*
	This singlettoni (singleton written in sphagetti code) establishes the connection to the irc server and allows
	channels to register themselves to receive events.
*/

"use strict";

var irc = require('irc');
var tmi = require('tmi.js');
var log = require('./log.js');
var Models = require('./lib/models.js');

var channel = require('./lib/channel.js');

var config = require('./config.js').irc;

//Set up disconnection timer for inactivity
//Twitch sends a PING every 5 minutes. If 10 minutes pass with no activity, we've been silently DC'd
var disconnectionTimer;
var disconnectionValue = 10 * 60 * 1000;

var lastWhisper = {};

//We setup the options object and import the oauth token.
var token = require('./secrets.js').twitchToken;
var options = {
	options: {
		debug: false
	},
	connection: {
		random: 'chat',
		reconnect: true
	},
	identity: {
		username: config.userName,
		password: token
	}
};
var whisper_options = {
	options: {
		debug: false
	},
	connection: {
		random: 'group',
		reconnect: true
	},
	identity: {
		username: config.userName,
		password: token
	}

}
var client = module.exports.client = new tmi.client(options);
var whisperconn = module.exports.whisperconn = new tmi.client(whisper_options);

var clientConnected = false;
var whisperconnConnected = false;

var quitting = module.exports.quitting = false;

//We store Channel objects that we pass messages to
var channels = module.exports.channels = {};

module.exports.whisper = function (user, channel, message) {
	lastWhisper = {
		user: user,
		channel: channel,
		message: message
	};
	if (whisperconnConnected) {
		//If we can send a whisper...
		whisperconn.whisper(user.username, message);
	} else {
		//Otherwise use the fallback method of spamming chat.
		replayWhisper();
	}
}
var replayWhisper = function () {
	// Blacklist this user from receiving whispers in the future?
	if (lastWhisper) {
		client.say(lastWhisper.channel.hashtag, lastWhisper.user['display-name'] + ": " + lastWhisper.message);
	}
}

//This will get thrown a bunch of channel models that we should enter
//and then start throwing messages at.
module.exports.joinChannels = function(channels){
	channels.forEach(joinChannel);
}

var joinChannel = module.exports.joinChannel = function(channel){
	if(channels[channel.hashtag]){
		return;
	}
	if (channel.model.active) {
		log.info('joining', channel.hashtag);
		
		channels[channel.hashtag] = channel;
		client.join(channel.hashtag);
	}
}

var partChannel = module.exports.partChannel = function (channel){
	if (!channels[channel.hashtag]) {
		return;
	}
	log.info('leaving', channel.hashtag);
	delete channels[channel.hashtag];
	client.part(channel.hashtag);
}

//We add a bunch of listeners to the IRC client that forward the events ot the appropriate Channel objects.
client.on('chat', function(channel, user, message, self){
	if (self) {
		//We don't care what we said.
		return;
	}
	var channel = channels[channel];

	channel && channel.onMessage(user, message);
});

client.on('mod', function (channel, user) {
	var channel = channels[channel];
	channel.onUserModded(user);
});

client.on('unmod', function (channel, user) {
	var channel = channels[channel];
	channel.onUserUnmodded(user);
});

client.on('connected', function (address, port) {
	clientConnected = true;
	log.info("Chat channel connected");
});

client.on('disconnected', function (reason) {
	clientConnected = false;
	log.warn("Chat channel disconnected: ", reason);
	if (this.quitting && !whisperconnConnected) {
		process.exit();
	}
})

whisperconn.on('connected', function (address, port) {
	whisperconnConnected = true;
	log.info("Whisper channel connected");
});
whisperconn.on('disconnected', function (reason) {
	whisperconnConnected = false;
	log.warn("Whisper channel disconnected: ", reason);
	if (this.quitting && !clientConnected) {
		process.exit();
	}
});

client.on('notice', function (channel, msgid, message) {
	switch (msgid) {
		default:
			log.info("Chat connection notice: ", channel, " - ", msgid, " (", message, ")");
			break;
	}
})

whisperconn.on('notice', function (channel, msgid, message) {
	switch (msgid) {
		case "whisper_restricted_recipient":
			log.warn("Restricted whisper message. Channel ", channel, ", id ", msgid, ", message ", message);
			replayWhisper();
			break;
		default:
			log.info("Whisper connection notice received: ", channel, " - ", msgid);
			break;
	}
});

client.connect();
whisperconn.connect();

