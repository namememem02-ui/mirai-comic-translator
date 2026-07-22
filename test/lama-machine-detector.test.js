const test = require('node:test');
const assert = require('node:assert/strict');

const { createLamaMachineDetector } = require('../lib/lama-machine-detector');

const NVIDIA_CONTRACT = {
  schema: 1,
  packages: [{
    backend: 'nvidia', version: '1.0.0',
    url: 'https://updates.example.test/lama-nvidia.zip', bytes: 1024,
    sha256: 'a'.repeat(64), minAppVersion: '0.1.0', archive: 'zip', minDriver: '531.79',
  }],
};

function createDetector(overrides = {}) {
  return createLamaMachineDetector({
    platform: 'win32', arch: 'x64', freeDisk: async () => 9e9,
    execFile: async () => ({ stdout: 'NVIDIA GeForce RTX 4090, 551.76\n', stderr: '' }),
    componentContract: NVIDIA_CONTRACT,
    ...overrides,
  });
}

test('missing nvidia-smi is a normal CPU-only result', async () => {
  const detector = createDetector({
    execFile: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
  });

  assert.deepEqual((await detector.detect('C:\\components')).nvidia, {
    present: false, name: '', driverVersion: '', compatible: false, reason: 'not-detected',
  });
});

test('reports a supported NVIDIA driver from the validated component contract', async () => {
  const result = await createDetector().detect('C:\\components');

  assert.deepEqual(result, {
    platform: 'win32', arch: 'x64', freeBytes: 9e9,
    nvidia: { present: true, name: 'NVIDIA GeForce RTX 4090', driverVersion: '551.76', compatible: true, reason: 'supported' },
  });
});

test('compares dotted NVIDIA driver versions numerically', async () => {
  const result = await createDetector({
    execFile: async () => ({ stdout: 'NVIDIA GeForce RTX 4090, 531.100\n', stderr: '' }),
  }).detect('C:\\components');

  assert.deepEqual(result.nvidia, {
    present: true, name: 'NVIDIA GeForce RTX 4090', driverVersion: '531.100', compatible: true, reason: 'supported',
  });
});

test('rejects oversized and numeric-overflow driver components', async () => {
  for (const driverVersion of ['531.1234567890123', '531.999999999999999999999999999999999999']) {
    const result = await createDetector({
      execFile: async () => ({ stdout: `NVIDIA GeForce RTX 4090, ${driverVersion}\n`, stderr: '' }),
    }).detect('C:\\components');
    assert.deepEqual(result.nvidia, {
      present: false, name: '', driverVersion: '', compatible: false, reason: 'invalid-output',
    });
  }
});

test('does not treat malformed nvidia-smi output as usable hardware', async () => {
  const result = await createDetector({
    execFile: async () => ({ stdout: 'NVIDIA GeForce RTX 4090, driver=newest\n', stderr: '' }),
  }).detect('C:\\components');

  assert.deepEqual(result.nvidia, {
    present: false, name: '', driverVersion: '', compatible: false, reason: 'invalid-output',
  });
});

test('does not probe NVIDIA on non-x64 Windows', async () => {
  let called = false;
  const result = await createDetector({
    arch: 'arm64', execFile: async () => { called = true; return { stdout: '', stderr: '' }; },
  }).detect('C:\\components');

  assert.equal(called, false);
  assert.deepEqual(result.nvidia, {
    present: false, name: '', driverVersion: '', compatible: false, reason: 'unsupported-platform',
  });
});

test('uses execFile arguments without a shell and returns bounded public diagnostics only', async () => {
  let call;
  const result = await createDetector({
    freeDisk: async () => { throw new Error('C:\\Users\\private\\secret-token'); },
    execFile: async (...args) => { call = args; throw Object.assign(new Error('C:\\Users\\private\\secret-token'), { code: 'EACCES' }); },
  }).detect('C:\\components');

  assert.ok(call[0].includes('nvidia-smi'));
  assert.deepEqual(call.slice(1), [
    ['--query-gpu=name,driver_version', '--format=csv,noheader'],
    { timeout: 3000, windowsHide: true },
  ]);
  assert.deepEqual(result, {
    platform: 'win32', arch: 'x64', freeBytes: 0,
    nvidia: { present: false, name: '', driverVersion: '', compatible: false, reason: 'not-detected' },
  });
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('normalizes a timed out NVIDIA probe to a safe unavailable result', async () => {
  const result = await createDetector({
    execFile: async () => { throw Object.assign(new Error('timed out at C:\\Users\\private'), { code: 'ETIMEDOUT' }); },
  }).detect('C:\\components');

  assert.deepEqual(result.nvidia, {
    present: false, name: '', driverVersion: '', compatible: false, reason: 'not-detected',
  });
  assert.equal(JSON.stringify(result).includes('private'), false);
});
