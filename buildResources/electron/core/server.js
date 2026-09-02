const { spawn, execFile } = require('child_process');

const {
  env,
  START_SERVER,
  APP_ROOT_DIR,
  SERVER_EXECUTABLE_PATH,
} = require('../config/paths');

let serverProcess = null;
let serverExitPromise = null;
let stopPromise = null;

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
  if (serverProcess && serverProcess.exitCode === null) {
    return serverProcess;
  }

  // console.log('resourcesDir is ' + env.APP_RESOURCES_DIR);
  // console.log('startServer() - workingDir is ' + APP_ROOT_DIR);
  // console.log('startServer() - env is ', env);

  serverProcess = spawn(SERVER_EXECUTABLE_PATH, [], {
    stdio: 'ignore',
    detached: false,
    env: env,
    cwd: APP_ROOT_DIR,
  });

  serverExitPromise = new Promise((resolve) => {
    serverProcess.once('exit', (code, signal) => {
      console.log(
        `startServer() - Server exited. code=${code}, signal=${signal}`
      );

      serverProcess = null;
      resolve({ code, signal });
    });

    serverProcess.once('error', (err) => {
      console.error('startServer() - Server process error:', err);
    });
  });

  return serverProcess;
}

function waitForProcessExit(timeoutMs) {
  if (!serverProcess || !serverExitPromise) {
    return Promise.resolve(true);
  }

  return Promise.race([
    serverExitPromise.then(() => true),
    delay(timeoutMs).then(() => false),
  ]);
}

function forceKillProcess(processToKill) {
  if (!processToKill || processToKill.pid == null) {
    return Promise.resolve();
  }

  const pid = String(processToKill.pid);

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      // Kill the process we spawned and any children it created.
      execFile(
        'taskkill',
        ['/pid', pid, '/t', '/f'],
        (error, stdout, stderr) => {
          if (error) {
            console.error(
              'stopServer() - Windows forceful termination failed:',
              error.message
            );
          }

          resolve();
        }
      );
    });
  }

  return new Promise((resolve) => {
    try {
      process.kill(processToKill.pid, 'SIGKILL');
      console.log('stopServer() - Server forcefully terminated.');
    } catch (e) {
      // It may have already exited
      if (e.code !== 'ESRCH') {
        console.error(
          'stopServer() - Server forceful termination failed:',
          e.message
        );
      }
    }

    resolve();
  });
}

async function stopServer() {
  if (stopPromise) {
    return stopPromise;
  }

  stopPromise = (async () => {
    const processToStop = serverProcess;

    if (!processToStop) {
      console.log('stopServer() - No owned server process to stop.');
      return;
    }

    if (processToStop.exitCode !== null || processToStop.killed) {
      console.log('stopServer() - Server has already exited.');
      return;
    }

    // Kill the process we spawned (or use another mechanism if you need gentle shutdown)
    try {
      processToStop.kill('SIGTERM');
      console.log('stopServer() - Server termination requested.');
    } catch (e) {
      // It may have already exited
      if (e.code !== 'ESRCH') {
        console.error(
          'stopServer() - Server termination request failed:',
          e.message
        );
      }
    }

    const exited = await waitForProcessExit(3000);

    if (!exited) {
      console.log(
        'stopServer() - Server did not exit in time; terminating forcefully.'
      );
      await forceKillProcess(processToStop);
      await waitForProcessExit(2000);
    }

    if (serverProcess === processToStop) {
      serverProcess = null;
    }

    console.log('stopServer() - Server shutdown handling complete.');
  })();

  try {
    return await stopPromise;
  } finally {
    stopPromise = null;
  }
}

module.exports = {
  startServer,
  stopServer,
  waitForServerReady,
  delay,
};
