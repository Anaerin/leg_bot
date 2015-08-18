"use strict";

var log = require('../log.js');

var globalConfig = require('../config.js');
var config = globalConfig.channel;

var commands = require('./commands');
var models = require('./models.js');

var client = require('../client.js');

var twitch = require('./twitch.js');


//These communicate between the irc client, command modules and database models.
var Channel = module.exports = function(model){
	
	this.model = model;
	this.hashtag = "#" + model.name;

	channels[model.name] = this;

	this.bindLog();

	//We use these to keep track of mod status of users.
	//Every time twitch unmods someone we actually wait for a while
	//because twitch keeps modding and unmodding all the time.
	this.mods = {};
	this.mods[model.name] = true; // The channel owner is always a mod.
	this.modTimeouts = {};

	this.commands = [];
	this.attachCommands();

    twitch.addChannel(this);
    this.antiSpamRules = {};
    var me = this;
    models.AntiSpamRules.findAll().then(function (rules) {
        me.antiSpamRules = rules;
    });
    this.spammerTimeout = {};
}

var channels = Channel.channels = {};

//Finds all active channels and builds channel objects out of them.
Channel.findActiveChannels = function(callback){

	var things = [];

	function buildChannels(models){
		models.forEach(function(m){
			things.push(new Channel(m));
		});

		if(callback instanceof Function){
			callback(things);
		}
	};

	models.Channel
		.findAll({where: ["active"]})
		.then(buildChannels);
}

var c = Channel.prototype;

//This gets called when the channel is actually joined

c.bindLog = function(){
	this.log = {};

	var name = this.model.dataValues.name;

	this.log.info = log.info.bind(log, "C:", name);
	this.log.error = log.error.bind(log, "C:", name);
}

//These get called when twitch tells us of somebody being modded or unmodded
//Because twitch is derpy we implement a timeout to removing mod status.
c.onUserModded = function(user){
	this.mods[user] = true;
	this.log.info("U:", user, "is now a mod");
	clearTimeout(this.modTimeouts[user]);
}
c.onUserUnmodded = function(user){
	var me = this;

	//We never demod the channel owner.
	if(user == this.model.name){
		return;
	}

	this.modTimeouts[user] = setTimeout(function(){
		me.log.info("U:", user, "is not a mod anymore");
		me.mods[user] = false;
	}, config.modTimeout);
}

//This will attach all the command modules that are enabled for the channel;
c.attachCommands = function(){
	this.attachCommand(commands.common);
	this.attachCommand(commands.calendar);
	this.attachCommand(commands.statistics);
	this.attachCommand(commands.advice);
}

c.attachCommand = function(constructor){
	var exists = this.commands.some(function(m){
		return m instanceof constructor;
	});

	if(!exists){
		this.commands.push(new constructor(this));
	}
}

//This gets called with every message sent to the channel
c.onMessage = function(user, message){
	//If it is something we said ourselves or not a command, we skip it.
    if (user == globalConfig.irc.userName) return;
    //If we are a moderator, and the user isn't, do antispam...    
    if (this.isBotMod() && !this.isMod(user)) {
        //Rules get loaded once (per channel, it seems, but that's not so bad), and then filter them here.
        //And as it's using the filter routine, it's async (I believe) which should help with speed.
        var matchingRules = this.antiSpamRules.filter(function (rule, index, object) {
            //Use regular expressions, because they're awesome. And I'm not going to try to 
            //write a wildcard fudger when RegExps are already here and native.
            var regExp = new RegExp(rule.regularExpression, "i");
            //Do we have a match?
            return regExp.test(this.message);
        }, { message: message });
        //Did we get any results?
        if (Array.isArray(matchingRules)) {
            var timeout = 0;
            //We have an array. As multiple rules can potentially match, we only really care about the first one.
            var rule = matchingRules[0];
            //Get the timeout for this user. Note, not DB-backed, so it's session-only.
            if (this.spammerTimeout[user]) timeout = this.spammerTimeout[user];
            //Increment the timeout.
            timeout++;
            //And store it back.
            this.spammerTimeout[user] = timeout;
            //Timeout the user, and log it.
            c.say("/timeout " + user + " " + Math.pow(4, timeout - 1));
            //Report the block, with all pertinent details.
            c.say("Spam detected from " + user + ", " + timeout + " times, timed out for " + Math.pow(4, timeout - 1) + " seconds. Rule matched: " + rule.name + ", contact Anaerin if this is wrong.");
            //Increase the rule's hit number
            rule.increment('count', { by: 1 });
        }
    }

    if (message[0] != '!') return;

	this.log.info("U:", user, "M:", message);

	for(var i=0, l=this.commands.length; i<l; i++){
		if(this.commands[i].onCommand(user, message.substr(1, message.length))){
			return;
		}
	}
}

//Returns wether an user is mod.
c.isMod = function(user){
	return this.mods[user] || user == this.model.name;
}

c.isBotMod = function(){
	return this.isMod(globalConfig.irc.userName);
}

c.getGame = function(){

	var game = this.twitchData();
	game = game.channel || game;
	game = game.game;

	return this.gameOverride || game;
}

c.twitchData = function(){
	return twitch.getData()[this.model.name] || {};
}

//This is what command modules call to say stuff in the channel.
c.say = function(message){
	this.log.info("Saying:", message);
	client.client.say(this.hashtag, message);
}

