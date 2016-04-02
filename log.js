"use strict";

var Winston = require('winston');

var WinstonChild = require('winston-child').WinstonChild;

var logLevel = require('./config.js').logging;

var w = module.exports = new Winston.Logger;

var options = {
	filename: './logs/legbot.log',
	silent: false,
	colorize: false,
	timestamp: true,
	json: false,
	handleExceptions: true,
	humanReadableUnhandledException: true,
	exitOnError: false
};

w.add(require('winston-daily-rotate-file'), options);
w.add(Winston.transports.Console, { level: logLevel.level, colorize: true, timestamp: true, handleExceptions: true, humanReadableUnhandledException: true, exitOnError: false });
