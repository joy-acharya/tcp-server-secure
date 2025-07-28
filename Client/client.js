// test/test-client.js
const net = require("net");
const { encode } = require("../shared/packet-utils");

// Create TCP client socket
const client = new net.Socket();

// Connect to the server
client.connect(9000, "127.0.0.1", () => {
  console.log("✅ Connected to server");

  // Handshake payload
  const handshake = {
    type: "handshake",
    clientId: 898,
  };

  // Encode with null-byte terminator
  const fullPacket = encode(handshake); // includes \0 at the end
  const midpoint = Math.floor(fullPacket.length / 2);

  // Simulate chunked TCP transmission
  const chunk1 = fullPacket.slice(0, midpoint);
  const chunk2 = fullPacket.slice(midpoint); // includes final \0

  console.log(`🚀 Sending first chunk (${chunk1.length} bytes)`);
  client.write(chunk1);

  setTimeout(() => {
    console.log(
      `🧩 Sending second chunk (${chunk2.length} bytes, includes \\0)`,
    );
    client.write(chunk2);
  }, 500);
});

// Log server response
client.on("data", (data) => {
  console.log("📥 Received from server:", data.toString());
});

// Handle disconnect
client.on("close", () => {
  console.log("❌ Connection closed");
});

client.on("error", (err) => {
  console.error("❗ Client error:", err.message);
});
