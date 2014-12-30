"use strict";

(function(){

	var twitchStreams;
	var requestInterval;
	var request;

	var mainContainer = document.getElementById('live_streams');

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
	}

	function buildDivs(){
		
		mainContainer.innerHTML = "";
		
		var channels = Object.keys(twitchStreams);

		channels = channels.sort();

		channels.forEach(buildDiv);
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

		var picture = document.createElement('img');
		picture.classList.add('live_picture');
		picture.src = channel.preview.medium + "?t=" + new Date();

		var game = document.createElement('div');
		game.classList.add('live_game');
		game.innerHTML = "Playing: " + (channel.game || "Something?");


		container.appendChild(header);
		container.appendChild(picture);
		container.appendChild(game);

		mainContainer.appendChild(container);
	}
	
	requestData();
	requestInterval = setInterval(requestData, 1000 * 90);
})();
