"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');
var client = require('../../client.js');
var channel = require('../channel.js');

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
            models.Channel.findOrCreate({ where: { name: user } }).spread(function (newChannel, created) {
                newChannel.active = true;
                newChannel.monitor = true;
                newChannel.save().then(function (savedmodel) {
                    var newChannelObj = channel.channelBuilder(savedmodel);
                    me.client.joinChannel(newChannelObj);
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
            this.channel.client.channels["#" + user].model.active = false;
            this.channel.client.channels["#" + user].model.save().then(function () {
                me.part(me.channel.client.channels["#" + user]);
            })
            
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
            models.Channel.findOrCreate({ where: { name: username } }).spread(function (newChannel, created) {
                newChannel.active = true;
                newChannel.monitor = true;
                newChannel.save().then(function (savedmodel) {
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
            this.channel.client.channels["#" + username].model.active = false;
            this.channel.client.channels["#" + username].model.save().then(function () {
                me.channel.client.partChannel(me.channel.client.channels["#" + username]);
            })
            
        }
    }
}