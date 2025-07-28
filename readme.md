
# TCP Encrypted Messaging Server

A lightweight, production-ready TCP server designed for encrypted communication with clients over persistent connections. Built using Node.js and Redis, this server supports chunked message delivery, ACK handling, AES-GCM encryption, and a scalable event loop with heartbeat detection.

## Features

- 🔐 AES-256-GCM based encryption
- 🔁 Persistent bi-directional TCP communication
- 🧩 Supports chunked/streamed packets with null-byte delimiter
- 🔂 Retry logic with acknowledgments for event delivery
- 🧵 Handles multiple client connections concurrently
- 💓 Heartbeat detection with ping/pong to track live clients
- 💾 Redis-backed queueing for event and usage tracking
- 🔄 Handles reconnects, client state cleanup
- 🧪 Ready for unit/integration testing
- 🧰 Modular and extensible design

## Folder Structure

```
TCP_CLIENT/
├── client/                 # Minimal client example for testing
├── connections/            # Handles socket-level logic per client
├── crypto/                 # Encryption utilities (e.g., DH, AES)
├── services/               # Redis and other backend services
├── shared/                 # Shared helpers like packet encoder/decoder
├── utils/                  # Logging, configuration, helpers
├── tests/                  # Automated test cases
├── .env                    # Environment configuration (Redis, port, etc.)
├── package.json            # Dependencies and scripts
├── socket-server.js        # Server entrypoint
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Redis >= 6 (with optional password protection)

### Installation

```bash
git clone https://github.com/joy-acharya/tcp-encrypted-server.git
cd tcp-encrypted-server
npm install
cp .env.example .env
```

### Configuration

Edit the `.env` file with your Redis settings:

```ini
PORT=9000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword
```

### Running the Server

```bash
node src/socket-server.js
```

### Testing with Client

Use the provided client simulator to test chunked handshake, reconnections, and heartbeat:

```bash
node client/multi-client-simulator.js
```

## API Overview

### Client Message Types

- `handshake` — Initial connection: `{ type: "handshake", clientId: "101" }`
- `ack` — Acknowledges a server event: `{ type: "ack", eventId: "evt123" }`
- `client-event` — Sends data from client to server: `{ type: "client-event", ... }`
- `pong` — Heartbeat response to server's `ping`

### Server Message Types

- `server-event` — Pushes an event to the client
- `ping` — Periodic heartbeat check to ensure client is alive

## Security

- AES-256-GCM encryption for all payloads
- Each packet includes IV + AuthTag for decryption
- Key derived using Diffie-Hellman + HKDF (planned extension)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss your idea.

## License

MIT

## Author

Developed with ❤️ by [Joy Acharya](https://github.com/joy-acharya)