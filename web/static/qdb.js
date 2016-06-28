"use strict";

(function(){

	var quotes;
    var request;
    var rows;

	var title = document.title;

	var mainContainer = document.getElementById('advices');

	function requestData(){
		if(request && request.readyState < 4){
			request.abort();
		}
		request = new XMLHttpRequest();
		request.open("get", "/api/qdb");
		request.send();

		request.onreadystatechange = parseRequest;
	}

	function parseRequest(){
		if(request.readyState != 4){
			return;
		}
        quotes = JSON.parse(request.response);
		buildDivs();
	}
    
	function buildDivs(){
		
        mainContainer.innerHTML = "";
        var table = document.createElement('table');
        table.classList.add('qdbTable');
        var headerRow = document.createElement('tr');
        ['ID','Quote', 'Author', 'Channel', 'Game'].forEach(function (name) {
            var cell = document.createElement('th');
            cell.appendChild(document.createTextNode(name));
            this.appendChild(cell);
        }, headerRow);
        table.appendChild(headerRow);
        quotes.forEach(buildDiv, table);
        mainContainer.appendChild(table);
	}
    
	function buildDiv(quote){
        var row = document.createElement('tr');
        
        [quote.id, quote.quote, quote.author, quote.channel, quote.game].forEach(function (nodeValue) {
            var cell = document.createElement('td');
            cell.appendChild(document.createTextNode(nodeValue));
            this.appendChild(cell);
        }, row)
       
        this.appendChild(row);
	}
	
	requestData();
	//requestInterval = setInterval(requestData, 1000 * 90);
})();
