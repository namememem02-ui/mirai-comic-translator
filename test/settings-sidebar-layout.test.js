const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');

test('Settings exposes five unique category tabs and matching panels', () => {
  assert.match(html, /class="settings-category-rail"[^>]*role="tablist"/);
  for (const category of ['ai', 'appearance', 'typography', 'retouch', 'updates']) {
    assert.equal((html.match(new RegExp(`data-settings-tab="${category}"`, 'g')) || []).length, 1);
    assert.equal((html.match(new RegExp(`data-settings-panel="${category}"`, 'g')) || []).length, 1);
  }
  assert.match(renderer, /SettingsTabs\.initSettingsTabs\(settingsDialog\)/);
});

test('Settings uses a wide fixed shell with independently scrolling content', () => {
  assert.match(css, /#settingsDialog\s*\{[^}]*width:\s*min\(920px,\s*calc\(100vw - 48px\)\)/s);
  assert.match(css, /#settingsDialog\s*\{[^}]*height:\s*min\(720px,\s*calc\(100vh - 48px\)\)/s);
  assert.match(css, /\.settings-layout\s*\{[^}]*grid-template-columns:\s*190px\s+minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.settings-content\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.settings-footer\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
});

test('all existing Settings controls remain present exactly once', () => {
  for (const id of [
    'settingsApiKeyInput', 'saveApiKeyBtn', 'deleteApiKeyBtn',
    'settingsUiScale', 'settingsFontSizeRange', 'settingsFontSizeAuto',
    'settingsFontFamily', 'settingsAlignLeft', 'settingsAlignCenter',
    'settingsAlignRight', 'settingsInpaintMode', 'checkForUpdatesBtn',
  ]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
});
