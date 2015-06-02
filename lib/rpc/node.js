'use strict';

var Chain = require('./chain');
var Block = require('../block');
var DB = require('./db');
var P2P = require('./p2p');
var bitcoin = require('bitcoin');
var chainlib = require('chainlib');
var BaseNode = chainlib.Node;
var util = require('util');
var log = chainlib.log;
var async = require('async');
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var _ = bitcore.deps._;
var genesis = require('../genesis.json');

function Node(config) {
  var self = this;

  BaseNode.call(this, config);

  this.testnet = config.testnet;
  this.syncing = false;

  this.on('ready', function() {
    self.sync(function(err) {
      if(err) {
        self.emit('error', new Error('Sync failed ' + err));
      } else {
        log.info('Sync finished');
        self.emit('synced');
      }
    });
  });
}

util.inherits(Node, BaseNode);

Node.prototype._loadConfiguration = function(config) {
  this._loadRPC(config);
  Node.super_.prototype._loadConfiguration.call(this, config);
};

Node.prototype._loadRPC = function(config) {
  if(!config.rpc) {
    config.rpc = {};
  }

  this.rpc = new bitcoin.Client(config.rpc);
};

Node.prototype._loadNetwork = function(config) {
  if(config.network) {
    Networks.add(config.network);
    this.network = Networks.get(config.network.name);
  } else if(config.testnet) {
    this.network = Networks.get('testnet');
  } else {
    this.network = Networks.get('livenet');
  }
};

Node.prototype._loadDB = function(config) {
  if(config.DB) {
    // Other modules can inherit from our DB and replace it with their own
    DB = config.DB;
  }

  this.db = new DB(config.db);
};

Node.prototype._loadP2P = function(config) {
  var self = this;

  if(!config.p2p) {
    config.p2p = {};
  };

  config.p2p.network = this.network;
  config.p2p.Transaction = this.db.Transaction;
  config.p2p.Block = this.Block;
  this.p2p = new P2P(config.p2p);
};

Node.prototype._loadConsensus = function(config) {
  if(!config.consensus) {
    config.consensus = {};
  }

  this.Block = Block;

  var genesisBlock;
  if(config.genesis) {
    genesisBlock = config.genesis;
  } else if(config.testnet) {
    genesisBlock = genesis.testnet;
  } else {
    genesisBlock = genesis.livenet;
  }

  if (_.isString(genesisBlock)) {
    genesisBlock = this.Block.fromBuffer(new Buffer(genesisBlock, 'hex'));
  }

  // pass genesis to chain
  config.consensus.genesis = genesisBlock;
  this.chain = new Chain(config.consensus);
};

Node.prototype._initialize = function() {
  var self = this;

  this.db.rpc = this.rpc;

  Node.super_.prototype._initialize.call(this);

  this.p2p.on('block', this._onBlock.bind(this));
};

Node.prototype._onBlock = function() {
  var self = this;

  if(self.syncing) {
    return;
  }

  log.debug('New block advertised on p2p network');
  log.debug('Syncing with bitcoind');
  self.sync(function(err) {
    if(err) {
      self.emit('error', new Error('Syncing failed: ' + err));
    } else {
      log.debug('Syncing complete');
      self.emit('synced');
    }
  });
};

Node.prototype.sync = function(callback) {
  var self = this;

  if(this.syncing) {
    return callback();
  }

  this.syncing = true;

  log.debug('Syncing');

  var bitcoindHeight = 0;

  // Increase performance by saving metadata every 30 seconds instead of after every block
  // TODO we need a more performant way of managing the cache. We shouldn't have to write the whole
  // cache to disk every time
  self.chain.lastSavedMetadataThreshold = 30000;

  async.series(
    [
      function getBitcoindHeight(next) {
        self.rpc.getBlockCount(function(err, blockCount) {
          if(err) {
            return next(err);
          }

          bitcoindHeight = blockCount;
          log.debug('Bitcoind height is', bitcoindHeight);
          log.debug('Tip height is', self.chain.tip.__height);
          next();
        });
      }
    ], function(err) {
      if(err) {
        self.syncing = false;
        return callback(err);
      }

      async.whilst(
        function() {
          return self.chain.tip.__height < bitcoindHeight;
        },
        function(next) {
          async.waterfall(
            [
              function getBlockHash(next) {
                log.debug('Getting next block hash from bitcoind');
                self.rpc.getBlockHash(self.chain.tip.__height + 1, next);
              },
              function getBlock(hash, resHeaders, next) {
                log.debug('Retrieving block from bitcoind', hash);
                self.db.getBlock(hash, next);
              },
              function addBlock(block, next) {
                log.debug('Adding block from bitcoind');
                self.chain.addBlock(block, next);
              }
            ],
            next
          );
        },
        function(err) {
          if(err) {
            self.syncing = false;
            return callback(err);
          }

          self.chain.lastSavedMetadataThreshold = 0;
          self.chain.saveMetadata();
          self.syncing = false;
          callback();
        }
      );
    }
  );
};

module.exports = Node;
