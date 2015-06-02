ChainLib Bitcoin
=======
[![Build Status](https://img.shields.io/travis/bitpay/chainlib-bitcoin.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/chainlib-bitcoin)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/chainlib-bitcoin.svg?style=flat-square)](https://coveralls.io/r/bitpay/chainlib-bitcoin)

A library for building Bitcoin chain based databases.

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

