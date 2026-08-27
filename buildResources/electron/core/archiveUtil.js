const fs = require('fs');
const { spawn } = require('child_process');

function extractZipWith7zip(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destinationDir, { recursive: true });
    const _7z = require("7zip-min");
    _7z.unpack(zipPath, destinationDir, (err) => {
      if (err) {
        reject(new Error(`Extraction failed: ${err.message || err}`));
      } else {
        resolve();
      }
    });
  });
}

function extractZipWithDitto(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destinationDir, { recursive: true });
    const child = spawn("ditto", ["-x", "-k", zipPath, destinationDir]);
    let stderr = "";
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("error", (err) => {
      reject(new Error(`Failed to start ditto: ${err.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ditto extraction failed with code ${code}: ${stderr}`));
      }
    });
  });
}

function extractZipWithUnzip(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destinationDir, { recursive: true });
    const child = spawn('unzip', ['-o', zipPath, '-d', destinationDir]);
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (err) => {
      reject(new Error(`Failed to start unzip: ${err.message}`));
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`unzip extraction failed with code ${code}: ${stderr}`));
      }
    });
  });
}

function extractTarXzWithSystemTar(archivePath, destinationDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destinationDir, { recursive: true });
    const child = spawn("tar", ["-xJf", archivePath, "-C", destinationDir]);
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => {
      reject(new Error(`Failed to start tar: ${err.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar extraction failed with code ${code}: ${stderr}`));
      }
    });
  });
}

module.exports = {
  extractZipWith7zip,
  extractZipWithDitto,
  extractZipWithUnzip,
  extractTarXzWithSystemTar,
};

