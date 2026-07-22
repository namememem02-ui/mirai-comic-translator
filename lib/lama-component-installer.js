const crypto = require('node:crypto');
const path = require('node:path');
const defaultFs = require('node:fs/promises');

const { validateComponentManifest } = require('./lama-component-contract');
const { createSafeZipExtractor, validateWindowsZipPath } = require('./safe-zip-extractor');

const BACKENDS = new Set(['cpu', 'nvidia']);
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_MAX_ENTRIES = 20_000;
const DEFAULT_MAX_EXTRACTED_BYTES = 32 * 1024 * 1024 * 1024;
const DEFAULT_MAX_COMPRESSION_RATIO = 20;
const DEFAULT_MAX_PATH_DEPTH = 32;
const DEFAULT_MAX_CANONICAL_PATHS = 100_000;
const MAX_ENTRY_NAME_LENGTH = 1024;
let operationSequence = 0;

function abortError() {
  const error = new Error('LaMa component operation aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw abortError();
}

function normalizedPackage(pkg) {
  return validateComponentManifest({ schema: 1, packages: [pkg] }).packages[0];
}

function componentRoot(paths) {
  const supplied = paths && (paths.root || paths.componentRoot);
  if (typeof supplied !== 'string' || !path.isAbsolute(supplied)) {
    throw new TypeError('A trusted absolute component root is required');
  }
  const root = path.resolve(supplied);
  if (path.parse(root).root === root) throw new TypeError('Component root cannot be a filesystem root');
  return root;
}

function under(root, ...segments) {
  const candidate = path.resolve(root, ...segments);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    if (!relative && segments.length === 0) return root;
    throw new Error('Derived component path escaped its trusted root');
  }
  return candidate;
}

function safeInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function createLimits(value = {}) {
  return {
    maxEntries: safeInteger(value.maxEntries, DEFAULT_MAX_ENTRIES),
    maxExtractedBytes: safeInteger(value.maxExtractedBytes, DEFAULT_MAX_EXTRACTED_BYTES),
    maxCompressionRatio: safeInteger(value.maxCompressionRatio, DEFAULT_MAX_COMPRESSION_RATIO),
    maxPathDepth: safeInteger(value.maxPathDepth, DEFAULT_MAX_PATH_DEPTH),
    maxCanonicalPaths: safeInteger(value.maxCanonicalPaths, DEFAULT_MAX_CANONICAL_PATHS),
  };
}

function operationToken(now) {
  operationSequence += 1;
  const stamp = String(now()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || 'operation';
  return `${process.pid}-${stamp}-${operationSequence}`;
}

function header(response, name) {
  if (!response || !response.headers) return null;
  if (typeof response.headers.get === 'function') return response.headers.get(name);
  const key = Object.keys(response.headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? response.headers[key] : null;
}

function contentLength(response) {
  const value = header(response, 'content-length');
  if (value === null || value === undefined || value === '' || !/^[1-9]\d*$/.test(String(value))) {
    throw new Error('Invalid or missing download content-length');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('Invalid download content-length');
  return parsed;
}

function assertHttpsResponse(response) {
  if (!response || response.url === undefined || response.url === '') return;
  try {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol === 'https:' && finalUrl.hostname && !finalUrl.username && !finalUrl.password) return;
  } catch {
    // Normalized to the same bounded transport error below.
  }
  throw new Error('LaMa component download must remain HTTPS');
}

async function defaultFreeDisk(fsApi, target) {
  if (typeof fsApi.statfs !== 'function') throw new Error('Disk space check unavailable');
  const stats = await fsApi.statfs(target);
  const available = typeof stats.bavail === 'bigint' || typeof stats.bsize === 'bigint'
    ? BigInt(stats.bavail) * BigInt(stats.bsize)
    : stats.bavail * stats.bsize;
  if (typeof available === 'bigint') return available > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(available);
  return Number.isSafeInteger(available) && available >= 0 ? available : 0;
}

async function assertFreeDisk(freeDisk, fsApi, root, requiredBytes) {
  let available;
  try {
    available = await (freeDisk ? freeDisk(root) : defaultFreeDisk(fsApi, root));
  } catch {
    throw new Error('Unable to verify disk space');
  }
  if (!Number.isSafeInteger(available) || available < requiredBytes) {
    throw new Error('Insufficient disk space for LaMa component');
  }
}

function safeRelativeFile(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENTRY_NAME_LENGTH
    || value.endsWith('/') || value.includes('\\')) return false;
  try {
    const parsed = validateWindowsZipPath(value);
    if (parsed.directory) return false;
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function validateExtractedTree(fsApi, candidateRoot, limits) {
  let count = 0;
  let bytes = 0;
  async function visit(directory) {
    const entries = await fsApi.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      count += 1;
      if (count > limits.maxEntries) throw new Error('Archive entry count limit exceeded');
      const candidate = under(candidateRoot, path.relative(candidateRoot, directory), entry.name);
      const stat = await fsApi.lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error('Archive symlink rejected');
      if (stat.isDirectory()) await visit(candidate);
      else if (stat.isFile()) {
        bytes += stat.size;
        if (!Number.isSafeInteger(bytes) || bytes > limits.maxExtractedBytes) {
          throw new Error('Archive extracted size limit exceeded');
        }
      } else {
        throw new Error('Archive special entry rejected');
      }
    }
  }
  await visit(candidateRoot);
}

async function readDescriptor(fsApi, candidateRoot, pkg) {
  let descriptor;
  try {
    const descriptorPath = under(candidateRoot, 'component.json');
    const descriptorStat = await fsApi.lstat(descriptorPath);
    if (!descriptorStat.isFile() || descriptorStat.size > 64 * 1024) throw new Error('invalid descriptor file');
    const raw = await fsApi.readFile(descriptorPath, 'utf8');
    descriptor = JSON.parse(raw);
  } catch {
    throw new Error('Invalid component layout');
  }
  const files = descriptor && descriptor.files;
  if (!isPlainObject(descriptor) || descriptor.schema !== 1 || descriptor.backend !== pkg.backend
    || descriptor.version !== pkg.version || !VERSION_PATTERN.test(descriptor.version)
    || descriptor.minAppVersion !== pkg.minAppVersion || !VERSION_PATTERN.test(descriptor.minAppVersion)
    || !isPlainObject(files)
    || !safeRelativeFile(files.python) || !safeRelativeFile(files.server) || !safeRelativeFile(files.model)) {
    throw new Error('Invalid component layout');
  }
  const requested = {
    pythonPath: under(candidateRoot, ...files.python.split('/')),
    serverPath: under(candidateRoot, ...files.server.split('/')),
    modelPath: under(candidateRoot, ...files.model.split('/')),
  };
  try {
    const realRoot = await fsApi.realpath(candidateRoot);
    const resolved = {};
    for (const [key, target] of Object.entries(requested)) {
      const stat = await fsApi.lstat(target);
      if (!stat.isFile()) throw new Error('not a regular file');
      const realTarget = await fsApi.realpath(target);
      const relative = path.relative(realRoot, realTarget);
      if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        throw new Error('file escaped staging');
      }
      resolved[key] = realTarget;
    }
    return {
      backend: pkg.backend,
      componentVersion: pkg.version,
      componentRoot: realRoot,
      ...resolved,
    };
  } catch {
    throw new Error('Invalid component layout');
  }
}

function safeInstallDirectory(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200 || value.includes('/') || value.includes('\\')) return false;
  try {
    const parsed = validateWindowsZipPath(value);
    return !parsed.directory && parsed.segments.length === 1;
  } catch {
    return false;
  }
}

function validateActive(value) {
  if (!isPlainObject(value) || value.schema !== 1 || !isPlainObject(value.components)) {
    throw new Error('Invalid active component metadata');
  }
  const components = {};
  for (const [backend, entry] of Object.entries(value.components)) {
    if (!BACKENDS.has(backend) || !isPlainObject(entry) || entry.backend !== backend
      || !VERSION_PATTERN.test(entry.version) || typeof entry.sha256 !== 'string'
      || !SHA256_PATTERN.test(entry.sha256) || typeof entry.installedAt !== 'string'
      || entry.installedAt.length < 1 || entry.installedAt.length > 100
      || (entry.directory !== undefined && !safeInstallDirectory(entry.directory))) {
      throw new Error('Invalid active component metadata');
    }
    components[backend] = {
      backend, version: entry.version, sha256: entry.sha256, installedAt: entry.installedAt,
    };
    if (entry.directory !== undefined) components[backend].directory = entry.directory;
  }
  return { schema: 1, components };
}

async function exists(fsApi, target) {
  try { await fsApi.lstat(target); return true; } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function assertNotSymbolicLink(fsApi, target) {
  const stat = await fsApi.lstat(target);
  if (stat.isSymbolicLink()) throw new Error('Managed component symbolic link rejected');
  return stat;
}

async function ensureManagedDirectory(fsApi, root, ...segments) {
  await fsApi.mkdir(root, { recursive: true });
  const rootStat = await assertNotSymbolicLink(fsApi, root);
  if (!rootStat.isDirectory()) throw new Error('Managed component path is not a directory');
  let current = root;
  for (const segment of segments) {
    current = under(root, path.relative(root, current), segment);
    try {
      const stat = await assertNotSymbolicLink(fsApi, current);
      if (!stat.isDirectory()) throw new Error('Managed component path is not a directory');
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
      try {
        await fsApi.mkdir(current);
      } catch (mkdirError) {
        if (!mkdirError || mkdirError.code !== 'EEXIST') throw mkdirError;
      }
      const stat = await assertNotSymbolicLink(fsApi, current);
      if (!stat.isDirectory()) throw new Error('Managed component path is not a directory');
    }
  }
  return current;
}

async function readActive(fsApi, root) {
  try {
    return validateActive(JSON.parse(await fsApi.readFile(under(root, 'active.json'), 'utf8')));
  } catch (error) {
    if (error && error.code === 'ENOENT') return { schema: 1, components: {} };
    throw error;
  }
}

async function writeActiveAtomic(fsApi, root, value, token) {
  const activePath = under(root, 'active.json');
  const temporaryPath = under(root, `.active-${token}.tmp`);
  const content = `${JSON.stringify(validateActive(value), null, 2)}\n`;
  let handle;
  try {
    if (typeof fsApi.open === 'function') {
      handle = await fsApi.open(temporaryPath, 'wx');
      await handle.writeFile(content, 'utf8');
      if (typeof handle.sync === 'function') await handle.sync();
      await handle.close();
      handle = null;
    } else {
      await fsApi.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
    }
    await fsApi.rename(temporaryPath, activePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fsApi.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function removeOwned(fsApi, target) {
  await fsApi.rm(target, { recursive: true, force: true });
}

function installedAt(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid installation timestamp');
  return date.toISOString();
}

function createLamaComponentInstaller(options = {}) {
  const fetchImpl = options.fetch;
  const fsApi = options.fs || defaultFs;
  const safeExtractor = createSafeZipExtractor({ fs: fsApi });
  const extract = options.extract || ((archive, destination, extractOptions) => safeExtractor.extract(archive, destination, extractOptions));
  const now = options.now || (() => new Date());
  const limits = createLimits(options.limits);
  const freeDisk = options.freeDisk;
  const probe = options.probe;
  const hashFile = options.hashFile;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  if (!fsApi || typeof fsApi.mkdir !== 'function') throw new TypeError('fs is required');
  if (typeof extract !== 'function') throw new TypeError('extract is required');
  if (hashFile !== undefined && typeof hashFile !== 'function') throw new TypeError('hashFile must be a function');

  async function download(pkgValue, paths, signal, onProgress) {
    const pkg = normalizedPackage(pkgValue);
    const root = componentRoot(paths);
    const downloads = under(root, 'downloads');
    const archive = under(downloads, `${pkg.backend}-${pkg.version}.zip`);
    const partial = `${archive}.partial`;
    await ensureManagedDirectory(fsApi, root, 'downloads');
    await removeOwned(fsApi, partial);
    throwIfAborted(signal);
    await assertFreeDisk(freeDisk, fsApi, root, pkg.bytes);

    let handle;
    let completed = false;
    try {
      const response = await fetchImpl(pkg.url, { signal });
      throwIfAborted(signal);
      if (!response || response.ok !== true || !response.body) throw new Error('LaMa component download failed');
      assertHttpsResponse(response);
      const declaredLength = contentLength(response);
      if (declaredLength !== pkg.bytes) {
        throw new Error('Download content-length mismatch');
      }
      handle = await fsApi.open(partial, 'wx');
      const hash = crypto.createHash('sha256');
      let receivedBytes = 0;
      if (typeof onProgress === 'function') onProgress({ receivedBytes, totalBytes: pkg.bytes });
      for await (const rawChunk of response.body) {
        throwIfAborted(signal);
        const chunk = Buffer.from(rawChunk);
        if (!Number.isSafeInteger(receivedBytes + chunk.length) || receivedBytes + chunk.length > pkg.bytes) {
          throw new Error('Download size exceeded package size');
        }
        let offset = 0;
        while (offset < chunk.length) {
          throwIfAborted(signal);
          const result = await handle.write(chunk, offset, chunk.length - offset, null);
          if (!result || !Number.isSafeInteger(result.bytesWritten) || result.bytesWritten < 1
            || result.bytesWritten > chunk.length - offset) {
            throw new Error('Download write made invalid progress');
          }
          hash.update(chunk.subarray(offset, offset + result.bytesWritten));
          offset += result.bytesWritten;
          receivedBytes += result.bytesWritten;
          if (typeof onProgress === 'function') onProgress({ receivedBytes, totalBytes: pkg.bytes });
        }
      }
      throwIfAborted(signal);
      if (receivedBytes !== pkg.bytes) throw new Error('Download size mismatch');
      await handle.sync();
      await handle.close();
      handle = null;
      const actualHash = String(hashFile ? await hashFile(partial) : hash.digest('hex')).toLowerCase();
      if (!SHA256_PATTERN.test(actualHash) || actualHash !== pkg.sha256) {
        throw new Error('LaMa component checksum mismatch');
      }
      await removeOwned(fsApi, archive);
      await fsApi.rename(partial, archive);
      completed = true;
      return archive;
    } catch (error) {
      if ((signal && signal.aborted) || (error && error.name === 'AbortError')) throw abortError();
      throw error;
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (!completed) await removeOwned(fsApi, partial).catch(() => {});
    }
  }

  async function install(pkgValue, paths, signal, onProgress) {
    const pkg = normalizedPackage(pkgValue);
    const root = componentRoot(paths);
    const token = operationToken(now);
    const staging = under(root, `.staging-${pkg.backend}-${pkg.version}-${token}`);
    const installDirectory = `${pkg.version}-${pkg.sha256.slice(0, 16)}-${token}`;
    const target = under(root, pkg.backend, installDirectory);
    let targetActivated = false;
    let metadataActivated = false;
    await ensureManagedDirectory(fsApi, root);
    const archive = await download(pkg, { root }, signal, onProgress);
    const maximumForPackage = Math.min(limits.maxExtractedBytes, pkg.bytes * limits.maxCompressionRatio);
    await assertFreeDisk(freeDisk, fsApi, root, maximumForPackage);
    throwIfAborted(signal);
    await removeOwned(fsApi, staging);
    try {
      await extract(archive, staging, {
        signal,
        limits: { ...limits, maxExtractedBytes: maximumForPackage },
      });
      throwIfAborted(signal);
      await validateExtractedTree(fsApi, staging, { ...limits, maxExtractedBytes: maximumForPackage });
      const launch = await readDescriptor(fsApi, staging, pkg);
      if (typeof probe !== 'function') throw new Error('Component health probe is required');
      let probeResult;
      try {
        probeResult = await probe(launch, signal);
      } catch {
        throw new Error('Component health probe failed');
      }
      if (probeResult !== true && (!isPlainObject(probeResult) || probeResult.healthy !== true)) {
        throw new Error('Component health probe failed');
      }
      throwIfAborted(signal);

      const active = await readActive(fsApi, root);
      const previous = active.components[pkg.backend];
      const previousTarget = previous
        ? under(root, pkg.backend, previous.directory || previous.version)
        : null;
      await ensureManagedDirectory(fsApi, root, pkg.backend);
      await fsApi.rename(staging, target);
      targetActivated = true;
      const metadata = {
        backend: pkg.backend,
        version: pkg.version,
        sha256: pkg.sha256,
        installedAt: installedAt(now),
        directory: installDirectory,
      };
      active.components[pkg.backend] = metadata;
      await writeActiveAtomic(fsApi, root, active, token);
      metadataActivated = true;
      let warning;
      if (previousTarget && previousTarget !== target && await exists(fsApi, previousTarget)) {
        try {
          await assertNotSymbolicLink(fsApi, previousTarget);
          await removeOwned(fsApi, previousTarget);
        } catch {
          warning = 'cleanup-pending';
        }
      }
      return warning ? { ...metadata, warning } : metadata;
    } catch (error) {
      if (!metadataActivated) {
        if (targetActivated) await removeOwned(fsApi, target).catch(() => {});
      }
      if ((signal && signal.aborted) || (error && error.name === 'AbortError')) throw abortError();
      throw error;
    } finally {
      await removeOwned(fsApi, staging).catch(() => {});
    }
  }

  async function inspect(backend, paths) {
    if (!BACKENDS.has(backend)) throw new TypeError('Invalid LaMa backend');
    const root = componentRoot(paths);
    const active = await readActive(fsApi, root);
    const metadata = active.components[backend];
    if (!metadata) return null;
    const target = under(root, backend, metadata.directory || metadata.version);
    if (!(await exists(fsApi, target))) return null;
    await assertNotSymbolicLink(fsApi, target);
    return { ...metadata };
  }

  async function remove(backend, paths) {
    if (!BACKENDS.has(backend)) throw new TypeError('Invalid LaMa backend');
    const root = componentRoot(paths);
    const token = operationToken(now);
    const backendRoot = under(root, backend);
    const quarantine = under(root, `.remove-${backend}-${token}`);
    await ensureManagedDirectory(fsApi, root);
    const active = await readActive(fsApi, root);
    let quarantined = false;
    let metadataCommitted = false;
    try {
      if (await exists(fsApi, backendRoot)) {
        await assertNotSymbolicLink(fsApi, backendRoot);
        await fsApi.rename(backendRoot, quarantine);
        quarantined = true;
      }
      delete active.components[backend];
      await writeActiveAtomic(fsApi, root, active, token);
      metadataCommitted = true;
      if (quarantined) {
        try {
          await removeOwned(fsApi, quarantine);
        } catch {
          return { removed: true, warning: 'cleanup-pending' };
        }
      }
      return { removed: true };
    } catch (error) {
      if (quarantined && !metadataCommitted) await fsApi.rename(quarantine, backendRoot).catch(() => {});
      throw error;
    }
  }

  return { download, install, remove, inspect };
}

module.exports = { createLamaComponentInstaller };
