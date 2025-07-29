// server/client-connection.js

const crypto = require("crypto");
const { encode, PacketDecoder } = require("../shared/packet-utils");
const { Logger } = require("../utils/logger");
const logger = Logger("SocketServer");

class ClientConnection {
  constructor(socket, context = {}) {
    this.socket = socket;
    this.clientId = null;
    this.secretKey = Buffer.alloc(32, 1);
    this.eventQueueKey = null;
    this.currentEvent = null;
    this.retryTimer = null;
    this.processing = false;
    this.socketClosed = false;
    this.clientPayloadQueue = [];
    this.invalidAckCount = 0;
    this.retryAttempts = 0;
    this.lastPongTimestamp = Date.now();

    this.redisClient = context.redisClient;
    this.clientMap = context.clientMap;
    this.logger = logger;
    this.decoder = new PacketDecoder(
      this.handleDecodedMessage.bind(this),
      this.logger,
    );

    this.setupSocket();
  }

  setupSocket() {
    this.socket.on("data", (chunk) => {
      try {
        this.decoder.pushChunk(chunk);
      } catch (error) {
        this.logger.warn(
          `Decoder failure for client ${this.clientId || "unknown"}: ${error.message}`,
        );
        this.cleanup();
      }
    });

    this.socket.on("close", () => {
      this.logger.warn(`Client disconnected: ${this.clientId}`);
      const clientId = this.socket.clientId || "[unidentified]";
      logger.warn(`[SocketServer] Client disconnected: ${clientId}`);
      logger.info(
        `[SocketServer] Cleaned up connection for client ${clientId}`,
      );
      this.socketClosed = true;
      this.cleanup();
    });

    this.socket.on("error", (err) => {
      this.logger.error(
        `Socket error for client ${this.clientId || "unknown"}: ${err.message}`,
      );
      this.socketClosed = true;
      this.cleanup();
    });
  }

  cleanup() {
    clearInterval(this.eventLoopInterval);
    clearInterval(this.retryTimer);
    clearInterval(this.heartbeatTimer);
    clearInterval(this.heartbeatMonitor);

    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch (_) {}
    }

    if (this.clientId && this.clientMap) {
      delete this.clientMap[this.clientId];
    }

    this.logger.info(`Cleaned up connection for client ${this.clientId}`);
  }

  async handleDecodedMessage(message) {
    try {
      if (typeof message !== "object" || (!message.type && !message.payload)) {
        throw new Error(
          "Invalid message format (not an object or missing keys)",
        );
      }

      const json = this.secretKey
        ? this.validateDecrypted(message)
        : this.validatePlainHandshake(message);

      if (json.type === "handshake") {
        this.clientId = json.clientId;
        this.socket.clientId = this.clientId;
        if (!this.clientId) throw new Error("Missing clientId in handshake");

        this.secretKey = Buffer.alloc(32, 1);
        this.eventQueueKey = `event-${this.clientId}`;
        this.logger.info(`Handshake completed with client ${this.clientId}`);
        this.startEventLoop();
        this.startHeartbeat();
      } else if (json.type === "ack") {
        this.handleAck(json.eventId);
      } else if (json.type === "client-event") {
        this.enqueueClientPayload(json);
      } else if (json.type === "pong") {
        this.lastPongTimestamp = Date.now();
        this.logger.debug(`Pong received from ${this.clientId}`);
      } else {
        throw new Error(`Unknown message type: ${json.type}`);
      }
    } catch (err) {
      this.logger.warn(
        `Client ${this.clientId || "unknown"} sent invalid data: ${err.message}`,
      );
      this.cleanup();
    }
  }

  validateDecrypted(message) {
    if (!message.payload) throw new Error("Missing encrypted payload");
    const decrypted = this.simpleDecrypt(message.payload);
    return JSON.parse(decrypted);
  }

  validatePlainHandshake(message) {
    if (message.type !== "handshake") throw new Error("Expected handshake");
    if (!message.clientId) throw new Error("Handshake missing clientId");
    return message;
  }

  startEventLoop() {
    this.eventLoopInterval = setInterval(async () => {
      if (this.processing || this.socketClosed) return;
      this.processing = true;

      try {
        const firstItem = await this.redisClient.lIndex(this.eventQueueKey, 0);
        if (firstItem) {
          const newEvent = this.parseEvent(firstItem);
          if (
            !this.currentEvent ||
            this.currentEvent.eventId !== newEvent.eventId
          ) {
            this.currentEvent = newEvent;
            this.invalidAckCount = 0;
            this.retryAttempts = 0;
            this.sendEventToClient(this.currentEvent);
          }
        } else {
          await this.processClientPayloads();
        }
      } catch (err) {
        this.logger.error("Error in event loop:", err.message);
      }

      this.processing = false;
    }, 200);
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socketClosed) return;

      const payload = {
        type: "ping",
        timestamp: Date.now(),
      };

      const encrypted = this.simpleEncrypt(JSON.stringify(payload));
      this.socket.write(encode({ payload: encrypted }));
      this.logger.debug(`Sent ping to ${this.clientId}`);
    }, 5000);

    this.heartbeatMonitor = setInterval(() => {
      if (this.socketClosed) return;
      const now = Date.now();
      if (now - this.lastPongTimestamp > 10000) {
        this.logger.warn(
          `No pong received from ${this.clientId} in 10s. Terminating.`,
        );
        this.cleanup();
      }
    }, 3000);
  }

  sendEventToClient(event) {
    const payload = {
      type: "server-event",
      eventId: event.eventId,
      eventNumber: event.eventNumber,
      timestamp: event.timestamp,
    };

    const encrypted = this.simpleEncrypt(JSON.stringify(payload));
    this.socket.write(encode({ payload: encrypted }));

    clearInterval(this.retryTimer);
    this.retryTimer = setInterval(() => {
      if (this.socketClosed) {
        this.logger.warn(
          `Client ${this.clientId} disconnected. Stopping retry for ${event.eventId}`,
        );
        clearInterval(this.retryTimer);
        return;
      }

      if (!this.currentEvent) {
        clearInterval(this.retryTimer);
        return;
      }

      this.retryAttempts++;

      this.logger.warn(`retryAttempts: ${this.retryAttempts}`);

      if (this.retryAttempts > 2) {
        this.logger.warn(
          `Event ${event.eventId} timed out after ${this.retryAttempts} retries.`,
        );
        clearInterval(this.retryTimer);
        this.currentEvent = null;
        return;
      }

      this.logger.warn(
        `Retrying event ${event.eventId}, attempt ${this.retryAttempts}`,
      );
      this.socket.write(encode({ payload: encrypted }));
    }, 1000);
  }

  async handleAck(eventId) {
    if (this.currentEvent?.eventId === eventId) {
      await this.redisClient.lPop(this.eventQueueKey);
      this.logger.debug(
        `ACK received for ${eventId} by client ${this.clientId}`,
      );
      this.currentEvent = null;
      clearInterval(this.retryTimer);
      this.invalidAckCount = 0;
    } else {
      this.invalidAckCount++;
      this.logger.warn(
        `Client ${this.clientId} sent invalid ACK for ${eventId}`,
      );

      this.logger.warn(`invalidAckCount: ${this.invalidAckCount}`);

      if (this.invalidAckCount >= 2) {
        this.logger.warn(
          `Client ${this.clientId} exceeded max invalid ACKs for event ${this.currentEvent?.eventId}. Dropping.`,
        );
        await this.redisClient.lPop(this.eventQueueKey);
        this.currentEvent = null;
        clearInterval(this.retryTimer);
      }
    }
  }

  parseEvent(eventString) {
    const [eventId, eventNumber, timestamp] = eventString.split("|");
    return { eventId, eventNumber, timestamp };
  }

  enqueueClientPayload(payload) {
    this.clientPayloadQueue.push(payload);
  }

  async processClientPayloads() {
    while (this.clientPayloadQueue.length > 0) {
      const payload = this.clientPayloadQueue.shift();
      await this.redisClient.set(
        `usage-${this.clientId}-${Date.now()}`,
        JSON.stringify(payload),
      );
    }
  }

  simpleEncrypt(plainText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.secretKey, iv);
    let encrypted = cipher.update(plainText, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  simpleDecrypt(encryptedBase64) {
    const data = Buffer.from(encryptedBase64, "base64");
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.secretKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, null, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

module.exports = { ClientConnection };
