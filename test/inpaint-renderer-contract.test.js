const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

test('renderer exposes LaMa status and retry controls', () => {
  assert.match(html, /id="inpaintStatus"/);
  assert.match(html, /id="retryInpaintBtn"/);
  assert.match(script, /getInpaintStatus/);
  assert.match(script, /onInpaintStatus/);
  assert.match(script, /retryInpaintSidecar/);
});

test('automatic rendering never calls blocky smooth erase fallback', () => {
  const calls = script.match(/drawSmoothErase\s*\(/g) || [];
  assert.equal(calls.length, 1, 'drawSmoothErase should remain defined but never called automatically');
  assert.doesNotMatch(script, /Falling back to smooth/);
});
