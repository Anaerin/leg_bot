"use strict";

var models = require('../../lib/models.js');
var channelList = require('../../lib/channel.js').channels;

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
	dump.game = channel.getGame();

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

		stat.counts.forEach(parseCount.bind(null, stat));
	}

	function parseCount(statistic, count){
		if(count.game == dump.game){
			dump.counts[statistic.command] = count.value;
		}
	}

};

app.get('/:channel$', dumpChannelInfo);

app.get('/:channel/game', function(req, res){
	res.send(res.locals.channel.getGame());
})

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
})
