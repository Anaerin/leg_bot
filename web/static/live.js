"use strict";
moment().format();
(function(){

	var twitchStreams;
	var requestInterval;
	var request;

	var title = document.title;
	var firstRun = true;
	var channelMap = new Map();
	var notified = [];
	var previousChannels = [];
	var timeToUpdate = 90;
	var mainContainer = document.getElementById('live_streams');
	var doNotification = function (channel) { console.log("No notification for you!"); };
	let countdown = document.createElement("div");
	countdown.style.position = "absolute";
	countdown.style.top = "8px";
	countdown.style.right = "8px";
	countdown.style.color = "white";
	countdown.id = "Countdown";
	document.body.appendChild(countdown);
	var actualNotif = function (channel) {
		if (Notification && !firstRun) {
			var options = {
				body: "Channel " + channel.channel.display_name + " is now live playing " + (channel.channel.game || "Something") + " (" + channel.channel.status + ")",
				icon: channel.channel.logo
			}
			var notification = new Notification("Ghost of Leg Bot", options);
			setTimeout(notification.close.bind(notification), 5000);
		}
	}
	if (Notification) {
		if (Notification.permission === "granted") {
			doNotification = actualNotif;
		} else if (Notification.permission !== "denied") {
			Notification.requestPermission(function (permission) {
				if (permission === "granted") {
					doNotification = actualNotif;
				}
			});
		}
	}

	function requestData(){
		if(request && request.readyState < 4){
			request.abort();
		}
		request = new XMLHttpRequest();
		request.open("get", "/api/live");
		request.send();

		request.onreadystatechange = parseRequest;
		timeToUpdate = 0;
		updateCountdown();
	}

	function parseRequest(){
		if(request.readyState != 4){
			return;
		}
		timeToUpdate = -1;
		updateCountdown();
		twitchStreams = JSON.parse(request.response);

		if (firstRun) {
			mainContainer.innerHTML = "<h1>Upcoming streams</h1>";
			mainContainer.innerHTML += "<h3>LoadingReadyRun Streams:</h3>";
			mainContainer.innerHTML += "<div id=\"UpcomingLRRStreams\"></div>";
			mainContainer.innerHTML += "<h3>Fan Streams:</h3>";
			mainContainer.innerHTML += "<div id=\"UpcomingFanStreams\"></div>";
			mainContainer.innerHTML += "<h1 id=\"StreamsLive\">0 streams currently live</h1>";
			mainContainer.innerHTML += "<div id=\"liveContainer\"></div>";
		}
		document.getElementById("UpcomingLRRStreams").innerHTML = "";
		document.getElementById("UpcomingLRRStreams").appendChild(buildComingUp(twitchStreams.lrrEvents));
		document.getElementById("UpcomingFanStreams").innerHTML = "";
		document.getElementById("UpcomingFanStreams").appendChild(buildComingUp(twitchStreams.fanEvents));
		document.getElementById("StreamsLive").innerHTML = Object.keys(twitchStreams.Twitch).length + " streams currently live";

		let channelsLive = new Set();

		for (let channel in twitchStreams.Twitch) {
			if (twitchStreams.Twitch.hasOwnProperty(channel)) {
				if (channelMap.has(channel)) {
					// If we have this channel already, update it.
					//console.log("Updating channel %s",channel);
					channelMap.get(channel).updateValues(twitchStreams.Twitch[channel]);
				} else {
					// If we don't, create it.
					console.log("Creating new channel %s", channel);
					channelMap.set(channel, new channelObject(twitchStreams.Twitch[channel]));
					// And insert it at the beginning.
					document.getElementById("liveContainer").insertBefore(channelMap.get(channel).createObject(), document.getElementById("liveContainer").childNodes[0]);
				}
				// Add this channel to the list of channels we've dealt with this go-around.
				channelsLive.add(channel);
			}
		};

		channelMap.forEach((value, key) => {
			// Now, for each channel we have in our master list
			if (!channelsLive.has(key)) {
				// If we didn't see it in the latest list, tell it to remove itself from the div, then delete it from the list.
				console.log("Removing dead channel %s", key);
				value.removeObject();
				channelMap.delete(key);
			};
		});

		firstRun = false;
		timeToUpdate = 90;
		updateCountdown();
	}

	function escapeHtml(text) {
		var map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};

		return text.replace(/[&<>"']/g, function (m) { return map[m]; });
	}	
	
	function buildComingUp(events) {
		if (events) {
			let returnVal = document.createDocumentFragment();
			events.forEach((ev) => {
				var outputDiv = document.createElement("div");
				if (ev['location']) {
					var textLocation = document.createElement("a");
					if (String(ev['location']).startsWith("http")) {
						textLocation.href = ev['location'];
					} else {
						textLocation.href = "http://" + ev['location'];
					}
					textLocation.innerHTML = escapeHtml(ev.summary);
					outputDiv.appendChild(textLocation);
				} else {
					outputDiv.innerHTML = escapeHtml(ev.summary);
				}
			
				var start = moment(ev.start);

				start.local();

				outputDiv.innerHTML += " " + start.format("ddd LT");
				outputDiv.innerHTML += " (" + start.fromNow() + ")";
				if (ev.description) {
					outputDiv.innerHTML += "<div class=\"description\">" + escapeHtml(ev.description) + "</div>";
				}

				returnVal.appendChild(outputDiv);
			});
			return returnVal;
		}
	}

	class channelObject {
		constructor(channel) {
			this.channel = channel;
			this.updateValues(channel);
			this.htmlCreated = false;
		}
		updateValues() {
			this.name = this.channel.channel.display_name;
			this.URL = this.channel.channel.url;
			this.logo = this.channel.channel.logo;
			this.preview = this.channel.preview.large;
			this.status = this.channel.channel.status;
			this.game = this.channel.channel.game;
			this._lb_offline = this.channel._lb_offline;
			this.viewers = this.channel.viewers;
			if (this.htmlCreated) this.updateObject();
		}
		createObject() {
			let container = document.createElement("a");
			container.classList.add("live_channel");
			container.href = this.URL;
			container.target = "_blank";
			
			let header = document.createElement("h3");
			header.classList.add("live_header");
			header.innerHTML = this.name;
			if (this._lb_offline) header.innerHTML += " ?";
			this.htmlHeader = header;

			let logo = document.createElement("img");
			logo.classList.add("channel_logo");
			logo.width = "150";
			logo.height = "150";
			if (this.logo) logo.src = this.logo.replace("300x300", "150x150") + "?t=" + new Date();
			else logo.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; //1x1 transparent gif
			this.htmlLogo = logo;

			let picture = document.createElement("img");
			picture.classList.add("live_picture");
			picture.src = this.preview + "?t=" + new Date();
			this.htmlPreview = picture;

			let game = document.createElement("div");
			game.classList.add("live_game");
			game.innerHTML = "";
			if (this.status) game.innerHTML += this.status + "<hr />";
			game.innerHTML += "Playing: " + (this.game || "Something?");
			this.htmlGame = game;

			container.appendChild(header);
			container.appendChild(logo);
			container.appendChild(picture);
			container.appendChild(game);
			this.htmlContainer = container;
			this.htmlCreated = true;
			doNotification(this.channel);
			return container;
		}
		removeObject() {
			this.htmlContainer.parentElement.removeChild(this.htmlContainer);
			delete this.htmlContainer, this.htmlHeader, this.htmlGame, this.htmlLogo, this.htmlPreview;
			this.htmlCreated = false;
		}
		updateObject() {
			let newGame = "";
			if (this.status) newGame += this.status + "<hr />";
			newGame += "Playing: " + (this.game || "Something?");
			this.htmlGame.innerHTML = newGame;

			this.htmlPreview.src = this.preview + "?t=" + new Date();
		}
	}
	requestData();
	requestInterval = setInterval(requestData, 1000 * 90);
	
	function updateCountdown() {
		if (document.getElementById("Countdown")) {
			if (timeToUpdate > 0) {
				document.getElementById("Countdown").innerHTML = "Updating in " + timeToUpdate + " seconds";
				timeToUpdate--;
			}
			if (timeToUpdate == 0) document.getElementById("Countdown").innerHTML = "Updating...";
			if (timeToUpdate == -1) document.getElementById("Countdown").innerHTML = "Redrawing...";
		}
	}
	var updateInterval = setInterval(updateCountdown, 1000);
})();
