"use strict";

var inherits = require('util').inherits;

//This is for simple modules that implement a static commandset
var CommandSet = require('./commandset.js');

var SimpleCommands = module.exports = function(channel){
	CommandSet.call(this, channel);	
}

CommandSet.adopt(SimpleCommands);

SimpleCommands.adopt = function(constructor){
	inherits(constructor, SimpleCommands);
};

var sc = SimpleCommands.prototype;

sc.onCommand = function(user, command){
	if(!this.commands){
		return;
	}

	var keys = Object.keys(this.commands);

	var i, l;

	var name, command;

	for(i=0, l=keys.length; i<l; i++){
		name = keys[i];
		if(this.checkCommand(name, user, command)){
			break;
		}
	}
};

sc.onWhisper = function (user, command) {
    if (!this.whisperCommands) {
        return;
    }
    var keys = Object.keys(this.whisperCommands);
    
    var i, l;
    
    var name, command;
    
    for (i = 0, l = keys.length; i < l; i++) {
        name = keys[i];
        if (this.checkWhisper(name, user, command)) {
            break;
        }
    }

}

sc.checkCommand = function(name, user, command){
	var def = this.commands[name];

	if(!def){
		return false;
	}

	var match = (def.regex instanceof RegExp) && command.match(def.regex);
	if(!match){
		return false;
	}

	//At this point we know that this is probably the command triggered
	//Now we check if it can be actually called.

	if(def.modOnly && !this.checkModLoud(user)){
		return true;
	}

	if(def.gameNeeded && !this.checkGame(user)){
		return true;
	}

	var time = def.time;
	var timeLoud = def.timeLoud;
	if(timeLoud && !this.checkTimeLoud(name, time, user)){
		return true;
	}
	else if(!timeLoud && !this.checkTime(name, time)){
		return true;
	}

	def.method.call(this, match, user, command);

	return true;
}

sc.checkWhisper = function (name, user, command) {
    var def = this.whisperCommands[name];
    
    if (!def) {
        return false;
    }
    
    var match = (def.regex instanceof RegExp) && command.match(def.regex);
    if (!match) {
        return false;
    }
    
    //At this point we know that this is probably the command triggered
    //Now we check if it can be actually called.
    
    var time = def.time;
    var timeLoud = def.timeLoud;
    if (timeLoud && !this.checkTimeLoud(name, time, user)) {
        return true;
    }
    else if (!timeLoud && !this.checkTime(name, time)) {
        return true;
    }
    
    def.method.call(this, match, user, command);
    
    return true;
}