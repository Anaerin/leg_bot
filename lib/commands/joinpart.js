"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');
var client = require('../../client.js');
var channel = require('../channel.js');
var twitch = require('../twitch.js');

var JoinPartModule = module.exports = function (channel) {
    SimpleCommands.call(this, channel);
}

SimpleCommands.adopt(JoinPartModule);

var jp = JoinPartModule.prototype;

jp.whisperCommands = {
    "join": {
        time: 60,
        timeLoud: false,
        regex: /^join$/i,
        method: function (match, user, message) {
            var me = this;
            var username = user;
            if (user.username) username = user.username;
            models.Channel.findOrCreate({ where: { name: username.toString().toLowerCase() } }).spread(function (newChannel, created) {
                newChannel.active = true;
                newChannel.save().then(function (savedmodel) {
					twitch.addFollow(username.toString().toLowerCase());
					var newChannelObj = channel.channelBuilder(savedmodel);
                    me.client.joinChannel(newChannelObj);
                    me.whisper(user, null, "Joining your channel");
                });
            });
        }
    },
    "part": {
        time: 60,
        timeLoud: false,
        regex: /^part$/i,
        method: function (match, user, message) {
            var me = this;
			this.channel.client.channels["#" + user.toString().toLowerCase()].model.active = false;
			this.channel.client.channels["#" + user.toString().toLowerCase()].model.save().then(function () {
				me.client.part(me.channel.client.channels["#" + user.toString().toLowerCase()]);
                me.whisper(user, null, "Leaving your channel");
            })
            
        }
	},
	"follow": {
		time: 10,
		timeLoud: false,
		regex: /^follow (.+)$/i,
		method: function (match, user, message) {
			twitch.addFollow(match[1].toString().toLowerCase());
		}
	},
	"followme": {
		time: 10,
		timeLoud: false,
		regex: /^follow$/i,
		method: function (match, user, message) {
			var username = user;
			if (user.username) username = user.username;
			twitch.addFollow(username);
		}
	}
}

jp.commands = {
    "join": {
        time: 60,
        timeLoud: false,
        modOnly: false,
        gameNeeded: false,
        regex: /^join$/i,
        method: function (match, user, message) {
            var me = this;
            var username = user;
            if (user.username) {
                username = user.username;
            }
            models.Channel.findOrInitialize({ where: { name: username.toString().toLowerCase() } }).spread(function (newChannel, created) {
                newChannel.active = true;
                newChannel.save().then(function (savedmodel) {
					twitch.addFollow(username.toString().toLowerCase());
					var newChannelObj = channel.channelBuilder(savedmodel);
                    me.client.joinChannel(newChannelObj);
                });
            });
        }
    },
    "part": {
        time: 60,
        timeLoud: false,
        modOnly: false,
        gameNeeded: false,
        regex: /^part$/i,
        method: function (match, user, message) {
            var me = this;
            var username = user;
            if (user.username) {
                username = user.username;
            }
            this.channel.client.channels["#" + username.toString().toLowerCase()].model.active = false;
			this.channel.client.channels["#" + username.toString().toLowerCase()].model.save().then(function () {
				me.channel.client.partChannel(me.channel.client.channels["#" + username.toString().toLowerCase()]);
            })
            
        }
	},
	"followme": {
		time: 60,
		timeLoud: false,
		modOnly: false,
		gameNeeded: false,
		regex: /^follow$/i,
		method: function (match, user, message) {
			var username = user;
			if (user.username) username = user.username;
			twitch.addFollow(username);
		}
	}
}