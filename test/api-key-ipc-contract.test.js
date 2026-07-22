const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('main process owns safeStorage and the secure API key store', () => {
  assert.match(mainSource, /safeStorage/);
  assert.match(mainSource, /createSecureApiKeyStore/);
  assert.match(mainSource, /const apiKeyStore\s*=\s*createSecureApiKeyStore/);
});

test('get-config returns only safe API key metadata', () => {
  const start = mainSource.indexOf("ipcMain.handle('get-config'");
  const end = mainSource.indexOf("ipcMain.handle('read-folder'", start);
  const handler = mainSource.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(handler, /apiKeyStore\.getMetadata\(\)/);
  assert.doesNotMatch(handler, /\bapiKey\s*:/);
  assert.doesNotMatch(handler, /cfg\.apiKey/);
});

test('translation reads the stored key only in the main process', () => {
  const start = mainSource.indexOf('async function requestGeminiTranslation');
  const end = mainSource.indexOf("ipcMain.handle('translate-page'", start);
  const helper = mainSource.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(helper, /apiKeyStore\.getKey\(\)/);
  assert.doesNotMatch(helper, /loadSharedConfig\(\)/);
});

test('save and delete IPC handlers delegate to the secure store', () => {
  assert.match(mainSource, /ipcMain\.handle\('save-api-key'[\s\S]*?apiKeyStore\.saveKey\(apiKey\)/);
  assert.match(mainSource, /ipcMain\.handle\('delete-api-key'[\s\S]*?apiKeyStore\.deleteKey\(\)/);
});
