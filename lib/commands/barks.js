"use strict";

var CommandSet = require('./commandset.js');

var Models = require('../models.js');

var log = require("../../log.js");

var BarkCommands = module.exports = function(channel){
    if (channel.model.active) {
        CommandSet.apply(this, arguments);
        this.barks = {};
		log.info("Loading Barks", channel.hashtag);
		this.loadBarks();
		channel.barks = this;
    }
};

CommandSet.adopt(BarkCommands);

var c = BarkCommands.prototype;

c.clearBarks = function () {
	for (var bark in this.barks) {
		if (this.barks.hasOwnProperty(bark)) {
			if (bark.timeout) {
				clearInterval(bark.timeout);
			}
		}
	}
}

c.startBark = function (bark) {
	var newBark = {};
	newBark.message = bark;
	newBark.channel = this.channel;
	newBark.from = this;
	newBark.interval = bark.interval;
	log.info("Starting bark", this.channel.hashtag, bark.command);
	newBark.doBark = function (user, ref) {
		if (!ref) ref = newBark;
		if (ref.from.barks[newBark.message.command]) {
			if (user) {
				if (newBark.message.modsOnly && newBark.from.checkModLoud(user)) {
					newBark.channel.say(newBark.message.message);
				} else if (!newBark.message.modsOnly) {
					newBark.channel.say(newBark.message.message);
				}
			} else {
				// No user. Being done from a timeout probably
				newBark.channel.say(newBark.message.message);
			}
		} else {
			// We don't exist anymore.
			clearTimeout(this);
			log.warn("Bark triggered when it doesn't exist", newBark.message.command);
		}
	}
	newBark.intervalBark = function () {
		log.info("Running Intervalbark", newBark.channel.hashtag, newBark.message.command, newBark.interval);
		if (newBark.timeout) {
			log.info("Bark has a timeout, clearing...", newBark.channel.hashtag, newBark.message.command, newBark.interval);
			clearTimeout(newBark.timeout);
			newBark.timeout = undefined;
		}
		log.info("Setting interval...", newBark.channel.hashtag, newBark.message.command, newBark.interval);
		newBark.timeout = setInterval(newBark.doBark, newBark.interval * 60 * 1000, null, newBark);
		newBark.doBark();
	}
	this.barks[bark.command] = newBark;
	if (bark.interval > 0) {
		log.info("Bark has interval, starting interval", this.channel.hashtag, newBark.message.command, newBark.interval);
		this.barks[newBark.message.command].intervalBark();
	} else {
		log.info("Bark has no interval", this.channel.hashtag, bark.command, bark.interval);
	}
}

c.loadBarks = function(){
    var me = this;
    for (var bark in this.barks) {
        if (this.barks.hasOwnProperty(bark)) {
            if (bark.timeout) {
                clearInterval(bark.timeout);
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
		log.info("Fetched barks", me.channel.hashtag);
		bark.forEach(me.startBark,me);
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
			}).then((bark) => {
				bark.save().then((bark) => {
					this.channel.whisper(this.user, "Bark " + bark.command + " added!");
					this.startBark(bark);
				});
			});
        }
    }
}

c.delBark = function (user, command) {
    if (this.checkModLoud(user)) {
        if (!this.barks[command]) {
			this.channel.whisper(user, "There is no bark for the command " + command);
			//this.channel.say("There is no bark for the command " + command);
        } else {
            var deadId = this.barks[command].message.id;
            if (this.barks[command].timeout) {
				log.info("Attempting to clear interval", command);
				clearInterval(this.barks[command].timeout);
			}
			if (deadId) {
				var me = this;
				Models.Bark.destroy({
					where: {
						id: deadId
					}
				}).then((numberDeleted) => {
					if (numberDeleted > 0) {
						delete me.barks[command];
						me.channel.whisper(user, "The bark " + command + " has been removed.");
					} else {
						me.channel.whisper(user, "There was a problem deleting " + command + ", id " + deadId);
					}
				});
			} else {
				this.channel.whisper(user, "Couldn't find ID to delete bark " + command);
			}
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
