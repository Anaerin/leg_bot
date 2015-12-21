"use strict";

var models = require('../../lib/models.js');
var channelList = require('../../lib/channel.js').channels;

var log = require('../../log.js');

var express = require('express');
var app = module.exports = new express();
var websockets = require("express-ws")(app);
var fs = require('fs');

function attachChannel(ws, req, next) {
    log.info("Got Websocket");
    var channel = channelList[req.params.channel];
    if (!channel) {
        ws.status(404).send("No such channel");
    }
    else {
        req.testing = 'test';
        ws.locals.channel = channel;
        ws.on('close', function () {
            var which = this.locals.channel.websockets.indexOf(this);
            this.locals.channel.websockets.splice(which, 1);
        });
        ws.on('message', function () {
            //We don't care;
        });
        channel.websockets.push(ws);
    }
    log.info("Set up socket. Moving on.");
    next();
};

app.ws('/ws/:channel$', attachChannel);

function dumpChannelInfo(req, res) {
    var dump = {};
    var channel = channelList[req.params.channel];;

    var html = fs.readFile('./web/websocket/wsreceiver.htm', 'utf8', function (err, htm) {
        if (err) {
            throw (err);
        };
        res.send(htm.replace('%channelname%', req.params.channel));
    })
};

app.get('/ws/:channel$', dumpChannelInfo);