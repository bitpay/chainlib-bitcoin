'use strict';

var util = require('util');
var BaseDB = require('../db');

function DB(options) {
  BaseDB.call(this, options);
}

util.inherits(DB, BaseDB);

DB.PREFIXES = BaseDB.PREFIXES;

DB.prototype.getBlock = function(hash, callback) {
  var self = this;

  // get block from bitcoind
  this.bitcoind.getBlock(hash, function(err, blockData) {
    if(err) {
      return callback(err);
    }
    callback(null, self.Block.fromBuffer(blockData));
  });
};

DB.prototype.putBlock = function(block, callback) {
  // block is already stored in bitcoind, but we need to update
  // our prevhash index still
  this._updatePrevHashIndex(block, callback);
};

module.exports = DB;
