const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'sidecar', 'inpaint_server.py'),
  'utf8'
);

test('LaMa processes the complete image and mask without patch cropping', () => {
  assert.match(source, /result_pil\s*=\s*lama\(img_pil,\s*mask_pil\)/);
  assert.doesNotMatch(source, /findContours|boundingRect|crop_img|crop_mask|result_np\[y1:y2/);
});

test('sidecar reads LAMA_BACKEND, LAMA_MODEL, and LAMA_VERSION from environment', () => {
  assert.match(source, /os\.environ\.get\(['"]LAMA_BACKEND['"]/);
  assert.match(source, /os\.environ\.get\(['"]LAMA_MODEL['"]/);
  assert.match(source, /os\.environ\.get\(['"]LAMA_VERSION['"]/);
});

test('health endpoint includes backend, componentVersion, errorCode, and message', () => {
  assert.match(source, /@app\.get\(["']\/health["']\)/);
  assert.match(source, /"backend":\s*backend/);
  assert.match(source, /"componentVersion":\s*component_version/);
  assert.match(source, /"errorCode":\s*error_code/);
});

test('sidecar maps CUDA and model loading errors to stable error codes', () => {
  assert.match(source, /cuda-unavailable/);
  assert.match(source, /cuda-out-of-memory|out of memory/i);
  assert.match(source, /driver-too-old/);
  assert.match(source, /model-missing/);
  assert.match(source, /startup-failed/);
});

