'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var chainlib = require('chainlib');
var bitcoinlib = require('../');
var Block = bitcoinlib.Block;
var leveldown = chainlib.deps.leveldown;

var chainData = require('./data/testnet-blocks.json');
var p2p = require('bitcore-p2p');
var Pool = p2p.Pool;
var proxyquire = require('proxyquire');

var FakeRPC = function() {
  this.blockIndex = {
    '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943': chainData[0]
  };
};
FakeRPC.prototype.getBlockCount = function(callback) {
  return callback(null, 10, {});
};
FakeRPC.prototype.getBlockHash = function(height, callback) {
  var blockData = chainData[height];
  var block = Block.fromBuffer(new Buffer(blockData, 'hex'));
  this.blockIndex[block.hash] = blockData;
  return callback(null, block.hash, {});
};
FakeRPC.prototype.getBlock = function(hash, raw, callback) {
  return callback(null, this.blockIndex[hash], {});
};

var FakeBitcoin = {
  Client: function() {
    return new FakeRPC();
  }
};

var OriginalNode = require('../lib/rpc/node');
var BitcoinNode = proxyquire('../lib/rpc/node', {bitcoin: FakeBitcoin});

describe('Bitcoin Node', function() {
  var node;
  var xprivkey = 'tprv8ZgxMBicQKsPdj1QowoT9z1tY5Et38qaMjCHZVoPdPFb6narfmYkqTygEVHfUmY78k3HcaEpkyNCAQDANaXtwNe1HLFvcA7nqYj1B7wTSTo';
  var path = './bitcoin-test.db';

  var configuration = {
    db: {
      xprivkey: xprivkey,
      path: path
    },
    p2p: {
      addrs: [
        {
          ip: {
            v4: '127.0.0.1'
          },
          port: 18333
        }
      ],
      dnsSeed: false
    },
    rpc: {
      host: 'localhost',
      port: 18332,
      user: 'user',
      pass: 'password'
    },
    testnet: true
  };

  before(function(done) {
    sinon.stub(Pool.prototype, 'connect', function() {
      this.emit('peerready', {host: 'fake', port: 12345, sendMessage: sinon.spy()});
    });
    sinon.stub(Pool.prototype, 'listen');
    node = new BitcoinNode(configuration);
    node.on('ready', function() {
      done();
    });
    node.on('error', function(err) {
      should.not.exist(err);
    });
  });

  after(function(done) {
    Pool.prototype.connect.restore();
    Pool.prototype.listen.restore();
    node.db.close(function(err) {
      leveldown.destroy(path, done);
    });
  });

  it('should sync 10 blocks', function(done) {
    node.once('synced', function() {
      node.chain.tip.hash.should.equal('00000000700e92a916b46b8b91a14d1303d5d91ef0b09eecc3151fb958fd9a2e');
      done();
    });
  });

  it('should get correct balance for an address', function(done) {
    node.getBalance('mpUjdth9vH3RiRjrqmmWtHTUotWZjZHuCY', false, function(err, balance) {
      should.not.exist(err);
      balance.should.equal(50 * 1e8);
      done();
    });
  });
});
