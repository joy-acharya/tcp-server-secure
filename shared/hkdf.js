const crypto = require("crypto");

function hkdfSha256(secret, length = 32, salt = "", info = "") {
  const prk = crypto.createHmac("sha256", salt).update(secret).digest();
  let prev = Buffer.alloc(0);
  let output = Buffer.alloc(0);
  let i = 0;
  while (output.length < length) {
    i++;
    const input = Buffer.concat([prev, Buffer.from(info), Buffer.from([i])]);
    prev = crypto.createHmac("sha256", prk).update(input).digest();
    output = Buffer.concat([output, prev]);
  }
  return output.slice(0, length);
}

module.exports = { hkdfSha256 };
