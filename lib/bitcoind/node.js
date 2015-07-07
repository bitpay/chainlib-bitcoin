'use strict';

var Chain = require('./chain');
var Block = require('../block');
var DB = require('./db');
var chainlib = require('chainlib');
var P2P = chainlib.P2P;
var BaseNode = chainlib.Node;
var util = require('util');
var log = chainlib.log;
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var _ = bitcore.deps._;
var genesis = require('../genesis.json');

function Node(config) {
  var self = this;

  BaseNode.call(this, config);

  this.testnet = config.testnet;
}

util.inherits(Node, BaseNode);

Node.prototype._loadConfiguration = function(config) {
  var self = this;
  this._loadBitcoind(config);
  Node.super_.prototype._loadConfiguration.call(self, config);
};

Node.prototype._loadBitcoind = function(config) {
  var self = this;

  var bitcoindConfig = {};
  if (config.testnet) {
    bitcoindConfig.directory = '~/.bitcoin/testnet3';
  } else {
    bitcoindConfig.directory = '~/.bitcoin';
  }

  // start the bitcoind daemon
  this.bitcoind = require('bitcoind.js')(bitcoindConfig);

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

  config.p2p.noListen = true;
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

  // Add references
  // DB
  this.db.chain = this.chain;
  this.db.Block = this.Block;

  // Chain
  this.chain.db = this.db;
  this.chain.p2p = this.p2p;

  // P2P
  this.p2p.db = this.db;
  this.p2p.chain = this.chain;

  this.bitcoind.on('ready', function(status) {
    log.info('Bitcoin Daemon Ready');
    self.db.bitcoind = self.bitcoind;
    self.db.initialize();
  });

  this.bitcoind.on('open', function(status) {
    log.info('Bitcoin Core Daemon Status:', status);
  });

  this.bitcoind.on('error', function(err) {
    log.error('Bitcoin Core Daemon Error:', err);
  });

  this.db.on('ready', function() {
    log.info('Bitcoin Database Ready');
    self.chain.db = self.db;
    self.chain.initialize();
  });

  this.db.on('error', function(err) {
    self.emit('error', err);
  });

  this.chain.on('ready', function() {
    log.info('Bitcoin Chain Ready');
    self.p2p.initialize();
  });

  this.chain.on('error', function(err) {
    self.emit('error', err);
  });

  this.p2p.on('ready', function() {
    log.info('Bitcoin P2P Ready');
    self.emit('ready');
  });

  this.p2p.on('error', function(err) {
    self.emit('error', err);
  });
};

module.exports = Node;
