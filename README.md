ChainLib Bitcoin
=======
[![Build Status](https://img.shields.io/travis/bitpay/chainlib-bitcoin.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/chainlib-bitcoin)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/chainlib-bitcoin.svg?style=flat-square)](https://coveralls.io/r/bitpay/chainlib-bitcoin)

A library for building Bitcoin chain based databases.

**Chainlib-bitcoin is not actively maintained anymore. Please check out [bitcoind.js](https://github.com/bitpay/bitcoind.js), which is similar, but runs bitcoind in the same node process and uses it to query blocks, transactions, unspent outputs and the mempool.**

## Getting Started

### Install

```bash
git clone git@github.com:bitpay/chainlib-bitcoin.git
cd chainlib-bitcoin
npm install
```

### Example Usage

```js

var BitcoinNode = require('chainlib-bitcoin').RPCNode;

var privkey = 'tprv8ZgxMBicQKsPdj1QowoT9z1tY5Et38qaMjCHZVoPdPFb6narfmYkqTygEVHfUmY78k3HcaEpkyNCAQDANaXtwNe1HLFvcA7nqYj1B7wTSTo';

var configuration = {
  db: {
    xprivkey: privkey,
    path: './bitcoin-testnet.db'
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
    pass: 'password',
    ssl: false,
    sslStrict: false
  },
  testnet: true
};

var node = new BitcoinNode(configuration);

node.chain.on('addblock', function(block) {
  console.log('New Best Tip:', block.hash);
});

```

### API Documentation

Get Unspent Outputs

```js
var address = '15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2';
var includeMempool = true;
node.getUnspentOutputs(address, includeMempool, function(err, unspentOutputs) {
  //...
});
```

View Balances

```js
var address = '15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2';
var includeMempool = true;
node.getBalance(address, includeMempool, function(err, balance) {
  //...
});
```

Get Outputs

```js
var address = '15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2';
var includeMempool = true;
node.getOutputs(address, includeMempool, function(err, outputs) {
  //...
});
```

Get Transaction

```js
var txid = 'c349b124b820fe6e32136c30e99f6c4f115fce4d750838edf0c46d3cb4d7281e';
var includeMempool = true;
node.getTransaction(txid, includeMempool, function(err, transaction) {
  //...
});
```

Get Block

```js
var blockHash = '00000000d17332a156a807b25bc5a2e041d2c730628ceb77e75841056082a2c2';
node.getBlock(blockHash, function(err, block) {
  //...
});
```

### Tests and Coverage

To run all of the tests:

```bash
npm run test
npm run coverage
```

To run a single test file in watch mode (useful for developing):

```bash
mocha -w -R spec test/db.unit.js
```

