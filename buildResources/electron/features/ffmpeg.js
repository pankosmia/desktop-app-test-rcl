const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { downloadToFile } = require('../core/downloadUtil');
const {
  extractZipWith7zip,
  extractZipWithDitto,
  extractZipWithUnzip,
} = require('../core/archiveUtil');
const { FFMPEG_BASE_DIR, FFMPEG_DIR } = require('../config/paths');

// Does user already have ffmpeg installed?
function getSystemFfmpegCommandName() {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

async function getSystemFfmpegCommand() {
  const command = getSystemFfmpegCommandName();
  try {
    await verifyFfmpegWorks(command);
    return command;
  } catch {
    return null;
  }
}

function verifyFfmpegWorks(ffmpegPathOrCommand) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPathOrCommand, ['-version']);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && /ffmpeg version/i.test(stdout || stderr)) {
        resolve(true);
      } else {
        reject(new Error(`FFmpeg verification failed with exit code ${code}`));
      }
    });
  });
}

async function getAvailableFfmpegPath() {
  const bundledPath = getBundledFfmpegExecutablePath();
  if (bundledPath && fs.existsSync(bundledPath)) {
    try {
      await verifyFfmpegWorks(bundledPath);
      return bundledPath;
    } catch {
      // ignore broken bundled install
    }
  }
  const systemCommand = await getSystemFfmpegCommand();
  if (systemCommand) {
    return systemCommand;
  }
  return null;
}

// ffmpeg install details
function getPlatformInfo() {
  if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      return {
        archiveExt: 'zip',
        executableName: 'ffmpeg.exe',
        downloadUrl: 'https://github.com/GyanD/codexffmpeg/releases/download/7.1.1/ffmpeg-7.1.1-essentials_build.zip',
      };
    }
    if (process.arch === 'arm64') {
      return {
        archiveExt: '7z',
        executableName: 'ffmpeg.exe',
        downloadUrl: 'https://github.com/tordona/ffmpeg-win-arm64/releases/download/7.1.1/ffmpeg-7.1.1-essentials-shared-win-arm64.7z',
      };
    }
    throw new Error(`Unsupported Windows architecture: ${process.arch}`);
  }
  if (process.platform === 'darwin') {
    if (process.arch === 'x64') {
      return {
        archiveExt: 'zip',
        executableName: 'ffmpeg',
        downloadUrl: 'https://ffmpeg.martin-riedl.de/download/macos/amd64/1741001873_7.1.1/ffmpeg.zip',
      };
    }
    if (process.arch === 'arm64') {
      return {
        archiveExt: 'zip',
        executableName: 'ffmpeg',
        downloadUrl: 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1741000090_7.1.1/ffmpeg.zip',
      };
    }
    throw new Error(`Unsupported macOS architecture: ${process.arch}`);
  }
  if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      return {
        archiveExt: 'zip',
        executableName: 'ffmpeg',
        downloadUrl: 'https://ffmpeg.martin-riedl.de/download/linux/amd64/1741000776_7.1.1/ffmpeg.zip',
      };
    }
    if (process.arch === 'arm64') {
      return {
        archiveExt: 'zip',
        executableName: 'ffmpeg',
        downloadUrl: 'https://ffmpeg.martin-riedl.de/download/linux/arm64/1740999880_7.1.1/ffmpeg.zip',
      };
    }
    throw new Error(`Unsupported Linux architecture: ${process.arch}`);
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function getBundledFfmpegExecutablePath() {
  const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  if (!fs.existsSync(FFMPEG_DIR)) return null;
  const stack = [FFMPEG_DIR];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === executableName) {
        return fullPath;
      }
    }
  }
  return null;
}

async function isFfmpegInstalled() {
  const ffmpegPath = await getAvailableFfmpegPath();
  return !!ffmpegPath;
}

async function extractFfmpegArchive(archivePath, destinationDir, archiveExt) {
  fs.mkdirSync(destinationDir, { recursive: true });

  if (process.platform === 'win32' && (archiveExt === 'zip' || archiveExt === '7z')) {
    await extractZipWith7zip(archivePath, destinationDir);
    return;
  }
  if (process.platform === 'darwin' && archiveExt === 'zip') {
    await extractZipWithDitto(archivePath, destinationDir);
    return;
  }
  if (process.platform === 'linux' && archiveExt === 'zip') {
    await extractZipWithUnzip(archivePath, destinationDir);
    return;
  }
  throw new Error(
    `Unsupported archive/platform combination: ${process.platform} / ${archiveExt}`,
  );
}

function ensureExecutablePermissions(filePath) {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o755);
  }
}

async function downloadFfmpeg(event) {
  const { archiveExt, downloadUrl } = getPlatformInfo();
  const tempArchive = path.join(os.tmpdir(), `ffmpeg-${Date.now()}.${archiveExt}`);
  const extractDir = FFMPEG_DIR;

  event.sender.send('ffmpeg-download-progress', 0);

  fs.rmSync(FFMPEG_BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });

  await downloadToFile(downloadUrl, tempArchive, (percent) => {
    event.sender.send('ffmpeg-download-progress', percent);
  });

  await extractFfmpegArchive(tempArchive, extractDir, archiveExt);

  const exePath = getBundledFfmpegExecutablePath();
  if (!exePath || !fs.existsSync(exePath)) {
    throw new Error('FFmpeg extraction succeeded but executable was not found.');
  }

  ensureExecutablePermissions(exePath);
  await verifyFfmpegWorks(exePath);

  try {
    fs.unlinkSync(tempArchive);
  } catch {
    // ignore cleanup failure
  }

  event.sender.send('ffmpeg-download-progress', 100);
}

function registerFfmpegHandlers() {
  // Ensure ffmpeg is installed before using
  ipcMain.handle('check-ffmpeg-installed', async () => {
    return await isFfmpegInstalled();
  });

  ipcMain.handle('get-ffmpeg-path', async () => {
    return await getAvailableFfmpegPath();
  });

  ipcMain.on('download-ffmpeg', async (event) => {
    try {
      await downloadFfmpeg(event);
      event.sender.send('ffmpeg-download-complete', true);
    } catch (err) {
      console.error('FFmpeg download failed:', err);
      event.sender.send('ffmpeg-download-complete', false, err.message);
    }
  });
}

module.exports = { registerFfmpegHandlers };
