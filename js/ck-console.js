function CKConsole(){
	this.rootRef = new Firebase('http://cityknowledge.firebaseio.com');
	this.groupsRef = this.rootRef.child('groups');
	this.mapsRef = this.rootRef.child('maps');
	this.dataRef = this.rootRef.child('data');
	this.layersRef = this.rootRef.child('layers');
	this.formsRef = this.rootRef.child('forms');
}

CKConsole.prototype.getGroup = function(groupname, callback){
	var _this = this;
	console.log("Getting group: "+groupname);
	this.groupsRef.child(groupname).on('value', function(groupSnapshot) {
		var groupData = groupSnapshot.val();
		
		_this.getValueFromKeys(_this.dataRef, groupData.members, function(members){
			callback({
				name: groupname,
				members: members
			});
		});
	});
}


CKConsole.prototype.getMap = function(mapId, callback){
	var _this = this;
	console.log("Getting map: "+mapId);
	this.getValue(this.mapsRef, mapId, function(map) {
		_this.getValuesAndMergeFromIds(_this.layersRef, map.layers,
		createMultiProcessCallback(
			function(layer, callback){
				if(layer.bubble && layer.bubble.type == 'form'){
					_this.getValue(_this.formsRef, layer.bubble.id, function(form){
						layer.bubble.form = form;
						callback(layer);
					});
				}
				else
					callback(layer);
			},
			function(layer, callback){
				if(layer.moreLink && layer.moreLink.type == 'form'){
					_this.getValue(_this.formsRef, layer.moreLink.id, function(form){
						layer.moreLink.form = form;
						callback(layer);
					});
				}
				else
					callback(layer);
			}
		),
		function(layers){
			map.layers = layers;
			callback(map);
		});
	});
}



//varargs
function createMultiProcessCallback(){
	var toCall = arguments.length;
	var args = arguments;
	return function(val, callback){
		var completed = 0;
		for (var i = 0; i < toCall; i++){
			args[i](val, function(){
				++completed;
				if(completed == toCall)
					callback(val);
			});
		}
	};
}



CKConsole.prototype.getValuesAndMergeFromIds = function(baseRef, datas, processFunction, callback){
	var requests = 0;
	var responses = 0;
	
	var items = {};
	
	for (key in datas) {
		++requests;
		var data = datas[key];
		this.getValueAndMergeFromId(baseRef, data, (function(key){return function(resultData){//make sure that the correct key is carried along
			processFunction(resultData, function(processedValue){
				items[key] = processedValue;
				++responses;
				if(requests == responses)
					callback(items);
			});
		};})(key));
	}
}

CKConsole.prototype.getValueFromKeys = function(baseRef, dataIds, callback){
	var requests = 0;
	var responses = 0;
	
	var items = {};
	
	for (id in dataIds) {
		++requests;
		baseRef.child(id).on('value', function(memberSnapshot) {
			var member = memberSnapshot.val();
			items[member.birth_certificate.ckID] = member;
			++responses;
			if(requests == responses)
				callback(items);
		});
	}
}

CKConsole.prototype.getValueAndMergeFromId = function(baseRef, data, callback){
	var id = data.id;
	this.getValue(baseRef, id, function(member) {
		callback($.extend({}, data, member));
	});
}
CKConsole.prototype.getValue = function(baseRef, id, callback){
	baseRef.child(id).on('value', function(snapshot) {
		callback(snapshot.val());
	});
}

CKConsoleUtil = {
	geoJsonToGoogleMaps : function(shape, options){
		if(shape.type=="Polygon"){
			var coords = shape.coordinates[0];
			var googleCoords = new Array();
			for(var i = 0; i<coords.length; ++i){
				var coord = coords[i];
				googleCoords.push(new google.maps.LatLng(coord[1], coord[0]));
			}
			
			return new google.maps.Polygon(jQuery.extend({paths: googleCoords}, options));
		}
		else
			console.error("Unknown shape:", shape);
	}
}