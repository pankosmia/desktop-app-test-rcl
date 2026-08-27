/**
 * Puppeteer launches the downloaded Firefox engine (features/firefox.js)
 * If an app omits Puppeteer/Firefox, then omit this module too.
 */
const { app, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { install, computeExecutablePath } = require('@puppeteer/browsers');

const {
  FIREFOX_VERSION,
  FIREFOX_BUILD_ID,
  ASSET_CACHE_DIR,
  FIREFOX_WIN_EXTRACT_DIR,
} = require('../config/paths');
const { downloadToFile } = require('../core/downloadUtil');
const { extractZipWith7zip } = require('../core/archiveUtil');

// Helper to get the Firefox executable path (used by generate-pdf)
function getFirefoxExecutablePath() {
  return computeExecutablePath({
    browser: 'firefox',
    buildId: FIREFOX_BUILD_ID,
    cacheDir: ASSET_CACHE_DIR,
  });
}

// Helper to check if Firefox browser engine is downloaded
function isFirefoxInstalled() {
  try {
    const exePath = getFirefoxExecutablePath();
    return fs.existsSync(exePath);
  } catch {
    return false;
  }
}

/**
 * Downloads and extracts Firefox on Windows using the silent /ExtractDir flag.
 * This avoids running the installer and won't touch any existing Firefox installation.
 */
async function downloadFirefoxWindows(event) {
  const url = `https://archive.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}/win64/en-US/Firefox%20Setup%20${FIREFOX_VERSION}.exe`;
  const tempExe = path.join(os.tmpdir(), `firefox-setup-${FIREFOX_VERSION}.exe`);
  const extractDir = FIREFOX_WIN_EXTRACT_DIR;

  console.log('Download URL:', url);
  console.log('Temp file:', tempExe);
  console.log('Extract to:', extractDir);

  // Step 1: Download the .exe with progress
  event.sender.send('download-progress', 0);
  await downloadToFile(url, tempExe, (percent) => {
    event.sender.send('download-progress', percent);
  });
  console.log('Download complete, extracting...');
  event.sender.send('download-progress', 100);

  // Step 2: Extract the self-extracting 7z archive
  await extractZipWith7zip(tempExe, extractDir);

  // Step 3: Clean up temp file
  try {
    fs.unlinkSync(tempExe);
    console.log('Temp file cleaned up');
  } catch {
    console.warn('Could not delete temp file:', tempExe);
  }

  // Step 4: Verify extraction
  const exePath = getFirefoxExecutablePath();
  if (!fs.existsSync(exePath)) {
    throw new Error(`Extraction appeared to succeed but firefox.exe not found at: ${exePath}`);
  }

  console.log('Firefox extracted successfully to:', exePath);
}

/**
 * Downloads Firefox on macOS/Linux using @puppeteer/browsers install().
 */
async function downloadFirefoxDefault(event) {
  event.sender.send('download-progress', null);
  await install({
    browser: 'firefox',
    buildId: FIREFOX_BUILD_ID,
    cacheDir: ASSET_CACHE_DIR,
    downloadProgressCallback: (downloadedBytes, totalBytes) => {
      if (
        typeof downloadedBytes === 'number' &&
        typeof totalBytes === 'number' &&
        totalBytes > 0
      ) {
        const percent = Math.round((downloadedBytes / totalBytes) * 100);
        event.sender.send('download-progress', percent);
      }
    },
  });
}

function registerFirefoxHandlers() {
  // IPC: Check if Firefox browser engine is already downloaded
  ipcMain.handle('check-firefox-installed', async () => {
    return isFirefoxInstalled();
  });

  // IPC: Download Firefox browser engine on user request
  ipcMain.on('download-firefox', async (event) => {
    console.log('download-firefox triggered');
    console.log('Cache dir:', ASSET_CACHE_DIR);
    console.log('Build ID:', FIREFOX_BUILD_ID);
    console.log('Platform:', process.platform);
    try {
      if (process.platform === 'win32') {
        await downloadFirefoxWindows(event);
      } else {
        await downloadFirefoxDefault(event);
      }
      event.sender.send('download-complete', true);
    } catch (err) {
      console.error('Firefox download failed:', err.message);
      console.error('Full error:', err);
      event.sender.send('download-complete', false, err.message);
    }
  });
}

module.exports = {
  getFirefoxExecutablePath,
  isFirefoxInstalled,
  downloadFirefoxWindows,
  downloadFirefoxDefault,
  registerFirefoxHandlers,
};
