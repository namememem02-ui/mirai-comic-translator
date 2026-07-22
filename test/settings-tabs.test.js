const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveTabIndex } = require('../src/settings-tabs');

test('arrow keys wrap through Settings categories', () => {
  assert.equal(resolveTabIndex(0, 'ArrowRight', 5), 1);
  assert.equal(resolveTabIndex(4, 'ArrowDown', 5), 0);
  assert.equal(resolveTabIndex(0, 'ArrowLeft', 5), 4);
  assert.equal(resolveTabIndex(2, 'ArrowUp', 5), 1);
});

test('Home and End move to the category boundaries', () => {
  assert.equal(resolveTabIndex(3, 'Home', 5), 0);
  assert.equal(resolveTabIndex(1, 'End', 5), 4);
});

test('unrelated keys and invalid counts keep the current category', () => {
  assert.equal(resolveTabIndex(2, 'Enter', 5), 2);
  assert.equal(resolveTabIndex(2, 'ArrowRight', 0), 2);
});
