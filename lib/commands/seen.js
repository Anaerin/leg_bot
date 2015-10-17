"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');

var Moment = require('moment-timezone');

var SeenModule = module.exports = function (channel) {
    SimpleCommands.call(this, channel);

}

SimpleCommands.adopt(SeenModule);

var s = SeenModule.prototype;

s.whisperCommands = {
    
    'seen': {
        regex: /^seen +(.*)$/i,
        method: function (match, user, message) {
            var self = this;
            models.LastSeen.findOne({ where: { name: match[1].toLowerCase() }, include: [models.Channel] }).then(function (foundUser) {
                if (foundUser == null) {
                    self.channel.whisper(user, null, 'I\'ve not yet seen a user by the name ' + match[1]);
                    return;
                } else {
                    if (foundUser.ChannelId == null) {
                        self.channel.whisper(user, null, 'Last saw ' + foundUser.name + ' ' + Moment(foundUser.dateTimeSeen).fromNow() + ', whispering sweet nothings in my electronic ear');
                    } else {
                        self.channel.whisper(user, null, 'Last saw ' + foundUser.name + ' ' + Moment(foundUser.dateTimeSeen).fromNow() + ', in ' + foundUser.Channel.name + '\'s room');
                    }
                }
            });
        },
    }
}


s.commands = {
    'seen': {
        time: 30,
        regex: /^seen +(.*)$/i,
        method: function (match, user, message) {
            var self = this;
            models.LastSeen.findOne({ where: { name: match[1].toLowerCase() }, include: [models.Channel] }).then(function (foundUser) {
                if (foundUser == null) {
                    self.channel.say('I\'ve not yet seen a user by the name ' + match[1]);
                    return;
                } else {
                    if (match.ChannelId == null) {
                        self.channel.say('Last saw ' + foundUser.name + ' ' + Moment(foundUser.dateTimeSeen).fromNow() + ', whispering sweet nothings in my electronic ear');
                    } else {
                        self.channel.say('Last saw ' + foundUser.name + ' ' + Moment(foundUser.dateTimeSeen).fromNow() + ', in ' + foundUser.Channel.name + '\'s room');
                    }
                }
            });

        },
    }
}
