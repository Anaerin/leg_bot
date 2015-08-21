"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');

var AntiSpamEngine = require('../antispam.js');

var AntiSpamModule = module.exports = function (channel) {
    SimpleCommands.call(this, channel);
    this.rules = {};
}

SimpleCommands.adopt(AntiSpamModule);

var c = AntiSpamModule.prototype;

c.commands = {
    'antispam add': {
        time: 5,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam add \"([^\"]+)\" \"(.*)\"$/i,
        method: function (match, user, message) {
            if (AntiSpamEngine.addRule(match[1], match[2])) {
                this.channel.say("Rule added");
            } else {
                this.channel.say("A rule with that name already exists.");
            }
        }
    },
    'antispam remove': {
        time: 5,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam remove \"([^\"]+)\"$/i,
        method: function (match, user, message) {
            var name = match[1];
            if (AntiSpamEngine.removeRule(match[1])) {
                this.channel.say("Rule deleted");
            } else {
                this.channel.say("Rule not found");
            }
        }
    },
    'antispam list': {
        time: 5,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam list$/i,
        method: function (match, user, message) {
            var rules = AntiSpamEngine.listRules();
            this.channel.say("Currently defined rules are: " + rules.join(', '));
        }
    },
    'antispam help': {
        time: 5,
        timeLoud: false,
        modOnly: true,
        gameNeeded: false,
        regex: /^antispam help$/i,
        method: function (match, user, message) {
            this.channel.say("antispam usage: !antispam add \"<rule name>\" \"<Regular Expression>\", !antispam remove \"<rule name>\"");
        }
    }
}