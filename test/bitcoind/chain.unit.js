'use strict';

var should = require('chai').should();
var bitcoinlib = require('../../');
var sinon = require('sinon');
var Chain = bitcoinlib.BitcoindNode.Chain;

describe('Bitcoind Chain', function() {

  describe('#_writeBlock', function() {
    it('should update hashes and call putBlock', function(done) {
      var chain = new Chain();
      chain.db = {
        putBlock: sinon.stub().callsArg(1)
      };
      chain._writeBlock({hash: 'hash', prevHash: 'prevhash'}, function(err) {
        should.not.exist(err);
        chain.db.putBlock.callCount.should.equal(1);
        chain.cache.hashes.hash.should.equal('prevhash');
        done();
      });
    });
  });
  describe('#_validateBlock', function() {
    it('should call the callback', function(done) {
      var chain = new Chain();
      chain._validateBlock('block', function(err) {
        should.not.exist(err);
        done();
      });
    });
  });
});
