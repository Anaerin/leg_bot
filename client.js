
/*
	This singlettoni (singleton written in sphagetti code) establishes the connection to the irc server and allows
	channels to register themselves to receive events.
*/

"use strict";

var tmi = require('tmi.js');
var log = require('./log.js');
var Models = require('./lib/models.js');

var Channel = require('./lib/channel.js');

var config = require('./config.js').irc;

var commands = require('./lib/commands');

var models = require('./lib/models.js');

//We setup the options object and import the oauth token.
var token = require('./secrets.js').twitchToken;

var ircClient = function () {
    if (client) return client;
    // Let's make ourselves an object...

    //First, we need a few clients...
    this.clientConnection = new tmi.client(this.options);
    this.clientConnection.parent = this;
    this.whisperConnection = new tmi.client(this.whisper_options);
	this.whisperConnection.parent = this;
	this.awsConnection = new tmi.client(this.aws_options);
	this.awsConnection.parent = this;
    
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
	this.clientConnection.on('serverchange', this.onServerChange);
    this.clientConnection.connect();    
	
	this.awsConnection.on('chat', this.onChat);
	this.awsConnection.on('mod', this.onMod);
	this.awsConnection.on('unmod', this.onUnMod);
	this.awsConnection.on('connected', this.onChatConnect);
	this.awsConnection.on('disconnected', this.onChatDisconnect);
	this.awsConnection.on('join', this.onChatJoin);
	this.awsConnection.on('part', this.onChatPart);
	this.awsConnection.on('notice', this.onChatNotice);
	this.awsConnection.on('roomstate', this.onRoomState);
	this.awsConnection.connect();
    

    this.whisperConnection.on('connected', this.onWhisperConnect);
    this.whisperConnection.on('disconnected', this.onWhisperDisconnect);
    this.whisperConnection.on('notice', this.onWhisperNotice);
    this.whisperConnection.on('whisper', this.onWhisper);
    this.whisperConnection.connect();

    //Then we attach whisper handlers directly.
    this.attachWhispers();
	this.lastUpdated = new Date().valueOf();
}

var c = ircClient.prototype;
c.lastWhisper = {};

c.disconnect = function () {
    this.clientConnection.disconnect();
    this.whisperConnection.disconnect();
}

c.onChatConnect = function (address, port) {
    client.clientConnected = true;
    log.info("Chat channel connected");
    Channel.findActiveChannels(this.parent.joinChannels);
}

c.onRoomState = function (channel, state) {
    var channel = this.parent.channels[channel];
    channel.onRoomState();
}

c.onChat = function (channel, user, message, self) {
    if (self) {
        //We don't care what we said.
        return;
    }
    var channel = this.parent.channels[channel];
    //Update the channel's users object with the latest version of this user's object. Yes, I know it's a little confusing...
    channel.users[user] = user;
    channel.onMessage(user, message);
    //Update the Last Seen table...
    client.updateLastSeen(user.username, channel.model.id);
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
    log.warn("Chat channel disconnected: ", reason);
    if (this.parent.quitting && !whisperconnConnected) {
        process.exit();
    }
}

c.onChatJoin = function (channel, user) {
    if (this.parent.channels.hasOwnProperty(channel)) {
        if (!this.parent.channels[channel].users.hasOwnProperty(user)) {
            // If this user has joined and hasn't spoken yet, add a basic, empty user object
            this.parent.channels[channel].users[user] = { username: user, 'display-name': user };
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
        default:
            log.info("Chat connection notice: ", channel, " - ", msgid, " (", message, ")");
            break;
    }
}

c.onWhisperConnect = function (address, port) {
    client.whisperconnConnected = true;
    log.info("Whisper channel connected");
}

c.onWhisperDisconnect = function (reason) {
    client.whisperconnConnected = false;
    log.warn("Whisper channel disconnected:", reason);
    if (reason == "Unable to connect.") {
        log.info("Attempting to reconnect...");
        this.connect();
    }
    if (this.parent.quitting && !this.parent.clientConnected) {
        process.exit();
    }
}

c.onWhisperNotice = function (channel, msgid, message) {
    switch (msgid) {
        case "whisper_restricted_recipient":
            log.warn("Restricted whisper message. Channel ", channel, ", id ", msgid, ", message ", message);
            this.parent.replayWhisper(true);
            break;
        default:
            log.info("Whisper connection notice received: ", channel, " - ", msgid);
            break;
    }
}

c.onWhisper = function (user, message) {
    //We got a whisper. Do something with it.
    log.info("Whisper received:", user, " - ", message);
    //Update the Last Seen table...
    client.updateLastSeen(user, null);    
    if (message[0] != '!') return;
    
    this.log.info("W:", user['display-name'], "M:", message);
    
    this.parent.whisperCommands.forEach(function (command) {
        command.onWhisper(user, message.substr(1, message.length));
    });
 
}

c.updateLastSeen = function (user, channelID) {
    models.LastSeen.findOrCreate({ where: { name: user }, defaults: { dateTimeSeen: Date.now() } }).spread(function (foundUser) {
        foundUser.dateTimeSeen = Date.now();
        foundUser.ChannelId = channelID;
        foundUser.save();
    });
}


c.options = {
	options: {
		logger: log,
		debug: false
	},
	connection: {
		cluster: 'main',
		reconnect: true
	},
	identity: {
		username: config.userName,
		password: token
	}
};
c.whisper_options = {
	options: {
		debug: false,
		logger: log
	},
	connection: {
		cluster: 'group',
		reconnect: true
	},
	identity: {
		username: config.userName,
		password: token
	}

}
c.aws_options = {
	options: {
		debug: false,
		logger: log
	},
	connection: {
		cluster: 'aws',
		reconnect: true,
		secure: true
	},
	identity: {
		username: config.userName,
		password: token
	}
}
c.whisperCommands = [];

c.clientConnected = false;
c.whisperconnConnected = false;

c.quitting = false;

//We store Channel objects that we pass messages to
c.channels = {};
c.awsChannels = {};

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
		user: username ,
		channel: channel,
		message: message
	};
	if (client.whisperconnConnected) {
		//If we can send a whisper...
		log.info("Whispering to ", username , ": ", message);
		client.whisperConnection.whisper(username, message);
	} else {
		//Otherwise use the fallback method of spamming chat.
		client.replayWhisper(false);
	}
}

c.getConnForChannel(channelName) {
	var clientChannels = client.clientConnection.getChannels();
	var awsChannels = client.awsConnection.getChannels();
	if (clientChannels.indexOf(channelName) >= 0) {
		return client.clientConnection;
	} else if (awsChannels.indexOf(channelName) >= 0) {
		return client.awsConnection;
	} else {
		log.error("Unable to find connection for ", channelName);
	}
}

c.timeout = function (channelname, username, time) {
	var clientObj = client.getConnForChannel(channelname);
	clientObj.timeout(channelname, username, time);
}

c.say = function (channel, message) {
	var clientObj = client.getConnForChannel(channelname);
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
c.replayWhisper = function(isError) {
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
c.joinChannel = function(channel){
	if(client.channels[channel.hashtag]){
		return;
	}
	if (channel.model.active) {
		log.info('joining', channel.hashtag);
        client.channels[channel.hashtag] = channel;
        client.clientConnection.join(channel.hashtag);
        channel.client = client;
	}
}

c.joinChannels = function (channels) {
    log.info('Joining Channels...');
    channels.forEach(client.joinChannel);
}

c.partChannel = function (channel){
	if (!channels[channel.hashtag]) {
		return;
	}
	log.info('leaving', channel.hashtag);
	delete channels[channel.hashtag];
    this.parent.getConnForChannel(channel.hashtag).part(channel.hashtag);
}
c.onServerChange = function (channel) {
	var me = this.parent;
	log.info("Switching to AWS for channel " + channel.hashtag);
	me.clientConnection.part(channel.hashtag);
	me.awsConnection.join(channel.hashtag);
}

var client = new ircClient();

module.exports = client;