'use strict';

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
var bitcoinlib = require('../');
var Wallet = bitcoinlib.Wallet;
var fakeData = require('./data/wallet.json');
var bitcore = require('bitcore');
var errors = bitcoinlib.errors;

var xprivkey = fakeData.xprivkey;
var utxos = fakeData.utxos;

describe('Bitcoin Wallet', function() {

  function mockedUnspent(address, callback) {
    var unspents = utxos[address];
    if (!unspents) {
      return callback(new errors.NoOutput('No transactions for this address'));
      }
    callback(null, unspents);
  };

  before(function() {
    sinon.stub(Wallet.prototype, 'getUnspentOutputsForAddress', mockedUnspent);
  });

  after(function() {
    Wallet.prototype.getUnspentOutputsForAddress.restore();
  });
  
  it('should create a bitcoin transaction to an address', function(done) {
    var wallet = new Wallet({
      xprivkey: xprivkey
    });
    wallet.updateUnspentOutputs(function(err) {
      var transaction = wallet.createTransaction('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L', 40000);
      transaction.should.be.instanceof(bitcore.Transaction);
      transaction.outputs[0].satoshis.should.equal(40000);
      done();
    });
  });

  it('should create a bitcoin transaction with utxos using "amount"', function(done) {
    utxos = fakeData.utxosAmount;
    var wallet = new Wallet({
      xprivkey: xprivkey
    });
    wallet.updateUnspentOutputs(function(err) {
      var transaction = wallet.createTransaction('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L', 40000);
      transaction.should.be.instanceof(bitcore.Transaction);
      transaction.outputs[0].satoshis.should.equal(40000);
      done();
    });
  });

  it('should throw error if missing satoshis or amount', function(done) {
    utxos = fakeData.utxosNaN;
    var wallet = new Wallet({
      xprivkey: xprivkey
    });
    wallet.updateUnspentOutputs(function(err) {
      (function() {
        wallet.createTransaction('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L', 40000);
      }).should.throw('Unspent output amount is undefined or NaN');
      done();
    });
  });
});
