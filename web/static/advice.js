"use strict";

(function(){

	var advices;
    var request;
    var rows;

	var title = document.title;

	var mainContainer = document.getElementById('advices');

	function requestData(){
		if(request && request.readyState < 4){
			request.abort();
		}
		request = new XMLHttpRequest();
		request.open("get", "/api/advice");
		request.send();

		request.onreadystatechange = parseRequest;
	}

	function parseRequest(){
		if(request.readyState != 4){
			return;
		}
        advices = JSON.parse(request.response);
		buildDivs();
	}
    
    function vote(event) {
        //right now? Do nothing.
        var me = event.currentTarget;
        //console.log('Got vote, ', me.scoreModifier, ' for id ', me.adviceID);
        if (request && request.readyState < 4) {
            request.abort();
        }
        request = new XMLHttpRequest();
        request.open("post", "/api/advice/" + me.adviceID + "/" + me.scoreModifier);
        request.send();
        request.onreadystatechange = function () {
            parseVote(me);
        }
    }
    function parseVote(me) {
        if (request.readyState != 4) {
            return
        }
        var newScore = JSON.parse(request.response);
        var buttons = me.parentElement.getElementsByClassName("voting");
        for (var i=0;i<buttons.length;i++) {
            var button = buttons[i];
            button.classList.remove("active");
            if (button.scoreModifier == newScore.vote) {
                button.classList.add("active");
            }
        }
        me.associatedScore.childNodes[0].nodeValue = newScore.score;
        //advices = JSON.parse(request.response);
        //buildDivs();
    }


	function buildDivs(){
		
        mainContainer.innerHTML = "";
        var table = document.createElement('table');
        table.classList.add('adviceTable');
        var headerRow = document.createElement('tr');
        ['Advice', 'Author', 'Channel', 'Game'].forEach(function (name) {
            var cell = document.createElement('th');
            cell.appendChild(document.createTextNode(name));
            this.appendChild(cell);
        }, headerRow);
        var lastCell = document.createElement('th');
        lastCell.appendChild(document.createTextNode('Score'));
        lastCell.colSpan = 2;
        headerRow.appendChild(lastCell);
        table.appendChild(headerRow);
        advices.forEach(buildDiv, table);
        mainContainer.appendChild(table);
	}
    
	function buildDiv(advice){
        var row = document.createElement('tr');
        
        if (advice.score < 1) {
            row.classList.add('removed');
        }
        
        [advice.advice, advice.author, advice.channel, advice.game].forEach(function (nodeValue) {
            var cell = document.createElement('td');
            cell.appendChild(document.createTextNode(nodeValue));
            this.appendChild(cell);
        }, row)
        
        var scoreCell = document.createElement('td');
        scoreCell.classList.add('score');
        scoreCell.appendChild(document.createTextNode(advice.score));
        row.appendChild(scoreCell);

        var voteCell = document.createElement('td');
        voteCell.classList.add('voteButtons');
        
        var voteUp = document.createElement('a');
        voteUp.scoreModifier = 1;
        voteUp.adviceID = advice.id;
        voteUp.associatedScore = scoreCell;
        voteUp.classList.add('voting','vote_up');
        voteUp.addEventListener('click', vote);
        voteUp.appendChild(document.createTextNode("\u25B2"));
        
        var voteNeutral = document.createElement('a');
        voteNeutral.scoreModifier = 0;
        voteNeutral.adviceID = advice.id;
        voteNeutral.associatedScore = scoreCell;
        voteNeutral.classList.add('voting','vote_neutral');
        voteNeutral.addEventListener('click', vote);
        voteNeutral.appendChild(document.createTextNode("\u2E3A"));
        
        var voteDown = document.createElement('a');
        voteDown.scoreModifier = -1;
        voteDown.adviceID = advice.id;
        voteDown.associatedScore = scoreCell;
        voteDown.classList.add('voting','vote_down');
        voteDown.addEventListener('click', vote);        
        voteDown.appendChild(document.createTextNode('\u25BC'));
        
        if (advice.vote == 1) {
            voteUp.classList.add('active');
        } else if (advice.vote == -1) {
            voteDown.classList.add('active');
        } else {
            voteNeutral.classList.add('active');
        }
        
        voteCell.appendChild(voteUp);
        voteCell.appendChild(voteNeutral);
        voteCell.appendChild(voteDown);
        row.appendChild(voteCell);
        this.appendChild(row);
	}
	
	requestData();
	//requestInterval = setInterval(requestData, 1000 * 90);
})();
