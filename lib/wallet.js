'use strict';

var bitcore = require('bitcore');
var chainlib = require('chainlib');
var BaseWallet = chainlib.Wallet;
var util = require('util');

function Wallet(options) {
  BaseWallet.call(this, options);
  this.db = options.db;
}
util.inherits(Wallet, BaseWallet);

Wallet.prototype.getUnspentOutputsForAddress = function(address, callback) {
  this.db.getUnspentOutputs(address, true, callback);
};

Wallet.prototype.createTransaction = function(address, amount) {

  var tx = bitcore.Transaction();
  var utxos = this.selectUnspentOutputs(amount);
  var change = this.getNextPrivateKey().toAddress(this.hdPrivateKey.network);

  // Get keys
  var keys = [];
  var inputTotal = 0;
  utxos.forEach(function(utxo) {
    if (utxo.amount) {
      inputTotal += utxo.amount * 100000000;
    } else {
      inputTotal += utxo.satoshis;
    }
    keys.push(utxo.privateKey);
  });

  tx.from(utxos);
  tx.to(address, amount);
  tx.change(change);
  tx.sign(keys);

  return tx;

};

Wallet.prototype.getAddress = function(n) {
  return this.hdPrivateKey.derive(n).privateKey.toAddress(this.network);
};

module.exports = Wallet;
