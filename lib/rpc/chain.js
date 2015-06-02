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

Chain.prototype._updateTip = function(block, callback) {
  log.debug('Chain updating the tip for: ' + block.hash);
  var self = this;

  if (block.prevHash !== self.tip.hash) {
    log.debug('Chain is starting reorg');
    var reorg = new Reorg(self, block, self.tip, 0);
    reorg.go(callback);
  } else {
    // Populate height
    block.__height = self.tip.__height + 1;

    async.series(
      [
        self._validateBlock.bind(self, block),
        self.db._onChainAddBlock.bind(self.db, block)
      ],
      function(err) {
        if(err) {
          return callback(err);
        }

        self.tip = block;
        self.saveMetadata();
        log.debug('Chain added block to main chain');
        self.emit('addblock', block);
        callback();
      }
    );
  }

  // No such thing as adding blocks to forks because bitcoind is always on the best chain
};

module.exports = Chain;
