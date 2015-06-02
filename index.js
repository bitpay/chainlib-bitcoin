'use strict';

module.exports = {};
module.exports.RPCNode = require('./lib/rpc');
module.exports.Node = require('./lib/node');
module.exports.Block = require('./lib/block');
module.exports.Chain = require('./lib/chain');
module.exports.DB = require('./lib/db');
module.exports.Miner = require('./lib/miner');
module.exports.Transaction = require('./lib/transaction');
module.exports.Wallet = require('./lib/wallet');
module.exports.errors = require('./lib/errors');

module.exports.deps = {};
module.exports.deps.chainlib = require('chainlib');
