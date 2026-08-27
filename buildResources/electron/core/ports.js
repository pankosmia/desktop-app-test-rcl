const net = require('net');
const { env } = require('../config/paths');

function findFreePort(start = 19119, end = 65535) {
  return new Promise((resolve, reject) => {
    let port = start;
    function tryPort() {
      if (port > end) return reject(new Error('free port not found'));
      const server = net.createServer();
      server.once('error', () => { port++; tryPort(); });
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, '127.0.0.1');
    }
    tryPort();
  });
}

// Use existing env var or find one
async function getPort() {
  if (env.ROCKET_PORT && env.ROCKET_PORT.trim() !== '') {
    return Number(env.ROCKET_PORT);
  }
  try {
    return await findFreePort(19119);
  } catch {
    return 19119; // matches Rocket.toml fallback
  }
}

module.exports = { findFreePort, getPort };
