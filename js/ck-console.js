angular.module('ckServices', [])

/*******************************************
  CKConsole service
********************************************/
	.service('$ckConsole', ['$rootScope', '$q', function($rootScope, $q) {
		this.rootRef = new Firebase('http://cityknowledge.firebaseio.com');
		this.groupsRef = this.rootRef.child('groups');
		this.mapsRef = this.rootRef.child('maps');
		this.dataRef = this.rootRef.child('data');
		this.layersRef = this.rootRef.child('layers');
		this.formsRef = this.rootRef.child('forms');
		
		this.groups = {};//groupname -> group object
		this.maps = {};//mapId -> map object

		/**
		 * @param groupname the name of the group to get
		 * @return AsyncValue<{groupname:<string>,members:<{ckId, memberData}[]>}>
		 */
		this.getGroup = function(groupname){
			var _this = this;
			
			if(this.groups[groupname]){
				console.log("Getting cached version of group: "+groupname);
				
				var deferred = $q.defer();
				deferred.resolve(this.groups[groupname]);
				return deferred.promise;
			}
			else{
				console.log("Getting group: "+groupname);
				return this.groups[groupname] = this.getValue(this.groupsRef, groupname).then(function(groupData) {
					return _this.getValueFromKeys(_this.dataRef, groupData.members).then(function(members){
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
		this.getMap = function(mapId, fetchGroups){
			var _this = this;
			
			if(this.maps[mapId]){
				console.log("Getting cached version of map: "+mapId);
				
				var deferred = $q.defer();
				deferred.resolve(this.maps[mapId]);
				return deferred.promise;
			}
			else{
				console.log("Getting map: "+mapId);
				
				return this.maps[mapId] = this.getValue(this.mapsRef, mapId).then(function(map){
					var asyncLayers = {};
					for (key in map.layers) {
						var layer = map.layers[key];
						asyncLayers[key] = _this.getValueAndMergeFromId(_this.layersRef, layer).then(
							function(layerData){
								var layerProcessActions = new Array();
								if(layerData.bubble && layerData.bubble.type == 'form'){
									layerProcessActions.push(_this.getValue(_this.formsRef, layerData.bubble.id).then(function(form){
										layerData.bubble.form = form;
									}));
								}
								if(layerData.moreLink && layerData.moreLink.type == 'form'){
									layerProcessActions.push(_this.getValue(_this.formsRef, layerData.moreLink.id).then(function(form){
										layerData.moreLink.form = form;
									}));
								}
								if(fetchGroups){
									layerProcessActions.push(_this.getGroup(layerData.groupname).then(function(groupData){
										layerData.members = groupData.members;
									}));
								}
								return $q.all(layerProcessActions).then(function(){
									return layerData;
								});
							}
						);
					}
					return $q.all(asyncLayers).then(function(layers){
						map.layers = layers;
						return map;
					});
				});
				
				return result;
			}
		}


			

		this.getValuesAndMergeFromIds = function(baseRef, datas){
			var asyncItems = {};
			for (key in datas) {
				var data = datas[key];
				asyncItems[key] = this.getValueAndMergeFromId(baseRef, data);
			}
			return $q.all(asyncItems);
		}

		this.getValueFromKeys = function(baseRef, dataIds){
			var asyncItems = {};
			for (var id in dataIds) {
				asyncItems[id] = this.getValue(baseRef, id);
			}
			return $q.all(asyncItems);
		}

		this.getValueAndMergeFromId = function(baseRef, data, callback){
			var id = data.id;
			return this.getValue(baseRef, id).then(function(member) {
				return $.extend({}, data, member);
			});
		}

		var i = 0;
		var total = 0;
		this.getValue = function(baseRef, id){
			var deferred = $q.defer();
			
			var ref = baseRef.child(id);
			
			var cachedObject = localStorage.getItem(ref.toString());
			if(cachedObject){
				deferred.resolve(JSON.parse(cachedObject));
			}
			else{
				++total;
				var value = new AsyncValue();
				ref.once('value', function(snapshot) {
					++i;
					console.info("Response: "+i+"/"+total, ref.toString());
					
					var result = snapshot.val();
					localStorage.setItem(ref.toString(), JSON.stringify(result));
					deferred.resolve(result);
				});
			}
			
			return deferred.promise;
		}
	}])
	.service('$ckConsoleMap', ['$rootScope', '$q', '$ckConsole', function($rootScope, $q, $ckConsole) {
		this.createMapLayersFromMapData = function(map, mapData){
			var _this = this;
			var layers = {};
			for(var id in mapData.layers){
				var layer = mapData.layers[id];
				var groupname = layer.groupname;
				var mapLayer = this.createMapLayerFromGroupData(map, layer, function(member){return _this.createGroupMemberLayer(member, layer.symbolUrl);});
				if(layer.visible)
					mapLayer.show();
				layers[groupname] = mapLayer;
			}
			return layers;
		};
		
		this.createMapLayerFromGroupData = function(map, groupData, memberLayerFactory){
			if(!memberLayerFactory){
				memberLayerFactory = this.createGroupMemberLayer;
			}
			var markers = {};
			for(var id in groupData.members){
				var member = groupData.members[id];
				var mapObject = memberLayerFactory(member);
				if(mapObject)
					markers[id] = mapObject;
			}
			return new MapGroupLayer(map, groupData, markers);
		};
		
		this.createGroupMemberLayer = function(member, symbolUrl){
			var layer = this.createGroupMemberShape(member);
			if(layer)
				return layer;
				
			var layer = this.createGroupMemberMarker(member, symbolUrl);
			if(layer)
				return layer;
		};
		this.createGroupMemberShape = function(member){
			if (member.shape) {
				return new L.GeoJSON(member.shape, {
					style: {
						fillColor: "#FF0000",
						fillOpacity: 0.35,
						weight: 1,
						color: "#000000",
						opacity: 0.35
					}
				});
			}
		};
		this.createGroupMemberMarker = function(member, symbolUrl){
			if(member.birth_certificate.lat && member.birth_certificate.lon){
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
				return new L.Marker(newLatLng, {
					icon: icon,
				});
			}
		};
		
	}]);





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
