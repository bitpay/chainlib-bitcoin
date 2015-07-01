'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var bitcoinlib = require('../../');
var OriginalDB = bitcoinlib.RPCNode.DB;
var DB = proxyquire('../../lib/rpc/db', {'../db': function() {}});

describe('RPC DB', function() {
  describe('#getBlock', function() {
    var db = new DB();
    db.rpc = {
      getBlock: sinon.stub().callsArgWith(2, null, '1234')
    };
    db.Block = {
      fromBuffer: sinon.stub().returns('block')
    };

    it('should get the block from rpc', function(done) {
      db.getBlock('1234', function(err, block) {
        should.not.exist(err);
        block.should.equal('block');
        done();
      });
    });
    it('should give an error when rpc.getBlock gives an error', function(done) {
      db.rpc.getBlock = sinon.stub().callsArgWith(2, new Error('error'));
      db.getBlock('1234', function(err, block) {
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