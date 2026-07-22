'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createLamaComponentManager } = require('../lib/lama-component-manager');

const CPU_PACKAGE = Object.freeze({
  backend: 'cpu', version: '1.1.0', url: 'https://updates.example.test/lama-cpu.zip',
  bytes: 100, sha256: 'a'.repeat(64), minAppVersion: '0.1.0', archive: 'zip',
});
const NVIDIA_PACKAGE = Object.freeze({
  backend: 'nvidia', version: '1.1.0', url: 'https://updates.example.test/lama-nvidia.zip',
  bytes: 200, sha256: 'b'.repeat(64), minAppVersion: '0.1.0', archive: 'zip', minDriver: '550.10',
});
const MANIFEST = Object.freeze({ schema: 1, packages: [CPU_PACKAGE, NVIDIA_PACKAGE] });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function installed(backend, version = '1.0.0') {
  return { backend, version, sha256: (backend === 'cpu' ? 'c' : 'd').repeat(64), installedAt: '2026-07-22T00:00:00.000Z' };
}

function createHarness(options = {}) {
  const inventory = new Map();
  if (options.cpuReady) inventory.set('cpu', installed('cpu', options.cpuVersion));
  if (options.nvidiaReady) inventory.set('nvidia', installed('nvidia', options.nvidiaVersion));
  const calls = [];
  const states = [];
  let settings = { mode: options.mode || 'auto', fallback: options.fallback || 'automatic' };
  let installFailure = options.installFailure;
  let removeFailure = options.removeFailure;
  let inspectFailure = options.inspectFailure;
  let inspectGate = options.inspectGate;
  let postInstallPhase = false;

  const installer = {
    async inspect(backend) {
      calls.push(`inspect:${backend}`);
      if (backend === 'cpu' && inspectGate) await inspectGate.promise;
      if (postInstallPhase && options.postInstallInspectGate) await options.postInstallInspectGate.promise;
      if (inspectFailure === backend) {
        const error = new Error(`secret path C:\\Users\\person\\${backend}`);
        if (options.inspectErrorCode !== null) error.code = options.inspectErrorCode || 'integrity-failed';
        throw error;
      }
      return inventory.get(backend) || null;
    },
    async install(pkg, paths, signal, onProgress) {
      calls.push(`install:${pkg.backend}`);
      if (options.installGate) await options.installGate.promise;
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      onProgress({ receivedBytes: 25, totalBytes: pkg.bytes });
      if (options.downloadGate) await options.downloadGate.promise;
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      onProgress({ receivedBytes: pkg.bytes, totalBytes: pkg.bytes });
      if (installFailure) throw new Error('C:\\Users\\person\\api-key=secret');
      const value = installed(pkg.backend, pkg.version);
      inventory.set(pkg.backend, value);
      postInstallPhase = true;
      if (options.postInstallInspectFailure) inspectFailure = pkg.backend;
      return value;
    },
    async remove(backend) {
      calls.push(`remove:${backend}`);
      if (removeFailure) throw new Error('C:\\private\\component');
      inventory.delete(backend);
      return { removed: true };
    },
  };
  const detector = {
    async detect(root) {
      calls.push(`detect:${root}`);
      if (options.detectGate) await options.detectGate.promise;
      return {
        platform: 'win32', arch: 'x64', freeBytes: 10_000,
        nvidia: {
          present: options.nvidiaPresent !== false,
          driverVersion: '551.20',
          compatible: options.nvidiaCompatible !== false,
          reason: options.nvidiaCompatible === false ? 'driver-too-old' : 'supported',
        },
      };
    },
  };
  const manifestLoader = {
    async load() {
      calls.push('manifest:load');
      if (options.manifestGate) await options.manifestGate.promise;
      if (options.manifestFailure) throw new Error('https://secret.example.test/token');
      return MANIFEST;
    },
  };
  const settingsStore = {
    async load() {
      calls.push('settings:load');
      return settings;
    },
    async save(next) {
      calls.push(`settings:save:${next.mode}:${next.fallback}`);
      if (options.settingsFailure) throw new Error('settings failed');
      settings = { ...next };
    },
  };
  const sidecar = {
    async start(backend, signal) {
      calls.push(`sidecar:start:${backend}`);
      if (options.onStartSignal) options.onStartSignal(signal);
      if (options.sidecarGate) await options.sidecarGate.promise;
      if (options.startResults && options.startResults[backend]) return options.startResults[backend];
      const failure = options.startFailures && options.startFailures[backend];
      return failure
        ? { state: 'unavailable', errorCode: failure, message: 'unsafe details' }
        : { state: 'ready', backend };
    },
    async stop(backend) {
      calls.push(`sidecar:stop:${backend}`);
      if (options.stopFailures && options.stopFailures[backend]) throw new Error('unsafe stop details');
    },
    async shutdown() { calls.push('sidecar:shutdown'); },
  };
  const manager = createLamaComponentManager({
    root: 'C:\\managed\\lama', detector, installer, manifestLoader, settingsStore,
    sidecar: options.sidecar || sidecar, sidecars: options.sidecars,
  });
  const unsubscribe = manager.subscribe((state) => states.push(state));
  return {
    manager, inventory, calls, states, unsubscribe,
    failInstall(value = true) { installFailure = value; },
    failRemove(value = true) { removeFailure = value; },
    failInspect(value) { inspectFailure = value; },
    setInspectGate(value) { inspectGate = value; },
  };
}

test('publishes an immutable safe initial state and supports unsubscribe', async () => {
  const harness = createHarness({ cpuReady: false, nvidiaReady: false });
  const initial = harness.manager.getState();
  assert.equal(initial.state, 'not-installed');
  assert.equal(Object.isFrozen(initial), true);
  assert.equal(Object.isFrozen(initial.preferences), true);
  assert.throws(() => { initial.state = 'ready-nvidia'; }, /read only|Cannot assign/);
  harness.unsubscribe();
  const count = harness.states.length;
  await harness.manager.initialize();
  assert.equal(harness.states.length, count);
});

test('a throwing subscriber cannot break subscription or later state publication', async () => {
  const harness = createHarness({ cpuReady: true });
  let unsubscribe;
  assert.doesNotThrow(() => {
    unsubscribe = harness.manager.subscribe(() => { throw new Error('listener failed'); });
  });
  await harness.manager.initialize();
  assert.equal(harness.manager.getState().state, 'ready-cpu');
  unsubscribe();
});

test('initialize publishes detecting then ready-cpu with normalized detection', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: false });
  await harness.manager.initialize();
  assert.deepEqual(harness.states.map((state) => state.state), ['not-installed', 'detecting', 'ready-cpu']);
  assert.equal(harness.manager.getState().backend, 'cpu');
  assert.deepEqual(harness.manager.getState().hardware, {
    platform: 'win32', arch: 'x64', freeBytes: 10_000,
    nvidia: { present: true, compatible: true, driverVersion: '551.20', reason: 'supported' },
  });
  assert.equal(Object.isFrozen(harness.manager.getState().hardware.nvidia), true);
});

test('initialize selects ready-nvidia in auto mode when compatible and installed', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: true });
  await harness.manager.initialize();
  assert.equal(harness.manager.getState().state, 'ready-nvidia');
  assert.equal(harness.manager.getState().backend, 'nvidia');
});

test('initialize reports repair-required without exposing an unclassified inspection error', async () => {
  const harness = createHarness({ cpuReady: true, inspectFailure: 'cpu', inspectErrorCode: null });
  await harness.manager.initialize();
  assert.deepEqual(harness.manager.getState(), {
    state: 'repair-required', backend: 'cpu', reason: 'integrity-failed',
    label: 'ต้องซ่อมแซมส่วนประกอบ CPU', message: 'ส่วนประกอบ AI รีทัชเสียหาย กรุณาซ่อมแซม',
    preferences: { mode: 'auto', fallback: 'automatic' },
    hardware: harness.manager.getState().hardware,
  });
  assert.doesNotMatch(JSON.stringify(harness.manager.getState()), /Users|person|secret/i);
});

test('a failed later inspection invalidates previously trusted inventory', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu' });
  await harness.manager.initialize();
  harness.failInspect('cpu');
  await harness.manager.check();
  assert.equal(harness.manager.getState().state, 'repair-required');
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
});

test('check publishes checking-update then update-available for the selected backend', async () => {
  const harness = createHarness({ cpuReady: true, cpuVersion: '1.0.0', mode: 'cpu' });
  await harness.manager.initialize();
  await harness.manager.check();
  assert.deepEqual(harness.states.slice(-2).map((state) => state.state), ['checking-update', 'update-available']);
  assert.equal(harness.manager.getState().backend, 'cpu');
  assert.equal(harness.manager.getState().componentVersion, '1.0.0');
  assert.equal(harness.manager.getState().availableVersion, '1.1.0');
});

test('install maps byte progress through downloading and installing before ready', async () => {
  const harness = createHarness({ mode: 'cpu' });
  await harness.manager.initialize();
  await harness.manager.install('cpu');
  const lifecycle = harness.states.map((state) => state.state);
  assert.deepEqual(lifecycle.slice(-4), ['downloading', 'downloading', 'installing', 'ready-cpu']);
  const progress = harness.states.find((state) => state.receivedBytes === 25);
  assert.equal(progress.totalBytes, 100);
  assert.equal(progress.percentage, 25);
  assert.equal(progress.canCancel, true);
});

test('cancel interrupts an active download and restores the previous healthy state', async () => {
  const downloadGate = deferred();
  const harness = createHarness({ cpuReady: true, mode: 'cpu', downloadGate });
  await harness.manager.initialize();
  const operation = harness.manager.install('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.manager.getState().state, 'downloading');
  assert.equal(harness.manager.cancel(), true);
  downloadGate.resolve();
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(harness.manager.getState().state, 'ready-cpu');
  assert.equal(harness.manager.getState().componentVersion, '1.0.0');
  assert.equal(harness.manager.cancel(), false);
});

test('mutating operations are serialized without overlapping installer calls', async () => {
  const installGate = deferred();
  const harness = createHarness({ mode: 'cpu', installGate });
  await harness.manager.initialize();
  const installPromise = harness.manager.install('cpu');
  const removePromise = harness.manager.remove('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.includes('remove:cpu'), false);
  installGate.resolve();
  await installPromise;
  await removePromise;
  assert.ok(harness.calls.indexOf('remove:cpu') > harness.calls.indexOf('install:cpu'));
  assert.equal(harness.manager.getState().state, 'not-installed');
});

test('concurrent start calls are serialized and do not launch duplicate sidecars', async () => {
  const sidecarGate = deferred();
  const harness = createHarness({ cpuReady: true, mode: 'cpu', sidecarGate });
  await harness.manager.initialize();
  const first = harness.manager.startRetouch();
  const second = harness.manager.startRetouch();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:cpu').length, 1);
  sidecarGate.resolve();
  await Promise.all([first, second]);
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:cpu').length, 1);
});

test('GPU runtime failure remains visible after automatic CPU fallback for the session', async () => {
  const harness = createHarness({ mode: 'auto', fallback: 'automatic', cpuReady: true, nvidiaReady: true });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.reportRuntimeFailure('cuda-out-of-memory');
  const fallback = harness.manager.getState();
  assert.match(fallback.label, /CPU/);
  assert.equal(fallback.state, 'gpu-fallback');
  assert.equal(fallback.transition, 'GPU -> CPU');
  assert.equal(fallback.reason, 'cuda-out-of-memory');
  assert.deepEqual(fallback.sessionFallback, {
    transition: 'GPU -> CPU', reason: 'cuda-out-of-memory',
  });
  assert.deepEqual(harness.calls.filter((call) => call.startsWith('sidecar:start:')), [
    'sidecar:start:nvidia', 'sidecar:start:cpu',
  ]);
  await harness.manager.check();
  assert.equal(harness.manager.getState().state, 'gpu-fallback');
  assert.equal(harness.manager.getState().reason, 'cuda-out-of-memory');
  await harness.manager.startRetouch();
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:nvidia').length, 1);
  await harness.manager.setPreferences({ mode: 'nvidia', fallback: 'automatic' });
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'ready-nvidia');
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:nvidia').length, 2);
  assert.deepEqual(harness.manager.getState().sessionFallback, {
    transition: 'GPU -> CPU', reason: 'cuda-out-of-memory',
  });
});

for (const fallback of ['ask', 'never']) {
  test(`${fallback} fallback never auto-switches GPU failure to CPU`, async () => {
    const harness = createHarness({ mode: 'nvidia', fallback, cpuReady: true, nvidiaReady: true });
    await harness.manager.initialize();
    await harness.manager.startRetouch();
    await harness.manager.reportRuntimeFailure('gpu-inference-failed');
    assert.equal(harness.manager.getState().state, 'error');
    assert.equal(harness.manager.getState().backend, 'nvidia');
    assert.equal(harness.manager.getState().reason, 'gpu-inference-failed');
    assert.equal(harness.manager.getState().requiresConfirmation, fallback === 'ask');
    assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
  });
}

test('automatic GPU fallback without installed CPU produces cpu-download-required', async () => {
  const harness = createHarness({ mode: 'nvidia', fallback: 'automatic', nvidiaReady: true });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.reportRuntimeFailure('gpu-init-failed');
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.manager.getState().reason, 'gpu-init-failed');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:nvidia').length, 1);
});

test('NVIDIA startup failure applies automatic fallback and preserves its reason', async () => {
  const harness = createHarness({
    mode: 'nvidia', fallback: 'automatic', cpuReady: true, nvidiaReady: true,
    startFailures: { nvidia: 'startup-failed' },
  });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'gpu-fallback');
  assert.equal(harness.manager.getState().reason, 'startup-failed');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), true);
});

test('a sidecar that declares the wrong backend or version is not marked ready', async () => {
  const harness = createHarness({
    mode: 'nvidia', fallback: 'automatic', cpuReady: true, nvidiaReady: true,
    startResults: {
      nvidia: { state: 'ready', backend: 'cpu', componentVersion: '9.9.9' },
    },
  });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'gpu-fallback');
  assert.equal(harness.manager.getState().reason, 'startup-failed');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), true);
});

test('duplicate queued runtime failures preserve the first successful fallback', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: true });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await Promise.all([
    harness.manager.reportRuntimeFailure('cuda-out-of-memory'),
    harness.manager.reportRuntimeFailure('gpu-inference-failed'),
  ]);
  assert.equal(harness.manager.getState().state, 'gpu-fallback');
  assert.equal(harness.manager.getState().reason, 'cuda-out-of-memory');
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:cpu').length, 1);
});

test('CPU mode without CPU produces cpu-download-required and never launches a sidecar', async () => {
  const harness = createHarness({ mode: 'cpu' });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.calls.some((call) => call.startsWith('sidecar:start:')), false);
});

test('setPreferences validates, persists, and reselects without auto-switching ask policy', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: false });
  await harness.manager.initialize();
  await harness.manager.setPreferences({ mode: 'nvidia', fallback: 'ask', ignored: 'secret' });
  assert.deepEqual(harness.manager.getState().preferences, { mode: 'nvidia', fallback: 'ask' });
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().requiresConfirmation, true);
  assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
});

test('install failure publishes safe Thai error while preserving the healthy component', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu', installFailure: true });
  await harness.manager.initialize();
  await assert.rejects(harness.manager.install('cpu'));
  const state = harness.manager.getState();
  assert.equal(state.state, 'error');
  assert.equal(state.backend, 'cpu');
  assert.equal(state.componentVersion, '1.0.0');
  assert.match(state.message, /ไม่สามารถ|ผิดพลาด/);
  assert.doesNotMatch(JSON.stringify(state), /Users|api-key|secret/i);
  harness.failInstall(false);
  await harness.manager.startRetouch();
  assert.equal(harness.calls.includes('sidecar:start:cpu'), true);
});

test('repair failure preserves a different healthy backend and the repaired backend metadata', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: true, mode: 'nvidia', installFailure: true });
  await harness.manager.initialize();
  await assert.rejects(harness.manager.repair('nvidia'));
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().backend, 'nvidia');
  assert.equal(harness.inventory.has('cpu'), true);
  assert.equal(harness.inventory.has('nvidia'), true);
});

test('repairing an active backend stops the old runtime and allows the new one to start', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu' });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.repair('cpu');
  assert.ok(harness.calls.indexOf('sidecar:stop:cpu') < harness.calls.indexOf('install:cpu'));
  await harness.manager.startRetouch();
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:cpu').length, 2);
});

test('cross-backend install failure never attaches the previous backend version', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu', installFailure: true });
  await harness.manager.initialize();
  await assert.rejects(harness.manager.install('nvidia'));
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().backend, 'nvidia');
  assert.equal(harness.manager.getState().componentVersion, undefined);
});

test('remove failure preserves active metadata and future retouch availability', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu', removeFailure: true });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await assert.rejects(harness.manager.remove('cpu'));
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().backend, 'cpu');
  assert.equal(harness.manager.getState().componentVersion, '1.0.0');
  harness.failRemove(false);
  await harness.manager.startRetouch();
  assert.equal(harness.calls.filter((call) => call === 'sidecar:start:cpu').length, 2);
});

test('unknown runtime failures are reduced to a bounded safe reason', async () => {
  const harness = createHarness({ cpuReady: true, nvidiaReady: true });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.reportRuntimeFailure('C:\\Users\\person\\secret-key');
  assert.equal(harness.manager.getState().reason, 'nvidia-unavailable');
  assert.doesNotMatch(JSON.stringify(harness.manager.getState()), /Users|secret/i);
});

test('manifest failure publishes a safe error and preserves the prior ready state metadata', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu', manifestFailure: true });
  await harness.manager.initialize();
  await assert.rejects(harness.manager.check());
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().backend, 'cpu');
  assert.equal(harness.manager.getState().componentVersion, '1.0.0');
  assert.doesNotMatch(JSON.stringify(harness.manager.getState()), /https|secret|token/i);
});

test('shutdown aborts active work, shuts down the sidecar once, and rejects future mutations', async () => {
  const downloadGate = deferred();
  const harness = createHarness({ mode: 'cpu', downloadGate });
  await harness.manager.initialize();
  const operation = harness.manager.install('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  const shutdown = harness.manager.shutdown();
  downloadGate.resolve();
  await assert.rejects(operation, { name: 'AbortError' });
  await shutdown;
  await harness.manager.shutdown();
  assert.equal(harness.calls.filter((call) => call === 'sidecar:shutdown').length, 1);
  await assert.rejects(harness.manager.check(), /shut down/i);
  assert.equal(harness.manager.subscribe(() => {}), false);
});

test('shutdown during manifest loading prevents the installer from starting', async () => {
  const manifestGate = deferred();
  const harness = createHarness({ mode: 'cpu', manifestGate });
  await harness.manager.initialize();
  const operation = harness.manager.install('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  const shutdown = harness.manager.shutdown();
  manifestGate.resolve();
  await assert.rejects(operation, { name: 'AbortError' });
  await shutdown;
  assert.equal(harness.calls.includes('install:cpu'), false);
});

test('shutdown attempts every sidecar adapter even when one rejects', async () => {
  const calls = [];
  const harness = createHarness({
    sidecars: {
      cpu: { async shutdown() { calls.push('cpu'); throw new Error('stop failed'); } },
      nvidia: { async shutdown() { calls.push('nvidia'); } },
    },
  });
  await harness.manager.initialize();
  await assert.doesNotReject(harness.manager.shutdown());
  assert.deepEqual(calls, ['cpu', 'nvidia']);
});

test('legacy per-backend sidecar uses shutdown when no stop method exists', async () => {
  const calls = [];
  const legacySidecar = {
    async ensureStarted() { calls.push('start'); return { state: 'ready' }; },
    async shutdown() { calls.push('shutdown'); },
  };
  const harness = createHarness({ cpuReady: true, mode: 'cpu', sidecar: legacySidecar });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.remove('cpu');
  assert.deepEqual(calls, ['start', 'shutdown']);
});

test('post-install inspection failure invalidates the activated backend', async () => {
  const harness = createHarness({
    cpuReady: true, mode: 'cpu', postInstallInspectFailure: true,
  });
  await harness.manager.initialize();
  await assert.rejects(harness.manager.install('cpu'));
  assert.equal(harness.manager.getState().state, 'error');
  assert.equal(harness.manager.getState().componentVersion, undefined);
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
});

test('late legacy startup success after shutdown triggers a second best-effort cleanup', async () => {
  const startup = deferred();
  const calls = [];
  let receivedSignal;
  const legacySidecar = {
    ensureStarted(backend, signal) {
      calls.push(`start:${backend}`);
      receivedSignal = signal;
      return startup.promise;
    },
    async shutdown() { calls.push('shutdown'); },
  };
  const harness = createHarness({ cpuReady: true, mode: 'cpu', sidecar: legacySidecar });
  await harness.manager.initialize();
  const starting = harness.manager.startRetouch();
  await new Promise((resolve) => setImmediate(resolve));
  const shuttingDown = harness.manager.shutdown();
  await assert.rejects(starting, { name: 'AbortError' });
  await shuttingDown;
  assert.equal(receivedSignal.aborted, true);
  assert.equal(calls.filter((call) => call === 'shutdown').length, 1);
  startup.resolve({ state: 'ready' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.filter((call) => call === 'shutdown').length, 2);
});

test('shutdown cancellation during initialize inspection rejects instead of reporting repair', async () => {
  const inspectGate = deferred();
  const harness = createHarness({ cpuReady: true, inspectGate });
  const initializing = harness.manager.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  const shuttingDown = harness.manager.shutdown();
  await assert.rejects(initializing, { name: 'AbortError' });
  await shuttingDown;
  assert.notEqual(harness.manager.getState().state, 'repair-required');
  inspectGate.resolve();
});

test('shutdown cancellation during update inspection rejects instead of reporting repair', async () => {
  const harness = createHarness({ cpuReady: true, mode: 'cpu' });
  await harness.manager.initialize();
  const inspectGate = deferred();
  harness.setInspectGate(inspectGate);
  const checking = harness.manager.check();
  await new Promise((resolve) => setImmediate(resolve));
  const shuttingDown = harness.manager.shutdown();
  await assert.rejects(checking, { name: 'AbortError' });
  await shuttingDown;
  assert.notEqual(harness.manager.getState().state, 'repair-required');
  inspectGate.resolve();
});

test('GPU stop rejection still preserves reason and completes automatic CPU fallback', async () => {
  const harness = createHarness({
    cpuReady: true, nvidiaReady: true, stopFailures: { nvidia: true },
  });
  await harness.manager.initialize();
  await harness.manager.startRetouch();
  await harness.manager.reportRuntimeFailure('cuda-out-of-memory');
  assert.equal(harness.manager.getState().state, 'gpu-fallback');
  assert.equal(harness.manager.getState().reason, 'cuda-out-of-memory');
  assert.deepEqual(harness.manager.getState().sessionFallback, {
    transition: 'GPU -> CPU', reason: 'cuda-out-of-memory',
  });
  assert.equal(harness.calls.includes('sidecar:start:cpu'), true);
  assert.doesNotMatch(JSON.stringify(harness.manager.getState()), /unsafe stop/i);
});

test('shutdown supports stop-only adapters and attempts all cleanup actions', async () => {
  const calls = [];
  const harness = createHarness({
    sidecars: {
      cpu: { async stop(backend) { calls.push(`cpu:${backend}`); throw new Error('stop failed'); } },
      nvidia: { async stop(backend) { calls.push(`nvidia:${backend}`); } },
    },
  });
  await harness.manager.initialize();
  await assert.doesNotReject(harness.manager.shutdown());
  assert.deepEqual(calls, ['cpu:cpu', 'nvidia:nvidia']);
  assert.equal(harness.manager.subscribe(() => {}), false);
});

test('cancel during post-activation inspection invalidates old backend trust', async () => {
  const postInstallInspectGate = deferred();
  const harness = createHarness({ cpuReady: true, mode: 'cpu', postInstallInspectGate });
  await harness.manager.initialize();
  const installing = harness.manager.install('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.manager.cancel(), true);
  postInstallInspectGate.resolve();
  await assert.rejects(installing, { name: 'AbortError' });
  assert.notEqual(harness.manager.getState().state, 'ready-cpu');
  await harness.manager.startRetouch();
  assert.equal(harness.manager.getState().state, 'cpu-download-required');
  assert.equal(harness.calls.includes('sidecar:start:cpu'), false);
});

test('shutdown during post-activation inspection never restores pre-install trust', async () => {
  const postInstallInspectGate = deferred();
  const harness = createHarness({ cpuReady: true, mode: 'cpu', postInstallInspectGate });
  await harness.manager.initialize();
  const installing = harness.manager.install('cpu');
  await new Promise((resolve) => setImmediate(resolve));
  const shuttingDown = harness.manager.shutdown();
  postInstallInspectGate.resolve();
  await assert.rejects(installing, { name: 'AbortError' });
  await shuttingDown;
  assert.notEqual(harness.manager.getState().state, 'ready-cpu');
});

test('late mismatched readiness and rejection both trigger cleanup after shutdown', async () => {
  for (const outcome of ['mismatch', 'rejection']) {
    const startup = deferred();
    const calls = [];
    const legacySidecar = {
      ensureStarted() { calls.push('start'); return startup.promise; },
      async shutdown() { calls.push('shutdown'); },
    };
    const harness = createHarness({ cpuReady: true, mode: 'cpu', sidecar: legacySidecar });
    await harness.manager.initialize();
    const starting = harness.manager.startRetouch();
    await new Promise((resolve) => setImmediate(resolve));
    const shuttingDown = harness.manager.shutdown();
    await assert.rejects(starting, { name: 'AbortError' });
    await shuttingDown;
    if (outcome === 'mismatch') {
      startup.resolve({ state: 'ready', backend: 'nvidia', componentVersion: '9.9.9' });
    } else {
      startup.reject(new Error('spawned then failed'));
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.filter((call) => call === 'shutdown').length, 2, outcome);
  }
});
