module.exports = {
	irc: {
		userName: 'Ghost_of_Leg_Bot',
	},

	db: {
		file: './legbot.sqlite',
	},
	channel: {
		//How long we keep an users mod status after twitch revokes it
		//(Twitch grants and revokes mod status all the time)
		modTimeout: 30 * 60 * 60 * 1000,
	},

	twitchAPI: {
		//Where we can find the api
		hostname: "api.twitch.tv",
		path: "/kraken/streams?channel=%channels%",
		//How often we DO query twitch's API in milliseconds
		interval: 90 * 1000,
		//Channels without leg_bot that we care about.
		otherChannels: require('./otherchannels.js')
	},


	gCal: {
		url: "https://www.googleapis.com/calendar/v3/calendars/%calendar%/events",
		params: "?key=%key%&maxResults=15&orderBy=startTime&singleEvents=true&timeMin=%after%&timeZone=Etc/UTC",
		interval: 15 * 60 * 1000,
		timeZone: 'America/Vancouver',
		displayFormat: 'ddd hh:mm A z',
		calendars: {
			'lrr': "loadingreadyrun.com_72jmf1fn564cbbr84l048pv1go@group.calendar.google.com",
			'fan': "caffeinatedlemur@gmail.com",
		},
	},

	web: {
		port: 3000,
	}
}
