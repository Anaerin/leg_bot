"use strict";

var Winston = require('winston');

var logLevel = require('./config.js').logging;

var w = module.exports = new Winston.Logger;

var options = {
	filename: './logs/legbot.log',
	silent: false,
	colorize: false,
	timestamp: true,
	json: false,
};

w.add(Winston.transports.DailyRotateFile, options);
w.add(Winston.transports.Console, { level: logLevel.level, colorize: true, timestamp: true });
