const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('jszip');

const { createSafeZipExtractor } = require('../lib/safe-zip-extractor');

async function workspace(t) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'safe-zip-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  return root;
}

async function writeZip(root, entries, options = {}) {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.data ?? 'x', {
      createFolders: false,
      unixPermissions: entry.unixPermissions,
      compression: entry.compression,
    });
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    platform: options.platform || 'UNIX',
    compression: options.compression || 'DEFLATE',
  });
  const archive = path.join(root, `fixture-${crypto.randomUUID()}.zip`);
  await fsp.writeFile(archive, buffer);
  return archive;
}

function extractor(options = {}) {
  return createSafeZipExtractor({ fs: fsp, ...options });
}

const LIMITS = {
  maxEntries: 100,
  maxExtractedBytes: 8 * 1024 * 1024,
  maxCompressionRatio: 1000,
  maxPathDepth: 16,
  maxCanonicalPaths: 200,
};

test('pre-scans a real traversal ZIP before creating any destination or escaped path', async (t) => {
  const root = await workspace(t);
  const archive = await writeZip(root, [
    { name: '../escaped/owned.txt', data: 'owned' },
    { name: 'valid/file.txt', data: 'valid' },
  ]);
  const destination = path.join(root, 'staging');

  await assert.rejects(
    extractor().extract(archive, destination, { limits: LIMITS }),
    /relative|traversal|path/i,
  );

  assert.equal(fs.existsSync(destination), false);
  assert.equal(fs.existsSync(path.join(root, 'escaped')), false);
});

test('rejects Windows path aliases and reserved names before extraction', async (t) => {
  const root = await workspace(t);
  const unsafeNames = [
    'folder./file.txt',
    'folder /file.txt',
    'NUL.txt',
    'dir/COM1.log',
    'dir/stream:secret',
    'C:/absolute.txt',
    '//server/share.txt',
    'dir\\backslash.txt',
    'dir//empty.txt',
  ];

  for (const [index, name] of unsafeNames.entries()) {
    const archive = await writeZip(root, [{ name, data: 'unsafe' }]);
    const destination = path.join(root, `staging-${index}`);
    await assert.rejects(extractor().extract(archive, destination, { limits: LIMITS }), /path|name|Windows|absolute|character/i);
    assert.equal(fs.existsSync(destination), false, name);
  }
});

test('rejects canonical duplicates, file-directory conflicts, symlinks, and special entries', async (t) => {
  const root = await workspace(t);
  const cases = [
    [
      { name: 'Models/model.bin', data: 'one' },
      { name: 'models/MODEL.bin', data: 'two' },
    ],
    [
      { name: 'runtime', data: 'file' },
      { name: 'runtime/python.exe', data: 'child' },
    ],
    [{ name: 'link', data: 'target', unixPermissions: 0o120777 }],
    [{ name: 'pipe', data: 'target', unixPermissions: 0o010777 }],
  ];

  for (const [index, entries] of cases.entries()) {
    const archive = await writeZip(root, entries);
    const destination = path.join(root, `staging-${index}`);
    await assert.rejects(extractor().extract(archive, destination, { limits: LIMITS }), /duplicate|alias|conflict|symlink|special|type/i);
    assert.equal(fs.existsSync(destination), false);
  }
});

test('pre-scan enforces entry-count, total-size, and compression-ratio limits', async (t) => {
  const root = await workspace(t);
  const countArchive = await writeZip(root, [
    { name: 'one.txt' }, { name: 'two.txt' }, { name: 'three.txt' },
  ]);
  await assert.rejects(extractor().extract(countArchive, path.join(root, 'count'), {
    limits: { ...LIMITS, maxEntries: 2 },
  }), /entry count/i);

  const sizeArchive = await writeZip(root, [{ name: 'large.bin', data: Buffer.alloc(101) }], { compression: 'STORE' });
  await assert.rejects(extractor().extract(sizeArchive, path.join(root, 'size'), {
    limits: { ...LIMITS, maxExtractedBytes: 100 },
  }), /size/i);

  const ratioArchive = await writeZip(root, [{ name: 'compressed.bin', data: Buffer.alloc(4096) }]);
  await assert.rejects(extractor().extract(ratioArchive, path.join(root, 'ratio'), {
    limits: { ...LIMITS, maxCompressionRatio: 2 },
  }), /compression ratio/i);
});

test('pre-scan bounds path depth and unique implicit parents before creating staging', async (t) => {
  const root = await workspace(t);
  const deepArchive = await writeZip(root, [{
    name: `${Array.from({ length: 5 }, (_, index) => `level-${index}`).join('/')}/file.txt`,
    data: 'deep',
  }]);
  const deepDestination = path.join(root, 'deep-staging');

  await assert.rejects(extractor().extract(deepArchive, deepDestination, {
    limits: { ...LIMITS, maxPathDepth: 4 },
  }), /path depth/i);
  assert.equal(fs.existsSync(deepDestination), false);

  const parentArchive = await writeZip(root, Array.from({ length: 3 }, (_, index) => ({
    name: `unique-${index}/nested-${index}/file.txt`,
    data: String(index),
  })));
  const parentDestination = path.join(root, 'parent-staging');

  await assert.rejects(extractor().extract(parentArchive, parentDestination, {
    limits: { ...LIMITS, maxCanonicalPaths: 8 },
  }), /canonical path/i);
  assert.equal(fs.existsSync(parentDestination), false);
});

test('cooperatively aborts a real file stream and removes staging', async (t) => {
  const root = await workspace(t);
  const archive = await writeZip(root, [{
    name: 'large.bin',
    data: crypto.randomBytes(2 * 1024 * 1024),
    compression: 'STORE',
  }], { compression: 'STORE' });
  const destination = path.join(root, 'staging');
  const controller = new AbortController();
  let progressEvents = 0;

  await assert.rejects(extractor().extract(archive, destination, {
    limits: LIMITS,
    signal: controller.signal,
    onProgress(event) {
      progressEvents += 1;
      if (event.extractedBytes > 0) controller.abort();
    },
  }), (error) => error && error.name === 'AbortError');

  assert.ok(progressEvents > 0);
  assert.equal(fs.existsSync(destination), false);
});

test('extracts a fully pre-scanned real archive with exact file contents', async (t) => {
  const root = await workspace(t);
  const archive = await writeZip(root, [
    { name: 'runtime/python.exe', data: 'python' },
    { name: 'models/big-lama.pt', data: 'model' },
  ]);
  const destination = path.join(root, 'staging');

  const result = await extractor().extract(archive, destination, { limits: LIMITS });

  assert.equal(result.entryCount, 2);
  assert.equal(await fsp.readFile(path.join(destination, 'runtime', 'python.exe'), 'utf8'), 'python');
  assert.equal(await fsp.readFile(path.join(destination, 'models', 'big-lama.pt'), 'utf8'), 'model');
});

test('completes a multi-chunk stored entry after the central-directory pre-scan', async (t) => {
  const root = await workspace(t);
  const payload = crypto.randomBytes(256 * 1024);
  const archive = await writeZip(root, [{ name: 'large.bin', data: payload, compression: 'STORE' }], { compression: 'STORE' });
  const destination = path.join(root, 'staging');

  await extractor().extract(archive, destination, { limits: LIMITS });

  assert.deepEqual(await fsp.readFile(path.join(destination, 'large.bin')), payload);
});

test('completes a multi-chunk stored string followed by later archive entries', async (t) => {
  const root = await workspace(t);
  const payload = 'x'.repeat(65 * 1024);
  const archive = await writeZip(root, [
    { name: 'component.json', data: payload, compression: 'STORE' },
    { name: 'runtime/python.exe', data: 'python', compression: 'STORE' },
  ], { compression: 'STORE' });
  const destination = path.join(root, 'staging');

  await extractor().extract(archive, destination, { limits: LIMITS });

  assert.equal(await fsp.readFile(path.join(destination, 'component.json'), 'utf8'), payload);
});
