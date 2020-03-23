/*
	This singlettoni (singleton written in sphagetti code) establishes the connection to the irc server and allows
	channels to register themselves to receive events.
*/

"use strict";

var tmi = require('tmi.js');
var log = require('./log.js');
var Models = require('./lib/models.js');

var Channel = require('./lib/channel.js');

var commands = require('./lib/commands');

var models = require('./lib/models.js');

var twitch = require('./lib/twitch.js');

var settings = require('./lib/settings.js');

//We setup the options object and import the oauth token.
var secrets = require('./secrets.js');

var ircClient = function () {
	this.lastWhisper = {};
	this.whisperCommands = [];

	this.clientConnected = false;

	this.quitting = false;

	//We store Channel objects that we pass messages to
	this.channels = {};
	this.seenCache = new Map();

	twitch.client = this;
	
	// Every minute, clear out any seen entries not used in the last 10 minutes.
	this.clearCache = setInterval(() => {
		this.seenCache.forEach((value, key, map) => {
			if (value.dateTimeSeen < (Date.now() + (10*60*1000))) {
				map.delete(key);
			}
		});
	}, (60*1000));
}

var c = ircClient.prototype;

c.connect = function (options) {
	//First, we need a few clients...
	this.options = options;
	this.clientConnection = new tmi.client(this.options);
	this.clientConnection.parent = this;

	//Then we add listeners to those clients.
	this.clientConnection.on('chat', this.onChat);
	this.clientConnection.on('mod', this.onMod);
	this.clientConnection.on('unmod', this.onUnMod);
	this.clientConnection.on('connected', this.onChatConnect);
	this.clientConnection.on('disconnected', this.onChatDisconnect);
	this.clientConnection.on('join', this.onChatJoin);
	this.clientConnection.on('part', this.onChatPart);
	this.clientConnection.on('notice', this.onChatNotice);
	this.clientConnection.on('roomstate', this.onRoomState);
	this.clientConnection.on('whisper', this.onWhisper);
	this.clientConnection.on('error', (e) => {
		// Unknown if this is actually a thing or not, it's not mentioned in the documentation.
		log.error("CONNECTION ERROR: %s", e);
	});
	//this.clientConnection.on('serverchange', this.onServerChange);
	this.clientConnection.network = "Main";
	this.clientConnection.connect();

	//Then we attach whisper handlers directly.
	this.attachWhispers();
	this.lastUpdated = new Date().valueOf();
}

c.disconnect = function () {
	this.clientConnection.disconnect();
}

c.onChatConnect = function (address, port) {
	client.clientConnected = true;
	log.info(this.network, "Connected");
	Channel.findActiveChannels(this.parent.joinChannels, this.network);
}

c.onRoomState = function (channel, state) {
	var channel = this.parent.channels[channel];
	channel.onRoomState();
}

c.onChat = function (channel, user, message, self) {
	if (self) {
		//We don't care what we said.
		this.parent.channels[channel].amMod = user.mod;
		return;
	}
	var channel = this.parent.channels[channel];
	//Update the channel's users object with the latest version of this user's object. Yes, I know it's a little confusing...
	channel.users[user] = user;
	channel.onMessage(user, message);
	//Update the Last Seen table...
	client.updateLastSeen(user.username, channel.model.name, message);
};

c.onMod = function (channel, user) {
	var channel = this.parent.channels[channel];
	channel.onUserModded(user);
}

c.onUnMod = function (channel, user) {
	var channel = this.parent.channels[channel];
	channel.onUserUnmodded(user);
}

c.onChatDisconnect = function (reason) {
	client.clientConnected = false;
	log.warn(this.network, "Chat channel disconnected: ", reason);
	this.parent.channels.forEach((channel) => {
		channel.tearDown();
		delete channel;
	});
	if (this.parent.quitting /* && !whisperconnConnected */ ) {
		process.exit();
	}
}

c.onChatJoin = function (channel, user) {
	if (this.parent.channels.hasOwnProperty(channel)) {
		if (!this.parent.channels[channel].users.hasOwnProperty(user)) {
			// If this user has joined and hasn't spoken yet, add a basic, empty user object
			this.parent.channels[channel].users[user] = {
				username: user,
				'display-name': user
			};
		}
	}
}

c.onChatPart = function (channel, user) {
	if (this.parent.channels.hasOwnProperty(channel)) {
		this.parent.channels[channel].users[user] = null;
	}
}

c.onChatNotice = function (channel, msgid, message) {
	switch (msgid) {
		case "whisper_restricted_recipient":
			log.warn("Restricted whisper message. Channel ", channel, ", id ", msgid, ", message ", message);
			this.parent.replayWhisper(true);
			break;
		case "msg_banned":
			log.warn("We are banned from ", channel, ", apparently. Leaving.");
			this.part(channel);
			this.parent.channels[channel].model.active = false;
			this.parent.channels[channel].model.save();
			this.parent.channels[channel].tearDown();
		case "msg_channel_suspended":
			log.warn("Channel %s is suspended. Leaving.", channel);
			this.part(channel);
			this.parent.channels[channel].model.active = false;
			this.parent.channels[channel].model.save();
			this.parent.channels[channel].tearDown();
		default:
			log.info(this.network, "Chat connection notice: ", channel, " - ", msgid, " (", message, ")");
			break;
	}
}

c.onWhisper = function (from, user, message, fromSelf) {
	//We got a whisper. Do something with it.
	log.info("Whisper received:", user, " - ", message);
	//Update the Last Seen table...
	client.updateLastSeen(user.username, false);
	if (message[0] != '!') return;

	this.log.info("W:", user['display-name'], "M:", message);

	this.parent.whisperCommands.forEach(function (command) {
		command.onWhisper(user, message.substr(1, message.length));
	});

}

c.getUsername = function() {
	return this.clientConnection.getUsername();
}

c.getUserSeen = async function(user) {
	if (this.seenCache.has(user)) {
		this.seenCache.get(user).dateTimeSeen = Date.now();
		return this.seenCache.get(user).id;
	} else {
		try {
			const foundUser = await models.LastSeen.findOne({
				where: {
					name: user
				}
			});
			if (foundUser) {
				this.seenCache.set(user, { id: foundUser.id, dateTimeSeen: Date.now() });
				return foundUser.id;
			} else {
				reject(new Error(`Unable to find LastSeens.id for user ${user}`));
			}
		} catch(e) {
			reject(new Error(`Unable to find LastSeens.id for user ${user}`));
		}
	}
}

c.updateLastSeen = function (user, channelName, message) {
	this.getUserSeen(user).then((userID) => {
		models.LastSeen.update({
			dateTimeSeen: Date.now(),
			whereSeen: channelName?channelName:null
		}, {
			where: {
				id: userID
			}
		});
	}).catch((e) => {
		var RegEx = new RegExp("[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)");
		if (RegEx.test(message)) {
			let channels;
			if (this.channels) channels = this.channels;
			if (!channels && this.parent.channels) channels = this.parent.channels;
			if (!channels) {
				log.warn(`Problem finding channels, this = ${JSON.stringify(this)}`);
				return;
			}
			if (channels["#" + channelName].amMod) {
				log.warn(`New user (${user}) appeared in ${channelName} and sent a URL (${message}). SpamBot? Timing out for 5 minutes`);
				client.timeout("#" + channelName, user, 300, "<AUTOMATED> First time seen and posting a URL - Spambot?");
				client.say("#" + channelName, "Automated timeout for " + user + " - First time I see you and your're posting a URL? Wait 5 minutes and try again.");
				foundUser.destroy();
				return;
			} else {
				log.warn(`New user (${user}) appeared in ${channelName} and sent a URL (${message}), but we're not a mod. Ignoring.`);
				return;
			}
		}
		models.LastSeen.build({
			name: user,
			dateTimeSeen: Date.now(),
			whereSeen: channelName?channelName:null
		}).save().then((savedUser) => {
			this.seenCache.set(user, savedUser.id);
		});
	});
	/* 
	// Old version, just in case.

	models.LastSeen.findOrCreate({
		where: {
			name: user
		},
		defaults: {
			dateTimeSeen: Date.now()
		}
	}).spread((foundUser, created) => {
		if (created) {

		}
		foundUser.dateTimeSeen = Date.now();
		if (channelName) {
			foundUser.whereSeen = channelName;
		} else {
			foundUser.whereSeen = null;
		}
		foundUser.save();
	});
	*/
}


c.attachWhispers = function () {
	this.attachWhisper(commands.common);
	this.attachWhisper(commands.calendar);
	this.attachWhisper(commands.antispam);
	this.attachWhisper(commands.advice);
	this.attachWhisper(commands.joinpart);
	this.attachWhisper(commands.seen);
}

c.attachWhisper = function (constructor) {
	var exists = this.whisperCommands.some(function (m) {
		return m instanceof constructor;
	});

	if (!exists) {
		this.whisperCommands.push(new constructor(this));
	}
}

c.whisper = function (user, channel, message) {
	var username = user;
	if (user.username) {
		username = user.username;
	}
	client.lastWhisper = {
		user: username,
		channel: channel,
		message: message
	};
	log.info("Whispering to ", username, ": ", message);
	client.clientConnection.whisper(username, message);
}

c.getConnForChannel = function (channelName) {
	var clientChannels = client.clientConnection.getChannels();
	//if (clientChannels.indexOf(channelName) >= 0) {
	return client.clientConnection;
	//} else {
	//log.error("Unable to find connection for ", channelName);
	//}
}

c.timeout = function (channelname, username, time) {
	var clientObj = client.getConnForChannel(channelname);
	clientObj.timeout(channelname, username, time);
}

c.say = function (channel, message) {
	var clientObj = client.getConnForChannel(channel);
	clientObj.say(channel, message);
}

c.findChannel = function (username) {
	for (var i = 0; i < client.channels.length; i++) {
		var channel = client.channels[i];
		if (channel.users && channel.users.hasOwnProperty(username)) {
			return channel;
		}
	}
	return false;
}
c.replayWhisper = function (isError) {
	// Blacklist this user from receiving whispers in the future?
	var isFromWhisper = false;
	if (client.lastWhisper) {
		var displayname, username = client.lastWhisper.user;
		if (username.username) {
			username = username.username;
		}
		if (client.lastWhisper.user['display-name']) {
			displayname = client.lastWhisper.user['display-name'];
		} else {
			displayname = username;
		}
		var hashtag = client.lastWhisper.channel;
		if (hashtag) {
			if (hashtag.hashtag) {
				hashtag = hashtag.hashtag;
			}
		} else {
			//We don't have a source channel, so this is in reply to a whisper.
			isFromWhisper = true;
			var foundChannel = client.findChannel(username);
			if (foundChannel) {
				hashtag = foundChannel.hashtag;
			} else {
				log.warn("Failed completely to find", username, "message:", client.lastWhisper.message);
				return;
			}
		}
		if (isError) {
			log.info("Whispering failed(?), saying to ", hashtag, ": ", displayname + ": " + client.lastWhisper.message);
			if (isFromWhisper) {
				client.say(hashtag, displayname + " (whisper failed, replying to first common channel, are you following?): " + client.lastWhisper.message);
			} else {
				client.say(hashtag, displayname + " (whisper failed, are you following?): " + client.lastWhisper.message);
			}
		} else {
			client.say(hashtag, displayname + ": " + client.lastWhisper.message);
		}
	}
}

//This will get thrown a bunch of channel models that we should enter
//and then start throwing messages at.
c.joinChannel = function (channel) {
	if (client.channels[channel.hashtag]) {
		return;
	}
	if (channel.model.active) {
		log.info(channel.network, 'Joining', channel.hashtag);
		client.channels[channel.hashtag] = channel;
		client.clientConnection.join(channel.hashtag);
		channel.client = client;
		//} else {
		//We don't want to join, but this is an "Interesting" channel. So monitor it.
		//
		//We don't need to worry about this anymore - They've all been imported.
		//twitch.addFollow(channel.model.name);
	}
}

c.joinChannels = function (channels) {
	log.info('Joining Channels...');
	channels.forEach(client.joinChannel);
}

c.partChannel = function (channel) {
	if (!channels[channel.hashtag]) {
		return;
	}
	log.info('leaving', channel.hashtag);
	delete channels[channel.hashtag];
	this.parent.getConnForChannel(channel.hashtag).part(channel.hashtag);
}

var client = new ircClient();

module.exports = client;