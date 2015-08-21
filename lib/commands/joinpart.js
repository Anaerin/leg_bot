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

jp.commands = {
    "join": {
        time: 60,
        timeLoud: false,
        modOnly: false,
        gameNeeded: false,
        regex: /^join$/i,
        method: function (match, user, message) {
            models.Channel.findOrCreate({ where: { name: user }}).spread(function (newChannel, created) {
                newChannel.active = true;
                newChannel.save().then(function (savedmodel) {
                    var newChannelObj = channel.channelBuilder(savedmodel);
                    client.joinChannel(newChannelObj);
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
            this.channel.client.channels["#" + user].model.active = false;
            this.channel.client.channels["#" + user].model.save().then(function () {
                me.channel.client.partChannel(me.channel.client.channels["#" + user]);
            })
            
        }
    }
}