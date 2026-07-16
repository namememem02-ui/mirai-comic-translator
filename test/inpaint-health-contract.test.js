const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('sidecar exposes readiness and rejects inpainting before ready', () => {
  const source = read('sidecar/inpaint_server.py');
  assert.match(source, /@app\.get\(["']\/health["']\)/);
  assert.match(source, /status_code\s*=\s*503/);
  assert.match(source, /threading\.Thread/);
});

test('Electron exposes status, retry, broadcasts, and shutdown', () => {
  const main = read('main.js');
  const preload = read('preload.js');
  assert.match(main, /get-inpaint-status/);
  assert.match(main, /retry-inpaint-sidecar/);
  assert.match(main, /inpaint-status-changed/);
  assert.match(main, /inpaintSidecar\.shutdown\(\)/);
  assert.match(preload, /getInpaintStatus/);
  assert.match(preload, /retryInpaintSidecar/);
  assert.match(preload, /onInpaintStatus/);
});
