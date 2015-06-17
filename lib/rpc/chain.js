'use strict';

var util = require('util');
var chainlib = require('chainlib');
var log = chainlib.log;
var BaseChain = chainlib.Chain;
var Reorg = chainlib.Reorg;
var async = require('async');

function Chain(options) {
  BaseChain.call(this, options);
}

util.inherits(Chain, BaseChain);

Chain.prototype._checkExisting = function(block, callback) {
  // Don't check if the block already exists.
  // It will show up as existing because db.getBlock() will pull it from RPC
  return callback();
};

Chain.prototype._validateBlock = function(block, callback) {
  // All validation is done by bitcoind
  return callback();
};

module.exports = Chain;
