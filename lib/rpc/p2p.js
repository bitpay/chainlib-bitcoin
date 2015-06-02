'use strict';

var util = require('util');
var chainlib = require('chainlib');
var log = chainlib.log;
var BitcoreP2P = require('bitcore-p2p');
var Inventory = BitcoreP2P.Inventory;
var BaseP2P = chainlib.P2P;

function P2P(options) {
  BaseP2P.call(this, options);
}

util.inherits(P2P, BaseP2P);

P2P.prototype.initialize = function() {
  this.mempool = this.db.mempool;

  this.mempool.on('transaction', this._onMempoolTransaction.bind(this));
  this.pool.on('peerready', this._onPeerReady.bind(this));
  this.pool.on('peerinv', this._onPeerInv.bind(this));
  this.pool.on('peertx', this._onPeerTx.bind(this));
  this.pool.on('peergetdata', this._onPeerGetData.bind(this));

  this.pool.connect();
};

P2P.prototype._onPeerReady = function(peer) {
  log.info('Connected to peer', (peer.host + ':' + peer.port));

  if(!this.ready) {
    this.ready = true;
    this.emit('ready');
  }
};

P2P.prototype._onPeerInv = function(peer, message) {
  var self = this;

  log.debug('Received inv from ' + peer.host, message);

  var inventory = message.inventory;
  var newBlock = false;
  var filtered = [];

  // Download transactions, but get blocks over RPC instead

  for(var i = 0; i < inventory.length; i++) {
    if(inventory[i].type === Inventory.TYPE.BLOCK) {
      newBlock = true;
      break;
    } else if(inventory[i].type === Inventory.TYPE.TX) {
      if(!self.mempool.hasTransaction(self._bufferToHash(inventory[i].hash))) {
        filtered.push(inventory[i]);
      }
    }
  }

  if(newBlock) {
    this.emit('block');
  } else if(filtered.length) {
    var message = self.messages.GetData(filtered);
    peer.sendMessage(message);
  }
};

module.exports = P2P;
