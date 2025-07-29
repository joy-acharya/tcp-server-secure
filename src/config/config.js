const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  port: process.env.PORT || 9300,
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || "AudR@red4312",
  },
  logLevel: process.env.LOG_LEVEL || "info",
};
