"use strict";

var express = require('express');

var mw = module.exports = new express.Router({mergeParams: true});

require('./live.js')(mw);

mw.use('/stats', require('./stats.js'));
mw.use('/advice', require('./advice.js'));
mw.use('/qdb', require('./qdb.js'));
mw.get('^/$', function(req, res){
	res.render('index.jade');
});




