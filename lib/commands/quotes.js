"use strict";

var SimpleCommands = require('./simple_commands.js');
var Sequelize = require('sequelize');
var models = require('../models.js');
var Quote = models.Quote;
var dbType = require('../../config.js').db.DBType;
var DBRandom = models.sequelize.fn('RAND');
if (dbType == "sqlite") {
	DBRandom = models.sequelize.fn('RANDOM');
}
var QuoteModule = module.exports = function(channel){
	SimpleCommands.call(this, channel);
};

var loadTimeout;

SimpleCommands.adopt(QuoteModule);

var c = QuoteModule.prototype;

c.sayQuote = function (quote, me) {
	if (quote) {
		var date = new Date(quote.when);
		var output = "Quote #" + quote.id + ": \"" + quote.quote + "\" -" + quote.author + " [" + date.getUTCFullYear() + "-" + ("00" + (date.getUTCMonth() + 1)).substr(-2) + "-" + ("00" + date.getUTCDate()).substr(-2) + "]";
		if (quote.game != "") {
			output += ", during " + quote.game;
		}
		output += " in channel " + quote.Channel.name;
		this.channel.say(output);
	} else {
		this.channel.say("Couldn't find quote");
	}
}

c.pickAndSayRandom = function (){
	var me = this;
	Quote.findOne({
		where: {
			active: true
		},
		order: [
			[DBRandom]
		],
		include: [models.Channel]
	}).then(this.sayQuote.bind(me)).catch(function (e) { 
		me.channel.say("Error fetching quote: " + e.message);
	});
}

c.commands = {
	'quote': {
		time: 30,
		timeLoud: false,
		regex: /^quote$/i,
		method: function(match, user, message){
			this.pickAndSayRandom();
		}
	},

	'quote count':{
		time: 30,
		timeLoud: false,
		regex: /^quote ?count$/i,
		method: function(match, user, message){
			var me = this;
			Quote.count({ where: { active: true } }).then(function (c) {
				me.channel.say("There are " + c + " quotes available");
			});
		}
	},
	'quote number': {
		time: 30,
		timeLoud: false,
		regex: /^quote (\d+)$/i,
		method: function(match, user, message){
			var me = this;
			Quote.findOne({
				where: {
					id: match[1]
				}, 
				include: [{
						model: models.Channel
					}]
			}).catch(function () { 
				me.channel.say("Unable to find quote #" + match[1]);
			}).then(me.sayQuote.bind(me));
		}
	},
	'quote by text': {
		time: 30,
		timeLoud: false,
		regex: /^quote bytext (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			Quote.findOne({
				where: {
					quote: {
						$like: '%' + match[1] + '%'
					}
				},
				order: [[DBRandom]],
				include: [{
						model: models.Channel
					}]
			}).then(me.sayQuote.bind(me)).catch(function () { 
				me.channel.say("Unable to find a quote matching " + match[1]);
			});
		}
	},
	'quote by author': {
		time: 30,
		timeLoud: false,
		regex: /^quote byauthor (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			Quote.findOne({
				where: {
					author: {
						$like: '%' + match[1] + '%'
					}
				},
				order: [[DBRandom]],
				include: [{
						model: models.Channel
					}]
			}).then(me.sayQuote.bind(me)).catch(function () { 
				me.channel.say("Unable to find a quote for user " + match[1]);
			});
		}
	},
	'quote by game': {
		time: 30,
		timeLoud: false,
		regex: /^quote bygame (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			Quote.findOne({
				where: {
					game: {
						$like: '%' + match[1] + '%'
					}
				},
				order: [[DBRandom]],
				include: [{
						model: models.Channel
					}]
			}).then(me.sayQuote.bind(me)).catch(function () {
				me.channel.say("Unable to find a quote for game " + match[1]);
			});
		}
	},
	'quote by channel': {
		time: 30,
		timeLoud: false,
		regex: /^quote bychannel (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			Quote.findOne({
				order: [[DBRandom]],
				include: [{
						model: models.Channel,
						where: {
							name: {
							$like: '%' + match[1] + '%'
							}
						}
					}]
			}).then(me.sayQuote.bind(me)).catch(function () {
				me.channel.say("Unable to find a quote from channel " + match[1]);
			});
		}
	},
	'quote by date': {
		time: 30,
		timeLoud: false,
		regex: /^quote bydate (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			var newDate = new Date(Date.parse(match[1]));
			var d = newDate.getUTCFullYear() + "-" + ("00" + (newDate.getUTCMonth() + 1)).substr(-2) + "-" + ("00" + newDate.getUTCDate()).substr(-2)
			Quote.findOne({
				where: {
					when: {
						$between: [ d + " 00:00:00", d + " 23:59:59"]
					}
				},
				order: [[DBRandom]],
				include: [{
						model: models.Channel
					}]
			}).catch(function () {
				me.channel.say('Unable to find a quote from ' + d);
			}).then(me.sayQuote.bind(me));
		}
	},
	'quote add': {
		time: 60,
		timeLoud: true,
		regex: /^quote add +(\w.*?)(?:\s?\((.*?)\))?(?:\s?\[(.*?)\])?$/i,
		modOnly: true,
		method: function(match, user, message){
			var game = this.channel.getGame();
			if (!game) game = "";
			var me = this;
			var quote = match[1];
			var author = match[2];
			if (!author || author == "") {
				if (user['display-name'])
					author = user['display-name'];
				else author = user;
			};
			var date = match[3];
			if (!date || date.toLowerCase() == "now") date = new Date();
			Quote.create({
				game: game,
				author: author,
				when: date,
				quote: quote,
				ChannelId: this.channel.model.id
			}).then(function (newQuote) {
				me.channel.say("Quote created with ID #" + newQuote.id);
			})
		}
	},
	'quote mod': {
		time: 60,
		timeLoud: true,
		regex: /^quote mod +(\d+) (\w.*?)(?:\s?\((.*?)\))?(?:\s?\[(.*?)\])?$/i,
		modOnly: true,
		method: function (match, user, message) {
			var game = this.channel.getGame();
			var me = this;
			var quoteId = match[1];
			var quote = match[2];
			var author = match[3];
			var date = match[4];
			Quote.findById(quoteId).then(function (foundQuote) {
				foundQuote.quote = quote;
				if (author != "") foundQuote.author = author;
				if (date != "") {
					if (date.toLowerCase() == "now") date = new Date();
					foundQuote.when = date;
				}
				foundQuote.save().then(function () {
					me.channel.say("Updated quote #" + quoteId);
				});
			}).catch(function () {
				me.channel.say("Unable to find quote #" + quoteId);
			});
		}
	},
	'quote del': {
		time: 60,
		timeLoud: true,
		regex: /^quote del +(\d+)$/i,
		modOnly: true,
		method: function (match, user, message) {
			var game = this.checkGame(user);
			var me = this;
			var quoteId = match[1];
			Quote.findById(quoteId).then(function (foundQuote) {
				return foundQuote.destroy();
			}).then(function () { 
				me.channel.say("Removed quote #" + match[1]);
			}).catch(function () {
				me.channel.say("Unable to find quote #" + quoteId);
			});
		}
	},
	'quote search': {
		time: 30,
		timeLoud: false,
		regex: /^quote (.+)$/i,
		method: function (match, user, message) {
			var me = this;
			Quote.findOne( {
			where: {
					$or: [
						{
							quote: {
								$like: '%' + match[1] + '%'
							}
						}, {
							author: {
								$like: '%' + match[1] + '%'
							}
						}, {
							game: {
								$like: '%' + match[1] + '%'
							}
						}
				]},
			order: [[DBRandom]],
			include: [{
					model: models.Channel
				}]
			}).then(me.sayQuote.bind(me)).catch(function () { 
				me.channel.say("Unable to find any quote matching " + match[1]);
			});
		}
	}
}
