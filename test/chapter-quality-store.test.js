const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createChapterQualityStore } = require('../lib/chapter-quality-store');

test('saves normalized exclusions and removes stale page names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-quality-'));
  const store = createChapterQualityStore(root);
  const saved = store.save('Book', '01', ['1.jpg', '2.jpg'], ['2.jpg', '2.jpg', 'gone.jpg']);
  assert.deepEqual(saved, { schemaVersion: 1, excludedPages: ['2.jpg'] });
  assert.deepEqual(store.load('Book', '01', ['1.jpg', '2.jpg']), saved);
});

test('rejects unsafe project and chapter path segments', () => {
  const store = createChapterQualityStore(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-quality-')));
  assert.throws(() => store.load('../Book', '01', []), /unsafe/i);
  assert.throws(() => store.save('Book', '..\\01', [], []), /unsafe/i);
});
