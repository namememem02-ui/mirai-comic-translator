const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { validatePathSegment, resolveWithin, isWithin } = require('../lib/safe-paths');

test('accepts Thai Chinese Japanese spaces and ordinary Unicode punctuation', () => {
  for (const name of ['ตอนที่ 1', '第一話', '第１話', 'โปรเจกต์—พิเศษ']) {
    assert.equal(validatePathSegment(name, 'name'), name);
  }
});

test('rejects traversal separators controls trailing Windows dots and device names', () => {
  for (const name of ['', '.', '..', '../escape', 'a/b', 'a\\b', 'bad\0name', 'chapter. ', 'CON', 'LPT1.png']) {
    assert.throws(() => validatePathSegment(name, 'name'), { name: 'Error' }, name);
  }
});

test('resolves only descendants of an absolute root', () => {
  const root = path.resolve('C:\\projects');
  const expected = path.join(root, 'เรื่องไทย', 'ตอน 1');

  assert.equal(resolveWithin(root, 'เรื่องไทย', 'ตอน 1'), expected);
  assert.throws(() => resolveWithin('projects', 'ตอน 1'), /absolute/);
});

test('containment rejects siblings with the same prefix', () => {
  const root = path.resolve('C:\\comic');
  assert.equal(isWithin(root, root), true);
  assert.equal(isWithin(root, path.join(root, 'ตอน 1', 'หน้า 1.png')), true);
  assert.equal(isWithin(root, path.resolve('C:\\comic-evil', 'หน้า 1.png')), false);
});
