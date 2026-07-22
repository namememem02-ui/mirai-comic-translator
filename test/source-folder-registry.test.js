const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createSourceFolderRegistry } = require('../lib/source-folder-registry');

test('authorizes an exact root and its descendants only', () => {
  const root = path.resolve('C:\\Comics', 'เรื่องไทย');
  const registry = createSourceFolderRegistry({ initialRoots: [root] });

  assert.equal(registry.isAuthorized(root), true);
  assert.equal(registry.isAuthorized(path.join(root, 'ตอน 1', '001.png')), true);
  assert.equal(registry.isAuthorized(path.resolve('C:\\Comics', 'เรื่องไทย-evil', '001.png')), false);
});

test('rejects relative roots and ignores duplicate authorization', () => {
  const root = path.resolve('C:\\Comics', '第一話');
  const registry = createSourceFolderRegistry();

  assert.throws(() => registry.authorize('relative-folder'), /absolute/);
  assert.equal(registry.authorize(root), root);
  assert.equal(registry.authorize(root.toUpperCase()), root);
  assert.deepEqual(registry.listRoots(), [root]);
});

test('returns a copy of roots instead of mutable internal state', () => {
  const root = path.resolve('C:\\Comics');
  const registry = createSourceFolderRegistry({ initialRoots: [root] });
  const roots = registry.listRoots();
  roots.length = 0;
  assert.equal(registry.isAuthorized(path.join(root, '001.png')), true);
});
