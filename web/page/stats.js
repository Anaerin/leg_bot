"use strict";

var models = require('../../lib/models.js');
var channelList = require('../../lib/channel.js').channels;

var log = require('../../log.js');

var express = require('express');
var app = module.exports = new express.Router({ mergeParams: true });

app.get('/$', showIndex);

function showIndex(req, res) {
    res.render('stats.jade', { title: "Statistics" });
}

app.get('/Games$', listGames);

function listGames(req, res) {
    var output = [];
    models.sequelize.query("SELECT game, SUM(value) AS count_value FROM counts GROUP BY game", { type: models.sequelize.QueryTypes.SELECT })
	.then(function (counts) {
        counts.forEach(function (count) {
            output.push({ stat: count.game, url: escape(count.game), value: count.count_value });
        });
        res.render('statsListing.jade', { stats: output, subpage: 'game', title: "Statistics by Game" });
    });

}

app.get('/Channels$', listChannels);

function listChannels(req, res) {
	var output = [];
    models.sequelize.query("SELECT Channels.name, count(Statistics.id) AS StatsCount FROM Statistics INNER JOIN Channels ON Statistics.ChannelId = channels.id GROUP BY ChannelId", { type: models.sequelize.QueryTypes.SELECT })
	.then(function (channels) {
        channels.forEach(function (channel) {
            output.push({ stat: channel.name, url: escape(channel.name), value: channel.StatsCount });
        });
        res.render('statsListing.jade', { stats: output, subpage: 'channel', title: "Statistics by Channel" });
	});
}

app.get('/game/:game*', attachGame);
function attachGame(req, res, next) {
    var Game = req.params.game;
    models.Count.findOne({ where: { game: Game } })
    .then(function (counts) {
        if (counts) {
            res.locals.game = Game
            next();
        } else {
            res.status(404).send("Cannot find game");
        }
    });
}

app.get('/game/:game$', listGameStats);
function listGameStats(req, res) {
    //res.send("Nothing yet");
    var game = req.params.game;
    var output = [];
    var players = [];
    models.sequelize.query('SELECT Statistics.name, Statistics.plural, SUM(Counts.value) AS CountValue FROM Counts INNER JOIN Statistics ON Counts.StatisticId = Statistics.id WHERE Counts.game = :game GROUP BY Counts.game, Statistics.command', { type: models.sequelize.QueryTypes.SELECT, replacements: { game: game } })
    .then(function (statistics) {
        statistics.forEach(function (stat) {
            output.push({ countValue: stat.CountValue, single: stat.name, plural: stat.plural });
        });
        models.sequelize.query('SELECT Channels.name FROM Channels INNER JOIN Statistics ON Channels.id = Statistics.ChannelId INNER JOIN Counts ON Counts.StatisticId = Statistics.id WHERE Counts.game = :game GROUP BY Channels.name', { type: models.sequelize.QueryTypes.SELECT, replacements: { game: game } })
        .then(function (users) {
            users.forEach(function (user) {
                players.push(user.name);
            });
            res.render('statsGame.jade', { stats: output, players: players, title: "Statistics for " + game, name: game });
        })
        
    });
}

app.get('/channel/:channel*', attachChannel);
function attachChannel(req, res, next) {
	var channel = channelList[req.params.channel];
	
	res.locals.channel = channel
	
	if (!channel) {
		res.status(404).send("No such channel");
	}
	else {
        next();
	}
};

app.get('/channel/:channel$', listChannelStats);
function listChannelStats(req, res) {
    var stats = [];
    var statsIDs = [];
    var gameNames = [];
    var channel = res.locals.channel;
    models.sequelize.query("SELECT Statistics.name, Statistics.plural, Statistics.command, SUM(Counts.value) AS CountValue, Statistics.id FROM Statistics INNER JOIN Counts ON Counts.StatisticId = Statistics.id WHERE Statistics.ChannelId = :id GROUP BY Statistics.name", { replacements: { id: channel.model.id }, type: models.sequelize.QueryTypes.SELECT })
    .then(function (statistics) {
        for (var i=0;i<statistics.length;i++) {
        var stat = statistics[i];
            statsIDs.push(stat.id);
            if (stat.CountValue == 1) {
                stats.push({ stat: stat.name, url: escape(stat.command), value: stat.CountValue });
            } else {
                stats.push({ stat: stat.plural, url: escape(stat.command), value: stat.CountValue });
            }
        }
        models.Count.findAll({ where: { StatisticId: { $in: statsIDs } }, group: ['game'] })
            .then(function (counts) {
            counts.forEach(function (count) {
                gameNames.push({ game: count.game, url: escape(count.game) });
            })
            res.render('statsChannel.jade', { stats: stats, title: "Statistics for " + channel.model.name, name: channel.model.name, games: gameNames })
        });
    });
}

app.get('/channel/:channel/count/:command$', listChannelStat);
function listChannelStat(req, res) {
    var output = [];
    var channel = res.locals.channel;
    models.Statistic.findOne({ where: { ChannelId: channel.model.id, command: req.params.command } })
    .then(function (statistics) {
        models.Count.findAll({ where: { StatisticId: statistics.id } })
        .then(function (counts) {
            counts.forEach(function (count) {
                output.push({ game: count.game, total: count.value });
            });
            res.render('statsChannelCommand.jade', { stats: output, name: channel.model.name, command: req.params.command, single: statistics.name, plural: statistics.plural });
        });
    });
}

app.get('/channel/:channel/game/:game$', listChannelGameStats);
function listChannelGameStats(req, res) {
    var output = [];
    var channel = res.locals.channel;
    var game = req.params.game;
    models.sequelize.query("SELECT Statistics.command, Statistics.name, Statistics.plural, Counts.value AS total FROM Counts INNER JOIN Statistics ON Counts.StatisticId = Statistics.id WHERE Counts.game = :game AND Statistics.ChannelId = :id", { type: models.sequelize.QueryTypes.SELECT, replacements: { game: game, id: channel.model.id } })
    .then(function (counts) {
        counts.forEach(function (count) {
            output.push({ command: count.command, single: count.name, plural: count.plural, total: count.total });
        });
        res.render('statsChannelGame.jade', { stats: output, name: channel.model.name, game: game });
    })
}