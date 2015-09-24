"use strict";

var log = require('./log.js');

log.info("Starting legbot");

var client = require('./client.js');

var Channel = require('./lib/channel.js');

var Web = require('./web');

client.client.on('connect', function(){
	log.info("Connected!");
	loadChannels();
});

function loadChannels(){
	log.debug("Querying channels to join");
	Channel.findActiveChannels(client.joinChannels);
}

//We do a clean disconnect on SIGINT before dying
process.on('SIGINT', function(){
	log.info("Got SIGINT! Disconnecting IRC and exiting.");
    client.client.quitting = true;
	client.client.disconnect("Time for off line LEG DAY!", function(){
		log.info("Disconnected.");
    });
    var quitTimer = setTimeout(quitTimeout, 10000);
});
function quitTimeout() {
    //It's been 10 seconds, and we still haven't quit. Force it.
    process.exit();
}

