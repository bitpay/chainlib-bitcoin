'use strict';

var BitcoinNode = require('../').RPCNode;

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
