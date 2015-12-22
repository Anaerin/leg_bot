"se strict";

var https = require('https');
var config = require("../config.js").twitchAPI;

var log = require("../log.js");

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


	//We setup the request options
	var options = {
		hostname: config.hostname,
		path: config.path.replace('%channels%', channelList),

		method: "GET",
	};

	log.log("Querying twitch data from", options.hostname, options.path);

	//log.info("Querying twitch API", options.path);

	var json = "";

	//This is pretty standard nodejs http request code.
	var req = https.request(options, function(res){
		res.on('data', function(chunk){
			json += chunk;
		});

		res.on('end', function(){
			parseTwitchJSON(json);
		});
	});

	req.on('error', function(e){
		log.error("Problem fetching twitch API data:", e);
	});
	req.end();
};

var parseTwitchJSON = function(json){
	try{
		json = JSON.parse(json);
	}
	catch(e){
		log.error("Got unusable response from twitch API.");
		return;
	}

	if(json.streams instanceof Array){
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
		}
	}, this);
}

var interval = setInterval(queryTwitch, config.interval);
setTimeout(queryTwitch, 10 * 1000);
