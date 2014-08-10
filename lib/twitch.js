//Channel objects use this code to query the twitch API for game/viewers/etc information.

var lastQuery =  0;

var https = require('https');
var config = require("../config.js").twitchAPI;

var I = {};

//This queries twitch's API for channel info.
//It needs to be bound to a channel object to work.
I.queryTwitch = function(){
	var me = this;	

	//We setup the request options
	var options = {
		hostname: config.hostname,
		path: config.path.replace('%channel%', 'loadingreadyrun'),

		method: "GET",
	};

	this.log.debug("Querying", options, "for channel data");
	var json = "";

	//This is pretty standard nodejs http request code.
	var req = https.request(options, function(res){
		res.on('data', function(chunk){
			json += chunk;
		});

		res.on('end', function(){
			me.parseTwitchJSON(json);
		});
	});
	req.end();
	req.on('error', console.log.bind(console));
};



//This parses the twitch result and fills out the twitch object on the channel.
I.parseTwitchJSON = function(json){
	var t = this.twitch = {};
	
	var json
	try{
		json = JSON.parse(json);
	}
	catch(e){
		this.log.error("Got unusable response from twitch API.");
		return;
	}

	this.log.debug("Got JSON from Twitch", json);

	if(json && json.stream){
		var stream = json.stream;
		t.live = true;

		t.game = stream.game;
	}
	else if(!json){

	}
	else{
		t.live = false;
	}
}

module.exports.inject = function(proto){
	Object.keys(I).forEach(function(key){proto[key] = I[key]});
}
