
/*
	This singlettoni (singleton written in sphagetti code) establishes the connection to the irc server and allows
	channels to register themselves to receive events.
*/

"use strict";

var irc = require('irc');
var log = require('./log.js');
var Models = require('./lib/models.js');

var channel = require('./lib/channel.js');

var config = require('./config.js').irc;

//Set up disconnection timer for inactivity
//Twitch sends a PING every 5 minutes. If 10 minutes pass with no activity, we've been silently DC'd
var disconnectionTimer;
var disconnectionValue = 10 * 60 * 1000;


//We setup the options object and import the oauth token.
var token = require('./secrets.js').twitchToken;
var options = {
	'userName': config.userName,
	'realName': config.userName,
    'password': token,
    'floodProtection': true,
    'encoding': 'UTF-8',
};

var client = module.exports.client = new irc.Client("irc.twitch.tv", config.userName, options);

client.quitting = false;

//We store Channel objects that we pass messages to
var channels = module.exports.channels = {};

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

client.on('disconnected', function(){
    //Never fires. Stupid IRC library.
    log.info("DISCONNECTED fired.", arguments);
    //client.connect(10);
});

//Wait, client.on('disconnect') does nothing? Hook the underlying connection, then.
client.conn.on('close', function (had_error) {
    if (!client.quitting) {
        if (had_error) {
            log.info("Connection closed, with error - reconnecting");
        } else {
            log.info("Connection closed, without error - reconnecting");
        }
        if (disconnectionTimer) {
            clearTimeout(disconnectionTimer);
        }
        client.connect(10);
    } else {
        log.info("Connection closed while quitting");
        log.info("Bailing...");
        process.exit();
    }
});

client.on('connect', function(){
	//this is a dumb hack, but it keeps us working without having
    //to rewrite the moderator code.
    log.debug("Connected - sending CAP request");
    client.conn.write("CAP REQ :twitch.tv/membership\r\n");
    //Keep the connection alive - send an ACK every 10 seconds or so...
    client.conn.setKeepAlive(true, 10000);
    //And watch to see if we timeout anyway
    if (!client.quitting) disconnectionTimer = setTimeout(disconnectionTimeout, disconnectionValue);
});
//We add a bunch of listeners to the IRC client that forward the events ot the appropriate Channel objects.
client.on('message', function(user, channel, message){
	var channel = channels[channel];

	channel && channel.onMessage(user, message);
});

//We use this to parse op status updates
function parseMode(channel, by, mode, argument, message){
	//What we need is an obscure part in the message object :(
	var args = message.args;

	
	var user = args[2];
	var channel = channels[args[0]];
	
	//we do not care about anything other than O (giggity)
	if(mode != 'o'){
		return;
	}
	if(!channel){
		return;
	}

	if(args[1] == '+o'){
		channel.onUserModded(user);
	}
	else if(args[1] == '-o'){
		channel.onUserUnmodded(user);
	}
}

client.on('+mode', parseMode);
client.on('-mode', parseMode);

client.on('ping', function(){
    log.info("Got PING from twitch");
});

client.on('netError', function(e){
	log.error('IRC lib netError:', e);
});

client.on('error', function (e) {
    log.error('IRC Server error:', e);
});

client.on('raw', function (e) {
    //Re-set the disconnection timer - Twitch PINGs every 5 minutes, which triggers this.
    if (disconnectionTimer) {
        clearTimeout(disconnectionTimer);
    }
    disconnectionTimer = setTimeout(disconnectionTimeout, disconnectionValue);
})

function disconnectionTimeout() {
    if (disconnectionTimer) {
        clearTimeout(disconnectionTimer);
    }    
    log.info("Didn't receive anything from the server in the last 10 minutes. Timeout? Retry the connection");
    if (!client.quitting) client.connect(10);
}