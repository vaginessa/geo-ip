/* global HOSTNAME:true, XDomainRequest:true */

/* jshint -W098 */
var geoip2 = (function () {
  /* jshint +W098 */
  'use strict';
  var exports = {};

  function Lookup(successCallback, errorCallback, options, type) {
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    /* This is for unit testing geolocation failures */
    this.geolocation = options && options.hasOwnProperty('geolocation') ? options.geolocation : navigator.geolocation;
    this.type = type;
  }

  Lookup.prototype.returnSuccess = function (location) {
    if (this.successCallback && typeof this.successCallback === 'function') {
      this.successCallback(this.fillInObject(this.objectFromJSON(location)));
    }
  };

  Lookup.prototype.returnError = function (error) {
    if (this.errorCallback && typeof this.errorCallback === 'function') {
      if (!error) {
        error = {
          'error': 'Unknown error',
        };
      }
      this.errorCallback(error);
    }
  };

  Lookup.prototype.objectFromJSON = function (json) {
    if (typeof window.JSON !== 'undefined' && typeof window.JSON.parse === 'function') {
      return window.JSON.parse(json);
    }
    else {
      /* jshint evil:true */
      return eval('(' + json + ')');
      /* jshint evil:false */
    }
  };

  var fillIns = {
    'country': [
            ['continent', 'Object', 'names', 'Object'],
            ['country', 'Object', 'names', 'Object'],
            ['registered_country', 'Object', 'names', 'Object'],
            ['represented_country', 'Object', 'names', 'Object'],
            ['traits', 'Object'],
    ],
    'city': [
            ['city', 'Object', 'names', 'Object'],
            ['continent', 'Object', 'names', 'Object'],
            ['country', 'Object', 'names', 'Object'],
            ['location', 'Object'],
            ['postal', 'Object'],
            ['registered_country', 'Object', 'names', 'Object'],
            ['represented_country', 'Object', 'names', 'Object'],
            ['subdivisions', 'Array', 0, 'Object', 'names', 'Object'],
            ['traits', 'Object'],
    ],
  };
  Lookup.prototype.fillInObject = function (obj) {
    var fill = this.type === 'country' ? fillIns.country : fillIns.city;

    for (var i = 0; i < fill.length; i++) {
      var path = fill[i];
      var o = obj;

      for (var j = 0; j < path.length; j += 2) {
        var key = path[j];
        if (!o[key]) {
          o[key] = path[j + 1] === 'Object' ? {} : [];
        }
        o = o[key];
      }
    }

    /* jshint camelcase: false */
    try {
      Object.defineProperty(
        obj.continent,
        'continent_code', {
          enumerable: false,
          get() {
            return this.code;
          },
          set(value) {
            this.code = value;
          },
        });
    }
    catch (e) {
      if (obj.continent.code) {
        obj.continent.continent_code = obj.continent.code;
      }
    }

    if (this.type !== 'country') {
      try {
        Object.defineProperty(
          obj,
          'most_specific_subdivision', {
            enumerable: false,
            get() {
              return this.subdivisions[this.subdivisions.length - 1];
            },
            set(value) {
              this.subdivisions[this.subdivisions.length - 1] = value;
            },
          });
      }
      catch (e) {
        obj.most_specific_subdivision = obj.subdivisions[obj.subdivisions.length - 1];
      }
    }
    /* jshint camelcase: true */

    return obj;
  };

  Lookup.prototype.getGeoIPResult = function () {
    var that = this,
      param,
      request,
      uri = '//' + ('geoip-js.maxmind.com') + '/geoip/v2.1/' + this.type + '/me?',
      httpParams = {
        referrer: location.protocol + '//' + location.hostname,
      };

    if (this.alreadyRan) {
      return;
    }
    this.alreadyRan = 1;

    if (navigator.appName === 'Microsoft Internet Explorer' && window.XDomainRequest && navigator.appVersion.indexOf('MSIE 1') === -1) {
      request = new XDomainRequest();
      uri = window.location.protocol + uri;
      // Fix for aborted connection in IE9 under some conditions
      // See http://www.havber.net/2012/04/aborted-xdr-requests-in-ie9/
      request.onprogress = function () {};
    }
    else {
      request = new window.XMLHttpRequest();
      uri = 'https:' + uri;
    }

    for (param in httpParams) {
      if (httpParams.hasOwnProperty(param) && httpParams[param]) {
        uri += param + '=' + encodeURIComponent(httpParams[param]) + '&';
      }
    }
    uri = uri.substring(0, uri.length - 1);

    request.open('GET', uri, true);
    request.onload = function () {
      if (typeof request.status === 'undefined' || request.status === 200) {
        that.returnSuccess(request.responseText);
      }
      else {
        var contentType = request.hasOwnProperty('contentType') ? request.contentType : request.getResponseHeader('Content-Type');

        var error;
        if (/json/.test(contentType) && request.responseText.length) {
          try {
            error = that.objectFromJSON(request.responseText);
          }
          catch (e) {
            error = {
              'code': 'HTTP_ERROR',
              'error': 'The server returned a ' + request.status + ' status with an invalid JSON body.',
            };
          }
        }
        else if (request.responseText.length) {
          error = {
            'code': 'HTTP_ERROR',
            'error': 'The server returned a ' + request.status + ' status with the following body: ' + request.responseText,
          };
        }
        else {
          error = {
            'code': 'HTTP_ERROR',
            'error': 'The server returned a ' + request.status + ' status but either the server did not return a body' + ' or this browser is a version of Internet Explorer that hides error bodies.',
          };
        }

        that.returnError(error);
      }
    };
    request.ontimeout = function () {
      that.returnError({
        'code': 'HTTP_TIMEOUT',
        'error': 'The request to the GeoIP2 web service timed out.',
      });
    };
    request.onerror = function () {
      that.returnError({
        'code': 'HTTP_ERROR',
        'error': 'There was a network error receiving the response from the GeoIP2 web service.',
      });
    };
    request.send(null);
  };

  exports.country = function (successCallback, errorCallback, options) {
    var l = new Lookup(successCallback, errorCallback, options, 'country');
    l.getGeoIPResult();
    return;
  };

  exports.city = function (successCallback, errorCallback, options) {
    var l = new Lookup(successCallback, errorCallback, options, 'city');
    l.getGeoIPResult();
    return;
  };

  exports.insights = function (successCallback, errorCallback, options) {
    var l = new Lookup(successCallback, errorCallback, options, 'insights');
    l.getGeoIPResult();
    return;
  };

  return exports;
}());
