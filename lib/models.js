"use strict";

//We initialize Sequelize.js here and define the models that leg_bot uses.

var Sequelize = require('sequelize');
var config = require('../config.js').db;
var log = require('../log.js');

var logFilter = function(logLine){
	logLine = logLine + "";

	if(logLine.match(/SELECT/) || logLine.match(/PRAGMA/) || logLine.match(/CREATE/) || logLine.match(/START TRANSACTION/) || logLine.match(/SET/) || logLine.match(/COMMIT/)){
		log.debug(logLine);
	}
	else{
		log.info(logLine);
	}
};

switch (config.DBType) {
    case 'mysql':
        var options = {
            dialect: 'mysql',
            host: config.DBHost,
            logging: logFilter
        }
        var sequelize = module.exports.sequelize = new Sequelize(config.DBName, config.DBUsername, config.DBPassword, options);
        break;
    default:
        var options = {
            dialect: 'sqlite',
            storage: config.file,
            logging: logFilter
        }
        var sequelize = module.exports.sequelize = new Sequelize('', '', '', options);
        break;
}

sequelize.authenticate();

//These are default options that all models get.
//Right now, we just disable the timestamping that sequelize does.
var options = {
	timestamps: false
}

//This is the type rule for every place we store a command
var commandType = {
	type: Sequelize.STRING(32),
	allowNull: false,
	validate: {
		isAlpha: true
	}
}

var AntiSpamRules = module.exports.AntiSpamRules= sequelize.define('AntiSpamRules', {
    name: {
        type: Sequelize.STRING(32),
        unique: true
    },
    regularExpression: Sequelize.TEXT,
    count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        validate: {
            isInt: true
        }
    }
}, options);

//Channels are the twitch/IRC channels we join
var Channel = module.exports.Channel = sequelize.define('Channels', {
	name: Sequelize.STRING(25),
    active: Sequelize.BOOLEAN,
}, {
	timestamps: false,
});

//Modules are different sets of commands that channels can have.
var Module = module.exports.Module = sequelize.define('Modules', {
	name: Sequelize.STRING(32),
	active: Sequelize.BOOLEAN
}, options);

//Module.hasMany(Channel);
Channel.hasMany(Module);

//Replies are simple call and response answers
var Reply = module.exports.Reply = sequelize.define('Replies', {
	command: commandType,
	reply: Sequelize.STRING(255),
}, options);

Channel.hasMany(Reply);


//Statistics are things the bot will count for a channel.
//Think !death !flunge or !warcrime
var Statistic = module.exports.Statistic = sequelize.define('Statistics', {
	command: commandType, 
	name: Sequelize.STRING(64),
	plural: Sequelize.STRING(64),	
}, options);

Channel.hasMany(Statistic);

//Counts are actual instances of a channel counting a thing.
var Count = module.exports.Count = sequelize.define('Counts', {
	game: Sequelize.STRING(255),
	value: {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		validate: {
			isInt: true,
		},
	},
}, options);

Statistic.hasMany(Count);

//Advices are global responses to the advice command that any mod on any channel can add.
var Advice = module.exports.Advice= sequelize.define('Advices', {
	game: Sequelize.STRING(255),
	author: Sequelize.STRING(25),
    content: Sequelize.STRING(512),
    score: Sequelize.INTEGER
}, options);

Channel.hasMany(Advice);

var Bark = module.exports.Bark = sequelize.define('Barks', {
    command: commandType,
    message: Sequelize.STRING(500),
    modsOnly:{
        type: Sequelize.BOOLEAN,
        defaultValue: true
    },
    interval: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        validate: {
            isInt: true
        }
    }
}, options);

Channel.hasMany(Bark);

var LastSeen = module.exports.LastSeen= sequelize.define('LastSeen', {
    name: {
        type: Sequelize.STRING(64),
        validate: {
            notEmpty: true
        }
    },
    dateTimeSeen: Sequelize.DATE
}, options);

LastSeen.belongsTo(Channel);

sequelize.sync();