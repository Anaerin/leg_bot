var express = require('express');
var twitch = require('../../lib/twitch.js');
var mw = module.exports = new express.Router({mergeParams: true});
mw.get('/', (req, res) => {
	if (req.query.code) {
		twitch.receivedCode(req.query.code);
		res.redirect('/');
	} else {
		res.sendStatus(400,"Bad Request - No oAuth code present");
	}
});