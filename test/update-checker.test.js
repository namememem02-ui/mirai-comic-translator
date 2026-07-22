const test = require('node:test');
const assert = require('node:assert/strict');

const { compareVersions, createUpdateChecker } = require('../lib/update-checker');

test('compares dotted app versions numerically', () => {
  assert.equal(compareVersions('0.2.0', '0.1.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
});

test('reports missing update source without making a request', async () => {
  let requested = false;
  const checker = createUpdateChecker({
    currentVersion: '0.1.0',
    manifestUrl: '',
    fetchImpl: async () => { requested = true; },
  });
  assert.deepEqual(await checker.check(), {
    status: 'not-configured',
    currentVersion: '0.1.0',
  });
  assert.equal(requested, false);
});

test('reports a newer validated HTTPS release', async () => {
  const checker = createUpdateChecker({
    currentVersion: '0.1.0',
    manifestUrl: 'https://updates.example.com/latest.json',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        version: '0.2.0',
        releaseNotes: 'แก้ไขระบบส่งออก',
        downloadUrl: 'https://updates.example.com/ComicTranslator-0.2.0.exe',
      }),
    }),
  });
  assert.deepEqual(await checker.check(), {
    status: 'available',
    currentVersion: '0.1.0',
    latestVersion: '0.2.0',
    releaseNotes: 'แก้ไขระบบส่งออก',
    downloadUrl: 'https://updates.example.com/ComicTranslator-0.2.0.exe',
  });
});

test('reports current when the manifest is not newer', async () => {
  const checker = createUpdateChecker({
    currentVersion: '0.2.0',
    manifestUrl: 'https://updates.example.com/latest.json',
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: '0.2.0', downloadUrl: 'https://updates.example.com/app.exe' }) }),
  });
  assert.deepEqual(await checker.check(), {
    status: 'current', currentVersion: '0.2.0', latestVersion: '0.2.0',
  });
});

test('rejects unsafe or malformed manifests with a safe result', async () => {
  const checker = createUpdateChecker({
    currentVersion: '0.1.0',
    manifestUrl: 'https://updates.example.com/latest.json',
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: 'new', downloadUrl: 'http://unsafe.example.com/app.exe' }) }),
  });
  assert.deepEqual(await checker.check(), {
    status: 'error', currentVersion: '0.1.0', message: 'ข้อมูลอัปเดตไม่ถูกต้อง',
  });
});

test('turns network failures and timeout into safe results', async () => {
  const networkChecker = createUpdateChecker({
    currentVersion: '0.1.0', manifestUrl: 'https://updates.example.com/latest.json',
    fetchImpl: async () => { throw new Error('secret network detail'); },
  });
  assert.deepEqual(await networkChecker.check(), {
    status: 'error', currentVersion: '0.1.0', message: 'เชื่อมต่อเซิร์ฟเวอร์อัปเดตไม่สำเร็จ',
  });

  const timeoutChecker = createUpdateChecker({
    currentVersion: '0.1.0', manifestUrl: 'https://updates.example.com/latest.json', timeoutMs: 10,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  assert.deepEqual(await timeoutChecker.check(), {
    status: 'error', currentVersion: '0.1.0', message: 'หมดเวลาตรวจสอบอัปเดต กรุณาลองใหม่',
  });
});
