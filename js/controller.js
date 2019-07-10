app.controller('DataCtrl', ['$scope', '$compile','$http', function($scope, $compile, $http){
  ctl = this;
  app.ctl = this;
  ctl.waterHeight = 60;
  ctl.boatHeight = 100;
  ctl.BASE_URL = "https://ckdata.herokuapp.com/api/v1";
  app.init_map(ctl);

  $('#spinner').spin('large', '#fff');

  ctl.changeHeight = function(){
    ctl.redraw();
  }

  ctl.apply = function(){ setTimeout(function () { $scope.$apply(); }, 50); };

  ctl.getGroup = function(group_name){
    var defer = $.Deferred();
    $http.get(ctl.BASE_URL+"/datasets.json?group_name="+group_name).then(
      function(response){
        defer.resolve(response.data);
      },
      function(error){
        defer.reject(error.data);
      }
    );
    return defer;
  };

  ctl.getGroup("MERGE Ponti").then(
    function(response){
      ctl.dataset = response.dataset;
      for(var k in ctl.dataset){
        ctl.addMarker(ctl.dataset[k]);
        $("#loadingPanel").hide();
        $('#spinner').spin(false);
      }
    },
    function(error){
      console.err(error);
    }
  );

  $http.get('https://ckdata.herokuapp.com/realtime/venice_tide')
    .then(function(result) {
      if(result.status == 200){
        ctl.waterHeight = parseFloat(result.data.latest_tide_level);
      }
    },
    function(error){
      console.err("Centro MAREE: ",error);
    }
  );
  
  ctl.showAbout = function (){
    $('#aboutPanel').show();
  }
  ctl.hideAbout = function (){
    $('#aboutPanel').hide();
  }
  
}]);