const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');

const { createLamaComponentInstaller } = require('../lib/lama-component-installer');

const OLD_HASH = '0'.repeat(64);

async function zipFixture(overrides = {}) {
  const descriptor = {
    schema: 1,
    backend: 'cpu',
    version: '1.0.0',
    minAppVersion: '0.1.0',
    files: {
      python: 'runtime/python.exe',
      server: 'sidecar/inpaint_server.py',
      model: 'models/big-lama.pt',
    },
    ...overrides.descriptor,
  };
  const zip = new JSZip();
  zip.file('component.json', JSON.stringify(descriptor));
  zip.file('runtime/python.exe', overrides.python || 'python');
  zip.file('sidecar/inpaint_server.py', overrides.server || 'server');
  zip.file('models/big-lama.pt', overrides.model || 'model');
  if (overrides.extra) {
    for (const [name, value] of Object.entries(overrides.extra)) zip.file(name, value);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function packageFor(buffer, overrides = {}) {
  return {
    backend: 'cpu',
    version: '1.0.0',
    url: 'https://updates.example.test/lama-cpu-1.0.0.zip',
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    minAppVersion: '0.1.0',
    archive: 'zip',
    ...overrides,
  };
}

function responseFor(buffer, options = {}) {
  const headers = new Headers();
  if (options.contentLength !== null) {
    headers.set('content-length', String(options.contentLength ?? buffer.length));
  }
  return new Response(buffer, { status: options.status || 200, headers });
}

async function tempRoot(t) {
  const parent = await fsp.mkdtemp(path.join(os.tmpdir(), 'lama-installer-'));
  const root = path.join(parent, 'components', 'lama');
  await fsp.mkdir(root, { recursive: true });
  t.after(() => fsp.rm(parent, { recursive: true, force: true }));
  return root;
}

function installerFor(buffer, overrides = {}) {
  const probes = [];
  const installer = createLamaComponentInstaller({
    fetch: async () => responseFor(buffer),
    fs: fsp,
    now: () => '2026-07-22T10:00:00.000Z',
    freeDisk: async () => Number.MAX_SAFE_INTEGER,
    probe: async (candidate) => {
      probes.push({
        ...candidate,
        pythonExistsDuringProbe: fs.existsSync(candidate.pythonPath),
        modelExistsDuringProbe: fs.existsSync(candidate.modelPath),
      });
      return { healthy: true };
    },
    ...overrides,
  });
  return { installer, probes };
}

async function seedActive(root, entries) {
  for (const [backend, entry] of Object.entries(entries)) {
    const directory = path.join(root, backend, entry.version);
    await fsp.mkdir(directory, { recursive: true });
    await fsp.writeFile(path.join(directory, 'marker.txt'), entry.marker || 'healthy-old', 'utf8');
  }
  await fsp.writeFile(path.join(root, 'active.json'), `${JSON.stringify({
    schema: 1,
    components: Object.fromEntries(Object.entries(entries).map(([backend, entry]) => [backend, {
      backend,
      version: entry.version,
      sha256: entry.sha256 || OLD_HASH,
      installedAt: '2026-01-01T00:00:00.000Z',
    }])),
  }, null, 2)}\n`, 'utf8');
}

async function partialFiles(root) {
  const names = [];
  async function walk(directory) {
    let entries = [];
    try { entries = await fsp.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.includes('.staging-') || entry.name.includes('.backup-')) names.push(child);
        await walk(child);
      }
      else if (entry.name.endsWith('.partial') || entry.name.includes('.staging-')) names.push(child);
    }
  }
  await walk(root);
  return names;
}

test('streams download bytes to a verified file and reports bounded progress', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const chunks = [buffer.subarray(0, 7), buffer.subarray(7)];
  const progress = [];
  const fetch = async () => new Response(new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  }), { headers: { 'content-length': String(buffer.length) } });
  const { installer } = installerFor(buffer, { fetch });

  const downloaded = await installer.download(pkg, { root }, undefined, (event) => progress.push(event));

  assert.equal(await fsp.readFile(downloaded, 'hex'), buffer.toString('hex'));
  assert.deepEqual(progress, [
    { receivedBytes: 0, totalBytes: buffer.length },
    { receivedBytes: 7, totalBytes: buffer.length },
    { receivedBytes: buffer.length, totalBytes: buffer.length },
  ]);
  assert.equal((await partialFiles(root)).length, 0);
});

test('cancellation removes the partial download', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const controller = new AbortController();
  const chunks = [buffer.subarray(0, 7), buffer.subarray(7)];
  const fetch = async () => new Response(new ReadableStream({
    pull(stream) {
      const chunk = chunks.shift();
      if (chunk) stream.enqueue(chunk);
      else stream.close();
    },
  }), { headers: { 'content-length': String(buffer.length) } });
  const { installer } = installerFor(buffer, { fetch });

  await assert.rejects(
    installer.download(pkg, { root }, controller.signal, ({ receivedBytes }) => {
      if (receivedBytes > 0) controller.abort();
    }),
    (error) => error && error.name === 'AbortError',
  );
  assert.equal((await partialFiles(root)).length, 0);
});

test('rejects content-length mismatch and oversized streams without leaving files', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);

  const mismatch = installerFor(buffer, {
    fetch: async () => responseFor(buffer, { contentLength: buffer.length - 1 }),
  }).installer;
  await assert.rejects(mismatch.download(pkg, { root }), /content-length/i);

  const oversized = installerFor(buffer, {
    fetch: async () => responseFor(Buffer.concat([buffer, Buffer.from('extra')]), { contentLength: null }),
  }).installer;
  await assert.rejects(oversized.download(pkg, { root }), /size/i);
  assert.equal((await partialFiles(root)).length, 0);
});

test('rejects a package fetch that redirects from HTTPS to plaintext HTTP', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const downgraded = responseFor(buffer);
  Object.defineProperty(downgraded, 'url', { value: 'http://cdn.example.test/lama.zip' });
  const { installer } = installerFor(buffer, { fetch: async () => downgraded });

  await assert.rejects(installer.download(pkg, { root }), /https/i);
  assert.equal((await partialFiles(root)).length, 0);
});

test('checks free disk before download and again before extraction', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  let fetched = false;
  const beforeDownload = installerFor(buffer, {
    fetch: async () => { fetched = true; return responseFor(buffer); },
    freeDisk: async () => pkg.bytes - 1,
  }).installer;
  await assert.rejects(beforeDownload.download(pkg, { root }), /disk space/i);
  assert.equal(fetched, false);

  let checks = 0;
  const beforeExtract = installerFor(buffer, {
    freeDisk: async () => (++checks === 1 ? Number.MAX_SAFE_INTEGER : 0),
  }).installer;
  await assert.rejects(beforeExtract.install(pkg, { root }), /disk space/i);
  assert.equal(checks, 2);
});

test('checksum failure never replaces the active component', async (t) => {
  const root = await tempRoot(t);
  await seedActive(root, { cpu: { version: '0.9.0' } });
  const buffer = await zipFixture();
  const pkg = packageFor(buffer, { sha256: '1'.repeat(64) });
  const { installer } = installerFor(buffer);

  await assert.rejects(installer.install(pkg, { root }), /checksum/i);

  assert.equal((await installer.inspect('cpu', { root })).version, '0.9.0');
  assert.equal(await fsp.readFile(path.join(root, 'cpu', '0.9.0', 'marker.txt'), 'utf8'), 'healthy-old');
  assert.equal((await partialFiles(root)).length, 0);
});

function maliciousExtractor(entries) {
  return async (_archive, options) => {
    for (const entry of entries) await options.onEntry(entry);
  };
}

test('rejects traversal, absolute, symlink, duplicate, and special archive entries', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const cases = [
    { label: 'traversal', entries: [{ fileName: '../escape.txt', uncompressedSize: 1, externalFileAttributes: 0 }] },
    { label: 'absolute', entries: [{ fileName: 'C:\\escape.txt', uncompressedSize: 1, externalFileAttributes: 0 }] },
    { label: 'symlink', entries: [{ fileName: 'link', uncompressedSize: 1, externalFileAttributes: 0o120777 << 16 }] },
    { label: 'duplicate', entries: [
      { fileName: 'Models/model.bin', uncompressedSize: 1, externalFileAttributes: 0 },
      { fileName: 'models/model.bin', uncompressedSize: 1, externalFileAttributes: 0 },
    ] },
    { label: 'special', entries: [{ fileName: 'pipe', uncompressedSize: 1, externalFileAttributes: 0o010777 << 16 }] },
  ];

  for (const scenario of cases) {
    const { installer } = installerFor(buffer, { extract: maliciousExtractor(scenario.entries) });
    await assert.rejects(installer.install(pkg, { root }), new RegExp(scenario.label, 'i'));
    assert.equal((await partialFiles(root)).length, 0);
  }
});

test('rejects archives over entry-count and extracted-size limits', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);

  const tooMany = installerFor(buffer, {
    extract: maliciousExtractor([
      { fileName: 'one', uncompressedSize: 1, externalFileAttributes: 0 },
      { fileName: 'two', uncompressedSize: 1, externalFileAttributes: 0 },
      { fileName: 'three', uncompressedSize: 1, externalFileAttributes: 0 },
    ]),
    limits: { maxEntries: 2, maxExtractedBytes: 100 },
  }).installer;
  await assert.rejects(tooMany.install(pkg, { root }), /entry count/i);

  const tooLarge = installerFor(buffer, {
    extract: maliciousExtractor([
      { fileName: 'huge', uncompressedSize: 101, externalFileAttributes: 0 },
    ]),
    limits: { maxEntries: 10, maxExtractedBytes: 100 },
  }).installer;
  await assert.rejects(tooLarge.install(pkg, { root }), /extracted size/i);
});

test('failed health probe rolls back without replacing a healthy active component', async (t) => {
  const root = await tempRoot(t);
  await seedActive(root, { cpu: { version: '0.9.0' } });
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const { installer } = installerFor(buffer, {
    probe: async () => { throw new Error('startup probe failed'); },
  });

  await assert.rejects(installer.install(pkg, { root }), /probe/i);

  assert.equal((await installer.inspect('cpu', { root })).version, '0.9.0');
  assert.equal(await fsp.readFile(path.join(root, 'cpu', '0.9.0', 'marker.txt'), 'utf8'), 'healthy-old');
  assert.equal(fs.existsSync(path.join(root, 'cpu', '1.0.0')), false);
  assert.equal((await partialFiles(root)).length, 0);
});

test('requires an explicit healthy result from the component probe', async (t) => {
  const root = await tempRoot(t);
  await seedActive(root, { cpu: { version: '0.9.0' } });
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const { installer } = installerFor(buffer, { probe: async () => undefined });

  await assert.rejects(installer.install(pkg, { root }), /probe/i);

  assert.equal((await installer.inspect('cpu', { root })).version, '0.9.0');
  assert.equal(fs.existsSync(path.join(root, 'cpu', '1.0.0')), false);
});

test('validates layout, probes the staged component, then atomically activates metadata', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const { installer, probes } = installerFor(buffer);

  const installed = await installer.install(pkg, { root });

  assert.equal(installed.backend, 'cpu');
  assert.equal(installed.version, '1.0.0');
  assert.equal(probes.length, 1);
  assert.equal(probes[0].backend, 'cpu');
  assert.match(probes[0].pythonPath, /runtime[\\/]python\.exe$/);
  assert.equal(probes[0].pythonExistsDuringProbe, true);
  assert.equal(probes[0].modelExistsDuringProbe, true);
  assert.deepEqual(JSON.parse(await fsp.readFile(path.join(root, 'active.json'), 'utf8')), {
    schema: 1,
    components: {
      cpu: {
        backend: 'cpu', version: '1.0.0', sha256: pkg.sha256,
        installedAt: '2026-07-22T10:00:00.000Z',
      },
    },
  });
  assert.equal((await partialFiles(root)).length, 0);
});

test('repair replaces only the selected verified version after its probe succeeds', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture({ python: 'replacement-python' });
  const pkg = packageFor(buffer);
  await seedActive(root, {
    cpu: { version: '1.0.0', marker: 'old-cpu' },
    nvidia: { version: '2.0.0', marker: 'healthy-gpu' },
  });
  const { installer } = installerFor(buffer);

  await installer.install(pkg, { root });

  assert.equal(await fsp.readFile(path.join(root, 'cpu', '1.0.0', 'runtime', 'python.exe'), 'utf8'), 'replacement-python');
  assert.equal(await fsp.readFile(path.join(root, 'nvidia', '2.0.0', 'marker.txt'), 'utf8'), 'healthy-gpu');
  assert.equal((await installer.inspect('nvidia', { root })).version, '2.0.0');
});

test('backend-scoped removal preserves the other managed backend and metadata', async (t) => {
  const root = await tempRoot(t);
  await seedActive(root, {
    cpu: { version: '1.0.0', marker: 'cpu' },
    nvidia: { version: '2.0.0', marker: 'gpu' },
  });
  const buffer = await zipFixture();
  const { installer } = installerFor(buffer);

  await installer.remove('cpu', { root });

  assert.equal(fs.existsSync(path.join(root, 'cpu')), false);
  assert.equal(await fsp.readFile(path.join(root, 'nvidia', '2.0.0', 'marker.txt'), 'utf8'), 'gpu');
  assert.equal(await installer.inspect('cpu', { root }), null);
  assert.equal((await installer.inspect('nvidia', { root })).version, '2.0.0');
  assert.deepEqual(Object.keys(JSON.parse(await fsp.readFile(path.join(root, 'active.json'), 'utf8')).components), ['nvidia']);
});

test('rejects an unsafe component descriptor before probing or activation', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture({
    descriptor: { files: { python: '../outside.exe', server: 'sidecar/inpaint_server.py', model: 'models/big-lama.pt' } },
  });
  const pkg = packageFor(buffer);
  const { installer, probes } = installerFor(buffer);

  await assert.rejects(installer.install(pkg, { root }), /component layout/i);
  assert.equal(probes.length, 0);
  assert.equal((await partialFiles(root)).length, 0);
});

test('rejects component compatibility metadata that differs from the package manifest', async (t) => {
  const root = await tempRoot(t);
  const buffer = await zipFixture({ descriptor: { minAppVersion: '9.9.9' } });
  const pkg = packageFor(buffer);
  const { installer, probes } = installerFor(buffer);

  await assert.rejects(installer.install(pkg, { root }), /component layout/i);
  assert.equal(probes.length, 0);
  assert.equal(await installer.inspect('cpu', { root }), null);
});

test('refuses managed-directory symlink redirects outside the trusted root', async (t) => {
  const root = await tempRoot(t);
  const outside = path.join(path.dirname(path.dirname(root)), 'outside');
  await fsp.mkdir(outside, { recursive: true });
  const buffer = await zipFixture();
  const pkg = packageFor(buffer);
  const { installer } = installerFor(buffer);
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';

  await fsp.symlink(outside, path.join(root, 'downloads'), linkType);
  await assert.rejects(installer.download(pkg, { root }), /symbolic link/i);
  assert.deepEqual(await fsp.readdir(outside), []);

  await fsp.rm(path.join(root, 'downloads'), { force: true });
  await fsp.symlink(outside, path.join(root, 'cpu'), linkType);
  await assert.rejects(installer.install(pkg, { root }), /symbolic link/i);
  assert.equal(fs.existsSync(path.join(outside, '1.0.0')), false);
});
