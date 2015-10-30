"use strict";

var CommandSet = require('./commandset.js');

var Models = require('../models.js');

var BarkCommands = module.exports = function(channel){
    if (channel.model.active) {
        CommandSet.apply(this, arguments);
        
        this.barks = {};
        
        this.loadBarks();
    }
};

CommandSet.adopt(BarkCommands);

var c = BarkCommands.prototype;

c.loadBarks = function(){
    var me = this;
    for (var bark in this.barks) {
        if (this.barks.hasOwnProperty(bark)) {
            if (bark.timeout) {
                clearTimeout(bark.timeout);
            }
        }
    }
	Models.Bark
	.findAll({where: {ChannelId: this.channel.model.id}})
	.then(function(bark){
		if(!bark){
			return;
		}
		me.barks = {};
		bark.forEach(function (message) {
            var newBark = {};
            newBark.message = message;
            newBark.channel = me.channel;
            newBark.from = me;
            newBark.doBark = function (user) {
                if (user) {
                    if (newBark.message.modsOnly && newBark.from.checkModLoud(user)) {
                        newBark.channel.say(message.message);
                    } else if (!newBark.message.modsOnly) {
                        newBark.channel.say(message.message);
                    }
                } else {
                    // No user. Being done from a timeout probably
                    newBark.channel.say(message.message);
                }
            }
            newBark.intervalBark = function () {
                if (newBark.timeout) {
                    clearTimeout(newBark.timeout);
                    newBark.timeout = undefined;
                }
                if (newBark.from.hasOwnProperty(newBark.message.command)) {
                    newBark.timeout = setTimeout(newBark.intervalBark, newBark.message.interval * 60 * 1000);
                    newBark.doBark();
                }
            }
            me.barks[message.command] = newBark;
            if (message.interval > 0) {
                me.barks[message.command].intervalBark();
            }
		});
	});	
};

c.onCommand = function (user, command) {
    //We determine what the command would be, if it references a stat
    var cmdFunk, match, barkName, value;
    
    //The regular expressions are all case insensitive, so no need to lowercase.
    //command = command.toLowerCase();
    
    //If we are asked for a list of barks we do that and stop looking for any other commands.
    if (command.match(/^barks$/i) || command.match(/^bark list$/i)) {
        return this.sayBarkList(user);
    }
    else if (command.match(/^bark help$/i)) {
        return this.helpBarks(user);
    }
    else if (match = command.match(/^bark +add +(\w+) +"(.+)" +(true|false) *(\d*)$/i)) {
        cmdFunk = this.addBark.bind(this, user, match[1], match[2], match[3], match[4] != ""?match[4]:0);
        barkName = true;
    }
    else if (match = command.match(/^bark +remove +(\w+)$/i)) {
        cmdFunk = this.delBark.bind(this, user, match[1]);
        barkName = match[1];
    }
	else{
		cmdFunk = this.triggerBark.bind(this, user);
        barkName = command;
	}

	if(cmdFunk instanceof Function && barkName){
		var bark = this.barks[barkName];
		if(bark || barkName === true){
			cmdFunk(bark);
		}
	}
};

c.addBark = function(user, command, message, isMod, timeout) {
    if (this.checkModLoud(user)) {
        if (this.barks[command]) {
            this.channel.whisper(user, "Bark " + command + " already exists!");
        } else {
			this.user = user;
			var newBark = Models.Bark.create({
                command: command.toString().toLowerCase(),
                message: message,
                modsOnly: isMod,
                interval: timeout,
                ChannelId: this.channel.model.id
            }).then(this.sayBarkAdded.bind(this, command));
        }
    }
}

c.sayBarkAdded = function (command) {
	this.loadBarks();
	this.channel.whisper(this.user, "Bark " + command + " added!");
    //this.channel.say("Bark " + command + " added!");
}

c.delBark = function (user, command) {
    if (this.checkModLoud(user)) {
        if (!this.barks[command]) {
			this.channel.whisper(user, "There is no bark for the command " + command);
			//this.channel.say("There is no bark for the command " + command);
        } else {
            var deadId = this.barks[command].message.id;
            if (this.barks[command].timeout) {
                clearTimeout(this.barks[command].timeout);
            }
            var me = this;
            this.barks[command].message.destroy().then(function () {
                me.channel.whisper(user, "The bark " + command + " has been removed.");
                //this.channel.say("The bark " + command + " has been removed.");
                me.loadBarks();
            });
        }
    }
}

c.sayBarkList = function(user){
	var barkList = Object.keys(this.barks).map(function(s){
		return "!" + s;
	});
	
	barkList = barkList.join(', ');

	
	this.channel.whisper(user, "Barks for this channel are: " + barkList);
	//this.channel.say("Barks for this channel are: " + barkList);
}

c.helpBarks = function (user) {
    if (this.checkModLoud(user)) {
		this.channel.whisper(user, 'Usage: !bark add <command> "<message>" <mod only (true/false)> [interval (optional, in minutes)], !bark remove <command>, !bark list');
		//this.channel.say('Usage: !bark add <command> "<message>" <mod only (true/false)> [interval (optional, in minutes)], !bark remove <command>, !bark list');
    }
}

c.triggerBark = function(user, bark){
	if(!bark){
		return;
	}
    bark.doBark(user);
}
