const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');

const { createUpdateInstaller } = require('../lib/update-installer');

test('downloadAndInstall downloads file, triggers progress, and spawns installer', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
  let spawned = false;
  let quitCalled = false;
  const progressEvents = [];

  const fakeData = Buffer.from('fake installer binary payload');
  const fakeStream = Readable.from([fakeData]);

  const installer = createUpdateInstaller({
    tempDir,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-length', String(fakeData.length)]]),
      body: fakeStream,
    }),
    spawnImpl: (exePath) => {
      spawned = exePath;
      return { unref: () => {} };
    },
    quitApp: () => {
      quitCalled = true;
    },
  });

  const result = await installer.downloadAndInstall({
    downloadUrl: 'https://github.com/test/app/releases/download/v0.2.0/Setup.exe',
    onProgress: (p) => progressEvents.push(p),
  });

  assert.equal(result.success, true);
  assert.ok(fs.existsSync(result.targetPath));
  assert.equal(spawned, result.targetPath);
  assert.ok(progressEvents.length > 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('downloadAndInstall rejects invalid non-HTTPS download URLs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
  const installer = createUpdateInstaller({ tempDir });

  await assert.rejects(
    async () => installer.downloadAndInstall({ downloadUrl: 'http://insecure.test/setup.exe' }),
    { message: 'Invalid download URL' }
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});
