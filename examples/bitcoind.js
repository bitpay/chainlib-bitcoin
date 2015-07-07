'use strict';

var BitcoinNode = require('../').BitcoindNode;

var privkey = 'tprv8ZgxMBicQKsPdj1QowoT9z1tY5Et38qaMjCHZVoPdPFb6narfmYkqTygEVHfUmY78k3HcaEpkyNCAQDANaXtwNe1HLFvcA7nqYj1B7wTSTo';

var configuration = {
  db: {
    xprivkey: privkey,
    path: './bitcoind.db'
  },
  p2p: {
    addrs: [
      {
        ip: {
          v4: '127.0.0.1'
        },
        port: 8333
      }
    ],
    dnsSeed: false
  },
  testnet: false
};

var node = new BitcoinNode(configuration);

node.chain.on('addblock', function(block) {
  console.log('New Best Tip:', block.hash);
});
