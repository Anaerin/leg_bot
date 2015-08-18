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
    },
    'antispam list': {
        time: 30,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam list$/i,
        method: function (match, user, message) {
            var me = this;
            AntiSpam.findAll().then(function (as) {
                me.channel.say("Currently defined rules are: " + as.reduce(function (prev, curr) {
                    return prev.concat(curr.name);
                }).join(", "));
            })
        }
    },
    'antispam help': {
        time: 30,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam help$/i,
        method: function (match, user, message) {
            me.channel.say("antispam usage: !antispam add \"<rule name>\" \"<Regular Expression>\", !antispam remove \"<rule name>\"");
        }
    }
}