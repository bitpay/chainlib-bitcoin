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
  this.rpc.getBlock(hash, false, function(err, blockData) {
    if(err) {
      return callback(err);
    }

    var block = self.Block.fromBuffer(new Buffer(blockData, 'hex'));
    callback(null, block);
  });
};

DB.prototype.putBlock = function(block, callback) {
  // block is already stored in bitcoind, but we need to update
  // our prevhash index still
  this._updatePrevHashIndex(block, callback);
};

module.exports = DB;
