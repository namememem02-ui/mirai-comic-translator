const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function compareVersions(left, right) {
  if (!VERSION_PATTERN.test(left) || !VERSION_PATTERN.test(right)) {
    throw new TypeError('Invalid app version');
  }
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!VERSION_PATTERN.test(value.version) || !isHttpsUrl(value.downloadUrl)) return null;
  if (value.releaseNotes !== undefined && typeof value.releaseNotes !== 'string') return null;
  return {
    version: value.version,
    releaseNotes: (value.releaseNotes || '').slice(0, 4000),
    downloadUrl: value.downloadUrl,
  };
}

function createUpdateChecker({ currentVersion, manifestUrl, fetchImpl = fetch, timeoutMs = 10000 }) {
  return {
    async check() {
      if (!manifestUrl) return { status: 'not-configured', currentVersion };
      if (!isHttpsUrl(manifestUrl)) {
        return { status: 'error', currentVersion, message: 'ข้อมูลอัปเดตไม่ถูกต้อง' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(manifestUrl, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Update server rejected request');
        const manifest = normalizeManifest(await response.json());
        if (!manifest) {
          return { status: 'error', currentVersion, message: 'ข้อมูลอัปเดตไม่ถูกต้อง' };
        }
        if (compareVersions(manifest.version, currentVersion) <= 0) {
          return { status: 'current', currentVersion, latestVersion: manifest.version };
        }
        return {
          status: 'available',
          currentVersion,
          latestVersion: manifest.version,
          releaseNotes: manifest.releaseNotes,
          downloadUrl: manifest.downloadUrl,
        };
      } catch {
        return {
          status: 'error',
          currentVersion,
          message: controller.signal.aborted
            ? 'หมดเวลาตรวจสอบอัปเดต กรุณาลองใหม่'
            : 'เชื่อมต่อเซิร์ฟเวอร์อัปเดตไม่สำเร็จ',
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { compareVersions, createUpdateChecker };
