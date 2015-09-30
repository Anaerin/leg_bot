"use strict";

var models = require('../../lib/models.js');

var log = require('../../log.js');

var express = require('express');
var session = require('express-session');
var SequelizeStore = require('connect-session-sequelize')(session.Store);
var app = module.exports = new express.Router({ mergeParams: true });
app.use(session({
    secret: 'Advise me, histy!',
    store: new SequelizeStore({
        db: models.sequelize,
        expiration: 30 * 24 * 60 * 60 * 60 * 1000
    }),
    rolling: true,
    saveUninitialized: false,
    resave: true,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 60 * 1000
    }
}));

app.get('/$', showIndex);

function showIndex(req, res) {
    res.render('advice.jade', { title: "Advice" });
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
