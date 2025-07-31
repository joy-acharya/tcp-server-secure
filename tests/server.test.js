const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

describe('TCP Server Integration Test (Mock Redis)', () => {
  let serverProcess;

  beforeAll((done) => {
    serverProcess = spawn('node', [path.join(__dirname, '../src/socket-server.js')], {
      env: { ...process.env, NODE_ENV: 'test' }
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('TCP server running')) {
        done();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
  }, 10000); // 10s timeout

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  test('TCP server responds with expected message', (done) => {
    const client = new net.Socket();

    client.connect(9300, '127.0.0.1', () => {
      client.write('{"type":"ping"}');
    });

    client.on('data', (data) => {
      const msg = data.toString();
      expect(msg).toContain('ack');
      client.destroy();
      done();
    });

    client.on('error', (err) => {
      console.error('Client error:', err);
      done(err);
    });
  }, 10000); // 10s timeout
});
