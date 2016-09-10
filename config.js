module.exports = {
	db: {
        DBType: 'sqlite',
        DBHost: 'localhost',
        DBUsername: 'ghost_of_leg_bot',
        DBPassword: 'Sir? Sir! Plain Text Passwords Are Bad!',
        file: './legbot.sqlite',
	},
	channel: {
		//How long we keep an users mod status after twitch revokes it
		//(Twitch grants and revokes mod status all the time)
		modTimeout: 30 * 60 * 60 * 1000,
	},

	twitchAPI: {
		//How often we DO query twitch's API in milliseconds
		interval: 90 * 1000,
		clientID: require('./secrets.js').twitchClientID,
		clientSecret: require('./secrets.js').twitchClientSecret,
		clientRedirectURL: require('./secrets.js').twitchRedirectURL
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
    },

    logging: {
        level: 'debug'
    }
}
