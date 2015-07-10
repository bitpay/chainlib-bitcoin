'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var bitcoinlib = require('../../');
var OriginalDB = bitcoinlib.BitcoindNode.DB;
var blockData = require('../data/livenet-345003.json');
var DB = proxyquire('../../lib/bitcoind/db', {'../db': function() {}});

describe('Bitcoind DB', function() {
  describe('#getBlock', function() {
    var db = new DB();
    db.bitcoind = {
      getBlock: sinon.stub().callsArgWith(1, null, new Buffer(blockData, 'hex'))
    };
    db.Block = {
      fromBuffer: sinon.stub().returns('block')
    };

    it('should get the block from bitcoind.js', function(done) {
      db.getBlock('00000000000000000593b60d8b4f40fd1ec080bdb0817d475dae47b5f5b1f735', function(err, block) {
        should.not.exist(err);
        block.should.equal('block');
        done();
      });
    });
    it('should give an error when bitcoind.js gives an error', function(done) {
      db.bitcoind.getBlock = sinon.stub().callsArgWith(1, new Error('error'));
      db.getBlock('00000000000000000593b60d8b4f40fd1ec080bdb0817d475dae47b5f5b1f735', function(err, block) {
        should.exist(err);
        err.message.should.equal('error');
        done();
      });
    });
  });
  describe('#putBlock', function() {
    it('should call _updatePrevHashIndex', function(done) {
      var db = new DB();
      db._updatePrevHashIndex = sinon.stub().callsArg(1);
      db.putBlock('block', function(err) {
        should.not.exist(err);
        db._updatePrevHashIndex.called.should.equal(true);
        done();
      });
    });
  });
});
