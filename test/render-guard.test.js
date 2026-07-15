const test = require('node:test');
const assert = require('node:assert/strict');

const { createRenderGuard } = require('../src/render-guard');

test('a newer page invalidates the previous page token', () => {
  const guard = createRenderGuard();
  const first = guard.begin('1.jpeg');
  const second = guard.begin('2.jpeg');

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('reselecting the same page still invalidates old work', () => {
  const guard = createRenderGuard();
  const first = guard.begin('1.jpeg');
  const second = guard.begin('1.jpeg');

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  assert.deepEqual(guard.current(), second);
  assert.equal(Object.isFrozen(second), true);
});

test('unknown and missing tokens are never current', () => {
  const guard = createRenderGuard();
  guard.begin('1.jpeg');

  assert.equal(guard.isCurrent(null), false);
  assert.equal(guard.isCurrent({ generation: 1, pageKey: 'other.jpeg' }), false);
});
