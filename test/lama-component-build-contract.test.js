const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lockSource = fs.readFileSync(path.join(__dirname, '..', 'sidecar', 'requirements-cpu.lock'), 'utf8');
const templateSource = fs.readFileSync(path.join(__dirname, '..', 'component', 'lama', 'component.template.json'), 'utf8');

test('requirements-cpu.lock specifies CPU-only PyTorch index and locked versions', () => {
  assert.match(lockSource, /download\.pytorch\.org\/whl\/cpu/);
  assert.match(lockSource, /torch==2\.1\.2\+cpu/);
  assert.match(lockSource, /simple-lama-inpainting==0\.1\.2/);
});

test('component.template.json conforms to schema 1 and CPU launch descriptor', () => {
  const template = JSON.parse(templateSource);
  assert.equal(template.schema, 1);
  assert.equal(template.id, 'lama');
  assert.equal(template.backend, 'cpu');
  assert.equal(template.version, '1.0.0');
  assert.ok(template.launch.python);
  assert.ok(template.launch.server);
  assert.ok(template.launch.model);
});

test('write-lama-manifest calculates SHA-256 and HTTPS download URL', () => {
  const { buildManifest } = require('../scripts/write-lama-manifest');
  const tempZip = path.join(__dirname, '..', 'test', 'fixtures', 'fake-lama-cpu.zip');
  fs.mkdirSync(path.dirname(tempZip), { recursive: true });
  fs.writeFileSync(tempZip, 'fake-zip-contents-for-testing', 'utf8');

  try {
    const manifest = buildManifest(tempZip, { version: '1.0.0' });
    assert.equal(manifest.schema, 1);
    assert.equal(manifest.packages.length, 1);
    assert.equal(manifest.packages[0].backend, 'cpu');
    assert.equal(manifest.packages[0].version, '1.0.0');
    assert.match(manifest.packages[0].url, /^https:\/\//);
    assert.match(manifest.packages[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.packages[0].size, Buffer.from('fake-zip-contents-for-testing').length);
  } finally {
    try { fs.unlinkSync(tempZip); } catch {}
  }
});
