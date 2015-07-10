'use strict';

var should = require('chai').should();
var bitcoinlib = require('../../');
var Chain = bitcoinlib.RPCNode.Chain;

describe('BitcoinD Chain', function() {
  describe('#_checkExisting', function() {
    it('should call the callback', function(done) {
      var chain = new Chain();
      chain._checkExisting('block', function(err) {
        should.not.exist(err);
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
