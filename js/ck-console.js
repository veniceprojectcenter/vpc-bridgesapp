
/*******************************************
  AsyncValue class
********************************************/
/**
 * @constructor
 * create a new Async value that can be waited on
 */
function AsyncValue(){
	this._isLoaded = false;
	this._callbackQueue = new Array();
}

/**
 * @return true if the AsyncValue has completed yet
 */
AsyncValue.prototype.isSet = function(){
	return this._isLoaded;
}

/**
 * @param callback (Func<?>) a callback function that is called when the AsyncValue has completed or immediately if it is already complete
 * @return this
 */
AsyncValue.prototype.get = function(callback){
	if(callback){
		if(this.isSet())
			callback(this._value);
		else
			this._callbackQueue.push(callback);
	}
	return this;
}

/**
 * Set the value of the AsyncValue and fire any pending callbacks
 * This should only be called once
 * @param value (?) the new value of the AsyncValue
 * @return this
 */
AsyncValue.prototype.set = function(value, finalCallback){
	if(this.isSet())
		console.error("AsyncValue set called multiple times...");
		
	this._isLoaded = true;
	this._value = value;
	for (var i = 0; i < this._callbackQueue.length; i++) {
		this._callbackQueue[i](value);
	}
	this._callbackQueue = [];
	if(finalCallback)
		finalCallback(value);
	return this;
}

/**
 * @param op (? Func<?>) a function used to transform the result of the AsyncValue
 * @return a new AsyncValue that is the value of this one transformed by the given function
 */
AsyncValue.prototype.applyFunction = function(op){
	var result = new AsyncValue();
	this.get(function(val){
		result.set(op(val));
	});
	return result;
}

/**
 * @param asyncOp (AsuncValue<?> Func<?>) a function that receves the value of this Async and returns a new Async value that will then be evaluated
 * @return a new AsyncValue that is the value of this one transformed by the function and with the final result of the returned AsyncValue
 */
AsyncValue.prototype.applyAsyncFunction = function(asyncOp){
	var result = new AsyncValue();
	this.get(function(val){
		asyncOp(val).get(function(finalVal){
			result.set(finalVal);
		});
	});
	return result;
}

/**
 * all provided async functions will execute in parallel
 * @varargs (AsuncValue<?> Func<?>) a function that receives the value of this AsyncValue
 * @return a new AsyncValue that completes when all of the provided async functions complete
 */
AsyncValue.prototype.applyParallelAsyncFunctions = function(){
	var result = new AsyncValue();
	var completed = 0;
	var numToCall = arguments.length;
	var args = arguments;
	this.get(function(val){
		for (var i = 0; i < numToCall; i++){
			args[i](val).get(function(){
				++completed;
				if(completed == numToCall)
					result.set(val);
			});
		}
	});
	return result;
}

/*******************************************
  Async (async utility methods)
********************************************/
var _____COMPLETED_EMPTY_ASYNC = new AsyncValue();
_____COMPLETED_EMPTY_ASYNC.set();
Async = {
	/**
	 * @param asyncValues Map<?, AsyncValue<?>>
	 * @return AsyncValue<Map<?, ?>> a single async value that evaluates to a map of the keys to the evaluated values
	 */
	doParallel: function(asyncValues){
		return Async.doParallelAndApplyAsync(asyncValues, function(val){
			return Async.completed(val);
		});
	},
	
	/**
	 * @param asyncValues Map<?, AsyncValue<?>>
	 * @param asyncOp Func<?> a function that takes the result of the first async operation
	 * @return AsyncValue<Map<?, ?>> a single async value that evaluates to a map of the keys to the evaluated values with the asyncOp applied to them
	 */
	doParallelAndApplyAsync: function(asyncValues, asyncOp){
		var result = new AsyncValue();
		var items = {};
		var completed = 0;
		var totalValues = 0;
		for(var key in asyncValues){
			++totalValues;
		}
		for(var key in asyncValues){
			var asyncValue = asyncValues[key];
			(function(currentKey){return asyncValue.get(function(asyncResult){
				asyncOp(asyncResult).get(function(finalVal){
					items[currentKey] = finalVal;
					++completed;
					if(completed == totalValues)
						result.set(items);
				});
			});})(key);
		}
		return result;
	},
	/**
	 * @param result (optional) the value the async values evaluates to
	 * @return AsyncValue<?> an async value that is immediately evaluated
	 */
	completed: function(result){
		if(result)
			return new AsyncValue().set(result);
		return _____COMPLETED_EMPTY_ASYNC;
	}
};



/*******************************************
  CKConsole class
********************************************/
/**
 * @constructor
 * create a new CKConsole that can be used to communicate with the City Knowledge firebase
 */
function CKConsole(){
	this.rootRef = new Firebase('http://cityknowledge.firebaseio.com');
	this.groupsRef = this.rootRef.child('groups');
	this.mapsRef = this.rootRef.child('maps');
	this.dataRef = this.rootRef.child('data');
	this.layersRef = this.rootRef.child('layers');
	this.formsRef = this.rootRef.child('forms');
	
	this.groups = {};//groupname -> AsyncValue<group object>
	this.maps = {};//mapId -> AsyncValue<map object>
}

/**
 * @param groupname the name of the group to get
 * @return AsyncValue<{groupname:<string>,members:<{ckId, memberData}[]>}>
 */
CKConsole.prototype.getGroup = function(groupname){
	var _this = this;
	
	if(this.groups[groupname]){
		console.log("Getting cached version of group: "+groupname);
		return this.groups[groupname];
	}
	else{
		console.log("Getting group: "+groupname);
		return this.groups[groupname] = this.getValue(this.groupsRef, groupname).applyAsyncFunction(function(groupData) {
			return _this.getValueFromKeys(_this.dataRef, groupData.members).applyFunction(function(members){
				return {
					groupname: groupname,
					members: members
				};
			});
		});
	}
}


/**
 * @param mapId the id of the map to get
 * @param fetchGroups if true then the group data will be retrieved and stored in the map before this completes
 * @return AsyncValue<mapData>
 */
CKConsole.prototype.getMap = function(mapId, fetchGroups){
	var _this = this;
	
	if(this.maps[mapId]){
		console.log("Getting cached version of map: "+mapId);
		return this.maps[mapId];
	}
	else{
		console.log("Getting map: "+mapId);
		
		return this.maps[mapId] = this.getValue(this.mapsRef, mapId).applyAsyncFunction(function(map){
			var asyncLayers = {};
			for (key in map.layers) {
				var layer = map.layers[key];
				asyncLayers[key] = _this.getValueAndMergeFromId(_this.layersRef, layer).applyParallelAsyncFunctions(
					function(layer){
						if(layer.bubble && layer.bubble.type == 'form'){
							return _this.getValue(_this.formsRef, layer.bubble.id).applyFunction(function(form){
								layer.bubble.form = form;
							});
						}
						else
							return Async.completed();
					},
					function(layer){
						if(layer.moreLink && layer.moreLink.type == 'form'){
							return _this.getValue(_this.formsRef, layer.moreLink.id).applyFunction(function(form){
								layer.moreLink.form = form;
							});
						}
						else
							return Async.completed();
					},
					function(layer){
						if(fetchGroups){
							return _this.getGroup(layer.groupname).applyFunction(function(groupData){
								layer.members = groupData.members;
							});
						}
						else
							return Async.completed();
					}
				);
			}
			return Async.doParallel(asyncLayers).applyFunction(function(layers){
				map.layers = layers;
				return map;
			});
		});
		
		return result;
	}
}




CKConsole.prototype.getValuesAndMergeFromIds = function(baseRef, datas){
	var asyncItems = {};
	for (key in datas) {
		var data = datas[key];
		asyncItems[key] = this.getValueAndMergeFromId(baseRef, data);
	}
	return Async.doParallel(asyncItems);
}

CKConsole.prototype.getValueFromKeys = function(baseRef, dataIds){
	var asyncItems = {};
	for (var id in dataIds) {
		asyncItems[id] = this.getValue(baseRef, id);
	}
	return Async.doParallel(asyncItems);
}

CKConsole.prototype.getValueAndMergeFromId = function(baseRef, data, callback){
	var id = data.id;
	return this.getValue(baseRef, id).applyFunction(function(member) {
		return $.extend({}, data, member);
	});
}

var i = 0;
var total = 0;
CKConsole.prototype.getValue = function(baseRef, id){
	var ref = baseRef.child(id);
	console.log();
	
	var cachedObject = localStorage.getItem(ref.toString());
	if(cachedObject){
		return Async.completed(JSON.parse(cachedObject));
	}
	else{
		++total;
		var value = new AsyncValue();
		ref.once('value', function(snapshot) {
			++i;
			console.info("Response: "+i+"/"+total, ref.toString());
			
			var result = snapshot.val();
			localStorage.setItem(ref.toString(), JSON.stringify(result));
			value.set(result);
		});
		return value;
	}
}







/*******************************************
  MapGroupLayer class
********************************************/
function MapGroupLayer(map, groupData, markers){
	this.groupData = groupData;
	this.markers = markers;
	this.map = map;
	this.featureGroup = new L.FeatureGroup();
	for(var id in this.markers){
		var marker = this.markers[id];
		this.featureGroup.addLayer(marker);
	}
}
MapGroupLayer.prototype.show = function(){
	this.map.addLayer(this.featureGroup);
	return this;
}
MapGroupLayer.prototype.hide = function(){
	this.map.removeLayer(this.featureGroup);
	return this;
}
MapGroupLayer.prototype.on = function(eventName, callback){
	var _this = this;
	for(var id in this.markers){
		(function(marker, member){
		marker.on(eventName, function(e){
			callback(e, member);
		});})(this.markers[id], this.groupData.members[id])
	}
	
	return this;
}
MapGroupLayer.prototype.getLayer = function(){
	return this.featureGroup;
}
MapGroupLayer.prototype.setStyle = function(options){
	for(var id in this.markers){
		var marker = this.markers[id];
		marker.setStyle(options);
	}
	return this;
}
MapGroupLayer.prototype.eachMember = function(callback){
	for(var id in this.groupData.members){
		var member = this.groupData.members[id];
		var marker = this.markers[id];
		callback(member, marker);
	}
	return this;
}





/*******************************************
  Utility Functions
********************************************/
CKConsoleUtil = {
	createMapLayerFromGroupData: function(map, groupData, symbolUrl){
		var markers = {};
		for(var id in groupData.members){
			var member = groupData.members[id];
			var mapObject;
			if (member.shape) {
				mapObject = new L.GeoJSON(member.shape, {
					style: {
						fillColor: "#FF0000",
						fillOpacity: 0.35,
						weight: 1,
						color: "#000000",
						opacity: 0.35
					}
				});
			}
			else if(member.birth_certificate.lat && member.birth_certificate.lon){
				var newLatLng = [member.birth_certificate.lat, member.birth_certificate.lon];
				var icon = new L.Icon.Default();
				if (symbolUrl) {
					icon = new L.Icon({
						iconUrl: symbolUrl,
						iconAnchor: [16, 37],
						popupAnchor: [0,-37],
						iconSize: [32, 37]
					});
				}
				var mapObject = new L.Marker(newLatLng, {
					icon: icon,
				});
			}
			if(mapObject)
				markers[id] = mapObject;
		}
		return new MapGroupLayer(map, groupData, markers);
	},
	
	createMapLayersFromMapData: function(map, mapData){
		var layers = {};
		for(var id in mapData.layers){
			var layer = mapData.layers[id];
			var groupname = layer.groupname;
			var mapLayer = CKConsoleUtil.createMapLayerFromGroupData(map, layer, layer.symbolUrl);
			if(layer.visible)
				mapLayer.show();
			layers[groupname] = mapLayer;
		}
		return layers;
	}
}