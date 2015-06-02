'use strict';

var Chain = require('./chain');
var Block = require('./block');
var DB = require('./db');
var chainlib = require('chainlib');
var BaseNode = chainlib.Node;
var util = require('util');
var bitcore = require('bitcore');
var Networks = bitcore.Networks;
var _ = bitcore.deps._;
var genesis = require('./genesis.json');

function Node(config) {
  BaseNode.call(this, config);

  this.testnet = config.testnet;
}

util.inherits(Node, BaseNode);

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
  this.db = new DB(config.db);
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

module.exports = Node;
