var wifiscanner = require('wifiscanner')
  , sqlite3 = require('sqlite3').verbose()
  , Q = require('Q')
  , config = require('./config');

exports.setup = function(state) {
  if (config.debug == "true")
    console.log("Initialize PiWar...\n");

  var deferred = Q.defer();

  state.scanner = wifiscanner();
  state.db = new sqlite3.Database( config.dbFileName );
  state.networks = [];
  state.table_exists = false;

  deferred.resolve( state );

  return deferred.promise;
};

exports.checkdb = function(state) {
  if (config.debug == "true")
    console.log("Checking DB...\n");

  var deferred = Q.defer();

  state.db.serialize(function() {
    if (config.debug == "true") {
      console.log("Retrieving table from the DB...\n");
      console.log("Found:");
    }
    state.db.each("SELECT name FROM sqlite_master WHERE type='table' AND name='networks'", function(err, row) {
      if (err) {
        deferred.reject( err );
      } else {
        if (config.debug == "true")
          console.log(" - " + JSON.stringify(row) + "\n");
      }
    }, function(err, rowCount) {
      if (err) {
        deferred.reject( err );
      } else {
        if (config.debug == "true")
          console.log("Number of rows found: " + rowCount + "\n");
        if (rowCount > 0) {
          if (config.debug == "true")
            console.log("Table exists.\n");
          state.table_exists = true;
        } else {
          if (config.debug == "true")
            console.log("Table not found.\n");
          state.table_exists = false;
        }
        deferred.resolve(state);
      }
    });
  });

  return deferred.promise;
}

exports.primedb = function(state) {
  if (config.debug == "true")
    console.log("Preparing DB...\n");

  var deferred = Q.defer();

  if ( ! state.table_exists ) {
    if (config.debug == "true")
      console.log("Creating table.\n");
    state.db.run("CREATE TABLE networks (ssid TEXT, mac TEXT, channel TEXT, security TEXT, related TEXT)",[],function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(state);
      }
    });
  } else {
    deferred.resolve(state);
  }

  return deferred.promise;
};

exports.preload = function(state) {
  if (config.debug == "true")
    console.log("Retrieving data from DB...\n");

  var deferred = Q.defer();

  if (config.debug == "true")
    console.log("Networks retrieved:\n");
  state.db.each("SELECT ssid FROM networks", function(err, row) {
    if ( err ) {
      deferred.reject( err );
    } else {
      if (config.debug == "true")
        console.log(" - " + JSON.stringify(row) + "\n");
      state.networks.push(row.ssid);
    }
  }, function(err, rowCount) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(state);
    }
  });

  return deferred.promise;
};

exports.scan = function(state) {
  if (config.debug == "true")
    console.log("Scanning for wifi networks...\n");

  var deferred = Q.defer();

  state.scanner.scan(function(error, networks) {
    if ( error ) {
      deferred.reject( error );
    } else {
      var stmt = state.db.prepare("INSERT INTO networks VALUES (?,?,?,?,?)");
      for (var i = 0; i < networks.length; i++) {
        if ( ! in_array( networks[i].ssid, state.networks ) ) {
          var related = [];
          for (var j = 0; j < networks.length; j++) {
            if (networks[i].ssid != networks[j].ssid) {
              related.push(networks[j].ssid);
            }
          }
          if (config.debug == "true")
            console.log("Adding SSID " + networks[i].ssid + " to database.\n");
          stmt.run(networks[i].ssid, networks[i].mac, networks[i].channel, JSON.stringify(networks[i].security), JSON.stringify( related ));
          state.networks.push(networks[i].ssid);
        }
      }
      stmt.finalize();
      deferred.resolve( state );
    }
  });

  return deferred.promise;
};

exports.cleanup = function(state) {
  if (config.debug == "true")
    console.log("Cleaning up.\n");

  var deferred = Q.defer();

  state.db.close();

  deferred.resolve( state );

  return deferred.promise;
};

function in_array( needle, haystack ) {
  for ( var i = 0; i < haystack.length; i++ ) {
    if ( haystack[i] == needle ) {
      return true;
    }
  }
  return false;
}
