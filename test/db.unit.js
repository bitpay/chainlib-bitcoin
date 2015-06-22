'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var chainlib = require('chainlib');
var levelup = chainlib.deps.levelup;
var bitcoinlib = require('../');
var DB = bitcoinlib.DB;
var blockData = require('./data/livenet-345003.json');
var bitcore = require('bitcore');
var EventEmitter = require('events').EventEmitter;
var errors = bitcoinlib.errors;
var memdown = require('memdown');

describe('Bitcoin DB', function() {
  var coinbaseAmount = 50 * 1e8;

  describe('#setWallet', function() {
    it('should set up the wallet with the xprivkey', function() {
      var xprivkey = 'tprv8ZgxMBicQKsPdWsFcAGGw9sNMKFT4EKesyXbHqxyd9y2T5TcevSr1FsYT6tPMf2MWvQREN924Sw4sxxbPoD8tjsA2M7mXfWQk2aEQn1MsML';
      var db = new DB({path: 'path', store: memdown});
      db.setWallet(xprivkey);
      should.exist(db.wallet);
      should.exist(db.wallet.hdPrivateKey);
    });
  });

  describe('#validateBlockData', function() {
    var db = new DB({path: 'path', store: memdown});
    var Transaction = function(){};
    Transaction.prototype.validate = sinon.stub().callsArg(2);
    db.getTransactionsFromBlock = function() {
      return [
        new Transaction(),
        new Transaction(),
        new Transaction()
      ];
    };
    db.validateCoinbase = sinon.stub().callsArg(2);

    it('should call validate on every transaction and check coinbase validity', function(done) {
      db.validateBlockData({}, function(err) {
        should.not.exist(err);
        Transaction.prototype.validate.callCount.should.equal(3);
        db.validateCoinbase.calledOnce.should.equal(true);
        done();
      });
    });

    it('should give an error if one of the transactions fails to validate', function(done) {
      var invalidTx = new Transaction();
      invalidTx.validate = sinon.stub().callsArgWith(2, new Error('invalid tx'));
      db.getTransactionsFromBlock = function() {
        return [
          new Transaction(),
          invalidTx,
          new Transaction()
        ];
      };

      db.validateBlockData({}, function(err) {
        should.exist(err);
        err.message.should.equal('invalid tx');
        done();
      });
    });
  });

  describe('#buildGenesisData', function() {
    it('build genisis data', function() {
      var db = new DB({path: 'path', store: memdown});
      db.buildCoinbaseTransaction = sinon.stub().returns({
        toBuffer: sinon.stub().returns(new Buffer('abcdef', 'hex'))
      });
      db.getMerkleRoot = sinon.stub().returns('merkleRoot');
      var data = db.buildGenesisData();
      data.buffer.should.deep.equal(new Buffer('01abcdef', 'hex'));
      data.merkleRoot.should.equal('merkleRoot');
    });
  });

  describe('#buildCoinbaseTransaction', function() {
    it('should correctly build a coinbase transaction with no fees', function() {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        getAddress: sinon.stub().returns('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L')
      };
      db.coinbaseAmount = coinbaseAmount;
      var coinbaseTx = db.buildCoinbaseTransaction();
      coinbaseTx.inputs.length.should.equal(1);
      var input = coinbaseTx.inputs[0];
      var expectedTxId = '0000000000000000000000000000000000000000000000000000000000000000';
      input.prevTxId.toString('hex').should.equal(expectedTxId);
      should.exist(input.outputIndex);
      should.exist(input.sequenceNumber);
      should.exist(input._script); // coinbase input script returns null
      coinbaseTx.outputs.length.should.equal(1);
      var output = coinbaseTx.outputs[0];
      output.satoshis.should.equal(coinbaseAmount);
    });

    it('should correctly build a coinbase transaction with fees', function() {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        getAddress: sinon.stub().returns('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L')
      };
      db.coinbaseAmount = coinbaseAmount;
      var transactions = [
        {
          _getInputAmount: sinon.stub().returns(5000),
          _getOutputAmount: sinon.stub().returns(4000),
          isCoinbase: sinon.stub().returns(false)
        },
        {
          _getInputAmount: sinon.stub().returns(8000),
          _getOutputAmount: sinon.stub().returns(7000),
          isCoinbase: sinon.stub().returns(false)
        }
      ];
      var coinbaseTx = db.buildCoinbaseTransaction(transactions);
      coinbaseTx.inputs.length.should.equal(1);
      var input = coinbaseTx.inputs[0];
      var expectedTxId = '0000000000000000000000000000000000000000000000000000000000000000';
      input.prevTxId.toString('hex').should.equal(expectedTxId);
      should.exist(input.outputIndex);
      should.exist(input.sequenceNumber);
      should.exist(input._script); // coinbase input returns null
      coinbaseTx.outputs.length.should.equal(1);
      var output = coinbaseTx.outputs[0];
      output.satoshis.should.equal(coinbaseAmount + 2000);
    });

    it('should throw an error if wallet not included', function() {
      var db = new DB({path: 'path', store: memdown});
      (function() {
        db.buildCoinbaseTransaction();
      }).should.throw('Wallet required to build coinbase');
    });

    it('will build a coinbase database with different data', function() {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        getAddress: sinon.stub().returns('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L')
      };
      var tx1 = db.buildCoinbaseTransaction().uncheckedSerialize();
      var tx2 = db.buildCoinbaseTransaction().uncheckedSerialize();
      tx1.should.not.equal(tx2);
    });

    it('can pass in custom data', function() {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        getAddress: sinon.stub().returns('mzso6uXxfDCq4L6xAffUD9BPWo6bdFBZ2L')
      };
      var tx1 = db.buildCoinbaseTransaction(null, new Buffer('abcdef', 'hex'));
      var data = tx1.inputs[0]._script.getData();
      data.should.deep.equal(new Buffer('abcdef', 'hex'));
    });

  });

  describe('#validateCoinbase', function() {
    var db = new DB({path: 'path', store: memdown});
    db.coinbaseAmount = coinbaseAmount;
    var Transaction = function() {};
    Transaction.prototype.isCoinbase = sinon.stub().returns(false);
    var coinbaseTx = new Transaction();
    coinbaseTx.isCoinbase = sinon.stub().returns(true);

    it('should give an error if the first transaction in the block is not a coinbase', function(done) {
      var transactions = [
          new Transaction(),
          new Transaction(),
          new Transaction()
      ];

      db.validateCoinbase({}, transactions, function(err) {
        should.exist(err);
        err.message.should.equal('First transaction in block must be coinbase');
        done();
      });
    });

    it('should give an error if there are no transactions', function(done) {
      db.validateCoinbase({}, [], function(err) {
        should.exist(err);
        err.message.should.equal('First transaction in block must be coinbase');
        done();
      });
    });

    it('should give an error if the output value is greater than coinbase amount plus fees', function(done) {
      coinbaseTx._getInputAmount = sinon.stub().returns(0);
      coinbaseTx._getOutputAmount = sinon.stub().returns(100 * 1e8);
      var transactions = [
        coinbaseTx,
        {
          _getInputAmount: sinon.stub().returns(5000),
          _getOutputAmount: sinon.stub().returns(4000),
          isCoinbase: sinon.stub().returns(false)
        },
        {
          _getInputAmount: sinon.stub().returns(8000),
          _getOutputAmount: sinon.stub().returns(7000),
          isCoinbase: sinon.stub().returns(false)
        }
      ];


      db.validateCoinbase({}, transactions, function(err) {
        should.exist(err);
        err.message.should.equal('Coinbase amount is too large');
        done();
      });
    });

    it('should not give an error if first transaction in coinbase and output amount is correct', function(done) {
      coinbaseTx._getInputAmount = sinon.stub().returns(0);
      coinbaseTx._getOutputAmount = sinon.stub().returns(coinbaseAmount + 2000);
      var transactions = [
        coinbaseTx,
        {
          _getInputAmount: sinon.stub().returns(5000),
          _getOutputAmount: sinon.stub().returns(4000),
          isCoinbase: sinon.stub().returns(false)
        },
        {
          _getInputAmount: sinon.stub().returns(8000),
          _getOutputAmount: sinon.stub().returns(7000),
          isCoinbase: sinon.stub().returns(false)
        }
      ];

      db.validateCoinbase({}, transactions, function(err) {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('#getOutputTotal', function() {
    it('should return the correct value including the coinbase', function() {
      var totals = [10, 20, 30];
      var db = new DB({path: 'path', store: memdown});
      var transactions = totals.map(function(total) {
        return {
          _getOutputAmount: function() {
            return total;
          },
          isCoinbase: function() {
            return total === 10 ? true : false;
          }
        };
      });
      var grandTotal = db.getOutputTotal(transactions);
      grandTotal.should.equal(60);
    });
    it('should return the correct value excluding the coinbase', function() {
      var totals = [10, 20, 30];
      var db = new DB({path: 'path', store: memdown});
      var transactions = totals.map(function(total) {
        return {
          _getOutputAmount: function() {
            return total;
          },
          isCoinbase: function() {
            return total === 10 ? true : false;
          }
        };
      });
      var grandTotal = db.getOutputTotal(transactions, true);
      grandTotal.should.equal(50)
    });
  });

  describe('#getInputTotal', function() {
    it('should return the correct value', function() {
      var totals = [10, 20, 30];
      var db = new DB({path: 'path', store: memdown});
      var transactions = totals.map(function(total) {
        return {
          _getInputAmount: function() {
            return total;
          },
          isCoinbase: sinon.stub().returns(false)
        };
      });
      var grandTotal = db.getInputTotal(transactions);
      grandTotal.should.equal(60);
    });
    it('should return 0 if the tx is a coinbase', function() {
      var db = new DB({store: memdown});
      var tx = {
        isCoinbase: sinon.stub().returns(true)
      };
      var total = db.getInputTotal([tx]);
      total.should.equal(0);
    });
  });

  describe('#_updateOutputs', function() {
    var block = bitcore.Block.fromString(blockData);
    var db = new DB({path: 'path', store: memdown, network: 'livenet'});
    db.getTransactionsFromBlock = function() {
      return block.transactions.slice(0, 8);
    };

    var data = [
      {
        key: {
          address: '1F1MAvhTKg2VG29w8cXsiSN2PJ8gSsrJw',
          timestamp: 1424836934000,
          txid: 'fdbefe0d064729d85556bd3ab13c3a889b685d042499c02b4aa2064fb1e16923',
          outputIndex: 0
        },
        value: {
          satoshis: 2502227470,
          script: 'OP_DUP OP_HASH160 20 0x02a61d2066d19e9e2fd348a8320b7ebd4dd3ca2b OP_EQUALVERIFY OP_CHECKSIG',
          blockHeight: 345003
        }
      },
      {
        key: {
          prevTxId: '3d7d5d98df753ef2a4f82438513c509e3b11f3e738e94a7234967b03a03123a9',
          prevOutputIndex: 32
        },
        value: {
          txid: '5780f3ee54889a0717152a01abee9a32cec1b0cdf8d5537a08c7bd9eeb6bfbca',
          inputIndex: 0,
          timestamp: 1424836934000
        }
      },
      {
        key: {
          address: '1Ep5LA4T6Y7zaBPiwruUJurjGFvCJHzJhm',
          timestamp: 1424836934000,
          txid: 'e66f3b989c790178de2fc1a5329f94c0d8905d0d3df4e7ecf0115e7f90a6283d',
          outputIndex: 1
        },
        value: {
          satoshis: 3100000,
          script: 'OP_DUP OP_HASH160 20 0x9780ccd5356e2acc0ee439ee04e0fe69426c7528 OP_EQUALVERIFY OP_CHECKSIG',
          blockHeight: 345003
        }
      }
    ];
    var key0 = data[0].key;
    var value0 = data[0].value;
    var key3 = data[1].key;
    var value3 = data[1].value;
    var key64 = data[2].key;
    var value64 = data[2].value;

    it('should create the correct operations when updating/adding outputs', function(done) {
      db._updateOutputs({height: 345003, timestamp: new Date(1424836934000)}, true, function(err, operations) {
        should.not.exist(err);
        operations.length.should.equal(81);
        operations[0].type.should.equal('put');
        var expected0 = ['outs', key0.address, key0.timestamp, key0.txid, key0.outputIndex].join('-');
        operations[0].key.should.equal(expected0);
        operations[0].value.should.equal([value0.satoshis, value0.script, value0.blockHeight].join(':'));
        operations[3].type.should.equal('put');
        var expected3 = ['sp', key3.prevTxId, key3.prevOutputIndex].join('-');
        operations[3].key.should.equal(expected3);
        operations[3].value.should.equal([value3.txid, value3.inputIndex, value3.timestamp].join(':'));
        operations[64].type.should.equal('put');
        var expected64 = ['outs', key64.address, key64.timestamp, key64.txid, key64.outputIndex].join('-');
        operations[64].key.should.equal(expected64);
        operations[64].value.should.equal([value64.satoshis, value64.script, value64.blockHeight].join(':'));
        done();
      });
    });
    it('should create the correct operations when removing outputs', function(done) {
      db._updateOutputs({height: 345003, timestamp: new Date(1424836934000)}, false, function(err, operations) {
        should.not.exist(err);
        operations.length.should.equal(81);
        operations[0].type.should.equal('del');
        operations[0].key.should.equal(['outs', key0.address, key0.timestamp, key0.txid, key0.outputIndex].join('-'));
        operations[0].value.should.equal([value0.satoshis, value0.script, value0.blockHeight].join(':'));
        operations[3].type.should.equal('del');
        operations[3].key.should.equal(['sp', key3.prevTxId, key3.prevOutputIndex].join('-'));
        operations[3].value.should.equal([value3.txid, value3.inputIndex, value3.timestamp].join(':'));
        operations[64].type.should.equal('del');
        operations[64].key.should.equal(['outs', key64.address, key64.timestamp, key64.txid, key64.outputIndex].join('-'));
        operations[64].value.should.equal([value64.satoshis, value64.script, value64.blockHeight].join(':'));
        done();
      });
    });
    it('should continue if output script is null', function(done) {
      var db = new DB({path: 'path', store: memdown, network: 'livenet'});
      var transactions = [
        {
          inputs: [],
          outputs: [
            {
              script: null,
              satoshis: 1000,
            }
          ],
          isCoinbase: sinon.stub().returns(false)
        }
      ];
      db.getTransactionsFromBlock = function() {
        return transactions;
      };

      db._updateOutputs({height: 345003, timestamp: new Date(1424836934000)}, false, function(err, operations) {
        should.not.exist(err);
        operations.length.should.equal(0);
        done();
      });
    });
  });

  describe('#_updateTransactions', function() {
    it('should remove conflicting mempool transactions', function(done) {
      var mempoolTransactions = [
        {
          inputs: [
            {
              prevTxId: 'tx1',
              outputIndex: 'out1'
            },
            {
              prevTxId: 'tx2',
              outputIndex: 'out2'
            }
          ],
          hash: 'hash1'
        },
        {
          inputs: [
            {
              prevTxId: 'tx3',
              outputIndex: 'out3'
            },
            {
              prevTxId: 'tx4',
              outputIndex: 'out4'
            }
          ],
          hash: 'hash2'
        }
      ];

      var blockTransactions = [
        {
          inputs: [
            {
              prevTxId: 'tx1',
              outputIndex: 'out1'
            },
            {
              prevTxId: 'tx6',
              outputIndex: 'out6'
            }
          ],
          hash: 'hash3'
        },
        {
          inputs: [
            {
              prevTxId: 'tx7',
              outputIndex: 'out7'
            },
            {
              prevTxId: 'tx8',
              outputIndex: 'out8'
            }
          ],
          hash: 'hash4'
        }
      ];

      var db = new DB({store: memdown});
      sinon.stub(DB.super_.prototype, '_updateTransactions').callsArgWith(2, null, []);

      db.mempool = {
        getTransactions: sinon.stub().returns(mempoolTransactions)
      };
      db.getTransactionsFromBlock = sinon.stub().returns(blockTransactions);

      db._updateTransactions('block', true, function(err, operations) {
        should.not.exist(err);
        db.mempool.transactions.length.should.equal(1);
        db.mempool.transactions[0].hash.should.equal('hash2');
        DB.super_.prototype._updateTransactions.restore();
        done();
      });
    });

    it('should give an error if parent _updateTransactions gives an error', function(done) {
      var db = new DB({store: memdown});
      sinon.stub(DB.super_.prototype, '_updateTransactions').callsArgWith(2, new Error('error'));

      db._updateTransactions('block', true, function(err, operations) {
        should.exist(err);
        err.message.should.equal('error');
        DB.super_.prototype._updateTransactions.restore();
        done();
      });
    });
  });

  describe('#_onChainAddBlock', function() {
    var db = new DB({path: 'path', store: memdown});
    db._updateOutputs = sinon.stub().callsArgWith(2, null, ['1a', '1b']);
    db._updateTransactions = sinon.stub().callsArgWith(2, null, ['2a', '2b']);
    db.store = {
      batch: sinon.stub().callsArg(1)
    };

    it('should give error when there is a failure to write', function() {
      var errordb = new DB({path: 'path', store: memdown});
      errordb._updateOutputs = sinon.stub().callsArgWith(2, null, ['1a', '1b']);
      errordb._updateTransactions = sinon.stub().callsArgWith(2, null, ['2a', '2b']);
      errordb.store = {
        batch: sinon.stub().callsArgWith(1, new Error('error'))
      };
      errordb._onChainAddBlock('block', function(err) {
        should.exist(err);
      });
    });

    it('should call block processing functions and write to database', function(done) {
      db._onChainAddBlock('block', function(err) {
        should.not.exist(err);
        db._updateOutputs.calledOnce.should.equal(true);
        db._updateOutputs.calledWith('block', true).should.equal(true);
        db._updateTransactions.calledOnce.should.equal(true);
        db._updateTransactions.calledWith('block', true).should.equal(true);
        db.store.batch.args[0][0].should.deep.equal(['1a', '1b', '2a', '2b']);
        done();
      });
    });
    it('should halt on an error and not write to database', function(done) {
      db._updateOutputs.reset();
      db.store.batch.reset();
      db._updateTransactions = sinon.stub().callsArgWith(2, new Error('error'));
      db._onChainAddBlock('block', function(err) {
        should.exist(err);
        err.message.should.equal('error');
        db._updateOutputs.calledOnce.should.equal(true);
        db._updateOutputs.calledWith('block', true).should.equal(true);
        db._updateTransactions.calledOnce.should.equal(true);
        db._updateTransactions.calledWith('block', true).should.equal(true);
        db.store.batch.called.should.equal(false);
        done();
      });
    });
  });

  describe('#_onChainRemoveBlock', function() {
    var db = new DB({path: 'path', store: memdown});
    db._updateOutputs = sinon.stub().callsArgWith(2, null, ['1a', '1b']);
    db._updateTransactions = sinon.stub().callsArgWith(2, null, ['2a', '2b']);
    db.store = {
      batch: sinon.stub().callsArg(1)
    };

    it('should give error when there is a failure to write', function() {
      var errordb = new DB({path: 'path', store: memdown});
      errordb._updateOutputs = sinon.stub().callsArgWith(2, null, ['1a', '1b']);
      errordb._updateTransactions = sinon.stub().callsArgWith(2, null, ['2a', '2b']);
      errordb.store = {
        batch: sinon.stub().callsArgWith(1, new Error('error'))
      };
      errordb._onChainRemoveBlock('block', function(err) {
        should.exist(err);
      });
    });

    it('should call block processing functions and write to database', function(done) {
      db._onChainRemoveBlock('block', function(err) {
        should.not.exist(err);
        db._updateOutputs.calledOnce.should.equal(true);
        db._updateOutputs.calledWith('block', false).should.equal(true);
        db._updateTransactions.calledOnce.should.equal(true);
        db._updateTransactions.calledWith('block', false).should.equal(true);
        db.store.batch.args[0][0].should.deep.equal(['1a', '1b', '2a', '2b']);
        done();
      });
    });
    it('should halt on an error and not write to database', function(done) {
      db._updateOutputs.reset();
      db.store.batch.reset();
      db._updateTransactions = sinon.stub().callsArgWith(2, new Error('error'));
      db._onChainRemoveBlock('block', function(err) {
        should.exist(err);
        err.message.should.equal('error');
        db._updateOutputs.calledOnce.should.equal(true);
        db._updateOutputs.calledWith('block', false).should.equal(true);
        db._updateTransactions.calledOnce.should.equal(true);
        db._updateTransactions.calledWith('block', false).should.equal(true);
        db.store.batch.called.should.equal(false);
        done();
      });
    });
  });

  describe('#getAPIMethods', function() {
    it('should return the correct methods', function() {
      var db = new DB({path: 'path', store: memdown});
      var methods = db.getAPIMethods();
      methods.length.should.equal(6);
    });
  });

  describe('#getBalance', function() {
    it('should sum up the unspent outputs', function(done) {
      var db = new DB({path: 'path', store: memdown});
      var outputs = [
        {satoshis: 1000}, {satoshis: 2000}, {satoshis: 3000}
      ];
      db.getUnspentOutputs = sinon.stub().callsArgWith(2, null, outputs);
      db.getBalance('1DzjESe6SLmAKVPLFMj6Sx1sWki3qt5i8N', false, function(err, balance) {
        should.not.exist(err);
        balance.should.equal(6000);
        done();
      });
    });

    it('will handle error from unspent outputs', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.getUnspentOutputs = sinon.stub().callsArgWith(2, new Error('error'));
      db.getBalance('someaddress', false, function(err) {
        should.exist(err);
        err.message.should.equal('error');
        done();
      });
    });

  });

  describe('#sendFunds', function() {

    it('should add transaction to mempool and give back a transaction', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        updateUnspentOutputs: sinon.stub().callsArg(0),
        createTransaction: sinon.stub().returns({id: '8555a92623666b51137d44bb8d38a12b4fd48705d738690ad3d285186beb3254'})
      };
      db.mempool = {
        addTransaction: sinon.stub().callsArg(1)
      };
      db.sendFunds('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', 50000, function(err, transaction) {
        should.not.exist(err);
        transaction.id.should.equal('8555a92623666b51137d44bb8d38a12b4fd48705d738690ad3d285186beb3254');
        db.wallet.createTransaction.calledWith('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', 50000);
        db.mempool.addTransaction.args[0][0].should.deep.equal({id: '8555a92623666b51137d44bb8d38a12b4fd48705d738690ad3d285186beb3254'});
        done();
      });
    });

    it('should catch transaction creation errors and pass them to the callback', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        updateUnspentOutputs: sinon.stub().callsArg(0),
        createTransaction: sinon.stub().throws(new Error('Insufficient funds'))
      };
      db.mempool = {
        addTransaction: sinon.stub().callsArg(1)
      };
      db.sendFunds('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', 50000, function(err, transaction) {
        should.exist(err);
        err.message.should.equal('Insufficient funds');
        done();
      });
    });

    it('should give an error if addTransaction gives an error', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.wallet = {
        updateUnspentOutputs: sinon.stub().callsArg(0),
        createTransaction: sinon.stub().returns({id: '8555a92623666b51137d44bb8d38a12b4fd48705d738690ad3d285186beb3254'})
      };
      db.mempool = {
        addTransaction: sinon.stub().callsArgWith(1, new Error('validation error'))
      };
      db.sendFunds('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', 50000, function(err, transaction) {
        should.exist(err);
        err.message.should.equal('validation error');
        done();
      });
    });

  });

  describe('#getOutputs', function() {
    var db = new DB({path: 'path', store: memdown});
    var address = '1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W';

    it('should get outputs for an address', function(done) {
      var readStream1 = new EventEmitter();
      db.store = {
        createReadStream: sinon.stub().returns(readStream1)
      };
      var mempoolOutputs = [
        {
          address: '1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W',
          txid: 'aa2db23f670596e96ed94c405fd11848c8f236d266ee96da37ecd919e53b4371',
          satoshis: 307627737,
          script: 'OP_DUP OP_HASH160 f6db95c81dea3d10f0ff8d890927751bf7b203c1 OP_EQUALVERIFY OP_CHECKSIG',
          blockHeight: 352532
        }
      ];
      db._getMempoolOutputs = sinon.stub().returns(mempoolOutputs);
      db.getOutputs(address, true, function(err, outputs) {
        should.not.exist(err);
        outputs.length.should.equal(3);
        outputs[0].address.should.equal(address);
        outputs[0].txid.should.equal('125dd0e50fc732d67c37b6c56be7f9dc00b6859cebf982ee2cc83ed2d604bf87');
        outputs[0].outputIndex.should.equal(1);
        outputs[0].satoshis.should.equal(4527773864);
        outputs[0].script.should.equal('OP_DUP OP_HASH160 038a213afdfc551fc658e9a2a58a86e98d69b687 OP_EQUALVERIFY OP_CHECKSIG');
        outputs[0].blockHeight.should.equal(345000);
        outputs[1].address.should.equal(address);
        outputs[1].txid.should.equal('3b6bc2939d1a70ce04bc4f619ee32608fbff5e565c1f9b02e4eaa97959c59ae7');
        outputs[1].outputIndex.should.equal(2);
        outputs[1].satoshis.should.equal(10000);
        outputs[1].script.should.equal('OP_DUP OP_HASH160 038a213afdfc551fc658e9a2a58a86e98d69b687 OP_EQUALVERIFY OP_CHECKSIG');
        outputs[1].blockHeight.should.equal(345004);
        outputs[2].address.should.equal(address);
        outputs[2].txid.should.equal('aa2db23f670596e96ed94c405fd11848c8f236d266ee96da37ecd919e53b4371');
        outputs[2].script.should.equal('OP_DUP OP_HASH160 f6db95c81dea3d10f0ff8d890927751bf7b203c1 OP_EQUALVERIFY OP_CHECKSIG');
        outputs[2].blockHeight.should.equal(352532);
        done();
      });

      var data1 = {
        key: ['outs', address, '1424835319000', '125dd0e50fc732d67c37b6c56be7f9dc00b6859cebf982ee2cc83ed2d604bf87', '1'].join('-'),
        value: ['4527773864', 'OP_DUP OP_HASH160 038a213afdfc551fc658e9a2a58a86e98d69b687 OP_EQUALVERIFY OP_CHECKSIG', '345000'].join(':')
      };

      var data2 = {
        key: ['outs', address, '1424837300000', '3b6bc2939d1a70ce04bc4f619ee32608fbff5e565c1f9b02e4eaa97959c59ae7', '2'].join('-'),
        value: ['10000', 'OP_DUP OP_HASH160 038a213afdfc551fc658e9a2a58a86e98d69b687 OP_EQUALVERIFY OP_CHECKSIG', '345004'].join(':')
      };

      readStream1.emit('data', data1);
      readStream1.emit('data', data2);
      readStream1.emit('close');
    });

    it('should give an error if the readstream has an error', function(done) {
      var readStream2 = new EventEmitter();
      db.store = {
        createReadStream: sinon.stub().returns(readStream2)
      };

      db.getOutputs(address, true, function(err, outputs) {
        should.exist(err);
        err.message.should.equal('readstreamerror');
        done();
      });

      readStream2.emit('error', new Error('readstreamerror'));
      process.nextTick(function() {
        readStream2.emit('close');
      });
    });
  });

  describe('#_getMempoolOutputs', function() {
    it('should get outputs from the mempool that match the given address', function() {
      var txs = [
        {
          outputs: [
            {
              script: { toAddress: sinon.stub().returns('19LWfGSnRRTrNfAnfQLnmbXpSuPypmXjRr') }
            },
            {
              script: { toAddress: sinon.stub().returns('14uBxy2QmzqXYwaxzVJgYMkXVEPLZZXhZa') }
            }
          ]
        },
        {
          outputs: [
            {
              script: { toAddress: sinon.stub().returns('1PWGHEJs8WD14iJ1LqXvQkUnfhsEzPeEvM') }
            },
            {
              script: { toAddress: sinon.stub().returns('19LWfGSnRRTrNfAnfQLnmbXpSuPypmXjRr') }
            },
            {
              script: { toAddress: sinon.stub().returns('1DsMARv3iHabUnbvvbSK7JK3ZyvTqMBAvE') }
            }
          ]
        },
        {
          outputs: [
            {
              script: { toAddress: sinon.stub().returns('15LrBvp1kWCRrjKxZUSNgNBrerzBKgpsyo') }
            }
          ]
        }
      ];

      var db = new DB({path: 'path', store: memdown});
      db.mempool = {
        getTransactions: sinon.stub().returns(txs)
      };
      var outputs = db._getMempoolOutputs('19LWfGSnRRTrNfAnfQLnmbXpSuPypmXjRr');
      outputs.length.should.equal(2);
    });
  });

  describe('#getUnspentOutputs', function() {
    it('should filter out spent outputs', function(done) {
      var outputs = [
        {
          satoshis: 1000,
          spent: false,
        },
        {
          satoshis: 2000,
          spent: true
        },
        {
          satoshis: 3000,
          spent: false
        }
      ];
      var i = 0;

      var db = new DB({path: 'path', store: memdown});
      db.getOutputs = sinon.stub().callsArgWith(2, null, outputs);
      db.isUnspent = function(output, queryMempool, callback) {
        callback(!outputs[i].spent);
        i++;
      };

      db.getUnspentOutputs('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(err, outputs) {
        should.not.exist(err);
        outputs.length.should.equal(2);
        outputs[0].satoshis.should.equal(1000);
        outputs[1].satoshis.should.equal(3000);
        done();
      });
    });
    it('should handle an error from getOutputs', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.getOutputs = sinon.stub().callsArgWith(2, new Error('error'));
      db.getUnspentOutputs('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(err, outputs) {
        should.exist(err);
        err.message.should.equal('error');
        done();
      });
    });
    it('should handle when there are no outputs', function(done) {
      var db = new DB({path: 'path', store: memdown});
      db.getOutputs = sinon.stub().callsArgWith(2, null, []);
      db.getUnspentOutputs('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(err, outputs) {
        should.exist(err);
        err.should.be.instanceof(errors.NoOutputs);
        outputs.length.should.equal(0);
        done();
      });
    });
  });

  describe('#isUnspent', function() {
    var db = new DB({path: 'path', store: memdown});

    it('should give true when isSpent() gives false', function(done) {
      db.isSpent = sinon.stub().callsArgWith(2, false);
      db.isUnspent('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(unspent) {
        unspent.should.equal(true);
        done();
      });
    });

    it('should give false when isSpent() gives true', function(done) {
      db.isSpent = sinon.stub().callsArgWith(2, true);
      db.isUnspent('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(unspent) {
        unspent.should.equal(false);
        done();
      });
    });

    it('should give false when isSpent() returns an error', function(done) {
      db.isSpent = sinon.stub().callsArgWith(2, new Error('error'));
      db.isUnspent('1KiW1A4dx1oRgLHtDtBjcunUGkYtFgZ1W', false, function(unspent) {
        unspent.should.equal(false);
        done();
      });
    });
  });

  describe('#isSpent', function() {
    var db = new DB({path: 'path', store: memdown});
    db.isSpentDB = sinon.stub().callsArgWith(1, false);
    db._isSpentMempool = sinon.stub().returns(true);

    it('should give true if queryMempool is set and the output was spent in the mempool', function(done) {
      db.isSpent('output', true, function(spent) {
        spent.should.equal(true);
        done();
      });
    });

    it('should give false if queryMempool is not set and the output is not in the db', function(done) {
      db.isSpent('output', false, function(spent) {
        spent.should.equal(false);
        done();
      });
    });
  });

  describe('#isSpentDB', function() {
    var db = new DB({path: 'path', store: memdown});
    db._isSpentMempool = sinon.stub().returns(false);

    var output = {
      txid: 'b56d1a8415ee50ef6e5d8291d45730fa710d727d290d6db2e6acb6229ebdf1ca',
      outputIndex: 2
    };

    it('should give false if the output is not spent', function(done) {
      var error = new levelup.errors.NotFoundError();
      db.store = {
        get: sinon.stub().callsArgWith(1, error)
      };
      db.isSpentDB(output, function(spent) {
        spent.should.equal(false);
        done();
      });
    });

    it('should give true if the output is spent', function(done) {
      db.store = {
        get: sinon.stub().callsArgWith(1, null)
      };
      db.isSpentDB(output, function(spent) {
        spent.should.equal(true);
        done();
      });
    });

    it('should give an error if there was an error', function(done) {
      db.store = {
        get: sinon.stub().callsArgWith(1, new Error('error'))
      };
      db.isSpentDB(output, function(spent) {
        should.exist(spent);
        var isError = spent instanceof Error;
        var isTruthy = false;
        if(spent) {
          isTruthy = true;
        }
        isError.should.equal(true);
        isTruthy.should.equal(true);
        spent.message.should.equal('error');
        done();
      });
    });
  });

  describe('#_isSpentMempool', function() {
    var txs = [
      {
        inputs: [
          {
            prevTxId: '7f4437c53df8c92fd958c79df3426578460a6a01a4905c009da86d3b3a8803fb',
            outputIndex: 0
          },
          {
            prevTxId: 'aa2db23f670596e96ed94c405fd11848c8f236d266ee96da37ecd919e53b4371',
            outputIndex: 1
          }
        ]
      },
      {
        inputs: [
          {
            prevTxId: 'bddfd734b0d6ee1f3f19bf940413f76800b542f253c8c3815bc661f1cfe8bb7c',
            outputIndex: 2
          }
        ]
      }
    ];

    var db = new DB({path: 'path', store: memdown});
    db.mempool = {
      getTransactions: sinon.stub().returns(txs)
    };

    it('should return true if the output was spent', function() {
      var result1 = db._isSpentMempool({
        txid: 'aa2db23f670596e96ed94c405fd11848c8f236d266ee96da37ecd919e53b4371',
        outputIndex: 1
      });
      result1.should.equal(true);

      var result2 = db._isSpentMempool({
        txid: 'bddfd734b0d6ee1f3f19bf940413f76800b542f253c8c3815bc661f1cfe8bb7c',
        outputIndex: 2
      });
      result2.should.equal(true);
    });
    it('should return false if the output was not spent', function() {
      var result = db._isSpentMempool({
        txid: '7f4437c53df8c92fd958c79df3426578460a6a01a4905c009da86d3b3a8803fb',
        outputIndex: 1
      });
      result.should.equal(false);
    });
  });
});
