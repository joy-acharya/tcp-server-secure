// services/redis-service.js
const { createClient } = require("redis");

function setupRedis({ host, port, password }, logger) {

  logger.info(`password: ${password}, host: ${host}, port: ${port}`);
  const client = createClient({
    password,
    socket: {
      host,
      port,
    },
  });

  client.on("error", (err) => console.error("Redis Client Error:", err));

  client.connect(); // don't await it here; already handled in higher layer
  return client;
}

module.exports = { setupRedis };
