"use strict";

var https = require('https');
var config = require("../config.js").twitchAPI;
var log = require("../log.js");
var tmi = require("tmi.js");
var tmiClient = new tmi.client()
var request = require("request");
var Models = require('./models.js');
var settings = require('./settings.js');
const Op = require("sequelize").Op

var channels = {};
var Twitch = function () {
	this.settings = settings;
	this.scopesRequired = ['user_read', 'user_follows_edit', 'chat_login'];
	this.tokenValid = false;
	this.following = [];
	this.followsLoaded = false;
	this.followsQueued = [];
	this.followsProcessing = [];
	this.channels = {};
	//This is the current set of channel data that we have.
	this.twitchData = {};
	//These are channel objects that consume the data.
	this.interval = setInterval(this.queryTwitch.bind(this), config.interval);
	//setTimeout(this.queryTwitch.bind(this), 10 * 1000);
	this.twitchHealthy = true;
	this.getFollows();
}
var t = Twitch.prototype;
	//Adds a channel to the list of interesting twitch channels.
	//It also makes sure that every channel is there once.

t.verifyToken = function () {
	log.debug("Verifying token...");
	if (this.settings["_loaded"]) { 
		if (this.settings.oAuthToken) {
			log.debug("Making request to id.twitch.tv to verify token");
			var apiRequest = request({
				url: 'https://api.twitch.tv/kraken',
				method: 'GET',
				json: true,
				headers: {
					"Accept": "application/vnd.twitchtv.v5+json",
					"Authorization": 'OAuth ' + this.settings.oAuthToken,
					"Client-ID": config.clientID
				}
			}, (err, res, body) => {
				log.debug("Got response from id.twitch.tv to verify token:", body);
				this.tokenValid = false;
				if (body && body.token) {
					if (body.token.valid) {
						this.tokenValid = true;
						// We have a valid token! does it have the scope(s) we need?
						for (let scope of this.scopesRequired) {
							if (body.token.authorization.scopes.indexOf(scope) == -1) {
								this.tokenValid = false;
							}
						}
					}
					if (this.tokenValid) {
						log.debug("Got valid token", body.token);
						this.settings["user_name"] = body.token.user_name;
						this.settings["user_id"] = body.token.user_id;
						var options = {
							options: {
								logger: log,
								debug: false
							},
							connection: {
								cluster: 'aws',
								reconnect: true,
								secure: true
							},
							identity: {
								username: this.settings.user_name,
								password: "oauth:" + this.settings.oAuthToken
							}
						};
						if (this.client) this.client.connect(options);
						if (!this.followsLoaded) this.getFollows();
					} else {
						this.getToken();
					}
				} else if (body) {
					this.twitchHealthy = false;
					// Got an invalid reply, retry in a second.
					setTimeout(this.verifyToken.bind(this), 1000);
				}
			});
		} else this.getToken();
	} else {
		log.debug("Settings not loaded yet. Waiting...");
		setTimeout(this.verifyToken.bind(this), 100);
	}
}

t.getToken = function () {
	log.warn("Please authorize me by going to " +
		"https://id.twitch.tv/oauth2/authorize" +
		"?response_type=code" +
		"&client_id=" + config.clientID +
		"&redirect_uri=" + encodeURIComponent(config.clientRedirectURL) +
		"&scope=" + encodeURIComponent(this.scopesRequired.join(" ")) +
		"&state=" + encodeURIComponent(new Date().toISOString()));
}

t.receivedCode = function(code) {
	log.info("Received oAuth code %s",code);
	var apiRequest = request({
		method: "POST",
		url: "https://id.twitch.tv/oauth2/token",
		json: true,
		headers: {
			"Accept": "application/vnd.twitchtv.v5+json",
			"Authorization": 'OAuth ' + this.settings.oAuthToken,
			"Client-ID": config.clientID
		},
		form: {
			"client_id": config.clientID,
			"client_secret": config.clientSecret,
			"grant_type": "authorization_code",
			"redirect_uri": config.clientRedirectURL,
			"code": code
		}
	}, (err, res, body) => {
		if (body && body.access_token) {
			this.settings.oAuthToken = body.access_token;
			this.verifyToken();
		} else {
			log.error("Using oAuth code failed: %s",body);
		}
	});
}

t.hasToken = function () {
	return this.tokenValid;
}

t.addChannel = function (channel) {
	var name = channel.model.name.toString().toLowerCase();
		channels[name] = channel;
		//if (this.twitchStreams.indexOf(name) == -1) {
		//	this.twitchStreams.push(name);
		//}
		this.addFollow(name);
	}


	//This allows other modules to get the twitch data set.
	//Whilst allowing us to delete and rebult the data object.
t.getData = function () {
		return this.twitchData;
	}

t.getFollows = function(start) {
	if (!start) start = 0;
	if (this.tokenValid) {	
		log.debug("Requesting follows for user id", settings.user_id);
		var apiRequest = request({
			url: "https://api.twitch.tv/kraken/users/" + settings.user_id + "/follows/channels",
			method: "GET",
			json: true,
			qs: {
				offset: start
			},
			headers: {
				"Accept": "application/vnd.twitchtv.v5+json",
				"Authorization": 'OAuth ' + this.settings.oAuthToken,
				"Client-ID": config.clientID
			}
		},(err, res, body) => {
			log.debug("Got the following for follows:", body);
			if (body && body.follows) {
				log.info("Processing follows, from %s to %s of %s", start, start + body.follows.length, body['_total']);
				if (start == 0) this.following = [];
				body.follows.forEach(follow => {
					this.following.push(follow.channel.name.toString().toLowerCase());
					if (this.followsQueued.indexOf(follow.channel.name.toString().toLowerCase()) != -1) {
						this.followsQueued.splice(this.followsQueued.indexOf(follow.channel.name.toString().toLowerCase()), 1);
					}
				});
				if (start + body.follows.length < body['_total']) {
					this.getFollows(start + body.follows.length);
				} else {
					this.followsLoaded = true;
					while (this.followsQueued.length > 0) {
						var newFollow = this.followsQueued.shift();
						this.addFollow(newFollow);
					}
					this.checkFollows();
					this.queryTwitch();
				}
			} else {
				log.warn("Got no follows, for some reason. Received %s", body);
			}
		}); 
	} else {
		this.verifyToken();
	}
}

t.checkFollows = function() {
	if (!this.settings.loadedFollowsFromDB) {
		var checkChannels = Models.Channel.findAll({ raw: true }).then(foundChannels => {
			foundChannels.forEach(channelObject => {
				if (!this.isFollowing(channelObject.name.toString().toLowerCase())) {
					this.addFollow(channelObject.name.toString().toLowerCase());
				}
			});
		});
		this.settings.loadedFollowsFromDB = new Date().toISOString();
	}
}

t.nameToId = function(name) {
	return new Promise((resolve, reject) => {
		let apiRequest = request({
			method: "PUT",
			url: "https://api.twitch.tv/helix/users?login=" + name.toString().toLowerCase(),
			json: true,
			headers: {
				"Accept": "application/vnd.twitchtv.v5+json",
				"Authorization": "OAuth " + this.settings.oAuthToken,
				"Client-ID": config.clientID
			}
		}, (err, res, body) => {
			if (body && body.data) {
				resolve(body.data.id);
			} else {
				reject("Couldn't get ID for " + name);
			}
		});
	});
}

t.addFollow = function(name) {
	if (this.followsLoaded && !this.isFollowing(name.toString().toLowerCase()) && !this.followsProcessing.includes(name.toString().toLowerCase())) {
		this.followsProcessing.push(name.toString().toLowerCase());
		this.nameToId(name).then((userID) => {
			var apiRequest = request({
				method: "PUT",
				url: "https://api.twitch.tv/kraken/users/" + this.settings.user_id + "/follows/channels/" + userID,
				json: true,
				headers: {
					"Accept": "application/vnd.twitchtv.v5+json",
					"Authorization": 'OAuth ' + this.settings.oAuthToken,
					"Client-ID": config.clientID
				}
			}, (err, res, body) => {
				if (body && body.channel && body.channel.name && !this.isFollowing(body.channel.name.toString().toLowerCase())) {
					this.following.push(body.channel.name.toString().toLowerCase());
					this.followsProcessing.splice(this.followsProcessing.indexOf(body.channel.name.toString().toLowerCase()), 1);
				} else {
					log.info("Got problem following: %s, %s",JSON.stringify(name), body);
				}
			});
		}).catch((error) => {
			log.warn("Error resolving name ",name," to ID - ",error);
		});
	} else if (!this.followsLoaded) {
		this.followsQueued.push(name.toString().toLowerCase());
	}
}

t.removeFollow = function(name) {
		if (this.isFollowing(name.toString().toLowerCase())) {
			var apiRequest = request({
				method: "DELETE",
				url: "https://api.twitch.tv/kraken/users/" + this.settings.user_id + "/follows/channels/" + name.toString().toLowerCase(),
				headers: {
					"Accept": "application/vnd.twitchtv.v5+json",
					"Authorization": 'OAuth ' + this.settings.oAuthToken,
					"Client-ID": config.clientID
				}
			}, (err, res, body) => {
				if (!err) {
					this.following.splice(this.following.indexOf(name.toString().toLowerCase()), 1);
					//this.following.push(body.channel.name);
				}
			});
		} else console.log("Twitch: Got request to unfollow, but we're not following " + name + "?");
	}

t.isFollowing = function(name) {
	if (this.followsLoaded) {
		return (this.following.indexOf(name.toString().toLowerCase()) != -1 || (name.toString().toLowerCase() == settings.user_name.toString().toLowerCase()));
	} else return false;
}

t.queryTwitch = function() {
	if (this.tokenValid) {			
		//var channelList = this.twitchStreams.join();
		tmiClient.api({
			//url: config.path.replace('%channels%', channelList),
			url: "https://api.twitch.tv/kraken/streams/followed?stream_type=live",
			method: "GET",
			headers: {
				"Accept": "application/vnd.twitchtv.v5+json",
				"Authorization": 'OAuth ' + this.settings.oAuthToken,
				"Client-ID": config.clientID
			}
		}, (err, res, body) => {
			if (err) {
				log.error(err);
				return;
			}
			this.parseTwitchJSON(body);
		});
	}
}

t.parseTwitchJSON = function(json) {
	this.twitchHealthy = true;
	try {
		if (typeof json === 'string') json = JSON.parse(json);
	} catch (e) {
		log.error(`Couldn't parse JSON: ${e.message}, JSON is ${json}`);
		this.twitchHealthy = false;
		return;
	}
    if (json.streams && json.streams instanceof Array) {
		json = json.streams;
	}
	else {
		log.error("Got twitch API data with no stream array, instead just contains %s", json);
		return;
	}

	var loadedStreams = {};
	//We make the retrieved data easy to access via stream name
	json.forEach((stream) => {
		loadedStreams[stream.channel.name.toString().toLowerCase()] = stream;
		if (!this.isFollowing(stream.channel.name.toString().toLowerCase())) {
			// We've just been notified of a stream that's live that we don't know we're following.
			// I guess someone added it elsewhere?? Add it to our list.
			this.following.push(stream.channel.name.toString().toLowerCase());
		}
	});
		
	//Now we iterate over all the channels that we care about.
	let seenOr = [];
	this.following.forEach((stream) => {
		var newData = loadedStreams[stream];
		var curData = this.twitchData[stream];

		//If both the old and retrieved data say offline, we do nothing.
		if (!newData && !curData) {
			return;
		}
		//If there is old data but no new data
		//We add a offline count to the old data
		//If that count goes too big, we agree with twitch and say the channel is offline.
		else if (!newData && curData) {
			curData._lb_offline = curData._lb_offline || 0;
			curData._lb_offline++;

			if (curData._lb_offline > 3) {
				log.info("S:", stream, "is now offline");
				this.twitchData[stream] = undefined;
			}
			else {
				log.info("S:", stream, "offline count is", curData._lb_offline);
			}
		}
		//If there is new data, we use it.
		else if (newData) {
			if (!curData || newData.channel.game != curData.channel.game) {
					//There's a new game! Fire off the WS notification.
					if (this.channels.hasOwnProperty(newData.channel.name.toString().toLowerCase())) {
							this.channels[newData.channel.name.toString().toLowerCase()].newGame();
					}
			}
			if (!curData) {
					log.info("New twitch data for channel:", stream);
			}
			this.twitchData[stream] = newData;
			seenOr.push(newData.channel.name.toString().toLowerCase());
/*
			Models.LastSeen.findOrCreate({ where: { name: newData.channel.name.toString().toLowerCase() }, defaults: { dateTimeSeen: Date.now(), whereSeen: "Streaming" } }).spread((foundUser) =>$
					foundUser.dateTimeSeen = Date.now();
					foundUser.whereSeen = "Streaming";
					foundUser.save();
			});
*/
	}
	if (seenOr.length >= 1) {
		Models.LastSeen.update({
			dateTimeSeen: Date.now(),
			whereSeen: "Streaming"
		}, {
			where: {
				name: {
					[Models.Op.in]: seenOr
				}
			}
		});
	}
}, this);
}

var twitch = new Twitch();
module.exports = twitch;
