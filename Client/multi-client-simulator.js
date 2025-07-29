// Client/multi-client-simulator.js

const net = require("net");
const crypto = require("crypto");

const sharedSecretKey = Buffer.alloc(32, 1); // Same key as server

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sharedSecretKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(payloadBase64) {
  const buffer = Buffer.from(payloadBase64, "base64");
  const iv = buffer.slice(0, 12);
  const tag = buffer.slice(12, 28);
  const encrypted = buffer.slice(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", sharedSecretKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString();
}

function encodeMessage(messageObj) {
  const payload = encrypt(JSON.stringify(messageObj));
  const framed = JSON.stringify({ payload }) + "\0";
  return Buffer.from(framed);
}

function splitMessageChunks(clientId) {
  const buffer = encodeMessage({ type: "handshake", clientId });
  return [
    buffer.slice(0, 15),
    buffer.slice(15, 32),
    buffer.slice(32, buffer.length - 1),
    buffer.slice(buffer.length - 1),
  ];
}

function simulateClient(
  clientId,
  delay = 1000,
  launchDelay = 3000,
  lifetime = 10000,
) {
  setTimeout(() => {
    const socket = net.createConnection(9300, "tcp-server", () => {
      console.log(`✅ [Client ${clientId}] Connected to server`);
      const chunks = splitMessageChunks(clientId);

      (async () => {
        for (let i = 0; i < chunks.length; i++) {
          const label =
            i === chunks.length - 1
              ? "📦 Final chunk with \\0"
              : `🚀 Chunk ${i + 1}`;
          console.log(
            `➡️  [Client ${clientId}] Sending: ${label} (${chunks[i].length} bytes)`,
          );
          socket.write(chunks[i]);
          await new Promise((r) => setTimeout(r, delay));
        }
      })();

      // 🔥 Auto-destroy after specified lifetime
      // setTimeout(() => {
      // console.warn(`🛑 [Client ${clientId}] Auto-destroying socket after ${lifetime}ms`);
      // socket.destroy();
      // }, lifetime);
    });

    function sendPong() {
      const pongMsg = encodeMessage({ type: "pong" });
      socket.write(pongMsg);
      console.log(`📶 [Client ${clientId}] Sent PONG`);
    }

    socket.on("data", (data) => {
      const packets = data.toString().split("\0").filter(Boolean);
      packets.forEach((packetStr) => {
        try {
          const parsed = JSON.parse(packetStr);
          const decrypted = decrypt(parsed.payload);
          const event = JSON.parse(decrypted);

          console.log(`🔓 [Client ${clientId}] Received:`, event);

          if (event.type === "ping") {
            sendPong();
          } else if (event.eventId) {
            const ack = {
              type: "ack",
              eventId: event.eventId,
            };
            socket.write(encodeMessage(ack));
            console.log(
              `✅ [Client ${clientId}] Sent ACK for ${event.eventId}`,
            );
          }
        } catch (err) {
          console.error(
            `❌ [Client ${clientId}] Decryption failed:`,
            err.message,
          );
        }
      });
    });

    socket.on("error", (err) => {
      console.error(`❌ [Client ${clientId}] Socket error: ${err.message}`);
    });

    socket.on("close", () => {
      console.log(`❌ [Client ${clientId}] Disconnected from server`);
    });
  }, launchDelay);
}

// Simulate 2 clients that self-destruct after 10s
// simulateClient(101, 1000, 3000, 10000); // client 101
// simulateClient(202, 1200, 4000, 10000); // client 202

const totalClients = parseInt(process.env.CLIENT_COUNT || "2");

for (let i = 1; i <= totalClients; i++) {
  const delay = 800 + Math.floor(Math.random() * 300); // delay between chunks
  const launchDelay = 1000 + i * 30; // stagger client launch
  const lifetime = 10000 + Math.floor(Math.random() * 5000); // auto-destroy

  simulateClient(i, delay, launchDelay, lifetime);
}
