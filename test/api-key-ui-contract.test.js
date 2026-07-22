const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');

test('preload exposes only argument-free key deletion', () => {
  assert.match(
    preload,
    /deleteApiKey:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('delete-api-key'\)/,
  );
});

test('settings provide one explicit API key delete action', () => {
  assert.equal((html.match(/id="deleteApiKeyBtn"/g) || []).length, 1);
  assert.match(html, /id="deleteApiKeyBtn"[^>]*>[\s\S]*?ลบ API Key/);
});

test('renderer refreshes stored-key status from safe main-process metadata', () => {
  assert.match(renderer, /async function refreshApiKeyStatus\(\)/);
  assert.match(renderer, /refreshApiKeyStatus[\s\S]*?window\.api\.getConfig\(\)/);
  assert.doesNotMatch(renderer, /\bkey\.slice\(/);
});

test('save and delete clear input then refresh metadata', () => {
  const saveStart = renderer.indexOf("saveApiKeyBtn.addEventListener('click'");
  const deleteStart = renderer.indexOf("deleteApiKeyBtn.addEventListener('click'");
  const saveHandler = renderer.slice(saveStart, deleteStart);
  const deleteHandler = renderer.slice(deleteStart, renderer.indexOf('// Font Size', deleteStart));

  assert.notEqual(saveStart, -1);
  assert.notEqual(deleteStart, -1);
  assert.match(saveHandler, /settingsApiKeyInput\.value\s*=\s*''/);
  assert.match(saveHandler, /await refreshApiKeyStatus\(\)/);
  assert.match(deleteHandler, /settingsApiKeyInput\.value\s*=\s*''/);
  assert.match(deleteHandler, /await refreshApiKeyStatus\(\)/);
});
