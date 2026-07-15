const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWatermarkStore } = require('../lib/watermark-store');

test('imports, replaces, loads, saves, and removes only managed watermark files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'comic-watermark-'));
  const projects = path.join(temp, 'projects');
  const sourcePng = path.join(temp, 'logo.png');
  const sourceWebp = path.join(temp, 'logo.webp');
  fs.writeFileSync(sourcePng, 'png');
  fs.writeFileSync(sourceWebp, 'webp');
  const store = createWatermarkStore(projects);

  const first = store.importAsset('Comic', '01', sourcePng);
  assert.equal(first.settings.imageFile, '_watermark.png');
  assert.equal(fs.existsSync(first.absolutePath), true);
  store.saveSettings('Comic', '01', { ...first.settings, opacity: 0.6, enabled: true });
  assert.equal(store.load('Comic', '01').settings.opacity, 0.6);

  const second = store.importAsset('Comic', '01', sourceWebp);
  assert.equal(second.settings.imageFile, '_watermark.webp');
  assert.equal(fs.existsSync(path.join(projects, 'Comic', '01', '_watermark.png')), false);

  store.remove('Comic', '01');
  assert.equal(store.load('Comic', '01').exists, false);
  assert.equal(fs.existsSync(sourcePng), true);
  assert.equal(fs.existsSync(sourceWebp), true);
});

test('rejects unsupported assets and unsafe path segments', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'comic-watermark-'));
  const source = path.join(temp, 'logo.gif');
  fs.writeFileSync(source, 'gif');
  const store = createWatermarkStore(path.join(temp, 'projects'));
  assert.throws(() => store.importAsset('Comic', '01', source), /PNG|JPG|WebP/);
  assert.throws(() => store.load('..', '01'), /project/i);
});
