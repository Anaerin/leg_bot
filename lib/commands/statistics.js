"use strict";

var CommandSet = require('./commandset.js');

var Models = require('../models.js');

var StatCommands = module.exports = function(channel){
	CommandSet.apply(this, arguments);

	this.statistics = {};

	this.statsTimeout = undefined;
	this.loadStatistics();
};

CommandSet.adopt(StatCommands);

var c = StatCommands.prototype;

c.loadStatistics = function(){
	var me = this;
	Models.Statistic
		.findAll({where: {ChannelId: this.channel.model.id}})
		.then(function(statistics){
			if(!statistics){
				return;
			}
			me.statistics = {};
			statistics.forEach(function(stat){
				me.statistics[stat.command] = stat;
			});
		});	
};

c.onCommand = function(user, command){
	//We determine what the command would be, if it references a stat
	var cmdFunk, match, statName, value;

	command = command.toLowerCase();

	//If we are asked for a list of stats we do that and stop looking for any other commands.
	if(command.match(/^stats$/i)){
		return this.sayStatList();
	}
    
    if (command.match(/^counter/i)) {
        var game;
        if (game = this.checkGame() && this.checkModLoud(user)) {
            if (command.match(/^counter +add/i)) {
                if (match = command.match(/^counter +add +(\w+) +(\w+) +(\w+)$/i)) {
                    if (this.statistics[match[1]]) {
                        this.channel.say("Counter " + match[1] + " already exists!");
                    } else {
                        Statistic.create({
                            command: match[1],
                            name: match[2],
                            plural: match[3]
                        }).then(function () {
                            this.channel.say("Counter " + match[1] + " added!");
                        });
                    }
                } else {
                    this.channel.say("Counter add usage: !counter add <command> <single> <plural>");
                }
            } else if (command.match(/^counter +remove/i)) {
                if (match = command.match(/^counter +remove +(\w+)$/i)) {
                    if (!this.statistics[match[1]) {
                        this.channel.say("There is no counter for the command " + match[1]);
                    } else {
                        this.statistics[match[1]].destroy();
                        this.channel.say("The counter " + match[1] + " has been removed.");
                    }
                }
            }
        }
    }

	if(match = command.match(/^(.*) ?count$/i)){
		cmdFunk = this.parrotStat.bind(this, user);
		statName = match[1];
	}
	else if(match = command.match(/^(.*) +set +(-?\d+)/i)){
		statName = match[1];
		var value = parseInt(match[2]);
		cmdFunk = this.setStat.bind(this, user, value);
	}
	else if(match = command.match(/^(.*) +(add|remove)( +-?\d+)?$/i)){
		statName = match[1];
		var value = parseInt(match[3]) || 1;

		if(match[2] == "remove"){
			value *= -1;
		}
		cmdFunk = this.modifyStat.bind(this, user, value);
	}
	else if(match = command.match(/^total ?(.*)$/i)){
		statName = match[1];
		cmdFunk = this.showTotalCount.bind(this);
	}
	else{
		cmdFunk = this.triggerStat.bind(this, user);
		statName = command;
	}

	if(cmdFunk instanceof Function && statName){
		var statistic = this.statistics[statName];
		if(statistic){
			cmdFunk(statistic);
		}
	}
};

c.sayStatList = function(){
	var statList = Object.keys(this.statistics).map(function(s){
		return "!" + s;
	});
	
	statList = statList.join(', ');

	this.channel.say("Statistics for this channel are: " + statList);
}

c.getCount = function(statistic, game){
	return Models.Count.findOrCreate({ where: { StatisticId: statistic.id, game: game } });
}

c.showTotalCount = function(statistic){
	if(!statistic){
		return;
	}
	//this.channel.say("This should say the total count for " + statistic.name);
	var promise = Models.Count.sum("value", {where: {StatisticId: statistic.id}});
	promise.then(this.sayTotalCount.bind(this, statistic));
}

c.sayTotalCount = function(statistic, value){
	if(value === null){
		value = 0;
	}
	var message = value + " total ";

	if(value == 1){
		message += statistic.name;
	}
	else{
		message += statistic.plural;
	}

	this.channel.say(message);
}

c.modifyStat = function(user, value, statistic){
	if(!statistic){
		return;
	}
	var game;
	if((game = this.checkGame()) && this.checkModLoud(user)){
		this.getCount(statistic, game)
			.then(this.doModifyStat.bind(this, statistic, game, value));
	}
}

c.doModifyStat = function(statistic, game, value, count){
	count[0].value += value;
	count[0].save();

	this.sayStatValue(statistic, game, count);
}

c.setStat = function(user, value, statistic){
	if(!statistic){
		return;
	}
	var game;
	if((game = this.checkGame()) && this.checkModLoud(user)){
		this.getCount(statistic, game)
			.then(this.doSetStat.bind(this, statistic, game, value));
	}
}

c.doSetStat = function(statistic, game, value, count){
	count[0].value = value;
	count[0].save();

	this.sayStatValue(statistic, game, count);
}

c.triggerStat = function(user, statistic){
	if(!statistic){
		return;
	}
	var game;
	if((game = this.checkGame()) && this.checkTimeLoud(statistic.name + "Trigger", 5, user)){
		this.getCount(statistic, game)
			.then(this.increaseStat.bind(this, statistic, game));
	}
}

c.increaseStat = function(statistic, game, count){
	count[0].value += 1;
	count[0].save();

	this.sayStatValue(statistic, game, count);
}

c.parrotStat = function(user, statistic){
	if(!statistic || !this.checkTime(statistic.name + "Parrot", 15)){
		return;
	}
	var game;
	if(game = this.checkGame()){
		this.getCount(statistic, game)
			.then(this.sayStatValue.bind(this, statistic, game));
	}
}

c.sayStatValue = function(statistic, game, count){
	var msg = "%value% %name% for %game%";

	if(count.value == 1){
		msg = msg.replace("%name%", statistic.name);
	}
	else{
		msg = msg.replace("%name%", statistic.plural);
	}

	msg = msg.replace("%value%", count[0].value);
	msg = msg.replace("%game%", game);

	this.channel.say(msg);
}
