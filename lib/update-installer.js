const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

function isHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function createUpdateInstaller({ fetchImpl = fetch, spawnImpl, tempDir, quitApp } = {}) {
  if (typeof tempDir !== 'string' || tempDir.length === 0) {
    throw new TypeError('tempDir is required');
  }

  return {
    async downloadAndInstall({ downloadUrl, onProgress } = {}) {
      if (!isHttpsUrl(downloadUrl)) {
        throw new Error('Invalid download URL');
      }

      const targetPath = path.join(tempDir, `Mee-a-rai-ComicTranslator-Update-${Date.now()}.exe`);
      const response = await fetchImpl(downloadUrl, {
        headers: { 'User-Agent': 'Mee-a-rai-ComicTranslator' },
      });
      if (!response.ok) {
        throw new Error(`Failed to download update installer: ${response.status}`);
      }

      const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
      let receivedBytes = 0;

      const fileStream = fs.createWriteStream(targetPath);

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedBytes += value.length;
          fileStream.write(Buffer.from(value));
          if (typeof onProgress === 'function') {
            const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes * 100) / totalBytes)) : 0;
            onProgress({ receivedBytes, totalBytes, percent });
          }
        }
        await new Promise((resolve) => fileStream.end(resolve));
      } else if (response.body && typeof response.body.pipe === 'function') {
        response.body.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (typeof onProgress === 'function') {
            const percent = totalBytes > 0 ? Math.min(100, Math.floor((receivedBytes * 100) / totalBytes)) : 0;
            onProgress({ receivedBytes, totalBytes, percent });
          }
        });
        await pipeline(response.body, fileStream);
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        receivedBytes = buffer.length;
        await fs.promises.writeFile(targetPath, buffer);
        if (typeof onProgress === 'function') {
          onProgress({ receivedBytes, totalBytes: receivedBytes, percent: 100 });
        }
      }

      if (typeof spawnImpl === 'function') {
        spawnImpl(targetPath, [], { detached: true, stdio: 'ignore' }).unref();
      }
      if (typeof quitApp === 'function') {
        setTimeout(() => quitApp(), 1000);
      }

      return { success: true, targetPath };
    },
  };
}

module.exports = { createUpdateInstaller };
