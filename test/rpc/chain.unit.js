'use strict';

var should = require('chai').should();
var sinon = require('sinon');

var bitcoinlib = require('../../');
var chainlib = require('chainlib');

var Chain = bitcoinlib.RPCNode.Chain;
var Reorg = chainlib.Reorg;

describe('RPC Chain', function() {
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