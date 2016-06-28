"use strict";
var models = require('../../lib/models.js');

var log = require('../../log.js');

var express = require('express');
var app = module.exports = new express.Router({ mergeParams: true });

function outputResults(res, req) {
    var myRes = res;
    var myReq = req;
	models.Quote.findAll( { include: [ models.Channel ], where: { active: true } } )
    .then(function (quotes) {
        var res = myRes;
        var req = myReq;
        var output = [];
        quotes.forEach(function (quote) {
            var item = {};
            item['author'] = quote.author;
            item['game'] = quote.game;
            item['quote'] = quote.quote;
			item['channel'] = quote.Channel.name;
            item['id'] = quote.id;
            output.push(item);
        });
        res.send(JSON.stringify(output));
    });
}

app.get('/', function (req, res) {
    //res.send(JSON.stringify(twitch.getData()));
    log.info("Got a request for qdb...");
    outputResults(res, req);
});