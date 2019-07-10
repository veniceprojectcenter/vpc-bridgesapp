app.init_map = function(ctl){
  ctl.dataset_errors = [];
  ctl.marker_group = L.layerGroup();

  ctl.init_map =function(){
    console.log("init map!");
    ctl.map = L.map('map',{center:[45.438109, 12.327966],zoom: 17 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}', {foo: 'bar', attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'}).addTo(ctl.map);
    ctl.apply();
  };

  ctl.addMarker = function(item){
    if(item.birth_certificate.lat == null){  
      //console.log("errore lat => ", item);
      ctl.dataset_errors.push(item);
      return;
    }
    var icon = ctl.create_icon(item);
    var new_marker = L.marker([item.birth_certificate.lat, item.birth_certificate.lng], {customID: item.birth_certificate.ck_id, item: item, icon: icon});
    new_marker.addTo(ctl.marker_group);
    //new_marker.on('click', ctl.opendetail);
    new_marker.on('mouseover', ctl.mouseover);
    new_marker.on('mouseout',ctl.mouseleave);
    ctl.marker_group.addTo(ctl.map); 
  };

  ctl.mouseover = function(){
    ctl.hoverData = [];
    ctl.hoverData.push({
      name  : "Additional Handrail?",
      value : this.options.item["Additional Handrail?"]
    });
    ctl.hoverData.push({
      name  : "Bridge Code",
      value : this.options.item["Bridge Code"]
    });
    ctl.hoverData.push({
      name  : "Bridge Name",
      value : this.options.item["Bridge Name"]
    });
    ctl.hoverData.push({
      name: "Bridge Number According to Zucchetta",
      value : this.options.item["Bridge Number According to Zucchetta"]
    });
    ctl.hoverData.push({
      name  : "Canal Crossed",
      value : this.options.item["Canal Crossed"]
    });
    ctl.hoverData.push({
      name  : "Crooked Bridge?",
      value : this.options.item["Crooked Bridge?"]
    });
    ctl.hoverData.push({
      name  : "Estimated Surface Area",
      value : this.options.item["Estimated Surface Area"]
    });
    ctl.hoverData.push({
      name  : "Handicapped Accessible?",
      value : this.options.item["Handicapped Accessible?"]
    });
    ctl.hoverData.push({
      name  : "Height Center (m)",
      value : this.options.item["Height Center (m)"]
    });
    ctl.hoverData.push({
      name  : "Minimum Height (m)",
      value : this.options.item["Minimum Height (m)"]
    });
    ctl.hoverData.push({
      name  : "ID",
      value : this.options.item["ID"]
    });
    ctl.hoverData.push({
      name  : "CK ID",
      value : this.options.item.birth_certificate.ck_id
    });
    ctl.hoverData.push({
      name  : "Latitude",
      value : this.options.item.birth_certificate.lat
    });
    ctl.hoverData.push({
      name  : "Longitude",
      value : this.options.item.birth_certificate.lng
    });
    ctl.hoverData.push({
      name  : "Private Bridge?",
      value : this.options.item["Private Bridge?"]
    });
    ctl.hoverData.push({
      name  : "Span (m)",
      value : this.options.item["Span (m)"]
    });
    ctl.hoverData.push({
      name  : "Total Number of Steps",
      value : this.options.item["Total Number of Steps"]
    });
    $(".my_over").css("height","350px");
    ctl.apply();
  }

  ctl.mouseleave = function(){
    ctl.hoverData = null;
    $(".my_over").css("height","100px");
    ctl.apply();
  }

  ctl.create_icon = function(item){
      var iconurl = "/images/red_dot.png";
      //console.log("Minimum height m: ",item["Minimum Height (m)"]);
      //console.log("altezza convertita",parseInt(parseFloat(item["Minimum Height (m)"])*100.0));
      if(parseInt(parseFloat(item["Minimum Height (m)"])*100.0) > (parseFloat(ctl.waterHeight )+ parseFloat(ctl.boatHeight) )){
        iconurl = "/images/green_dot.png";
      }
      var icon = L.icon({
        iconUrl:      iconurl,
        iconSize:     [16, 16], // size of the icon
        iconAnchor:   [8, 8], // point of the icon which will correspond to marker's location
       // popupAnchor:  [32, 32] // point from which the popup should open relative to the iconAnchor
      });
      return icon;
  }

  ctl.redraw =function(){
    ctl.marker_group.clearLayers();
    ctl.marker_group = L.layerGroup();
    for(var k in ctl.dataset){
      ctl.addMarker(ctl.dataset[k]);
    }
    ctl.apply();
  };

}
