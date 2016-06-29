"use strict";

var https = require('https');
var config = require("../config.js").twitchAPI;
var myName = require("../config.js").irc.userName;
var log = require("../log.js");

var Models = require('./models.js');

//This is a list of twitch channels that we are interested in.
var twitchStreams = config.otherChannels;
//This is the current set of channel data that we have.
var twitchData = {};
//These are channel objects that consume the data.
var channels = {};


//Adds a channel to the list of interesting twitch channels.
//It also makes sure that every channel is there once.
var addChannel = module.exports.addChannel = function(channel){
	var name = channel.model.name;
	channels[name] = channel;
	if(twitchStreams.indexOf(name) == -1){
		twitchStreams.push(channel.model.name);
	}
}


//This allows other modules to get the twitch data set.
//Whilst allowing us to delete and rebult the data object.
module.exports.getData = function(){
	return twitchData;
}

var queryTwitch = module.exports.queryTwitch = function(){
	var me = this;	

	var channelList = twitchStreams.join();
    var client = channels[myName].client;
	if (client.clientConnection) {
        //log.info("Querying twitch data from", config.path.replace('%channels%', channelList));
        client.clientConnection.api({
			url: config.path.replace('%channels%', channelList),
			method: "GET",
			headers: {
				"Accept": "application/vnd.twitchtv.v3+json",
				"Authorization": config.oAuth,
				"Client-ID": config.clientID
			}
		}, function (err, res, body) {
			if (err) {
				log.error(err);
				return;
			}
			parseTwitchJSON(body);
		});
	} else {
		log.warn("clientConnection doesn't exist...");
	}
};

var parseTwitchJSON = function(json){
    if (typeof json === 'string') json = JSON.parse(json);
    if (json.streams instanceof Array) {
		json = json.streams;
	}
	else{
        log.error("Got twitch API data with no stream array");
		return;
	}

	var loadedStreams = {};

	//We make the retrieved data easy to access via stream name
	json.forEach(function(stream){
		loadedStreams[stream.channel.name] = stream;
	});

	//Now we iterate over all the channels that we care about.
	twitchStreams.forEach(function(stream){
		var newData = loadedStreams[stream];
		var curData = twitchData[stream];

		//If both the old and retrieved data say offline, we do nothing.
		if(!newData && !curData){
			return;
		}
		//If there is old data but no new data
		//We add a offline count to the old data
		//If that count goes too big, we agree with twitch and say the channel is offline.
		else if(!newData && curData){
			curData._lb_offline = curData._lb_offline || 0;
			curData._lb_offline++;

			if(curData._lb_offline > 3){
				log.info("S:", stream, "is now offline");
				twitchData[stream] = undefined;
			}
			else{
				log.info("S:", stream, "offline count is", curData._lb_offline);
			}
		}
		//If there is new data, we use it.
        else if (newData) {
            if (!curData || newData.channel.game != curData.channel.game) {
                //There's a new game! Fire off the WS notification.
                channels[newData.channel.name].newGame();
            }
			if(!curData){
				log.info("New twitch data for channel:", stream);
			}
            twitchData[stream] = newData;
            log.info("Updating LastSeen info for", newData.channel.name);
            Models.LastSeen.findOrCreate({ where: { name: newData.channel.name }, defaults: { dateTimeSeen: Date.now() } }).spread(function (foundUser) {
                foundUser.dateTimeSeen = Date.now();
                foundUser.ChannelId = channels[newData.channel.name].model.id;
                foundUser.save();
            });
		}
	}, this);
}

var interval = setInterval(queryTwitch, config.interval);
setTimeout(queryTwitch, 10 * 1000);
