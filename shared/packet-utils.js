// shared/packet-utils.js
module.exports = {
  encode(messageObj) {
    const str = JSON.stringify(messageObj);
    return Buffer.from(str + "\0", "utf8");
  },

  PacketDecoder: class {
    constructor(onMessage, logger = console) {
      // 🔧 default fallback
      this.buffer = Buffer.alloc(0);
      this.onMessage = onMessage;
      this.logger = logger;
    }

    pushChunk(chunk) {
      this.logger.debug?.(`Received chunk of ${chunk.length} bytes`);
      this.buffer = Buffer.concat([this.buffer, chunk]);

      let nullIndex;
      while ((nullIndex = this.buffer.indexOf(0x00)) !== -1) {
        const packet = this.buffer.slice(0, nullIndex).toString("utf8");
        this.logger.debug?.(
          `Complete packet found (${nullIndex} bytes): ${packet}`,
        );
        try {
          const parsed = JSON.parse(packet);
          this.onMessage(parsed);
        } catch (err) {
          this.logger.error?.("Invalid packet JSON:", err.message);
        }
        this.buffer = this.buffer.slice(nullIndex + 1);
      }
    }
  },
};
