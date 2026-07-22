const path = require('node:path');
const defaultFs = require('node:fs/promises');
const { Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const defaultYauzl = require('yauzl');

const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const MAX_ENTRY_NAME_LENGTH = 1024;
const MAX_SEGMENT_LENGTH = 255;

function abortError() {
  const error = new Error('ZIP extraction aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw abortError();
}

function boundedLimits(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !Number.isSafeInteger(value.maxEntries) || value.maxEntries < 1
    || !Number.isSafeInteger(value.maxExtractedBytes) || value.maxExtractedBytes < 1
    || !Number.isSafeInteger(value.maxPathDepth) || value.maxPathDepth < 1
    || !Number.isSafeInteger(value.maxCanonicalPaths) || value.maxCanonicalPaths < 1
    || !Number.isFinite(value.maxCompressionRatio) || value.maxCompressionRatio <= 0) {
    throw new TypeError('Invalid ZIP extraction limits');
  }
  return {
    maxEntries: value.maxEntries,
    maxExtractedBytes: value.maxExtractedBytes,
    maxPathDepth: value.maxPathDepth,
    maxCanonicalPaths: value.maxCanonicalPaths,
    maxCompressionRatio: value.maxCompressionRatio,
  };
}

function entryKind(entry) {
  const attributes = Number.isInteger(entry.externalFileAttributes) ? entry.externalFileAttributes : 0;
  const mode = (attributes >>> 16) & 0xffff;
  const type = mode & 0xf000;
  const madeBy = Number.isInteger(entry.versionMadeBy) ? entry.versionMadeBy >>> 8 : -1;
  const dosDirectory = madeBy === 0 && (attributes & 0x10) === 0x10;
  const directory = type === 0x4000 || dosDirectory || entry.fileName.endsWith('/');
  if (type === 0xa000) return 'symlink';
  if (type !== 0 && type !== 0x4000 && type !== 0x8000) return 'special';
  return directory ? 'directory' : 'file';
}

function validateSegment(segment) {
  if (!segment || segment === '.' || segment === '..') throw new Error('Invalid ZIP path segment');
  if (segment.length > MAX_SEGMENT_LENGTH) throw new Error('ZIP path segment is too long');
  if (/[\x00-\x1f\x7f-\x9f]/.test(segment)) throw new Error('ZIP path contains control characters');
  if (segment.includes(':')) throw new Error('ZIP path contains a Windows alternate-data-stream colon');
  if (/[. ]$/.test(segment)) throw new Error('ZIP path uses a Windows trailing dot or space alias');
  if (WINDOWS_DEVICE_NAME.test(segment)) throw new Error('ZIP path uses a reserved Windows device name');
  return segment.normalize('NFC');
}

function validateEntryPath(fileName) {
  if (typeof fileName !== 'string' || !fileName || fileName.length > MAX_ENTRY_NAME_LENGTH
    || fileName.includes('\0')) throw new Error('Invalid ZIP path');
  if (fileName.includes('\\')) throw new Error('ZIP path contains a backslash');
  if (fileName.startsWith('/') || /^[a-zA-Z]:/.test(fileName)) throw new Error('Absolute ZIP path rejected');
  const directory = fileName.endsWith('/');
  const raw = directory ? fileName.slice(0, -1) : fileName;
  if (!raw) throw new Error('Invalid ZIP path');
  const rawSegments = raw.split('/');
  if (rawSegments.some((segment) => segment.length === 0)) throw new Error('ZIP path contains an empty segment');
  const segments = rawSegments.map(validateSegment);
  const normalizedPath = segments.join('/');
  const canonical = segments.map((segment) => segment.toLowerCase()).join('/');
  return { canonical, directory, normalizedPath, segments };
}

function validateEntryMetadata(entry, state, limits) {
  const parsed = validateEntryPath(entry && entry.fileName);
  if (parsed.segments.length > limits.maxPathDepth) throw new Error('ZIP path depth limit exceeded');
  const kind = entryKind(entry);
  if (kind === 'symlink') throw new Error('ZIP symlink rejected');
  if (kind === 'special') throw new Error('ZIP special entry type rejected');
  if (parsed.directory !== (kind === 'directory')) throw new Error('ZIP entry type conflicts with its path');
  if (typeof entry.isEncrypted === 'function' && entry.isEncrypted()) throw new Error('Encrypted ZIP entry rejected');
  if (kind === 'file' && entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw new Error('Unsupported ZIP compression method');
  }
  if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0
    || !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0) {
    throw new Error('Invalid ZIP entry size');
  }

  state.entryCount += 1;
  if (state.entryCount > limits.maxEntries) throw new Error('ZIP entry count limit exceeded');
  state.extractedBytes += entry.uncompressedSize;
  if (!Number.isSafeInteger(state.extractedBytes) || state.extractedBytes > limits.maxExtractedBytes) {
    throw new Error('ZIP extracted size limit exceeded');
  }
  if (kind === 'file' && entry.uncompressedSize > 0
    && (entry.compressedSize === 0 || entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio)) {
    throw new Error('ZIP compression ratio limit exceeded');
  }

  const parts = parsed.canonical.split('/');
  const normalizedParts = parsed.normalizedPath.split('/');
  for (let index = 1; index < parts.length; index += 1) {
    const canonicalParent = parts.slice(0, index).join('/');
    const normalizedParent = normalizedParts.slice(0, index).join('/');
    const existing = state.paths.get(canonicalParent);
    if (existing && existing.kind === 'file') throw new Error('ZIP file-directory conflict rejected');
    if (existing && existing.normalizedPath !== normalizedParent) throw new Error('ZIP canonical path alias rejected');
    if (!existing) {
      if (state.paths.size >= limits.maxCanonicalPaths) throw new Error('ZIP canonical path limit exceeded');
      state.paths.set(canonicalParent, { kind: 'directory', normalizedPath: normalizedParent, explicit: false });
    }
  }

  const existing = state.paths.get(parsed.canonical);
  if (existing) {
    if (existing.kind !== kind) throw new Error('ZIP file-directory conflict rejected');
    if (existing.normalizedPath !== parsed.normalizedPath) throw new Error('ZIP canonical path alias rejected');
    if (existing.explicit || kind === 'file') throw new Error('Duplicate ZIP entry rejected');
    existing.explicit = true;
  } else {
    if (state.paths.size >= limits.maxCanonicalPaths) throw new Error('ZIP canonical path limit exceeded');
    state.paths.set(parsed.canonical, { kind, normalizedPath: parsed.normalizedPath, explicit: true });
  }

  return {
    fingerprint: {
      compressedSize: entry.compressedSize,
      compressionMethod: entry.compressionMethod,
      crc32: entry.crc32,
      externalFileAttributes: entry.externalFileAttributes,
      fileName: entry.fileName,
      generalPurposeBitFlag: entry.generalPurposeBitFlag,
      uncompressedSize: entry.uncompressedSize,
      versionMadeBy: entry.versionMadeBy,
    },
    kind,
    relativePath: parsed.normalizedPath,
    size: entry.uncompressedSize,
  };
}

function entryMatchesFingerprint(entry, expected) {
  return Object.entries(expected).every(([key, value]) => entry[key] === value);
}

function openArchive(yauzlApi, archivePath) {
  return new Promise((resolve, reject) => {
    yauzlApi.open(archivePath, {
      autoClose: false,
      decodeStrings: true,
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    }, (error, zipfile) => (error ? reject(error) : resolve(zipfile)));
  });
}

function scanArchive(zipfile, signal, limits) {
  return new Promise((resolve, reject) => {
    const records = [];
    const state = { entryCount: 0, extractedBytes: 0, paths: new Map() };
    let settled = false;
    const cleanup = () => {
      zipfile.removeListener('entry', onEntry);
      zipfile.removeListener('end', onEnd);
      zipfile.removeListener('error', onError);
      zipfile.removeListener('close', onClose);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const onError = (error) => finish(error);
    const onClose = () => finish(new Error('ZIP archive closed during pre-scan'));
    const onAbort = () => {
      finish(abortError());
      zipfile.close();
    };
    const onEntry = (entry) => {
      try {
        throwIfAborted(signal);
        records.push(validateEntryMetadata(entry, state, limits));
        zipfile.readEntry();
      } catch (error) {
        finish(error);
      }
    };
    const onEnd = () => finish(null, {
      entries: records,
      entryCount: state.entryCount,
      totalBytes: state.extractedBytes,
    });
    zipfile.on('entry', onEntry);
    zipfile.on('end', onEnd);
    zipfile.on('error', onError);
    zipfile.on('close', onClose);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      throwIfAborted(signal);
      zipfile.readEntry();
    } catch (error) {
      finish(error);
    }
  });
}

function openEntryStream(zipfile, entry) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
}

async function extractFile(fsApi, zipfile, record, destination, signal, progress) {
  const outputPath = path.join(destination, ...record.relativePath.split('/'));
  await fsApi.mkdir(path.dirname(outputPath), { recursive: true });
  throwIfAborted(signal);
  const stream = await openEntryStream(zipfile, record.entry);
  let handle;
  let written = 0;
  try {
    handle = await fsApi.open(outputPath, 'wx', 0o600);
    const output = new Writable({
      write(rawChunk, _encoding, callback) {
        const chunk = Buffer.from(rawChunk);
        (async () => {
          throwIfAborted(signal);
          if (!Number.isSafeInteger(written + chunk.length) || written + chunk.length > record.size) {
            throw new Error('ZIP entry exceeded its declared size');
          }
          let offset = 0;
          while (offset < chunk.length) {
            const result = await handle.write(chunk, offset, chunk.length - offset, null);
            if (!result || result.bytesWritten < 1) throw new Error('ZIP output write made no progress');
            offset += result.bytesWritten;
          }
          written += chunk.length;
          progress.extractedBytes += chunk.length;
          if (typeof progress.onProgress === 'function') {
            progress.onProgress({ extractedBytes: progress.extractedBytes, totalBytes: progress.totalBytes });
          }
        })().then(() => callback(), callback);
      },
    });
    await pipeline(stream, output, { signal });
    throwIfAborted(signal);
    if (written !== record.size) throw new Error('ZIP entry size mismatch');
    await handle.sync();
  } finally {
    stream.destroy();
    if (handle) await handle.close().catch(() => {});
  }
}

function extractScannedArchive(fsApi, zipfile, scanned, destination, signal, progress) {
  return new Promise((resolve, reject) => {
    let index = 0;
    let processing = false;
    let settled = false;
    const cleanup = () => {
      zipfile.removeListener('entry', onEntry);
      zipfile.removeListener('end', onEnd);
      zipfile.removeListener('error', onError);
      zipfile.removeListener('close', onClose);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onError = (error) => finish(error);
    const onClose = () => finish(new Error('ZIP archive closed during extraction'));
    const onAbort = () => {
      if (!processing) {
        finish(abortError());
        zipfile.close();
      }
    };
    const onEntry = async (entry) => {
      processing = true;
      try {
        throwIfAborted(signal);
        const record = scanned.entries[index];
        if (!record || !entryMatchesFingerprint(entry, record.fingerprint)) {
          throw new Error('ZIP archive changed after pre-scan');
        }
        const outputPath = path.join(destination, ...record.relativePath.split('/'));
        if (record.kind === 'directory') await fsApi.mkdir(outputPath, { recursive: true });
        else await extractFile(fsApi, zipfile, { ...record, entry }, destination, signal, progress);
        index += 1;
        processing = false;
        zipfile.readEntry();
      } catch (error) {
        processing = false;
        finish(error);
      }
    };
    const onEnd = () => {
      if (index !== scanned.entries.length) finish(new Error('ZIP archive changed after pre-scan'));
      else finish();
    };
    zipfile.on('entry', onEntry);
    zipfile.on('end', onEnd);
    zipfile.on('error', onError);
    zipfile.on('close', onClose);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      throwIfAborted(signal);
      zipfile.readEntry();
    } catch (error) {
      finish(error);
    }
  });
}

function createSafeZipExtractor(options = {}) {
  const fsApi = options.fs || defaultFs;
  const yauzlApi = options.yauzl || defaultYauzl;
  if (!fsApi || typeof fsApi.open !== 'function') throw new TypeError('fs is required');
  if (!yauzlApi || typeof yauzlApi.open !== 'function') throw new TypeError('yauzl is required');

  return {
    async extract(archivePath, destination, extractOptions = {}) {
      if (typeof archivePath !== 'string' || !path.isAbsolute(archivePath)
        || typeof destination !== 'string' || !path.isAbsolute(destination)) {
        throw new TypeError('Archive and destination paths must be absolute');
      }
      const limits = boundedLimits(extractOptions.limits);
      const signal = extractOptions.signal;
      let scanZipfile;
      let extractionZipfile;
      let createdDestination = false;
      try {
        throwIfAborted(signal);
        scanZipfile = await openArchive(yauzlApi, archivePath);
        const scanned = await scanArchive(scanZipfile, signal, limits);
        scanZipfile.close();
        scanZipfile = null;
        throwIfAborted(signal);

        await fsApi.mkdir(destination);
        createdDestination = true;
        const progress = { extractedBytes: 0, totalBytes: scanned.totalBytes, onProgress: extractOptions.onProgress };
        if (typeof progress.onProgress === 'function') progress.onProgress({ extractedBytes: 0, totalBytes: scanned.totalBytes });
        extractionZipfile = await openArchive(yauzlApi, archivePath);
        await extractScannedArchive(fsApi, extractionZipfile, scanned, destination, signal, progress);
        throwIfAborted(signal);
        return { entryCount: scanned.entryCount, extractedBytes: progress.extractedBytes };
      } catch (error) {
        if (createdDestination) await fsApi.rm(destination, { recursive: true, force: true }).catch(() => {});
        if ((signal && signal.aborted) || (error && error.name === 'AbortError')) throw abortError();
        throw error;
      } finally {
        if (scanZipfile) scanZipfile.close();
        if (extractionZipfile) extractionZipfile.close();
      }
    },
  };
}

module.exports = { createSafeZipExtractor, validateWindowsZipPath: validateEntryPath };
