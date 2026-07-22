const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveProjectChapter } = require('../lib/safe-paths');

test('preserves Unicode project names and recognizes a numeric chapter suffix', () => {
  assert.deepEqual(deriveProjectChapter('เรื่องไทย_12'), { project: 'เรื่องไทย', chapter: '12' });
  assert.deepEqual(deriveProjectChapter('漫画'), { project: '漫画', chapter: '01' });
});

test('falls back safely for invalid or reserved folder names', () => {
  assert.deepEqual(deriveProjectChapter('CON'), { project: 'default', chapter: '01' });
  assert.deepEqual(deriveProjectChapter('..'), { project: 'default', chapter: '01' });
});
