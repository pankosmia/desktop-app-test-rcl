const { spawn, execSync } = require('child_process');
const { env, START_SERVER, ELECTRON_ROOT_DIR } = require('../config/paths');

let serverProcess = null;

const MAC_SERVER_PATH = './bin/server.bin';
const WIN_SERVER_PATH = './bin/server.exe';

function delay(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function waitForServerReady(port, opts = {}) {
  const {
    overallTimeoutMs = 20000,
    perRequestTimeoutMs = 2000,
    intervalMs = 300,
  } = opts;

  const url = `http://127.0.0.1:${port}/api/version`;
  const deadline = Date.now() + overallTimeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(perRequestTimeoutMs),
        // Avoid any caching surprises during startup probing:
        cache: 'no-store',
      });
      if (res.ok) return; // server is ready
      // A response but not 2xx (e.g. 404/500 while booting) → keep trying.
      lastError = new Error(`Unexpected status ${res.status} from ${url}`);
    } catch (err) {
      // ECONNREFUSED, socket reset, DNS, or per-request AbortError → keep trying.
      lastError = err;
    }

    // Guard against sleeping when there's not enough time left
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await delay(Math.min(intervalMs, remaining));
  }

  const e = new Error(
    `Server did not become ready within ${overallTimeoutMs} ms` +
    (lastError ? ` (last error: ${lastError.message})` : '')
  );
  e.code = 'STARTUP_TIMEOUT'; // <-- tag used to write a friendlier production message
  throw e;
}

function startServer() {
  const serverPath = process.platform === 'win32' ? WIN_SERVER_PATH : MAC_SERVER_PATH;
  const workingDir = ELECTRON_ROOT_DIR;
  console.log('resourcesDir is ' + env.APP_RESOURCES_DIR);
  // console.log('startServer() - workingDir is ' + workingDir);
  // console.log('startServer() - resourcesDir is ' + resourcesDir);
  // console.log('startServer() - env is ', env);
  serverProcess = spawn(serverPath, [], {
    stdio: 'ignore',
    detached: true,
    env: env,
    cwd: workingDir
  });
  serverProcess.unref();
  // console.log('startServer() - Server started at ' + path.join(workingDir, serverPath));
}

function stopServer() {
  if (serverProcess) {
    // Kill the process we spawned (or use another mechanism if you need gentle shutdown)
    try {
      process.kill(serverProcess.pid);
      console.log('stopServer() - Server stopped.');
    } catch (e) {
      // It may have already exited
      console.error('stopServer() - Server Failed to stop - process ID kill failed.');
    }
  } else {
    // Optionally: kill whatever is listening on port
    try {
      console.log('stopServer() - Trying to stop server forcefully.');
      execSync(`lsof -t -i:${env.ROCKET_PORT} | xargs kill -9`); // but lsof does not exist in Windows
      console.log('stopServer() - Server stopped forcefully.');
    } catch {
      // ignore if nothing is running
      console.error(`stopServer() - Server Failed to stop - process at port ${env.ROCKET_PORT} ID kill failed.`);
    }
  }
}

module.exports = {
  startServer,
  stopServer,
  waitForServerReady,
  delay,
  MAC_SERVER_PATH,
  WIN_SERVER_PATH,
};
