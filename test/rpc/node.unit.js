'use strict';

var should = require('chai').should();
var sinon = require('sinon');

var bitcore = require('bitcore');
var Networks = bitcore.Networks;

var proxyquire = require('proxyquire');
var chainlib = require('chainlib');

var OriginalNode = chainlib.Node;
var BaseNode = require('events').EventEmitter;
BaseNode.log = chainlib.log;
BaseNode.prototype._loadConfiguration = sinon.spy();
BaseNode.prototype._initialize = sinon.spy();
chainlib.Node = BaseNode;
var Node = proxyquire('../../lib/rpc/node', {chainlib: chainlib});
chainlib.Node = OriginalNode;

describe('RPC Node', function() {
  describe('#_loadConfiguration', function() {
    it('should call the necessary methods', function() {
      var node = new Node({});
      node._loadRPC = sinon.spy();
      node._loadConfiguration({});
      node._loadRPC.called.should.equal(true);
      BaseNode.prototype._loadConfiguration.called.should.equal(true);
    });
  });
  describe('#_loadRPC', function() {
    it('should initialize rpc', function() {
      var node = new Node({});
      node._loadRPC({});
      should.exist(node.rpc);
    });
  });
  describe('#_loadNetwork', function() {
    it('should add the network that was listed in the config', function() {
      var config = {
        network: {
          name: 'chainlib',
          alias: 'chainlib',
          pubkeyhash: 0x1c,
          privatekey: 0x1e,
          scripthash: 0x28,
          xpubkey: 0x02e8de8f,
          xprivkey: 0x02e8da54,
          networkMagic: 0x0c110907,
          port: 9333
        }
      };

      var node = new Node(config);
      node._loadNetwork(config);
      var network = Networks.get('chainlib');
      should.exist(network);
      node.network.name.should.equal('chainlib');
    });
    it('should use the testnet network if testnet is specified', function() {
      var config = {
        testnet: true
      };

      var node = new Node(config);
      node._loadNetwork(config);
      node.network.name.should.equal('testnet');
    });
    it('should use the livenet network if nothing is specified', function() {
      var config = {};

      var node = new Node(config);
      node._loadNetwork(config);
      node.network.name.should.equal('livenet');
    });
  });
  describe('#_loadDB', function() {
    it('should load the db', function() {
      var DB = function() {};
      var config = {
        DB: DB
      };

      var node = new Node(config);
      node._loadDB(config);
      node.db.should.be.instanceof(DB);
    });
  });
  describe('#_loadP2P', function() {
    it('should load p2p', function() {
      var config = {};

      var node = new Node(config);
      node.db = {};
      node._loadP2P(config);
      should.exist(node.p2p);
    });
  });
  describe('#_loadConsensus', function() {
    var node = new Node({});

    it('should use the genesis specified in the config', function() {
      var config = {
        genesis: '0100000043497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000bac8b0fa927c0ac8234287e33c5f74d38d354820e24756ad709d7038fc5f31f020e7494dffff001d03e4b6720101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0e0420e7494d017f062f503253482fffffffff0100f2052a010000002321021aeaf2f8638a129a3156fbe7e5ef635226b0bafd495ff03afe2c843d7e3a4b51ac00000000'
      };
      node._loadConsensus(config);
      should.exist(node.chain);
      node.chain.genesis.hash.should.equal('00000000b873e79784647a6c82962c70d228557d24a747ea4d1b8bbe878e1206');
    });
    it('should use the testnet genesis if testnet is specified', function() {
      var config = {
        testnet: true
      };
      node._loadConsensus(config);
      should.exist(node.chain);
      node.chain.genesis.hash.should.equal('000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943');
    });
    it('should use the livenet genesis if nothing is specified', function() {
      var config = {};
      node._loadConsensus(config);
      should.exist(node.chain);
      node.chain.genesis.hash.should.equal('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f')
    });
  });
  describe('#_initialize', function() {
    it('should initialize', function() {
      var node = new Node({});
      node.db = {};
      node.rpc = 'rpc';
      node._initialize();
      node.db.rpc.should.equal('rpc');
      BaseNode.prototype._initialize.called.should.equal(true);
    });
  });
});
