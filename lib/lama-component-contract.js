const BACKENDS = new Set(['cpu', 'nvidia']);
const MODES = new Set(['auto', 'cpu', 'nvidia']);
const FALLBACKS = new Set(['automatic', 'ask', 'never']);
const STATES = new Set([
  'not-installed', 'detecting', 'checking-update', 'downloading', 'installing',
  'ready-cpu', 'ready-nvidia', 'gpu-fallback', 'cpu-download-required',
  'update-available', 'repair-required', 'error',
]);
const SAFE_REASONS = new Set([
  'driver-too-old', 'nvidia-unavailable', 'out-of-memory', 'gpu-init-failed',
  'gpu-inference-failed', 'startup-failed', 'integrity-failed', 'unavailable',
]);
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const DRIVER_PATTERN = /^\d+(?:\.\d+){1,3}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_URL_LENGTH = 2048;
const MAX_STRING_LENGTH = 200;
const DEFAULT_MAX_PACKAGE_BYTES = 8 * 1024 * 1024 * 1024;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isVersion(value) {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0 && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function boundedString(value, maximum = MAX_STRING_LENGTH) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;
}

function manifestError() {
  return new TypeError('Invalid LaMa component manifest');
}

function validateComponentManifest(value, options = {}) {
  const maximumBytes = Number.isSafeInteger(options.maxPackageBytes) && options.maxPackageBytes > 0
    ? options.maxPackageBytes
    : DEFAULT_MAX_PACKAGE_BYTES;
  if (!isPlainObject(value) || value.schema !== 1 || !Array.isArray(value.packages)
    || value.packages.length < 1 || value.packages.length > BACKENDS.size) {
    throw manifestError();
  }

  const seenBackends = new Set();
  const packages = value.packages.map((entry) => {
    if (!isPlainObject(entry) || !BACKENDS.has(entry.backend) || seenBackends.has(entry.backend)
      || !isVersion(entry.version) || !isHttpsUrl(entry.url)
      || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > maximumBytes
      || typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)
      || !isVersion(entry.minAppVersion) || entry.archive !== 'zip') {
      throw manifestError();
    }
    if (entry.backend === 'nvidia' && (typeof entry.minDriver !== 'string' || !DRIVER_PATTERN.test(entry.minDriver))) {
      throw manifestError();
    }
    if (entry.backend === 'cpu' && entry.minDriver !== undefined) throw manifestError();
    seenBackends.add(entry.backend);
    const normalized = {
      backend: entry.backend,
      version: entry.version,
      url: entry.url,
      bytes: entry.bytes,
      sha256: entry.sha256.toLowerCase(),
      minAppVersion: entry.minAppVersion,
      archive: entry.archive,
    };
    if (entry.backend === 'nvidia') normalized.minDriver = entry.minDriver;
    return normalized;
  });
  return { schema: 1, packages };
}

function normalizeComponentSettings(value) {
  const settings = isPlainObject(value) ? value : {};
  return {
    mode: MODES.has(settings.mode) ? settings.mode : 'auto',
    fallback: FALLBACKS.has(settings.fallback) ? settings.fallback : 'automatic',
  };
}

function safeReason(value) {
  return SAFE_REASONS.has(value) ? value : 'nvidia-unavailable';
}

function unavailableNvidia(input, settings) {
  const reason = safeReason(input.gpuFailure);
  if (settings.fallback === 'automatic' && input.cpuReady === true) {
    return { backend: 'cpu', state: 'gpu-fallback', reason, automatic: true };
  }
  return { backend: null, state: 'error', reason, automatic: false };
}

function selectLamaBackend(input) {
  const candidate = isPlainObject(input) ? input : {};
  const settings = normalizeComponentSettings(candidate);
  const nvidiaAvailable = candidate.nvidiaReady === true && candidate.nvidiaCompatible === true && !candidate.gpuFailure;

  if (settings.mode === 'auto') {
    if (nvidiaAvailable) return { backend: 'nvidia', state: 'ready-nvidia', automatic: true };
    if (candidate.cpuReady === true) return { backend: 'cpu', state: 'ready-cpu', automatic: true };
    return { backend: null, state: 'cpu-download-required', automatic: true };
  }
  if (settings.mode === 'cpu') {
    return candidate.cpuReady === true
      ? { backend: 'cpu', state: 'ready-cpu', automatic: false }
      : { backend: null, state: 'cpu-download-required', automatic: false };
  }
  if (nvidiaAvailable) return { backend: 'nvidia', state: 'ready-nvidia', automatic: false };
  return unavailableNvidia(candidate, settings);
}

function safeComponentStatus(value) {
  if (!isPlainObject(value) || !STATES.has(value.state)) {
    return { state: 'error', message: 'AI retouch unavailable' };
  }
  const status = { state: value.state };
  if (BACKENDS.has(value.backend)) status.backend = value.backend;
  const reason = boundedString(value.reason);
  if (reason && SAFE_REASONS.has(reason)) status.reason = reason;
  if (isVersion(value.componentVersion)) status.componentVersion = value.componentVersion;
  if (isVersion(value.availableVersion)) status.availableVersion = value.availableVersion;
  if (Number.isSafeInteger(value.receivedBytes) && value.receivedBytes >= 0) status.receivedBytes = value.receivedBytes;
  if (Number.isSafeInteger(value.totalBytes) && value.totalBytes > 0) status.totalBytes = value.totalBytes;
  if (status.receivedBytes !== undefined && status.totalBytes !== undefined) {
    status.percentage = Math.min(100, Math.floor((status.receivedBytes * 100) / status.totalBytes));
  }
  const message = boundedString(value.message, 300);
  if (message) status.message = message;
  if (isPlainObject(value.diagnostic)) {
    const code = boundedString(value.diagnostic.code, 100);
    if (code) status.diagnostic = { code };
  }
  return status;
}

module.exports = {
  validateComponentManifest,
  normalizeComponentSettings,
  selectLamaBackend,
  safeComponentStatus,
};
