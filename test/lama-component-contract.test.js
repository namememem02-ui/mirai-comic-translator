const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateComponentManifest,
  normalizeComponentSettings,
  selectLamaBackend,
  safeComponentStatus,
} = require('../lib/lama-component-contract');

const CPU_PACKAGE = {
  backend: 'cpu',
  version: '1.0.0',
  url: 'https://updates.example.test/lama-cpu-1.0.0.zip',
  bytes: 1024,
  sha256: 'a'.repeat(64),
  minAppVersion: '0.1.0',
  archive: 'zip',
};

test('validates and projects a bounded HTTPS component manifest', () => {
  assert.deepEqual(validateComponentManifest({
    schema: 1,
    packages: [{ ...CPU_PACKAGE, ignoredByClients: true }],
    ignoredTopLevelField: true,
  }), {
    schema: 1,
    packages: [CPU_PACKAGE],
  });
});

test('manifest rejects HTTP URLs and invalid SHA-256', () => {
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [{ backend: 'cpu', url: 'http://example.test/a.zip', sha256: 'bad' }],
  }), /manifest/i);
});

test('manifest rejects unbounded package bytes, duplicate backends, and invalid NVIDIA driver fields', () => {
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [{ ...CPU_PACKAGE, bytes: Number.MAX_SAFE_INTEGER }],
  }), /manifest/i);
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [CPU_PACKAGE, { ...CPU_PACKAGE }],
  }), /manifest/i);
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [{ ...CPU_PACKAGE, backend: 'nvidia', minDriver: 'newest' }],
  }), /manifest/i);
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [{ ...CPU_PACKAGE, version: `1.${'2'.repeat(300)}.3` }],
  }), /manifest/i);
  assert.throws(() => validateComponentManifest({
    schema: 1,
    packages: [{ ...CPU_PACKAGE, backend: 'nvidia', minDriver: `1.${'2'.repeat(300)}` }],
  }), /manifest/i);
});

test('normalizes invalid persisted settings to safe defaults', () => {
  assert.deepEqual(normalizeComponentSettings({ mode: 'system-python', fallback: 'silent' }), {
    mode: 'auto',
    fallback: 'automatic',
  });
  assert.deepEqual(normalizeComponentSettings({ mode: 'nvidia', fallback: 'ask' }), {
    mode: 'nvidia',
    fallback: 'ask',
  });
});

test('auto recommends CPU when NVIDIA driver is unavailable', () => {
  assert.equal(selectLamaBackend({
    mode: 'auto', cpuReady: true, nvidiaReady: false, nvidiaCompatible: false,
  }).backend, 'cpu');
});

test('automatic fallback announces GPU to CPU transition', () => {
  assert.deepEqual(selectLamaBackend({
    mode: 'nvidia', fallback: 'automatic', cpuReady: true, nvidiaReady: true,
    nvidiaCompatible: true, gpuFailure: 'driver-too-old',
  }), {
    backend: 'cpu', state: 'gpu-fallback', reason: 'driver-too-old', automatic: true,
  });
});

test('auto mode announces a GPU runtime failure before using CPU', () => {
  assert.deepEqual(selectLamaBackend({
    mode: 'auto', cpuReady: true, nvidiaReady: true, nvidiaCompatible: true,
    gpuFailure: 'cuda-out-of-memory',
  }), {
    backend: 'cpu', state: 'gpu-fallback', reason: 'cuda-out-of-memory', automatic: true,
  });
});

test('ask and never fallback policies keep a failed NVIDIA backend unavailable', () => {
  assert.deepEqual(selectLamaBackend({
    mode: 'nvidia', fallback: 'ask', cpuReady: true, nvidiaReady: true,
    nvidiaCompatible: true, gpuFailure: 'out-of-memory',
  }), {
    backend: null, state: 'error', reason: 'out-of-memory', automatic: false,
  });
  assert.deepEqual(selectLamaBackend({
    mode: 'nvidia', fallback: 'never', cpuReady: true, nvidiaReady: true,
    nvidiaCompatible: false,
  }), {
    backend: null, state: 'error', reason: 'nvidia-unavailable', automatic: false,
  });
});

test('safe status excludes paths and arbitrary diagnostic fields', () => {
  assert.deepEqual(safeComponentStatus({
    state: 'downloading', backend: 'cpu',
    componentVersion: '1.0.0', receivedBytes: 10, totalBytes: 20,
    diagnostic: { code: 'driver-too-old', path: 'C:\\Users\\private', apiKey: 'secret' },
    installPath: 'C:\\Users\\private',
  }), {
    state: 'downloading', backend: 'cpu',
    componentVersion: '1.0.0', receivedBytes: 10, totalBytes: 20, percentage: 50,
    diagnostic: { code: 'driver-too-old' },
  });
});

test('safe status falls back to a bounded generic error for malformed values', () => {
  assert.deepEqual(safeComponentStatus({
    state: 'surprise', message: 'x'.repeat(1000), diagnostic: { code: 'x'.repeat(1000) },
  }), {
    state: 'error', message: 'AI retouch unavailable',
  });
});

test('safe status derives messages and diagnostics without forwarding runtime text', () => {
  assert.deepEqual(safeComponentStatus({
    state: 'error', message: 'C:\\Users\\private\\project\\page.png secret-token',
    diagnostic: { code: 'C:\\Users\\private\\project\\page.png secret-token' },
  }), {
    state: 'error', message: 'AI retouch unavailable',
  });
  assert.deepEqual(safeComponentStatus({
    state: 'error', diagnostic: { code: 'cuda-out-of-memory' },
  }), {
    state: 'error', message: 'AI retouch unavailable', diagnostic: { code: 'cuda-out-of-memory' },
  });
});

test('safe status rejects inconsistent backend and download progress invariants', () => {
  assert.deepEqual(safeComponentStatus({ state: 'ready-cpu', backend: 'nvidia' }), {
    state: 'error', message: 'AI retouch unavailable',
  });
  assert.deepEqual(safeComponentStatus({
    state: 'downloading', backend: 'cpu', receivedBytes: 21, totalBytes: 20,
  }), {
    state: 'error', message: 'AI retouch unavailable',
  });
  assert.deepEqual(safeComponentStatus({
    state: 'ready-cpu', backend: 'cpu', receivedBytes: 1, totalBytes: 1,
  }), {
    state: 'error', message: 'AI retouch unavailable',
  });
});
