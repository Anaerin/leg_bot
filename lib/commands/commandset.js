"use strict";

var inherits = require('util').inherits;

//Commandsets parse command messages and keep track of
//if commands can be only triggered by mods or if there
//is a set interval of time between triggerings.
var CommandSet = module.exports = function(channel){
	this.channel = channel;

	this.log = channel.log;

	this.commandTimes = {};	
}

CommandSet.adopt = function(constructor){
	inherits(constructor, CommandSet);
}

var c = CommandSet.prototype;

//This is a way for commands that are dynamic
//to check their time between triggers
c.checkTime = function(name, interval){
	interval = interval * 1000;
	var lastTime = this.commandTimes[name];
	var currentTime = new Date();

	if(lastTime){
		if(currentTime - lastTime < interval){
			return false;
		}
	}

	this.commandTimes[name] = currentTime;

	return true;
}

c.checkTimeLoud = function(name, interval, user){
	if(this.checkTime(name, interval)){
		return true;
	}
	else{
		this.channel.client.whisper(user, this.channel, "A similar command has been triggered recently.");
		//this.channel.say(user['display-name'] + ": A similar command has been triggered recently.");
		return false;
	}
}

c.checkMod = function(user){
	return this.channel.isMod(user);
}

c.checkModLoud = function(user){
	if(this.checkMod(user)){
		return true;
	}
	else{
		this.channel.client.whisper(user, this.channel, "That is a mod only command.")
		//this.channel.say(user + ": That is a mod only command.");
		return false;
	}
}

c.checkGame = function(){
	var game = this.channel.getGame();
	if(!game){
		this.channel.say("Not currently playing any game.");
		return false;
	}
	else{
		return game;
	}
}

c.onCommand = function(user, command){
	//This is for actual modules to implement.
}
