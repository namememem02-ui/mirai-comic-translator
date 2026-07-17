const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');

test('chapter review shows each source image before AI composition finishes', () => {
  assert.match(source, /sourcePreview\.className = 'review-source-preview'/);
  assert.match(source, /sourcePreview\.src = images\[index\]\.fileUrl/);
  assert.match(source, /sourcePreview\.addEventListener\('load',[\s\S]{0,300}page\.style\.aspectRatio/);
  assert.match(source, /page\.append\(name, sourcePreview, state\)/);
});

test('completed review replaces the temporary source preview', () => {
  assert.match(source, /pageElement\.querySelector\('\.review-source-preview'\)\?\.remove\(\)/);
});
