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
				
				return $q.when(this.groups[groupname]);
			}
			else{
				var deferred = $q.defer();
				console.log("Getting group: "+groupname);
				this.getValue(this.groupsRef, groupname).then(function(groupData) {
					deferred.notify({type: 'groupData', groupData: groupData});
					return _this.getValueFromKeys(_this.dataRef, groupData.members).then(function(members){
						deferred.resolve({
							groupname: groupname,
							members: members
						});
					}, undefined, function(notification){
						deferred.notify({type: 'newMember', groupData: groupData, memberId: notification.key, member: notification.value});
					});
				});
				return this.groups[groupname] = deferred.promise;
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

				return $q.when(this.maps[mapId]);
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
										console.log(groupData);
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
			}
		}


			

		this.getValuesAndMergeFromIds = function(baseRef, datas){
			var deferred = $q.defer();
			
			var asyncItems = {};
			for (key in datas) {
				var data = datas[key];
				asyncItems[key] = this.getValueAndMergeFromId(baseRef, data).then((function(idCapture){return function(val){
					deferred.notify({key: idCapture, value: val});
					return val;
				};})(id));
			}
			
			$q.all(asyncItems).then(function(result){
				deferred.resolve(result);
			});
			
			return deferred.promise;
		}

		this.getValueFromKeys = function(baseRef, dataIds){
			var deferred = $q.defer();
			
			var asyncItems = {};
			for (var id in dataIds) {
				asyncItems[id] = this.getValue(baseRef, id).then((function(idCapture){return function(val){
					deferred.notify({key: idCapture, value: val});
					return val;
				};})(id));
			}
			
			$q.all(asyncItems).then(function(result){
				deferred.resolve(result);
			});
			
			return deferred.promise;
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
			//cachedObject = null; //TODO use this to disable caching
			if(cachedObject){
				deferred.resolve(JSON.parse(cachedObject));
			}
			else{
				++total;
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
	
	
	
/*******************************************
  CKConsole Map service
********************************************/
	.service('$ckConsoleMap', ['$rootScope', '$q', '$ckConsole', function($rootScope, $q, $ckConsole) {
		/*this.createMapLayersFromMapData = function(map, mapData){
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
		};*/
		
		this.createMapLayerFromGroupData = function(map, groupPromise, createCallback, memberLayerFactory){
			if(!memberLayerFactory){
				memberLayerFactory = function(member){return _this.createGroupMemberLayer(member);};
			}
			
			var _this = this;
			var deferred = $q.defer();
			var layer;
			
			function createLayerIfNeeded(groupname){
				if(!layer){
					layer = new MapGroupLayer(map, groupname);
					createCallback(layer);
				}
			}
			function createMemberLayer(id, member){
				var mapObject = memberLayerFactory(member);
				layer.addMember(id, member, mapObject);
			}
			
			groupPromise.then(function(groupData){
				createLayerIfNeeded(groupData.groupname);
				for(var id in groupData.members){//create all remaining members if needed
					if(!layer.getMember(id)){
						createMemberLayer(id, groupData.members[id]);
					}
				};
				deferred.resolve(layer);
			}, undefined, function(notification){
				createLayerIfNeeded(notification.groupData.groupname);
				if(notification.type=='newMember')
					createMemberLayer(notification.memberId, notification.member);
			});
			
			return deferred.promise;
		};
		
		this.createGroupMemberLayer = function(member, symbolUrl){
			if(!member)
				return;
			var layer = this.createGroupMemberShape(member);
			if(layer)
				return layer;
				
			layer = this.createGroupMemberMarker(member, symbolUrl);
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
function MapGroupLayer(map, groupname){
	this.groupname = groupname;
	this.map = map;
	this.groupMembers = {};
	this.markers = {};
	this.featureGroup = new L.FeatureGroup();
	for(var id in this.markers){
		var marker = this.markers[id];
		this.featureGroup.addLayer(marker);
	}
}
MapGroupLayer.prototype.addMember = function(id, member, marker){
	this.groupMembers[id] = member;
	this.markers[id] = marker;
	if(this.style)
		marker.setStyle(this.style);
	this.featureGroup.addLayer(marker);
	return this;
}
MapGroupLayer.prototype.getMember = function(id){
	return this.groupMembers[id];
}
MapGroupLayer.prototype.setStyle = function(style){
	for(var id in this.markers){
		var marker = this.markers[id];
		marker.setStyle(style);
	}
	this.style = style;
	return this;
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
	this.featureGroup.on(eventName, function(e){
		for(var id in _this.markers){
			var marker = _this.markers[id];
			var member = _this.groupMembers[id];
			if(marker==e.layer){
				callback(e, member, marker);
				return;
			}
			for(var markerId in marker._layers){
				var marker = marker._layers[markerId];
				if(marker==e.layer){
					callback(e, member, marker);
					return;
				}
			}
		}
		console.warning("event on feature group did not convert to marker", e, _this.markers);
	});
	return this;
}
MapGroupLayer.prototype.getLayer = function(){
	return this.featureGroup;
}
MapGroupLayer.prototype.eachMember = function(callback){
	for(var id in this.groupMembers){
		var member = this.groupMembers[id];
		var marker = this.markers[id];
		callback(member, marker);
	}
	return this;
}
