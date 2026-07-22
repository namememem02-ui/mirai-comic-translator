const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');

test('index.html includes header badge and LaMa component settings container', () => {
  assert.ok(htmlSource.includes('id="lama-header-badge"'), 'index.html missing #lama-header-badge');
  assert.ok(htmlSource.includes('id="lama-settings-panel"'), 'index.html missing #lama-settings-panel');
});
