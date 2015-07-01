'use strict';

var util = require('util');
var chainlib = require('chainlib');
var log = chainlib.log;
var BaseChain = require('../chain');
var async = require('async');

function Chain(options) {
  BaseChain.call(this, options);
}

util.inherits(Chain, BaseChain);

Chain.prototype._writeBlock = function(block, callback) {
  // Update hashes
  this.cache.hashes[block.hash] = block.prevHash;
  // call db.putBlock to update prevHash index, but it won't write the block to disk
  this.db.putBlock(block, callback);
};

Chain.prototype._validateBlock = function(block, callback) {
  // All validation is done by bitcoind
  return callback();
};

module.exports = Chain;
