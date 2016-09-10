"use strict";

var globalConfig = require('../../config.js');

var models = require('../../lib/models.js');
var channelList = require('../../lib/channel.js').channels;

var log = require('../../log.js');

var settings = require('../../lib/settings.js');

var express = require('express');
var app = module.exports = new express.Router({mergeParams: true});

function attachChannel(req, res, next){
	var channel = channelList[req.params.channel];

	res.locals.channel = channel

	if(!channel){
		res.status(404).send("No such channel");
	}
	else{
		next();
	}
};

app.get('/:channel*', attachChannel);

function dumpChannelInfo(req, res){
	var dump = {};
	var channel = res.locals.channel;

	dump.name = channel.model.name;
	dump.game = res.locals.game || channel.getGame() || "";
    
    var queryParams = {
		include: models.Count,
	}

	channel.model.getStatistics(queryParams).then(function(statistics){

		dump.statistics = [];
		dump.counts = {};
		statistics.forEach(parseStat);

		res.send(dump);
	});

	function parseStat(stat){
		dump.statistics.push(stat.command);
		dump.counts[stat.command] = 0;
		stat.Counts.forEach(parseCount.bind(null, stat));
	}

	function parseCount(statistic, count){
		if(count.game.toLowerCase() == dump.game.toLowerCase()){
            dump.counts[statistic.command] = count.value;
		}
	}

};

app.get('/:channel$', dumpChannelInfo);

app.get('/:channel/game', function(req, res){
	res.send(res.locals.channel.getGame());
})

app.get('/:channel/games', function(req, res){
	var channel = res.locals.channel;

	var dump = [];

	var games = {};

	var queryParams = {
		include: models.Count,
	}

	channel.model.getStatistics(queryParams).then(function(statistics){
		statistics.forEach(parseStat);
		dump = Object.keys(games);
		res.send(dump);
	});

	function parseStat(stat){
        stat.Counts.forEach(parseCount.bind(null, stat));
	}

    function parseCount(statistic, count){
		games[count.game] = true;
	}
});

app.get('/:channel/stat/:stat', function(req, res){

	var channel = res.locals.channel;

	var game = channel.getGame();

	var queryParams = {
		where: {
			ChannelId: channel.model.id,
			command: req.params.stat
		}
	}

	models.Statistic.find(queryParams)
	.then(function(stat){
		if(!stat){
			return res.status(404).send("No such statistic");
		}
		
		queryParams = {
			where: {
				game: game,
				StatisticId: stat.id
			}
		}
		
		return models.Count
		.find(queryParams)
		.then(function(count){
			if(count){
				res.send(count.value + "");
			}
			else{
				res.send(0 + "");
			}
		});
	})
});

app.get('/:channel/counts', function(req, res){

	var channel = res.locals.channel;

	var queryParams = {
		where: {
			ChannelId: channel.model.id,
		},
		include: models.Count
	}

	var dump = {};

	models.Statistic.findAll(queryParams)
	.then(function(stats){
	
		stats.forEach(function(stat){
			var statDump = dump[stat.command] = {};
			statDump.command = stat.command;
			statDump.name = stat.name;
			statDump.plural = stat.plural;

			var statGames = statDump.games = {};

			stat.Counts.forEach(function(count){
				statGames[count.game] = count.value;
			});
		});

		res.send(JSON.stringify(dump));
	})
});

app.get('/:channel/game/:game', function(req, res){
	res.locals.game = req.params.game;
	return dumpChannelInfo(req, res);
});

app.get('/:channel/bark/:bark', function (req, res) {
	var channel = res.locals.channel;
	if (channel.barks.barks[req.params.bark]) {
		channel.barks.barks[req.params.bark].doBark({ username: settings.user_name });
		res.send("OK");
	} else {
		res.send("Error");
	}
});