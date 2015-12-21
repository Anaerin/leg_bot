"use strict";

var log = require('../log.js');
var Models = require('./models.js');

var AntiSpamEngine = function () {
    this.rules = [];
    this.UserTimeouts = {};
    this.updateRules();
}

var c = AntiSpamEngine.prototype;

c.updateRules = function () {
    var me = this;
    Models.AntiSpamRules.findAll().then(function (rules) {
        me.rules = rules;
    });    
    var fs = require('fs');
    fs.readFile(process.cwd() + "/AntiSpamRules.json", null, function (err, data) {
        if (err) {
            log.info("Unable to open AntiSpamRules.json, not importing.");
            return;
        }
        log.debug("Starting JSON Parse");
        data = JSON.parse(data);
        log.debug("Parse finished");
        Models.AntiSpamRules.bulkCreate(data.spam_rules, { fields: ['name', 'regularExpression'], validate: true })
            .then(function () {
            Models.AntiSpamRules.findAll().then(function (rules) {
                me.rules = rules;
            });
        });
        fs.rename(process.cwd() + "/AntiSpamRules.json", process.cwd() + "/AntiSpamRules-Added.json", function (err) {
            if (err) {
                log.info("Couldn't rename?");
                return;
            }
        });
    });
}
c.removeRule = function (name) {
    Models.AntiSpamRules
        .destroy({ where: { name: name } });
    this.updateRules();
    return true;
}
c.addRule = function (name, regExp) {
    var matches = this.rules.filter(function (rule, index, object) {
        return rule.name == this.name;
    }, { name: name });
    if (Array.isArray(matches) && matches.length > 0) {
        return false;
    } else {
        Models.AntiSpamRules.create({
            name: name,
            regularExpression: regExp
        });
        this.updateRules();
        return true;
    }
}
c.matchRule = function (text) {
    var matches = this.rules.filter(function (rule, index, object) {
        //Use regular expressions, because they're awesome. And I'm not going to try to 
        //write a wildcard fudger when RegExps are already here and native.
        try {
            var regExp = new RegExp(rule.regularExpression, "i");
            //Do we have a match?
            
            return regExp.test(this.message);
        } catch (e) {
            log.info("Error creating RegExp: ", rule.regularExpression);
            return false;
        }
    }, { message: text });
    if (Array.isArray(matches) && matches.length > 0) {
        return matches[0];
    } else {
        return false;
    }
}
c.listRules = function () {
    var ruleNames = [];
    this.rules.forEach(function (rule) {
        if (rule.count == 1) {
            ruleNames.push(rule.name + " (matched " + rule.count + " time)");
        } else {
            ruleNames.push(rule.name + " (matched " + rule.count + " times)");
        }
    });
    return ruleNames;
}

module.exports = new AntiSpamEngine;
