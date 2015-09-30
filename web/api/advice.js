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

app.post('/:id/:vote', function (req, res) {
    var myRes = res;
    var myReq = req
    models.Advice.findById(req.params.id)
    .then(function (advice) {
        var res = myRes;
        var req = myReq;
        if (req.session && req.session.votes && req.session.votes.hasOwnProperty(req.params.id)) {
            advice.decrement({ score: req.session.votes[req.params.id] }).then(function (advice) {
                req.session.votes[req.params.id] = 0;
                changeScore(advice, myRes, myReq);
            });
        } else {
            changeScore(advice, res, req);
        }
    })
})

function changeScore(advice, res, req) {
    if (!req.session.votes) {
        req.session.votes = {};
    }
    req.session.votes[req.params.id] = req.params.vote;
    var myRes = res;
    var myReq = req;
    advice.increment({ score: req.params.vote }).then(function (advice) {
        outputResults(myRes, myReq);
    });
}

function outputResults(res, req) {
    var myRes = res;
    var myReq = req;
    models.sequelize.query('SELECT Advices.id, author, game, content, Channels.name, score FROM Advices INNER JOIN Channels ON Advices.ChannelId = Channels.id', { type: models.sequelize.QueryTypes.SELECT })
    .then(function (advices) {
        var res = myRes;
        var req = myReq;
        var output = [];
        advices.forEach(function (advice) {
            var item = {};
            item['author'] = advice.author;
            item['game'] = advice.game;
            item['advice'] = advice.content;
            item['channel'] = advice.name
            item['id'] = advice.id;
            item['score'] = advice.score;
            if (req.session && req.session.votes && req.session.votes.hasOwnProperty(advice.id)) {
                item['vote'] = req.session.votes[advice.id];
            } else {
                item['vote'] = 0;
            }
            output.push(item);
        });
        res.send(JSON.stringify(output));
    });
}

app.get('/', function (req, res) {
    //res.send(JSON.stringify(twitch.getData()));
    outputResults(res, req);
});