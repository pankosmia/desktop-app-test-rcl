const { app, dialog } = require('electron');
const { START_SERVER } = require('../config/paths');
const {
  startServer,
  stopServer,
  waitForServerReady,
} = require('./server');

// Injected by the orchestrator (electronStartup.js) to avoid a circular dependency with window.js.
let createWindow = () => {
  throw new Error('startupErrors: createWindow was not injected.');
};

function setCreateWindow(fn) {
  createWindow = fn;
}

async function attemptStartup(port) {
  if (START_SERVER) {
    startServer();
  }

  try {
    await waitForServerReady(port);
  } catch (err) {
    if (START_SERVER) {
      await stopServer();
    }

    throw err;
  }
}

function humanizeStartupError(err, port) {
  console.error('[startup] backend failed to become ready:', err);
  const msg = (err && err.message) || String(err);

  if (err && err.code === 'STARTUP_TIMEOUT') {
    return `The app couldn't reach the backend on port ${port} in time. ` +
      `It may still be starting up, or something is blocking it.`;
  }
  if (/EADDRINUSE/i.test(msg)) {
    return `Port ${port} is already in use by another program, so the backend couldn't start.`;
  }
  if (/ENOENT/i.test(msg)) {
    return `The backend program couldn't be found or launched.`;
  }
  if (/ECONNREFUSED/i.test(msg)) {
    return `The backend didn't respond on port ${port}. It may have stopped or failed to start.`;
  }
  return `The backend couldn't be started.`;
}

function rawErrorText(err) {
  if (!err) return String(err);
  return err.stack || `${err.name || 'Error'}: ${err.message || String(err)}`;
}

function showStartupFailure(err, port) {
  const friendly = humanizeStartupError(err, port);

  if (!START_SERVER) {
    // Development Environment
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Retry', 'Quit'],
      defaultId: 0,
      message: 'Waiting for the server.',
      detail: `${friendly}\n\n` +
        `Start it, then click Retry.\n\n` +
        `— Developer details —\n${rawErrorText(err)}`,
    });

    if (choice === 0) {
      attemptStartup(port)
        .then(createWindow)
        .catch((e) => showStartupFailure(e, port));
    } else {
      app.quit();
    }
  } else {
    // Production Environment
    dialog.showMessageBoxSync({
      type: 'error',
      buttons: ['Quit'],
      defaultId: 0,
      message: 'The backend could not be started.',
      detail: `${friendly}\n\nPlease quit and try again.`,
    });

    app.quit();
  }
}

module.exports = {
  humanizeStartupError,
  rawErrorText,
  showStartupFailure,
  attemptStartup,
  setCreateWindow,
};
