'use strict';

var Block = require('./block');
var chainlib = require('chainlib');
var log = chainlib.log;
var async = require('async');

function Miner(options) {
  var self = this;

  if(!options) {
    throw new Error('Must incude miner options');
  }

  this.chain = options.chain;
  this.db = options.db;
  this.hashesPerCycle = options.hashesPerCycle || Miner.HASHES_PER_CYCLE;
  this.started = false;

  this.chain.on('addblock', function() {
    self.tipChanged = true;
  });
}

Miner.HASHES_PER_CYCLE = 100;

Miner.prototype.start = function() {
  log.debug('Started miner');
  this.started = true;
  this.mineBlocks();
};

Miner.prototype.mineBlocks = function() {
  var self = this;

  async.whilst(
    function() {
      return self.started;
    },
    function(callback) {
      self.mineBlock(function(err) {
        setImmediate(function() {
          callback(err);
        });
      });
    }, function(err) {
      if(err) {
        self.started = false;
        return log.error('Miner stopped due to error: ', err);
      }

      log.debug('Miner stopped');
    }
  );
};

Miner.prototype.mineBlock = function(callback) {
  var self = this;

  // Get transactions from mempool
  var mempoolTransactions = self.db.mempool.getTransactions();

  // Add coinbase transaction
  var transactions = [];
  if (this.db.buildCoinbaseTransaction) {
    var coinbase = this.db.buildCoinbaseTransaction(mempoolTransactions);
    transactions.push(coinbase);
  }

  transactions = transactions.concat(mempoolTransactions);
  self.chain.getNextWorkRequired(self.chain.tip, function(err, bits) {
    if(err) {
      return callback(err);
    }

    var block = new Block({
      prevHash: self.chain.tip.hash,
      timestamp: new Date(),
      nonce: 0,
      bits: bits
    });

    self.db.addTransactionsToBlock(block, transactions);

    var validPOW = false;
    self.tipChanged = false;
    async.whilst(
      function() {
        return !validPOW && !self.tipChanged && self.started;
      },
      function(next) {
        for(var i = 0; i < self.hashesPerCycle; i++) {
          block.nonce++;
          validPOW = block.validProofOfWork(self.chain);
          if(validPOW) {
            return setImmediate(next);
          }
        }
        setImmediate(next);
      }, function() {
        if(self.tipChanged) {
          log.debug('Abandoned block because tip changed');
          return callback();
        }

        if(!self.started) {
          log.debug('Abandoned block because miner was stopped');
          return callback();
        }

        // Add block to chain
        log.debug('Miner built block ' + block.hash);
        self.chain.addBlock(block, function(err) {
          if(err) {
            log.error('Miner could not add block ' + block.hash + ' to chain: ' + err.stack);
          } else {
            log.debug('Miner successfully added block ' + block.hash + ' to chain');
          }
          callback();
        });
      }
    );


  });
};

Miner.prototype.stop = function() {
  this.started = false;
};

module.exports = Miner;
