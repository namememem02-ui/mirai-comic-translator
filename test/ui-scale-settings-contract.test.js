const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('settings expose, preview, save, and roll back UI scale', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.match(html, /id="settingsUiScale"/);
  for (const value of ['100', '115', '130']) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(script, /uiScale:\s*115/);
  assert.match(script, /UiScale\.applyUiScale/);
  assert.match(script, /settingsUiScale\.addEventListener\('change'/);
  assert.match(script, /restoreSavedUiScale/);
});
