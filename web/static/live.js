"use strict";

(function(){

	var twitchStreams;
	var requestInterval;
	var request;

	var title = document.title;
	var firstRun = true;

	var notified = [];
	var previousChannels = [];
	var mainContainer = document.getElementById('live_streams');
	var doNotification = function (channel) { console.log("No notification for you!"); };
	var actualNotif = function (channel) {
		if (Notification) {
			var twitchChannel = twitchStreams[channel];
			var options = {
				body: "Channel " + channel + " is now live playing " + (twitchChannel.channel.game || "Something") + " (" + twitchChannel.channel.status + ")",
				icon: twitchChannel.channel.logo
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
	}

	function parseRequest(){
		if(request.readyState != 4){
			return;
		}

		twitchStreams = JSON.parse(request.response);
		buildDivs();
		firstRun = false;
	}

	function buildDivs(){
		
		mainContainer.innerHTML = "";
		
		var channels = Object.keys(twitchStreams);

		document.title = "(" + channels.length + ") " + title;

		channels = channels.sort();

		channels.forEach(buildDiv);
		var newChannels = [];
		var removedChannels = [];
		for (let channel of channels) {
			console.log("Checking if " + channel + " is new...", !previousChannels.includes(channel));
			if (!previousChannels.includes(channel)) {
				console.log("It is! Is this first run?", firstRun);
				newChannels.push(channel);
				if (!firstRun) {
					console.log("Trying notification for " + channel);
					doNotification(channel);
				}
			}
		};
		for (let channelName of previousChannels) {
			if (!channels.includes(channelName)) {
				removedChannels.push(channelName);
			}
		};
		previousChannels = channels;
		
	}

	function buildDiv(channel){
		channel = twitchStreams[channel];
		var container = document.createElement('a');
		container.classList.add('live_channel');
		container.href = channel.channel.url;
		container.target = "_blank";
		
		var header = document.createElement('h3');
		header.classList.add('live_header');
		header.innerHTML = channel.channel.display_name;

		if(channel._lb_offline){
			header.innerHTML += " ?";
		}
		var logo = document.createElement('img');
		logo.classList.add('channel_logo');
		logo.width = "150";
		logo.height = "150";
		if (channel.channel.logo) {
			logo.src = channel.channel.logo.replace('300x300', '150x150');
		} else {
		    logo.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="; //1x1 transparent gif
		}
		var picture = document.createElement('img');
		picture.classList.add('live_picture');
		picture.src = channel.preview.large + "?t=" + new Date();

		var game = document.createElement('div');
		game.classList.add('live_game');
		channel = channel.channel || channel;
		game.innerHTML = "";
		if (channel.status) game.innerHTML += channel.status + "<hr />"
		game.innerHTML += "Playing: " + (channel.game || "Something?");

		container.appendChild(header);
		container.appendChild(logo);
		container.appendChild(picture);
		container.appendChild(game);

		mainContainer.appendChild(container);
	}
	
	requestData();
	requestInterval = setInterval(requestData, 1000 * 90);
})();
