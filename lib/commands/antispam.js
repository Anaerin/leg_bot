"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');
var AntiSpam = models.AntiSpamRules;

var AntiSpamModule = module.exports = function (channel) {
    SimpleCommands.call(this, channel);
}

SimpleCommands.adopt(AntiSpamModule);

var a = AntiSpamModule.prototype;

a.commands = {
    'antispam add': {
        time: 30,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam add \"([^\"]+)\" \"(.*)\"$/i,
        method: function (match, user, message) {
            var name = match[1];
            var regExp = match[2];
            var me = this;
            AntiSpam.create({
                name: name,
                regularExpression: regExp
            }).then(function () {
                me.channel.say("Rule added");
            })
        }
    },
    'antispam remove': {
        time: 30,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam remove \"([^\"]+)\"$/i,
        method: function (match, user, message) {
            var name = match[1];
            var me = this;
            AntiSpam.destroy({ where: {
                    name: name,
                }
            }).then(function () {
                me.channel.say("Rule removed");
            })
        }
    }
}