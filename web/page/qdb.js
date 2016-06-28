"use strict";

var models = require('../../lib/models.js');

var log = require('../../log.js');

var express = require('express');
var app = module.exports = new express.Router({ mergeParams: true });
app.get('/$', showIndex);

function showIndex(req, res) {
    res.render('qdb.jade', { title: "Quote Database" });
}
