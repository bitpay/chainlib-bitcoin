'use strict';

var Chain = require('./chain');
var Block = require('../block');
var DB = require('./db');
var bitcoin = require('bitcoin');
var chainlib = require('chainlib');
var P2P = chainlib.P2P;
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

  this.db.rpc = this.rpc;

  Node.super_.prototype._initialize.call(this);
};

module.exports = Node;
