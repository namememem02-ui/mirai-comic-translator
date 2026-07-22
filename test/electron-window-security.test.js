const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');

test('registers and serves the secure local asset scheme', () => {
  const registration = main.indexOf('protocol.registerSchemesAsPrivileged');
  assert.ok(registration >= 0 && registration < main.indexOf('app.whenReady()'));
  assert.match(main, /protocol\.handle\('mirai-asset'/);
  assert.match(main, /net\.fetch\(pathToFileURL\(assetPath\)\.toString\(\)\)/);
  assert.match(main, /supportFetchAPI:\s*true,\s*corsEnabled:\s*true/);
});

test('enables Chromium security and denies popup and navigation escape', () => {
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*'deny'/);
  assert.match(main, /will-navigate/);
});

test('document CSP permits only the required image and network sources', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /img-src 'self' data: blob: mirai-asset:/);
  assert.match(html, /connect-src 'self' http:\/\/127\.0\.0\.1:\* https:\/\/generativelanguage\.googleapis\.com/);
  assert.match(html, /connect-src[^";]*mirai-asset:/);
});
