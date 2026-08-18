const fs = require('fs');
const path = require('path');

async function downloadToFile(url, destination, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} from ${url}`);
  }
  const totalBytes = parseInt(response.headers.get('content-length'), 10) || 0;
  let downloadedBytes = 0;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const fileStream = fs.createWriteStream(destination);
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
    downloadedBytes += value.length;
    if (totalBytes > 0 && onProgress) {
      const percent = Math.round((downloadedBytes / totalBytes) * 100);
      onProgress(percent);
    }
  }
  fileStream.end();
  await new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

module.exports = { downloadToFile };
