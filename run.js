var piwar = require('./piwar')
  , config = require('./config');

var state = {};

piwar.setup( state )
.then(piwar.checkdb)
.then(piwar.primedb)
.then(piwar.preload)
.then(piwar.scan)
.then(piwar.cleanup)
.catch(function( err ) {
  console.log( err );
});
