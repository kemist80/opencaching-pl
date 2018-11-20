
function mainMapEntryPoint(params){

  // filters should be initialized before ocTiles first load
  initFilter(params);

  // add tile layer with caches generated by OKAPI
  addOCTileLayer(params);

  // init map click handlers
  mapClickInit(params);

  // add to DynamicMapChunk callback on background layer changge
  addLayerChangeCallback(params);

  // additional controls for fullScreen mode
  if(params.isFullScreenMap){
    initFullScreenMapControls(params);
  }

  // init the rest of mainMap controls
  initControls(params);

  initSearch(params);
}

function addOCTileLayer(params) {

  var map = DynamicMapServices.getMapObject(params.mapId);

  var ocLayer = new ol.layer.Tile({
    source: getOcTailSource(params),
    visible: true,
    zIndex: 100,
    wrapX: true,
  });

  OcLayerServices.setOcLayerName(ocLayer, 'oc_okapiTiles');

  map.addLayer(ocLayer);
}

function getOcTailSource(params, addRandomParam) {

  var ocTileUrl = '/MainMapAjax/getMapTile/{x}/{y}/{z}/'+params.userUuid;

  // collect filter params, search data etc.
  urlParamsArr = getCommonUrlParams(params);

  if ( addRandomParam != undefined ) {
    t = new Date();
    urlParamsArr.push("rand=" + "r" + t.getTime());
  }

  if(urlParamsArr.length > 0){
    ocTileUrl += '?' + urlParamsArr.join('&');
  }

  return new ol.source.TileImage({
    url: ocTileUrl,
    opacity: 1,
    wrapDateLine: false,
    wrapX: true,
    noWrap: false
  })

}

function getCommonUrlParams(params){
  urlParamsArr = [];

  if ( params.searchData ) {
    urlParamsArr.push("searchdata="+params.searchData);
  }

  // load filters data
  $.each( dumpFiltersToJson(), function(key,val) {

    if( typeof(val) === typeof(true) ){
      if( val ){ // for booleans: skip false props, skip "true" value
        urlParamsArr.push(key);
      }
    } else {
      urlParamsArr.push(key+'='+val);
    }

  });

  // load cacheSet data if necessary
  if( $('#mapFilters #csEnabled').length ) { // cacheSet menu present
    if( $('#mapFilters #csEnabled').is( ":checked" ) ) { // and cacheSet enabled

      csIdEl = $('#mapFilters #csId');
      urlParamsArr.push( "csId="+csIdEl.val() );
    }
  }

  return urlParamsArr;
}

function mapClickInit(params) {

  var map = DynamicMapServices.getMapObject(params.mapId);

  var pendingClickRequest = null; //last click ajax request
  var pendingClickRequestTimeout = 10000; // default timeout - in milliseconds

  var compiledPopupTpl = null;

  /**
   * Cancel previous ajax requests
   */
  var _abortPreviousRequests = function () {
    if (pendingClickRequest) {
      pendingClickRequest.abort();
      pendingClickRequest = null;
    }
  }

  /**
   * Returns extent 32px x 32px with center in coordinates
   */
  var _getClickBounds = function (coords) {
    unitsPerPixel = map.getView().getResolution();
    circleClicked = new ol.geom.Circle(coords, 16*unitsPerPixel)
    return circleClicked.getExtent()
  }

  var _displayClickMarker = function (coords) {

    clickMarker = map.getOverlayById('mapClickMarker')
    if (clickMarker==null) { //clickMarker is undefined
      // prepare map click marker overlay.

      var clickMarkerDiv = $('<div id="mapClickMarker"></div>');
      map.addOverlay( new ol.Overlay(
          {
            id: 'mapClickMarker',
            element: clickMarkerDiv[0],
            positioning: 'center-center',
            position: coords,
            autoPanAnimation: {
              duration: 250
            },
          }
      ))
    } else {
      clickMarker.setPosition(coords)
    }
  }

  var _hideClickMarker = function () {
    clickMarker = map.getOverlayById('mapClickMarker')
    if ( clickMarker ) { // clickMarker is present
      clickMarker.setPosition(undefined)
    }
  }

  var _hidePopup = function() {
    popup = map.getOverlayById('mapPopup')
    if ( popup ) { // clickMarker is present
      popup.setPosition(undefined)
    }
  }

  /**
   * Returns url to retrive cache data
   * @param coords - OL coords of click
   * @param skipFilters boolean - if set filters are skiped
   */
  var _getPopupDataUrl = function(coords) {

    var url='/MainMapAjax/getPopupData/';

    // add bbox in SWNE format (see OKAPI)
    var extent = _getClickBounds(coords);
    swCorner = ol.proj.transform(ol.extent.getBottomLeft(extent),'EPSG:3857','EPSG:4326');
    neCorner = ol.proj.transform(ol.extent.getTopRight(extent),'EPSG:3857','EPSG:4326');
    url += swCorner[1]+'|'+swCorner[0]+'|'+neCorner[1]+'|'+ neCorner[0];

    // add userId param
    url += '/' + params.userUuid;

    // collect filter params, search data etc.
    urlParamsArr = getCommonUrlParams(params);
    if(urlParamsArr.length > 0){
      url += '?' + urlParamsArr.join('&');
    }

    return url;
  }

  var onLeftClickFunc = function(coords) {

    _abortPreviousRequests();

    _displayClickMarker(coords);

    pendingClickRequest = jQuery.ajax({
      url: _getPopupDataUrl(coords),
    });

    pendingClickRequest.always( function() {
      _hideClickMarker();
      pendingClickRequest = null;
    });

    pendingClickRequest.done( function( data ) {

      if (data === null) { // nothing to display
          _hidePopup();
          return; //nothing more to do here
      }

      popup = map.getOverlayById('mapPopup');
      if (popup == null) {

        // there is no popup object - create it
        map.addOverlay( popup = new ol.Overlay(
            {
              id: 'mapPopup',
              element: $('<div id="mapPopup"></div>')[0],
              position: undefined, // will be set below
              autoPan: true,
              autoPanAnimation: {
                duration: 250
              },
            }
        ));


      }

      // load popup data
      if(compiledPopupTpl == null){
        var popupTpl = $("#mainMapPopupTpl").html();
        var compiledPopupTpl = Handlebars.compile(popupTpl);
      }
      $('#mapPopup').html(compiledPopupTpl(data));

      var cacheCords = ol.proj.transform([data.coords.lon,data.coords.lat],'EPSG:4326','EPSG:3857');
      popup.setPosition(cacheCords);

      // assign click on popup close button handler
      $("#mapPopup-closer").click(function() {
        popup.setPosition(undefined);
        return false;
      });


    });
  };

  var onRightClickFunc = function(coords) {
    _abortPreviousRequests();
    _displayClickMarker(coords)
    //todo
  }

  /**********************************/
  /** init handlers                          */
  /**********************************/

  // assign left-click handler
  map.on("singleclick", function(evt) {
    onLeftClickFunc(evt.coordinate)
  })

  // asign right-click handler
  map.getViewport().addEventListener('contextmenu', function (evt) {
    evt.preventDefault()
    onRightClickFunc(map.getEventCoordinate(evt))
  })

  if(params.openPopupAtCenter){
    onLeftClickFunc(map.getView().getCenter());
  }

}

function dumpFiltersToJson() {

  var json = {};

  // get elements marked as filter params
  $( '#mapFilters .filterParam' ).each(function() {

    if( $(this).is('input[type=checkbox]') ){
      json[$(this).prop('id')] = $(this).prop("checked");

    } else if ( $(this).is('input') ) {
      json[$(this).prop('id')] = $(this).val();

    } else if ( $(this).is('select') ) {
      json[$(this).prop('id')] = $(this).val();

    } else {
      console.err('Unknown filter param?!');
    }
  });

  return json;
}

function initFilter(params) {

  // check if we have saved filters state
  if(params.initUserPrefs){
    // set filter values saved at server side
    $.each(params.initUserPrefs.filters, function(key, val) {

      var el = $("#mapFilters #"+key);
      if (el.is("input[type=checkbox]")) {
        el.prop('checked', val);
      } else if (el.is("select")) {
        el.val(val);
      } else {
        console.error('Unknown saved element?!:'+key+":"+val);
      }
    });
  }
  /**
   * Filters changed - ocLayer should be refreshed
   */
  var refreshOcTiles = function (refreshTiles) {

    var map = DynamicMapServices.getMapObject(params.mapId);

    // refresh OC-tile layer
    ocLayer = map.getLayers().forEach(function (layer){
      if( OcLayerServices.getOcLayerName(layer) === 'oc_okapiTiles' ) {
        layer.setSource(getOcTailSource(params, refreshTiles));
      }
    });

    // save user map settings to server
    saveUserSettings(params);
  }

  // add filters click handlers
  $('#mapFilters input.filterParam').click(function() {
    refreshOcTiles();
  });

  $('#mapFilters #csEnabled').click(function() {
    refreshOcTiles();
  });


  $('#mapFilters select.filterParam').change(function() {
    refreshOcTiles();
  });

  $('#refreshButton').click(function() {
    refreshOcTiles(true);
  });

}

function addLayerChangeCallback(params){
  DynamicMapServices.addMapLayerSwitchCallback(params.mapId, function(layerName){
    saveUserSettings(params);
  });
}

function saveUserSettings(params) {

  if(params.dontSaveFilters){
    return;
  }

  var json = {
      "filters": dumpFiltersToJson(),
      "map": DynamicMapServices.getSelectedLayerName(params.mapId),
  };

  $.ajax({
    type: "POST",
    dataType: 'json',
    url: "/MainMapAjax/saveMapSettingsAjax",
    data: { 'userMapSettings': JSON.stringify( json ) },
    success: function() {
      console.info("User preferences saved.")
    },
    error: function() {
      console.error("Can't save user map preferences!")
    },
  });

}

function initFullScreenMapControls(params) {
    var map = DynamicMapServices.getMapObject(params.mapId);

    var filtersDiv = $('#mapFilters');
    filtersDiv.toggle(false); // to be sure filters are hidden now

    // add filters as map control
    map.addControl(new ol.control.Control(
        {
          element: filtersDiv[0],
        }
    ));

    $('#filtersToggle').click(function() {

      // hide/display filters box
      filtersDiv.toggle()
    });

}

function initControls(params) {
  var map = DynamicMapServices.getMapObject(params.mapId);

  // add mainMap custom icons
  map.addControl(new ol.control.Control(
      {
        element: $("#mainMapControls")[0],
      }
  ));

  // init fullscreen <-> embeded map toggler
  $('#fullscreenToggle').click(function() {

    zoom = map.getView().getZoom();
    coords = map.getView().getCenter();
    projection = map.getView().getProjection().getCode();
    wgs84Coords = ol.proj.transform(coords, projection, 'EPSG:4326');

    var currentLocation = window.location.href;
    if( params.isFullScreenMap ){
      // this is fullscreen map -> user switch to embeded
      document.cookie = "forceFullScreenMap=off;"; //remember user decision in cookie
        url = currentLocation.replace(/fullScreen/i, "embeded");
    } else {
        document.cookie = "forceFullScreenMap=on;";
        url = currentLocation.replace(/embeded/i, "fullScreen");
    }

    window.location.href = url;
  });


  // add 150m circle at given coords
  if ( params.circle150m ) {

    var center = map.getView().getCenter();

    var circle = new ol.Feature({
      geometry: new ol.geom.Circle(center, 300),
    });

    var initCordsText = CoordinatesUtil.toWGS84(map, circle.getGeometry().getCenter());

    circle.setStyle([
        new ol.style.Style({ // style of circle
            stroke: new ol.style.Stroke({
              color: DynamicMapServices.styler.fgColor,
              width: 2
            }),
            text: new ol.style.Text({
              text: initCordsText,
              offsetY: 30,
              backgroundFill: new ol.style.Fill(
                  {color: DynamicMapServices.styler.bgColor}),
              padding: [5,5,5,5],
              scale: 1.2,
            }),
        }),
        new ol.style.Style({ // style of center marker
          geometry: function(feature){
            return new ol.geom.Point(feature.getGeometry().getCenter());
          },
          image: new ol.style.RegularShape({
            stroke: new ol.style.Stroke({
              color: DynamicMapServices.styler.fgColor,
              width: 2,
            }),
            points: 4,
            radius: 10,
            radius2: 0,
            angle: Math.PI / 4
          })
        })
        ]
    );

    var circleColection = new ol.Collection([circle]);

    var circleLayer = new ol.layer.Vector ({
      zIndex: 200,
      visible: true,
      source:  new ol.source.Vector({features: circleColection}),
    });

    OcLayerServices.setOcLayerName(circleLayer, 'oc_circle');

    map.addLayer(circleLayer);

    var movement = new ol.interaction.Translate({
      layers: [circleLayer]
    });

    map.addInteraction( movement );

    movement.on('translateend', function(evt){

      var circle = evt.features.pop();
      var coords = CoordinatesUtil.toWGS84(map, circle.getGeometry().getCenter());

      var style = circle.getStyle();
      var text = style[0].getText();
      text.setText(coords);
      style[0].setText(text);
      circle.setStyle(style);
    });
  }

}

function initSearch(params) {

    if (!params.isSearchEnabled) {
        $('#searchToggle').hide();
        console.log("Main map search disabled.");
        return;
    }

    var map = DynamicMapServices.getMapObject(params.mapId);
    // add mainMap custom icons
    map.addControl(new ol.control.Control(
        {
            element: $("#mainMapSearch")[0],
        }
    ));

    var _place;
    var compiledSearchResultTpl = null;

    var search = $('#mainMapSearch');
    var searchToggle = $('#searchToggle');
    var searchTrigger = $('#searchTrigger');
    var inputSearch = $('#searchInput');
    var resultsDiv = $("#searchResults");

    search.hide();


    $('#filtersToggle').click(function() {
        closeSearch();
    });

    searchToggle.click(function(e) {
        $('.mapFiltersFullScreen').hide();
        search.is(":visible") ? closeSearch() : _openSearch();
    });

    searchTrigger.click(function() {
        if (inputSearch.val().length > 0) {
            _executeSearch();
        }
    });

    inputSearch.keyup(function() {
        _enableSearchTrigger(inputSearch.val().length > 0);
    });

    inputSearch.keypress(function(e) {
        if (e.which == 13 && inputSearch.val().length > 0) {
            _executeSearch();
        }
    });

    var _enableSearchTrigger = function(enable) {
        if (enable) {
            searchTrigger.removeClass('disabled');
        } else {
            searchTrigger.addClass('disabled');
        }
    }

    var _executeSearch = function() {
        resultsDiv.empty();
        _place = inputSearch.val();
        _getLocalizationByPlace();
    }

    var _getLocalizationByPlace = function() {
        $.ajax({
            type: 'get',
            dataType: 'json',
            url: "/MainMapAjax/getPlaceLocalization/"+_place,
            success: function(data) {
                _displayResults(data);
            },
            error: function(error) {
                _displayError(error);
            },
        });
    }

    var _displayError = function(error) {
        resultsDiv.append("<div class='error'>" + tr.map_error + "</div>");
    }

    var _displayResults = function(data) {

        // load results
        if (!compiledSearchResultTpl) {
            var searchResultTpl = $("#mainMapSearchResultTpl").html();
            var compiledSearchResultTpl = Handlebars.compile(searchResultTpl);
        }

        if (data.length > 0) {
            data.forEach(function (entry) {
                var result = compiledSearchResultTpl(entry);
                var resultDiv = $(result);
                resultDiv.click(function () {
                    _applySelectedPlace(entry);
                });
                resultsDiv.append(resultDiv);
            });
        } else {
            resultsDiv.append("<div class='error'>" + tr.map_searchEmpty + _place + "</div>");
        }
    }

    var _applySelectedPlace = function(result) {
        _adjustMap(result);
        closeSearch();
    }

    var _adjustMap = function(result) {
        var bbox = result.bbox;
        var sw = ol.proj.fromLonLat([bbox[0], bbox[1]]);
        var ne = ol.proj.fromLonLat([bbox[2], bbox[3]]);
        map.getView().fit([sw[0], sw[1], ne[0], ne[1]], {nearest: true});
    }

    var _resetInput = function() {
        resultsDiv.empty();
        inputSearch.val('');
    }

    var _openSearch = function() {
        search.show();
        inputSearch.focus();
    }

    var closeSearch = function() {
        search.hide();
        _resetInput();
        _enableSearchTrigger(false);
    }
}



