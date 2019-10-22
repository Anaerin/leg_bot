"use strict";

var SimpleCommands = require('./simple_commands.js');

var models = require('../models.js');
var Advice = models.Advice;

var AdviceModule = module.exports = function(channel){
	SimpleCommands.call(this, channel);

	this.lastAdvice = undefined;
};

var advices = [];

var loadTimeout;

var loadAdvices = function () {
    if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = undefined;
    }
    Advice.findAll({ where: {
            score: {
                [models.Op.gt]: 0
            }
        }}).
    then(function (adv){
		advices = adv;
	});

	loadTimeout = setTimeout(loadAdvices, 4 * 60 * 1000);
}

loadAdvices();

SimpleCommands.adopt(AdviceModule);

var c = AdviceModule.prototype;

c.pickAndSayRandom = function(){
	if(advices.length == 0){
		return;
	}
	var index = Math.floor(Math.random() * advices.length);
	var advice = this.lastAdvice = advices[index];
	advice = advice.content;

	this.channel.say(advice);
}

c.commands = {
	'advice': {
		time: 30,
		regex: /^advice$/i,
		method: function(match, user, message){
			this.pickAndSayRandom();
		}
	},

	'sir': {
		time: 30,
		regex: /^sir$/i,
		method: function(match, user, message){
			if(advices.length == 0){
				return;
			}
			this.lastAdvice = "!sir and !tradition are dead; long live !sir and !tradition";
			this.channel.say("Sir? Sir! Desert bus is over.");
		}
	},

	'tradition': {
		time: 30,
		regex: /^tradition$/i,
		method: function(match, user, message){
			//original idea by Compleatly in LRL chat.
			if(advices.length == 0){
				return;
			}
			this.lastAdvice = "!sir and !tradition are dead; long live !sir and !tradition";
			this.channel.say("Old memes die, replaced by new ones - as is tradition!");

		}
	},

	'advice count':{
		time: 30,
		regex: /^advice ?count$/i,
		method: function(match, user, message){
			var msg = "There are %count% pieces of \"useful\" advice available";
			msg = msg.replace("%count%", advices.length);

			this.channel.say(msg);
		}
	},

	'advice source': {
		time: 30,
		regex: /^advice +source$/i,
		method: function(match, user, message){
			if(!this.lastAdvice){
				return;
			}
			
			if(typeof this.lastAdvice === 'string'){
				this.channel.say(this.lastAdvice);
				return;
			}
			var me = this;
			var advice = this.lastAdvice;
			models.Channel
				.findById(advice.ChannelId)
				.then(function(channel){
					var message = "Written by: " + advice.author;
                    if (channel) {
                        message += ", on channel: " + channel.name;
                    }
                    message += ", during game: " + advice.game;
                    message += ", current score is " + advice.score;
					me.channel.say(message);
				});
		}
	},
    'advice vote': {
        time: 60,
        timeLoud: false,
        regex: /^advice vote$/i,
        method: function(match, user, message){
            this.channel.say('Want to have a say in what advice is used? Go to http://ghostoflegbot.tk/advice');
        }
    },
    'advice good': {
        time: 5,
        timeLoud: false,
        regex: /^advice good$/i,
        method: function (match, user, message){
            if (!this.lastAdvice) {
                return;
            }
            if (typeof this.lastAdvice === 'string') {
                return;
            }
            var advice = this.lastAdvice;
            advice.increment('score');
            advice.reload();
            this.channel.say('Advice "' + advice.content + '" now has a score of ' + advice.score);
        }
    },
    'advice bad': {
        time: 5,
        timeLoud: false,
        regex: /^advice bad$/i,
        method: function (match, user, message) {
            if (!this.lastAdvice) {
                return;
            }
            if (typeof this.lastAdvice === 'string') {
                return;
            }
            var advice = this.lastAdvice;
            advice.decrement('score');
            advice.reload();
            this.channel.say('Advice "' + advice.content + '" now has a score of ' + advice.score);
        }
    },
	'advice add': {
		time: 60,
		timeLoud: true,
		regex: /^advice add +(\w.*)$/i,
		gameNeeded: true,
		modOnly: true,
		method: function(match, user, message){
			var game = this.checkGame(user);

			if(!game){
				return;
			}

			var me = this;
			var adviceText = match[1];
			Advice.create({
				game: game,
				author: user['display-name'],
				content: adviceText,
				ChannelId: this.channel.model.id
			}).then(function(){
				me.channel.say("Advice added. Bad advice will be deleted.");
			});
		}
	},
}
