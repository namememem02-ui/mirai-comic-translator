const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('uses an in-dialog ZIP name field instead of unsupported window.prompt', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.match(html, /id="facebookArchiveName"/);
  assert.doesNotMatch(script, /\bprompt\s*\(/);
  assert.match(script, /facebookArchiveName\.value/);
});
