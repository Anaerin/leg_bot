"use strict";

var log = require('../log.js');

var globalConfig = require('../config.js');
var config = globalConfig.channel;

var commands = require('./commands');
var models = require('./models.js');

var client = require('../client.js');

var twitch = require('./twitch.js');

var antiSpamEngine = require('./antispam.js');

var channelBuilder = module.exports.channelBuilder = function (model) {
    return new Channel(model);
}

var hasChannel = module.exports.hasChannel = function (channelName) {
    return channels[channelName];
}

//These communicate between the irc client, command modules and database models.
var Channel = module.exports = function(model, network){
	
	this.model = model;
	this.hashtag = "#" + model.name;

	channels[model.name] = this;
	this.network = network;
	this.bindLog();

	//We use these to keep track of mod status of users.
	//Every time twitch unmods someone we actually wait for a while
	//because twitch keeps modding and unmodding all the time.
	this.mods = {};
	this.mods[model.name] = true; // The channel owner is always a mod.
	this.modTimeouts = {};
    this.users = {};
	this.commands = [];
	this.attachCommands();
    twitch.addChannel(this);
    this.spammerTimeout = {};
    this.client = client;
    this.websockets = [];
}

var channels = Channel.channels = {};

//Finds all active channels and builds channel objects out of them.
Channel.findActiveChannels = function(callback, network){

	var things = [];

	function buildChannels(models){
		models.forEach(function(m){
			things.push(new Channel(m, network));
		});

		if(callback instanceof Function){
			callback(things);
		}
	};

	models.Channel
		.findAll()
	    .then(buildChannels);
}

var c = Channel.prototype;

c.sendWS = function (json) {
    this.websockets.forEach(function (ws) {
        ws.send(JSON.stringify(json));
    }, this);
}

//This gets called when the channel is actually joined

c.bindLog = function(){
	this.log = {};

	var name = this.model.dataValues.name;

	this.log.info = log.info.bind(log, "N:", this.network, "C:", name);
	this.log.error = log.error.bind(log, "N:", this.network, "C:", name);
}

//These get called when twitch tells us of somebody being modded or unmodded
//Because twitch is derpy we implement a timeout to removing mod status.
c.onUserModded = function(user){
    var username = user;
    if (user.username) username = user.username;
    this.mods[username] = true;
	this.log.info("U:", username, "is now a mod");
	clearTimeout(this.modTimeouts[username]);
}
c.onUserUnmodded = function(user){
	var me = this;
    var username = user;
    if (user.username) username = user.username;
	//We never demod the channel owner.
	if(username == this.model.name){
		return;
	}

	this.modTimeouts[username] = setTimeout(function(){
		me.log.info("U:", username, "is not a mod anymore");
		me.mods[username] = false;
	}, config.modTimeout);
}

c.newGame = function () {
    var game = this.getGame();
    this.sendWS({ 'action': 'GameChanged', 'game': game });
    if (game) {
        if (this.statistics) {
            if (this.statistics.statistics) {
                var me = this;
                var statNames = Object.keys(this.statistics.statistics);
                var stats = {};
                var statIDs = [];
                var statValues = {};
                statNames.forEach(function (stat) {
                    var statID = me.statistics.statistics[stat].id;
                    statIDs.push(statID);
                    stats[statID] = stat;
                    statValues[stat] = 0;
                });
                log.info("Stats is", stats);
                log.info("StatIDs are", statIDs);
                models.Count.findAll({ where: { StatisticId: { $in: statIDs }, game: game } }).then(function (counts) {
                    counts.forEach(function (count) {
                        statValues[stats[count.StatisticId]] = count.value;
                    });
                    Object.keys(statValues).forEach(function (statName) {
                        me.sendWS({ 'action': 'StatChanged', 'stat': statName, 'value': statValues[statName] });
                    });
                });
            } else {
                log.info("No statistics in channel stats object?");
            }
        } else {
            log.info("No Statistics?");
        }
    }
}
//This will attach all the command modules that are enabled for the channel;
c.attachCommands = function(){
	this.attachCommand(commands.common);
    this.attachCommand(commands.calendar);
    this.attachCommand(commands.antispam);
	this.attachCommand(commands.seen);
	//Hats' channel and HP's channel have their own bots handling quotes. So don't attach the quote command in those channel.
	if (this.hashtag != "#cantwearhats" && this.hashtag != "#hpbraincase") this.attachCommand(commands.quote);
    if (this.hashtag == "#" + globalConfig.irc.userName) {
        //This is my personal channel. No need for statistics or advice in here, but there is for join support.
        this.attachCommand(commands.joinpart);
    } else {
        this.attachCommand(commands.statistics);
        this.attachCommand(commands.advice);
        this.attachCommand(commands.barks);
    }
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
    //If we are a moderator, and the user isn't, do antispam...    
    if (this.isBotMod() && !this.isMod(user)) {
        //Rules get loaded once (per channel, it seems, but that's not so bad), and then filter them here.
        //And as it's using the filter routine, it's async (I believe) which should help with speed.
        var matchingRules = antiSpamEngine.matchRule(message);
        if (matchingRules) {
            //We have a rule.
            var timeout = 0;
            //Get the timeout for this user. Note, not DB-backed, so it's session-only.
            if (antiSpamEngine.UserTimeouts[user.username]) timeout = antiSpamEngine.UserTimeouts[user.username];
            //Increment the timeout.
            timeout++;
            //And store it back.
            antiSpamEngine.UserTimeouts[user.username] = timeout;
            //Timeout the user, and log it.
			this.client.timeout(this.model.hashtag, user.username, Math.pow(4, timeout - 1));
			//this.say("/timeout " + user + " " + Math.pow(4, timeout - 1));
            //Report the block, with all pertinent details.
            this.say("Spam detected from " + user['display-name'] + ", " + timeout + " times, timed out for " + Math.pow(4, timeout - 1) + " seconds. Rule matched: " + matchingRules.name + ", contact Anaerin if this is wrong.");
            //Increase the rule's hit number
            matchingRules.increment('count', { by: 1 });
        }
    }

    if (message[0] != '!') return;

	this.log.info("U:", user['display-name'], "M:", message);

	for(var i=0, l=this.commands.length; i<l; i++){
		if(this.commands[i].onCommand(user, message.substr(1, message.length))){
			return;
		}
	}
}

//Returns wether an user is mod.
c.isMod = function(user){
    return user['user-type'] == 'mod' || this.mods[user.username] || user == this.model.name;
}

c.isBotMod = function(){
	return this.isMod({ username: globalConfig.irc.userName });
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

c.onRoomState = function () {
	//Stop slamming twitch with updates on join - If it's not been 10 seconds since last query, don't do anything.
	if (new Date().valueOf() > (this.client.lastUpdated + 10000)) {
		twitch.queryTwitch();
	} else {
		this.log.info("Got ROOMSTATE, but it's only been " + ((new Date().valueOf() - this.client.lastUpdated) / 1000) + " seconds since last query - ignoring and resetting timer.");
	}
	this.client.lastUpdated = new Date().valueOf();
}

//This is what command modules call to say stuff in the channel.
c.say = function(message){
	this.log.info("Saying:", message);
	this.client.say(this.hashtag, message);
}

c.whisper = function (user, message) {
    this.client.whisper(user, this.hashtag, message);
}