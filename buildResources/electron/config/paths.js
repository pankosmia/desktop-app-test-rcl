const { app } = require('electron');
const path = require('path');

const FIREFOX_VERSION = '149.0.2';
const FIREFOX_BUILD_ID = 'stable_' + FIREFOX_VERSION;
const ASSET_CACHE_DIR = path.join(app.getPath('home'), 'pankosmia', '_assets');
const FFMPEG_BASE_DIR = path.join(ASSET_CACHE_DIR, 'ffmpeg');
const FFMPEG_VERSION = '7.1.1'; // Matching url's entered for each OS/Arch
const FFMPEG_DIR = path.join(FFMPEG_BASE_DIR, FFMPEG_VERSION);

// Where the extracted Firefox binary lives on Windows
const FIREFOX_WIN_EXTRACT_DIR = path.join(ASSET_CACHE_DIR, 'firefox', 'win64-' + FIREFOX_BUILD_ID);

const START_SERVER = process.env.START_SERVER !== "false";

const env = {
  ...process.env,
  ...(START_SERVER && {
    APP_RESOURCES_DIR: process.env.APP_RESOURCES_DIR ?? "./lib/",
  }),
};

const ELECTRON_ROOT_DIR = path.join(__dirname, '..', '..');

module.exports = {
  FIREFOX_VERSION,
  FIREFOX_BUILD_ID,
  ASSET_CACHE_DIR,
  FFMPEG_BASE_DIR,
  FFMPEG_VERSION,
  FFMPEG_DIR,
  FIREFOX_WIN_EXTRACT_DIR,
  START_SERVER,
  env,
  ELECTRON_ROOT_DIR,
};
