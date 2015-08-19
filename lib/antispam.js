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
    //DoNothing();
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
        var regExp = new RegExp(rule.regularExpression, "i");
        //Do we have a match?
        return regExp.test(this.message);
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
        ruleNames.push(rule.name);
    });
    return ruleNames;
}

module.exports = new AntiSpamEngine;
