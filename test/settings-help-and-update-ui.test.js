const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

test('Settings explains how to create a Gemini API key', () => {
  assert.match(html, /id="openGeminiApiKeyPageBtn"/);
  assert.match(html, /ยังไม่มี Key\? สร้างฟรี 1 นาที/);
  assert.match(html, /Create API key/);
  assert.match(html, /คีย์จะเก็บอย่างปลอดภัยในเครื่องนี้เท่านั้น/);
});

test('Gemini setup opens only the fixed Google AI Studio page through main', () => {
  assert.match(preload, /openGeminiApiKeyPage:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-gemini-api-key-page'\)/);
  assert.match(renderer, /openGeminiApiKeyPageBtn\.addEventListener\('click'/);
  assert.match(main, /const GEMINI_API_KEY_URL = 'https:\/\/aistudio\.google\.com\/apikey'/);
  assert.match(main, /ipcMain\.handle\('open-gemini-api-key-page'[\s\S]*shell\.openExternal\(GEMINI_API_KEY_URL\)/);
  assert.doesNotMatch(preload, /openExternal:\s*\([^)]*url/);
});
