const defaultContract = require('./lama-component-contract');

const BACKENDS = new Set(['cpu', 'nvidia']);
const HARDWARE_REASONS = new Set([
  'supported', 'driver-too-old', 'not-detected', 'invalid-output',
  'min-driver-unavailable', 'unsupported-platform',
]);
const DRIVER_PATTERN = /^\d+(?:\.\d+){1,3}$/;

const COPY = Object.freeze({
  'not-installed': ['ยังไม่ได้ติดตั้ง AI รีทัช', 'ติดตั้งส่วนประกอบ CPU เพื่อเริ่มใช้งาน AI รีทัช'],
  detecting: ['กำลังตรวจสอบเครื่อง', 'กำลังตรวจสอบฮาร์ดแวร์และส่วนประกอบ AI รีทัช'],
  'checking-update': ['กำลังตรวจสอบอัปเดต', 'กำลังตรวจสอบส่วนประกอบ AI รีทัชรุ่นล่าสุด'],
  downloading: ['กำลังดาวน์โหลด AI รีทัช', 'กำลังดาวน์โหลดส่วนประกอบอย่างปลอดภัย'],
  installing: ['กำลังติดตั้ง AI รีทัช', 'กำลังตรวจสอบและเปิดใช้งานส่วนประกอบ'],
  'ready-cpu': ['AI รีทัช · CPU', 'AI รีทัชพร้อมใช้งานด้วย CPU'],
  'ready-nvidia': ['AI รีทัช · GPU', 'AI รีทัชพร้อมใช้งานด้วย NVIDIA GPU'],
  'gpu-fallback': ['AI รีทัช · CPU (GPU ใช้งานไม่ได้)', 'เปลี่ยนจาก GPU เป็น CPU สำหรับเซสชันนี้'],
  'cpu-download-required': ['ต้องดาวน์โหลดส่วนประกอบ CPU', 'ดาวน์โหลด CPU เพื่อใช้งาน AI รีทัชต่อ'],
  'update-available': ['มีอัปเดต AI รีทัช', 'มีส่วนประกอบ AI รีทัชรุ่นใหม่พร้อมติดตั้ง'],
  'repair-required': ['ต้องซ่อมแซมส่วนประกอบ', 'ส่วนประกอบ AI รีทัชเสียหาย กรุณาซ่อมแซม'],
  error: ['AI รีทัชไม่พร้อมใช้งาน', 'ไม่สามารถใช้งาน AI รีทัชได้ กรุณาลองอีกครั้งหรือซ่อมแซมส่วนประกอบ'],
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function safeHardware(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const nvidiaValue = value.nvidia && typeof value.nvidia === 'object' && !Array.isArray(value.nvidia)
    ? value.nvidia
    : {};
  const nvidia = {
    present: nvidiaValue.present === true,
    compatible: nvidiaValue.compatible === true,
  };
  if (typeof nvidiaValue.driverVersion === 'string' && nvidiaValue.driverVersion.length <= 64
    && DRIVER_PATTERN.test(nvidiaValue.driverVersion)) {
    nvidia.driverVersion = nvidiaValue.driverVersion;
  } else {
    nvidia.driverVersion = '';
  }
  nvidia.reason = HARDWARE_REASONS.has(nvidiaValue.reason) ? nvidiaValue.reason : 'not-detected';
  return {
    platform: value.platform === 'win32' ? 'win32' : 'unsupported',
    arch: value.arch === 'x64' ? 'x64' : 'unsupported',
    freeBytes: Number.isSafeInteger(value.freeBytes) && value.freeBytes >= 0 ? value.freeBytes : 0,
    nvidia,
  };
}

function compareVersions(left, right) {
  const leftParts = String(left).split('.').map(Number);
  const rightParts = String(right).split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function requiredFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  return value;
}

function method(owner, names) {
  for (const name of names) {
    if (owner && typeof owner[name] === 'function') return owner[name].bind(owner);
  }
  return null;
}

function abortError() {
  const error = new Error('LaMa component operation was cancelled');
  error.name = 'AbortError';
  return error;
}

function abortable(value, signal) {
  if (!signal) return Promise.resolve(value);
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(value).then(
      (result) => { signal.removeEventListener('abort', abort); resolve(result); },
      (error) => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

function createLamaComponentManager(options = {}) {
  const contract = options.contract || defaultContract;
  const normalizeSettings = requiredFunction(contract.normalizeComponentSettings, 'contract.normalizeComponentSettings');
  const selectBackend = requiredFunction(contract.selectLamaBackend, 'contract.selectLamaBackend');
  const safeStatus = requiredFunction(contract.safeComponentStatus, 'contract.safeComponentStatus');
  const validateManifest = requiredFunction(contract.validateComponentManifest, 'contract.validateComponentManifest');
  const detector = options.detector;
  const installer = options.installer;
  const root = options.root || options.componentRoot;
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('root is required');
  const detect = requiredFunction(method(detector, ['detect']), 'detector.detect');
  const inspect = requiredFunction(method(installer, ['inspect']), 'installer.inspect');
  const installComponent = requiredFunction(method(installer, ['install']), 'installer.install');
  const removeComponent = requiredFunction(method(installer, ['remove']), 'installer.remove');
  const loadManifest = requiredFunction(
    typeof options.loadManifest === 'function'
      ? options.loadManifest
      : typeof options.manifestLoader === 'function'
        ? options.manifestLoader
        : method(options.manifestLoader, ['load', 'get']),
    'manifestLoader.load',
  );
  const loadSettings = method(options.settingsStore, ['load', 'read', 'get']) || (async () => ({}));
  const saveSettings = method(options.settingsStore, ['save', 'write', 'set']) || (async () => {});
  const sidecar = options.sidecar || options.sidecarManager || null;
  const sidecars = options.sidecars || null;

  let preferences = normalizeSettings(options.preferences);
  let hardware;
  const inventory = new Map();
  let publicState;
  let operationQueue = Promise.resolve();
  let activeController = null;
  let activeBackend = null;
  let fallbackNotice = null;
  let fallbackPinned = false;
  let closed = false;
  let shutdownPromise = null;
  const shutdownController = new AbortController();
  const listeners = new Set();

  function safeReason(code, fallback = 'unavailable') {
    if (typeof code !== 'string' || code.length === 0) return fallback;
    const selected = selectBackend({
      mode: 'nvidia', fallback: 'never', cpuReady: false,
      nvidiaReady: false, nvidiaCompatible: false, gpuFailure: code,
    });
    return typeof selected.reason === 'string' ? selected.reason : fallback;
  }

  function copyFor(candidate, projected) {
    const pair = COPY[projected.state] || COPY.error;
    let label = pair[0];
    if (projected.state === 'repair-required' && projected.backend) {
      label = `ต้องซ่อมแซมส่วนประกอบ ${projected.backend === 'nvidia' ? 'GPU' : 'CPU'}`;
    }
    return { label, message: pair[1] };
  }

  function project(candidate) {
    const projected = safeStatus(candidate);
    const next = { ...projected, ...copyFor(candidate, projected) };
    if (candidate.transition === 'GPU -> CPU' && projected.backend === 'cpu') {
      next.transition = 'GPU -> CPU';
    }
    if (candidate.canCancel === true && projected.state === 'downloading') next.canCancel = true;
    if (projected.state === 'error' && typeof candidate.requiresConfirmation === 'boolean') {
      next.requiresConfirmation = candidate.requiresConfirmation;
    }
    next.preferences = { ...preferences };
    if (hardware) next.hardware = hardware;
    if (fallbackNotice) {
      next.sessionFallback = { transition: 'GPU -> CPU', reason: fallbackNotice.reason };
    }
    return deepFreeze(next);
  }

  function notify(next) {
    for (const listener of [...listeners]) {
      try { listener(next); } catch { /* Listener failures must not corrupt manager state. */ }
    }
  }

  function publish(candidate) {
    publicState = project(candidate);
    notify(publicState);
    return publicState;
  }

  function restore(snapshot) {
    publicState = snapshot;
    notify(publicState);
    return publicState;
  }

  function enqueue(work, allowClosed = false) {
    if (closed && !allowClosed) return Promise.reject(new Error('LaMa component manager is shut down'));
    const result = operationQueue.then(async () => {
      if (closed && !allowClosed) throw new Error('LaMa component manager is shut down');
      return work();
    });
    operationQueue = result.catch(() => {});
    return result;
  }

  function metadataCandidate(state, backend, metadata, extra = {}) {
    const candidate = { state, backend, ...extra };
    if (metadata && typeof metadata.version === 'string') candidate.componentVersion = metadata.version;
    return candidate;
  }

  function nvidiaFailureReason() {
    if (!hardware || !hardware.nvidia.present) return 'nvidia-unavailable';
    if (!hardware.nvidia.compatible) {
      return hardware.nvidia.reason === 'driver-too-old' ? 'driver-too-old' : 'nvidia-unavailable';
    }
    return 'nvidia-unavailable';
  }

  function selectedState({ allowNotInstalled = false } = {}) {
    const cpu = inventory.get('cpu');
    const nvidia = inventory.get('nvidia');
    if (fallbackNotice && fallbackPinned) {
      if (!cpu) return { state: 'cpu-download-required', reason: fallbackNotice.reason };
      return metadataCandidate('gpu-fallback', 'cpu', cpu, {
        reason: fallbackNotice.reason, transition: 'GPU -> CPU',
      });
    }
    if (!cpu && !nvidia && allowNotInstalled) return { state: 'not-installed' };
    const selected = selectBackend({
      ...preferences,
      cpuReady: Boolean(cpu),
      nvidiaReady: Boolean(nvidia),
      nvidiaCompatible: hardware ? hardware.nvidia.compatible === true : false,
    });
    if (selected.backend) {
      return metadataCandidate(selected.state, selected.backend, inventory.get(selected.backend), {
        reason: selected.reason,
      });
    }
    if (selected.state === 'error') {
      const backend = nvidia ? 'nvidia' : undefined;
      return {
        state: 'error', backend, reason: nvidiaFailureReason(),
        requiresConfirmation: preferences.fallback === 'ask' && Boolean(cpu),
        ...(backend && nvidia ? { componentVersion: nvidia.version } : {}),
      };
    }
    return { state: selected.state };
  }

  function failureState(previous, error, overrides = {}) {
    const candidate = {
      state: 'error', reason: safeReason(error && error.code),
      ...overrides,
    };
    if (!candidate.backend && previous && BACKENDS.has(previous.backend)) candidate.backend = previous.backend;
    const matchingMetadata = candidate.backend && inventory.get(candidate.backend);
    if (!candidate.componentVersion && matchingMetadata && matchingMetadata.version) {
      candidate.componentVersion = matchingMetadata.version;
    } else if (!candidate.componentVersion && previous && previous.componentVersion
      && (!candidate.backend || previous.backend === candidate.backend)) {
      candidate.componentVersion = previous.componentVersion;
    }
    return candidate;
  }

  async function inspectInventory(signal = shutdownController.signal) {
    const failures = [];
    for (const backend of BACKENDS) {
      try {
        const metadata = await abortable(inspect(backend, { root }), signal);
        if (metadata) inventory.set(backend, metadata);
        else inventory.delete(backend);
      } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        inventory.delete(backend);
        failures.push({ backend, reason: safeReason(error && error.code, 'integrity-failed') });
      }
    }
    return failures;
  }

  async function manifest(signal = shutdownController.signal) {
    return validateManifest(await abortable(loadManifest(), signal));
  }

  function packageFor(value, backend) {
    return value.packages.find((entry) => entry.backend === backend) || null;
  }

  function adapterFor(backend) {
    return sidecars && sidecars[backend] ? sidecars[backend] : sidecar;
  }

  async function cleanupAdapter(adapter, backend) {
    const stop = method(adapter, ['stop', 'shutdown']);
    if (stop) await stop(backend);
  }

  async function startAdapter(backend) {
    const adapter = adapterFor(backend);
    const start = method(adapter, ['start', 'ensureStarted']);
    if (!start) return { state: 'unavailable', errorCode: 'startup-failed' };
    const startup = Promise.resolve().then(() => start(backend, shutdownController.signal));
    startup.then(async (result) => {
      if (closed && adapterReady(result, backend, inventory.get(backend))) {
        await cleanupAdapter(adapter, backend).catch(() => {});
      }
    }, () => {});
    try {
      return await abortable(startup, shutdownController.signal);
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      return { state: 'unavailable', errorCode: 'startup-failed' };
    }
  }

  async function stopAdapter(backend) {
    await cleanupAdapter(adapterFor(backend), backend);
  }

  function adapterReady(result, backend, metadata) {
    if (result === true) return true;
    if (!result || result.state !== 'ready') return false;
    if (result.backend !== undefined && result.backend !== backend) return false;
    if (result.componentVersion !== undefined && metadata
      && result.componentVersion !== metadata.version) return false;
    return true;
  }

  async function applyGpuFailure(code) {
    const reason = safeReason(code);
    const automatic = preferences.fallback === 'automatic';
    if (automatic) {
      fallbackNotice = { reason };
      fallbackPinned = true;
    }
    try { await stopAdapter('nvidia'); } catch { /* Fallback remains visible even if cleanup fails. */ }
    activeBackend = null;
    if (!automatic) {
      return publish({
        state: 'error', backend: 'nvidia', reason,
        componentVersion: inventory.get('nvidia') && inventory.get('nvidia').version,
        requiresConfirmation: preferences.fallback === 'ask' && inventory.has('cpu'),
      });
    }

    const cpu = inventory.get('cpu');
    if (!cpu) {
      return publish({ state: 'cpu-download-required', reason });
    }
    const result = await startAdapter('cpu');
    if (!adapterReady(result, 'cpu', cpu)) {
      return publish(failureState(publicState, { code: result && result.errorCode }, { backend: 'cpu' }));
    }
    activeBackend = 'cpu';
    return publish(metadataCandidate('gpu-fallback', 'cpu', cpu, {
      reason, transition: 'GPU -> CPU',
    }));
  }

  async function initializeMutation() {
    publish({ state: 'detecting' });
    try {
      preferences = normalizeSettings(await abortable(loadSettings(), shutdownController.signal));
      hardware = deepFreeze(safeHardware(await abortable(detect(root), shutdownController.signal)));
      const failures = await inspectInventory();
      if (failures.length > 0) {
        const failure = failures[0];
        return publish({ state: 'repair-required', backend: failure.backend, reason: failure.reason });
      }
      return publish(selectedState({ allowNotInstalled: true }));
    } catch (error) {
      publish(failureState(publicState, error));
      throw error;
    }
  }

  async function checkMutation() {
    const previous = publicState;
    publish({ state: 'checking-update' });
    try {
      const available = await manifest();
      const failures = await inspectInventory();
      if (failures.length > 0) {
        const failure = failures[0];
        return publish({ state: 'repair-required', backend: failure.backend, reason: failure.reason });
      }
      const selected = selectedState({ allowNotInstalled: true });
      if (selected.state === 'gpu-fallback') return publish(selected);
      const preferenceOrder = [selected.backend, 'cpu', 'nvidia'].filter(Boolean);
      const backend = [...new Set(preferenceOrder)].find((candidate) => {
        const current = inventory.get(candidate);
        const pkg = packageFor(available, candidate);
        return current && pkg && compareVersions(current.version, pkg.version) < 0;
      });
      if (backend) {
        const current = inventory.get(backend);
        const pkg = packageFor(available, backend);
        return publish(metadataCandidate('update-available', backend, current, { availableVersion: pkg.version }));
      }
      return publish(selected);
    } catch (error) {
      publish(failureState(previous, error));
      throw error;
    }
  }

  async function installMutation(backend, explicitRecovery = false) {
    const previous = publicState;
    const controller = new AbortController();
    activeController = controller;
    let activated = false;
    try {
      const available = await manifest(controller.signal);
      const pkg = packageFor(available, backend);
      if (!pkg) throw Object.assign(new Error('LaMa component package is unavailable'), { code: 'unavailable' });
      if (activeBackend === backend) {
        await stopAdapter(backend);
        activeBackend = null;
      }
      publish({
        state: 'downloading', backend, receivedBytes: 0, totalBytes: pkg.bytes, canCancel: true,
      });
      const result = await installComponent(pkg, { root }, controller.signal, (progress) => {
        if (controller.signal.aborted) return;
        if (progress && progress.receivedBytes === progress.totalBytes) {
          publish({ state: 'installing', backend });
          return;
        }
        publish({
          state: 'downloading', backend,
          receivedBytes: progress && progress.receivedBytes,
          totalBytes: progress && progress.totalBytes,
          canCancel: true,
        });
      });
      activated = true;
      const metadata = await inspect(backend, { root }) || result;
      inventory.set(backend, metadata);
      if (backend === 'nvidia' && explicitRecovery) fallbackPinned = false;
      return publish(selectedState({ allowNotInstalled: true }));
    } catch (error) {
      if ((controller && controller.signal.aborted) || (error && error.name === 'AbortError')) {
        restore(previous);
        throw abortError();
      }
      if (activated) inventory.delete(backend);
      const preserved = activated ? { ...previous, componentVersion: undefined } : previous;
      publish(failureState(preserved, error, { backend }));
      throw error;
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  async function removeMutation(backend) {
    const previous = publicState;
    try {
      if (activeBackend === backend) {
        await stopAdapter(backend);
        activeBackend = null;
      }
      await removeComponent(backend, { root });
      inventory.delete(backend);
      return publish(selectedState({ allowNotInstalled: true }));
    } catch (error) {
      publish(failureState(previous, error, { backend }));
      throw error;
    }
  }

  async function preferencesMutation(settings) {
    const previous = publicState;
    const next = normalizeSettings(settings);
    try {
      await saveSettings(next);
      preferences = next;
      if (fallbackPinned && (next.mode === 'nvidia' || next.fallback !== 'automatic')) {
        fallbackPinned = false;
      }
      return publish(selectedState({ allowNotInstalled: true }));
    } catch (error) {
      publish(failureState(previous, error));
      throw error;
    }
  }

  async function startRetouchMutation() {
    if (fallbackNotice && fallbackPinned && activeBackend === 'cpu' && inventory.has('cpu')) {
      return publish(selectedState());
    }
    const selected = selectedState();
    if (!selected.backend) return publish(selected);
    const backend = selected.backend;
    if (activeBackend === backend) return publish(selected);
    if (activeBackend) await stopAdapter(activeBackend);
    activeBackend = null;
    const result = await startAdapter(backend);
    if (!adapterReady(result, backend, inventory.get(backend))) {
      if (backend === 'nvidia') return applyGpuFailure((result && result.errorCode) || 'startup-failed');
      return publish(failureState(publicState, { code: result && result.errorCode }, { backend }));
    }
    activeBackend = backend;
    return publish(selected);
  }

  publicState = project({ state: 'not-installed' });

  return {
    initialize: () => enqueue(initializeMutation),
    getState: () => publicState,
    check: () => enqueue(checkMutation),
    install(backend) {
      if (!BACKENDS.has(backend)) return Promise.reject(new TypeError('Invalid LaMa backend'));
      return enqueue(() => installMutation(backend));
    },
    cancel() {
      if (!activeController || activeController.signal.aborted) return false;
      activeController.abort();
      return true;
    },
    repair(backend) {
      if (!BACKENDS.has(backend)) return Promise.reject(new TypeError('Invalid LaMa backend'));
      return enqueue(() => installMutation(backend, true));
    },
    remove(backend) {
      if (!BACKENDS.has(backend)) return Promise.reject(new TypeError('Invalid LaMa backend'));
      return enqueue(() => removeMutation(backend));
    },
    setPreferences: (settings) => enqueue(() => preferencesMutation(settings)),
    startRetouch: () => enqueue(startRetouchMutation),
    reportRuntimeFailure(code) {
      return enqueue(async () => {
        if (fallbackNotice && fallbackPinned) return publish(selectedState());
        if (activeBackend === 'nvidia' || publicState.backend === 'nvidia') return applyGpuFailure(code);
        return publish(failureState(publicState, { code }));
      });
    },
    shutdown() {
      if (shutdownPromise) return shutdownPromise;
      closed = true;
      shutdownController.abort();
      if (activeController) activeController.abort();
      shutdownPromise = enqueue(async () => {
        const adapters = new Set();
        if (sidecar) adapters.add(sidecar);
        if (sidecars) for (const adapter of Object.values(sidecars)) adapters.add(adapter);
        try {
          await Promise.allSettled([...adapters].map(async (adapter) => {
            const shutdownAdapter = method(adapter, ['shutdown', 'stop']);
            if (shutdownAdapter) await shutdownAdapter();
          }));
        } finally {
          activeBackend = null;
          listeners.clear();
        }
      }, true);
      return shutdownPromise;
    },
    subscribe(listener) {
      if (closed) return false;
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      listeners.add(listener);
      try { listener(publicState); } catch { /* Listener failures are isolated from lifecycle work. */ }
      return () => listeners.delete(listener);
    },
  };
}

module.exports = { createLamaComponentManager };
