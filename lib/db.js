'use strict';

var util = require('util');
var chainlib = require('chainlib');
var BaseDB = chainlib.DB;
var Transaction = require('./transaction');
var Wallet = require('./wallet');
var async = require('async');
var bitcore = require('bitcore');
var BufferWriter = bitcore.encoding.BufferWriter;
var errors = require('./errors');
var levelup = chainlib.deps.levelup;
var log = chainlib.log;
var PublicKey = bitcore.PublicKey;
var Address = bitcore.Address;

function DB(options) {
  if(!options) {
    options = {};
  }

  BaseDB.call(this, options);

  this.coinbaseAmount = options.coinbaseAmount || 50 * 1e8;
  this.Transaction = Transaction;

  this.network = bitcore.Networks.get(options.network) || bitcore.Networks.testnet;

  if(options.xprivkey) {
    this.setWallet(options.xprivkey);
  }
}

util.inherits(DB, BaseDB);

DB.PREFIXES = {
  TX: 'tx',
  SPENTS: 'sp',
  OUTPUTS: 'outs'
};
DB.CONCURRENCY = 10;

DB.prototype.setWallet = function(xprivkey) {
  this.wallet = new Wallet({xprivkey: xprivkey, db: this, network: this.network});
};

DB.prototype.validateBlockData = function(block, callback) {
  var self = this;

  var transactions;

  async.series(
    [
      function validateTransactions(next) {
        transactions = self.getTransactionsFromBlock(block);

        async.each(transactions, function(transaction, done) {
          transaction.validate(self, transactions, done);
        }, next);
      },
      function validateCoinbase(next) {
        self.validateCoinbase(block, transactions, next);
      }
    ],
    callback
  );
};

DB.prototype.buildGenesisData = function() {
  var coinbaseTx = this.buildCoinbaseTransaction();
  var bw = new BufferWriter();
  bw.writeVarintNum(1);
  bw.write(coinbaseTx.toBuffer());
  var merkleRoot = this.getMerkleRoot([coinbaseTx]);
  var buffer = bw.concat();
  return {
    merkleRoot: merkleRoot,
    buffer: buffer
  };
};

DB.prototype.buildCoinbaseTransaction = function(transactions, data) {
  if(!this.wallet) {
    throw new Error('Wallet required to build coinbase');
  }

  if(!data) {
    data = bitcore.crypto.Random.getRandomBuffer(40);
  }

  var fees = 0;

  if(transactions && transactions.length) {
    fees = this.getInputTotal(transactions) - this.getOutputTotal(transactions, true);
  }

  var coinbaseTx = new this.Transaction();
  coinbaseTx.to(this.wallet.getAddress(0), this.coinbaseAmount + fees);

  var script = bitcore.Script.buildDataOut(data);

  var input = new bitcore.Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xffffffff,
    sequenceNumber: 4294967295,
    script: script
  });

  coinbaseTx.inputs = [input];
  return coinbaseTx;
};

DB.prototype.validateCoinbase = function(block, transactions, callback) {
  if(!transactions.length || !transactions[0].isCoinbase()) {
    return callback(new Error('First transaction in block must be coinbase'));
  }

  var fees = this.getInputTotal(transactions) - this.getOutputTotal(transactions, true);

  if(transactions[0]._getOutputAmount() > this.coinbaseAmount + fees) {
    return callback(new Error('Coinbase amount is too large'));
  }

  callback();
};

DB.prototype.getOutputTotal = function(transactions, excludeCoinbase) {
  var totals = transactions.map(function(tx) {
    if(tx.isCoinbase() && excludeCoinbase) {
      return 0;
    } else {
      return tx._getOutputAmount();
    }
  });
  var grandTotal = totals.reduce(function(previousValue, currentValue) {
    return previousValue + currentValue;
  });
  return grandTotal;
};

DB.prototype.getInputTotal = function(transactions) {
  var totals = transactions.map(function(tx) {
    if(tx.isCoinbase()) {
      return 0;
    } else {
      return tx._getInputAmount();
    }
  });
  var grandTotal = totals.reduce(function(previousValue, currentValue) {
    return previousValue + currentValue;
  });
  return grandTotal;
};

DB.prototype._updateOutputs = function(block, addOutput, callback) {
  var txs = this.getTransactionsFromBlock(block);

  log.debug('Processing transactions', txs);
  log.debug('Updating outputs');

  var action = 'put';
  if (!addOutput) {
    action = 'del';
  }

  var operations = [];

  for (var i = 0; i < txs.length; i++) {

    var tx = txs[i];
    var txid = tx.id;
    var inputs = tx.inputs;
    var outputs = tx.outputs;

    for (var j = 0; j < outputs.length; j++) {
      var output = outputs[j];

      var script = output.script;
      if(!script) {
        log.debug('Invalid script');
        continue;
      }

      if (!script.isPublicKeyHashOut() && !script.isScriptHashOut() && !script.isPublicKeyOut()) {
        // ignore for now
        log.debug('script was not pubkeyhashout, scripthashout, or pubkeyout');
        continue;
      }

      var address;

      if(script.isPublicKeyOut()) {
        var pubkey = script.chunks[0].buf;
        address = Address.fromPublicKey(new PublicKey(pubkey), this.network);
      } else {
        address = output.script.toAddress(this.network);
      }

      var outputIndex = j;

      var timestamp = block.timestamp.getTime();
      var height = block.height;

      operations.push({
        type: action,
        key: [DB.PREFIXES.OUTPUTS, address, timestamp, txid, outputIndex].join('-'),
        value: [output.satoshis, script, height].join(':')
      });
    }

    if(tx.isCoinbase()) {
      continue;
    }

    for (var j = 0; j < inputs.length; j++) {
      var input = inputs[j];

      var prevTxId = input.prevTxId.toString('hex');
      var prevOutputIndex = input.outputIndex;
      var timestamp = block.timestamp.getTime();
      var inputIndex = j;

      operations.push({
        type: action,
        key: [DB.PREFIXES.SPENTS, prevTxId, prevOutputIndex].join('-'),
        value: [txid, inputIndex, timestamp].join(':')
      });
    }

  }

  callback(null, operations);

};

DB.prototype._updateTransactions = function(block, addTransaction, callback) {
  var self = this;

  DB.super_.prototype._updateTransactions.call(self, block, addTransaction, function(err, operations) {
    if(err || !addTransaction) {
      return callback(err, operations);
    }

    // Remove transactions from mempool with inputs that were spent
    var mempoolTransactions = self.mempool.getTransactions();
    var blockTransactions = self.getTransactionsFromBlock(block);
    var newMempoolTransactions = [];

    for(var i = 0; i < mempoolTransactions.length; i++) {
      var txHasInputsInBlock = false;
      for(var j = 0; j < mempoolTransactions[i].inputs.length; j++) {
        for(var k = 0; k < blockTransactions.length; k++) {
          for(var l = 0; l < blockTransactions[k].inputs.length; l++) {
            var mempoolInput = mempoolTransactions[i].inputs[j];
            var blockInput = blockTransactions[k].inputs[l];
            if(mempoolInput.prevTxId === blockInput.prevTxId &&
              mempoolInput.outputIndex === blockInput.outputIndex) {
              txHasInputsInBlock = true;
              break;
            }
          }

          if(txHasInputsInBlock) {
            break;
          }
        }

        if(txHasInputsInBlock) {
          break;
        }
      }

      if(!txHasInputsInBlock) {
        newMempoolTransactions.push(mempoolTransactions[i]);
      }
    }

    self.mempool.transactions = newMempoolTransactions;
    callback(null, operations);
  });
};

DB.prototype._onChainAddBlock = function(block, callback) {

  var self = this;

  log.debug('DB handling new chain block');

  // Remove block from mempool
  self.mempool.removeBlock(block.hash);

  async.series([
    this._updateOutputs.bind(this, block, true), // add outputs
    this._updateTransactions.bind(this, block, true) // add transactions
  ], function(err, results) {

    if (err) {
      return callback(err);
    }

    var operations = [];
    for (var i = 0; i < results.length; i++) {
      operations = operations.concat(results[i]);
    }

    log.debug('Updating the database with operations', operations);

    self.store.batch(operations, callback);

  });

};


DB.prototype._onChainRemoveBlock = function(block, callback) {

  var self = this;

  async.series([
    this._updateOutputs.bind(this, block, false), // remove outputs
    this._updateTransactions.bind(this, block, false) // remove transactions
  ], function(err, results) {

    if (err) {
      return callback(err);
    }

    var operations = [];
    for (var i = 0; i < results.length; i++) {
      operations = operations.concat(results[i]);
    }
    self.store.batch(operations, callback);

  });

};

DB.prototype.getAPIMethods = function() {
  return [
    ['getTransaction', this, this.getTransaction, 2],
    ['getBalance', this, this.getBalance, 2],
    ['sendFunds', this, this.sendFunds, 2],
    ['getOutputs', this, this.getOutputs, 2],
    ['getUnspentOutputs', this, this.getUnspentOutputs, 2],
    ['isSpent', this, this.isSpent, 2]
  ];
};

DB.prototype.getBalance = function(address, queryMempool, callback) {
  this.getUnspentOutputs(address, queryMempool, function(err, outputs) {
    if(err) {
      return callback(err);
    }

    var satoshis = outputs.map(function(output) {
      return output.satoshis;
    });

    var sum = satoshis.reduce(function(a, b) {
      return a + b;
    }, 0);

    return callback(null, sum);
  });
};

DB.prototype.sendFunds = function(address, amount, callback) {

  var self = this;

  self.wallet.updateUnspentOutputs(function(err) {
    if (err) {
      return callback(err);
    }

    try {
      var transaction = self.wallet.createTransaction(address, amount);
    } catch(e) {
      return callback(e);
    }

    self.mempool.addTransaction(transaction, function(err) {
      if(err) {
        return callback(err);
      }
      callback(null, transaction);
    });
  });

};

DB.prototype.getOutputs = function(address, queryMempool, callback) {
  var self = this;

  var outputs = [];
  var key = [DB.PREFIXES.OUTPUTS, address].join('-');

  var stream = this.store.createReadStream({
    start: key,
    end: key + '~'
  });

  stream.on('data', function(data) {

    var key = data.key.split('-');
    var value = data.value.split(':');

    var output = {
      address: key[1],
      txid: key[3],
      outputIndex: Number(key[4]),
      satoshis: Number(value[0]),
      script: value[1],
      blockHeight: Number(value[2])
    };

    outputs.push(output);

  });

  var error;

  stream.on('error', function(streamError) {
    if (streamError) {
      error = streamError;
    }
  });

  stream.on('close', function() {
    if (error) {
      return callback(error);
    }

    if(queryMempool) {
      var mempoolOutputs = self._getMempoolOutputs(address);

      outputs = outputs.concat(self._getMempoolOutputs(address));
    }

    callback(null, outputs);
  });

  return stream;

};

DB.prototype._getMempoolOutputs = function(address) {
  var outputs = [];

  var transactions = this.mempool.getTransactions();
  transactions.forEach(function(tx) {
    // add additional info to outputs
    var outputObjects = [];
    for(var i = 0; i < tx.outputs.length; i++) {
      var output = {};
      output.script = tx.outputs[i].script.toString();
      output.satoshis = tx.outputs[i].satoshis;
      output.txid = tx.hash;
      output.outputIndex = i;
      output.address = tx.outputs[i].script.toAddress().toString();
      outputObjects.push(output);
    }

    var filtered = outputObjects.filter(function(output) {
      return address.toString() === output.address;
    });

    if(filtered.length) {
      outputs = outputs.concat(filtered);
    }
  });

  return outputs;
};

DB.prototype.getUnspentOutputs = function(address, queryMempool, callback) {

  var self = this;

  this.getOutputs(address, queryMempool, function(err, outputs) {
    if (err) {
      return callback(err);
    } else if(!outputs.length) {
      return callback(new errors.NoOutputs('Address ' + address + ' has no outputs'), []);
    }

    var isUnspent = function(output, callback) {
      self.isUnspent(output, queryMempool, callback);
    };
    
    async.filter(outputs, isUnspent, function(results) {
      callback(null, results);
    });
  });
};

DB.prototype.isUnspent = function(output, queryMempool, callback) {
  this.isSpent(output, queryMempool, function(spent) {
    callback(!spent);
  });
};

DB.prototype.isSpent = function(output, queryMempool, callback) {
  if(queryMempool && this._isSpentMempool(output)) {
    return callback(true);
  }

  this.isSpentDB(output, callback);
};

DB.prototype.isSpentDB = function(output, callback) {
  var txid = output.prevTxId ? output.prevTxId.toString('hex') : output.txid; // output can also be an input

  var key = [DB.PREFIXES.SPENTS, txid, output.outputIndex].join('-');
  this.store.get(key, function(err) {
    if (err instanceof levelup.errors.NotFoundError) {
      // unspent
      callback(false);
    } else {
      if(err) {
        return callback(err);
      }

      // spent
      callback(true);
    }
  });
};

DB.prototype._isSpentMempool = function(output) {
  var spent = false;

  var txid = output.prevTxId ? output.prevTxId.toString('hex') : output.txid; // output can also be an input

  var transactions = this.mempool.getTransactions();
  for(var i = 0; i < transactions.length; i++) {
    for(var j = 0; j < transactions[i].inputs.length; j++) {
      var input = transactions[i].inputs[j];
      if(input.prevTxId.toString('hex') === txid && input.outputIndex === output.outputIndex) {
        spent = true;
        break;
      }
    }
    if(spent) {
      break;
    }
  }

  return spent;
};

module.exports = DB;
