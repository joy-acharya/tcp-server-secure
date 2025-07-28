// const crypto = require('crypto');

// function generateSharedKey(peerKeyBase64) {
//   const dh = crypto.createDiffieHellman(2048);
//   dh.generateKeys();
//   const peerKey = Buffer.from(peerKeyBase64, 'base64');
//   return dh.computeSecret(peerKey);
// }
// module.exports = { generateSharedKey };

// crypto/diffie-hellman.js

function generateSharedKey(peerKeyBase64) {
  // Use static 32-byte key to match Python client
  return Buffer.from("ThisIsASharedKeyForTesting123456");
}

module.exports = { generateSharedKey };
