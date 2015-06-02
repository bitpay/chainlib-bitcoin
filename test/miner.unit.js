'use strict';

var chai = require('chai');
var should = chai.should();
var sinon = require('sinon');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var bitcoinlib = require('../');
var Miner = bitcoinlib.Miner;
var Chain = bitcoinlib.Chain;

describe('Bitcoin Miner', function() {
  describe('@constructor', function() {
    it('should construct a miner', function() {
      var miner = new Miner({
        chain: {
          on: sinon.spy()
        }
      });
    });
    it('should throw an error if options are not specified', function() {
      (function() {
        var miner = new Miner();
      }).should.throw('Must incude miner options');
    });
  });
  describe('#start', function() {
    it('should call mineBlocks()', function() {
      var miner = new Miner({
        chain: {
          on: sinon.spy()
        }
      });
      miner.mineBlocks = sinon.spy();
      miner.start();
      miner.mineBlocks.called.should.equal(true);
    });
  });
  describe('#mineBlocks', function() {
    it('should stop after calling stop()', function(done) {
      var miner = new Miner({
        chain: {
          on: sinon.spy()
        }
      });
      miner.mineBlock = sinon.stub().callsArg(0);
      miner.start();
      miner.stop();
      setTimeout(function() {
        miner.mineBlock.called.should.equal(true);
        miner.started.should.equal(false);
        done();
      }, 50);
    });
    it('should stop on error', function(done) {
      var miner = new Miner({
        chain: {
          on: sinon.spy()
        }
      });
      miner.mineBlock = sinon.stub().callsArgWith(0, new Error('error'));
      miner.start();
      setTimeout(function() {
        miner.mineBlock.called.should.equal(true);
        miner.started.should.equal(false);
        done();
      }, 50);
    });
  });
  describe('#mineBlock', function() {
    var ChainStub = function() {};
    util.inherits(ChainStub, EventEmitter);
    ChainStub.prototype.getNextWorkRequired = sinon.stub().callsArgWith(1, null, 522243058);
    ChainStub.prototype.addBlock = sinon.stub().callsArg(1);
    ChainStub.prototype.getTargetFromBits = Chain.prototype.getTargetFromBits;

    var chain = new ChainStub();
    chain.tip = {
      hash: '00000000a141216a896c54f211301c436e557a8d55900637bbdce14c6c7bddef'
    };
    var db = {
      mempool: {
        getTransactions: sinon.stub().returns([])
      },
      buildCoinbaseTransaction: sinon.stub().returns('coinbase'),
      addTransactionsToBlock: sinon.spy()
    };

    var miner = new Miner({
      chain: chain,
      db: db
    });

    it('should mine a block', function(done) {
      miner.started = true;
      miner.mineBlock(function(err) {
        should.not.exist(err);
        done();
      });
    });
    it('should return if tip changed', function(done) {
      miner.db.addTransactionsToBlock = function(block, transactions) {
        block.validProofOfWork = function() {
          miner.chain.emit('addblock');
          return false;
        }
      };
      miner.started = true;
      miner.mineBlock(function(err) {
        should.not.exist(err);
        miner.db.addTransactionsToBlock = sinon.spy();
        done();
      });
    });
    it('should return if miner was stopped', function(done) {
      miner.db.addTransactionsToBlock = function(block, transactions) {
        block.validProofOfWork = function() {
          miner.started = false;
          return false;
        }
      };
      miner.started = true;
      miner.mineBlock(function(err) {
        should.not.exist(err);
        miner.db.addTransactionsToBlock = sinon.spy();
        done();
      });
    });
    it('should log an error if addBlock gave an error', function(done) {
      miner.chain.addBlock = sinon.stub().callsArgWith(1, new Error('error'));
      miner.started = true;
      miner.mineBlock(function(err) {
        should.not.exist(err);
        done();
      });
    });
    it('should give an error if getNextWorkRequired gave an error', function(done) {
      miner.chain.getNextWorkRequired = sinon.stub().callsArgWith(1, new Error('error'));
      miner.started = true;
      miner.mineBlock(function(err) {
        should.exist(err);
        done();
      });
    });
  });
  describe('#stop', function() {
    it('should set started to false', function() {
      var miner = new Miner({
        chain: {
          on: sinon.spy()
        }
      });
      miner.started = true;
      miner.stop();
      miner.started.should.equal(false);
    });
  });
});
