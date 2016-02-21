"use strict";

var express = require("express");
var expressWs = require("express-ws");
var config = require("../config.js").web;

var expressWs = expressWs(express());
var app = expressWs.app;

var jade = require('jade');
app.engine('jade', jade.__express);
app.set('views', './web/views');

var compression = require('compression');
app.use(compression());

var models = require('../lib/models.js');
var channelList = require('../lib/channel.js').channels;

var log = require('../log.js');

var fs = require('fs');

app.use('/api', require('./api'));

var serveStatic = require('serve-static');
app.use('/static', serveStatic('./web/static'));

app.use('/', require('./page'));

/*
 * 
 * Express-WS is good, but it doesn't support routers properly. Ergo, this needs to go here.
 * Good job it's simple.
 * 
 * */

function attachWebsocket(ws, req, next) {
    log.info("Got Websocket");
    var channel = req.channel;
    if (!channel) {
        log.warn("Unable to find channel " + req.channelName);
        ws.send("Unable to find channel " + req.channelName);
        ws.close();
    } else {
        log.info("Got channel " + req.channelName);
        ws.channel = channel;
        log.info("Set ws.channel");
        ws.on('close', function () {
            var which = this.channel.websockets.indexOf(this);
            this.channel.websockets.splice(which, 1);
        });
        log.info("onClose set");
        channel.websockets.push(ws);
        log.info("channel.websockets is now " + JSON.stringify(channel.websockets));
    }
    log.info("Set up socket. Moving on.");
    next();
};

app.param('channel', function (req, res, next, channel) {
    req.channelName = channel;
    req.channel = channelList[channel];
    return next();
})
app.ws('/ws/:channel', attachWebsocket);

function websocketTest(req, res) {
    var dump = {};
    var channel = channelList[req.params.channel];;
    
    var html = fs.readFile('./web/websocket/wsreceiver.htm', 'utf8', function (err, htm) {
        if (err) {
            throw (err);
        };
        res.send(htm.replace('%channelname%', req.params.channel));
    })
};

app.get('/ws/:channel', websocketTest);

var server = app.listen(config.port);
