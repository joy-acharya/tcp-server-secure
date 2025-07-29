const net = require("net");
const { ClientConnection } = require("../connections/client-connection");
const { Logger } = require("../utils/logger");
const { setupRedis } = require("../services/redis-service");
const { generateSharedKey } = require("../crypto/diffie-hellman");
const config = require("../src/config/config");

const logger = Logger("SocketServer", config.logLevel);
const clientMap = new Map();

function startSocketServer(port = config.port) {
  const redisClient = setupRedis(config.redis, logger);

  const server = net.createServer((socket) => {
    const remoteIP = socket.remoteAddress;
    const remotePort = socket.remotePort;

    if (socket.remoteAddress === "::1") {
      // console.debug(`[TRACE] Ignoring localhost probe from ${socket.remoteAddress}`);
      socket.destroy(); // silently kill probe
      return;
    }

    console.log(`[TRACE] New TCP connection from ${remoteIP}:${remotePort}`);
    const client = new ClientConnection(socket, {
      redisClient,
      logger,
      generateSharedKey,
      clientMap,
    });
    clientMap.set(client.id, client);
  });

  server.on("error", (err) => {
    logger.error("Server error:", err);
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`TCP server running on port ${port}`);
  });
}

startSocketServer();
module.exports = { startSocketServer };
