"use strict";

var express = require('express');

var mw = module.exports = new express.Router({mergeParams: true});

require('./live.js')(mw);

mw.use(function(req, res, next) {
	  res.header("Access-Control-Allow-Origin", "*");
	    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		  next();
});

mw.use('/channel', require('./channel.js'));
mw.use('/advice', require('./advice.js'));

mw.get('/', function(req, res){
	res.send("Only scrubs skip API params.");
});
