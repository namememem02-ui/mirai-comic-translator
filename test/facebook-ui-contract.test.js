const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('uses an in-dialog ZIP name field instead of unsupported window.prompt', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.match(html, /id="facebookArchiveName"/);
  assert.match(html, /id="facebookMaxImages"/);
  for (const value of ['11', '22', '33', '44']) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(html, /value="33" selected/);
  assert.doesNotMatch(html, /4:5/);
  assert.doesNotMatch(script, /\bprompt\s*\(/);
  assert.match(script, /facebookArchiveName\.value/);
  assert.match(script, /allocateSliceCounts/);
});
