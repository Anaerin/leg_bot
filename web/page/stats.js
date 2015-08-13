"use strict";

var models = require('../../lib/models.js');

var channels = {};

models.Channel
		.findAll({where: ["active"]})
		.then(function(models){
			models.forEach(function(model){
				var name = model.name;
				channels[name] = model;
			});
		});

module.exports = function(mw){
	
	mw.get('/stats/:channel', function(req, res){
		var channel = channels[req.params.channel];

		if(!channel){
			return res.send("No Such Channel");
		}

		var statInfos = {};
		var statNames = [];
		var counts = {};

		channel.getStatistics({include: models.Count}).then(function(stats){
			stats.forEach(parseStatistic);
			res.send(JSON.stringify(statistics));
		});

		function parseStatistic(stat){
			var command = stat.command;
			statNames.push(command);
			statInfos[command] = stat;

			stat
		}

		function parseCount(command){

		}
	});
}

var buildStatsData = function(channel){

};
