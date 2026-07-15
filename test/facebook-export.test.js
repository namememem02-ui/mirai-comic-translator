const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTargetSliceHeight,
  getSliceRects,
  formatSliceName
} = require('../src/facebook-export');

test('calculates a rounded 4:5 target height', () => {
  assert.equal(getTargetSliceHeight(800), 1000);
  assert.equal(getTargetSliceHeight(801), 1001);
});

test('builds fixed slices and preserves the final remainder', () => {
  assert.deepEqual(getSliceRects(800, 2500), [
    { x: 0, y: 0, width: 800, height: 1000 },
    { x: 0, y: 1000, width: 800, height: 1000 },
    { x: 0, y: 2000, width: 800, height: 500 }
  ]);
});

test('keeps a short page as a single slice', () => {
  assert.deepEqual(getSliceRects(800, 700), [
    { x: 0, y: 0, width: 800, height: 700 }
  ]);
});

test('rejects invalid dimensions and sequence numbers', () => {
  for (const value of [0, -1, NaN, Infinity]) {
    assert.throws(() => getTargetSliceHeight(value), TypeError);
  }
  assert.throws(() => getSliceRects(800, 0), TypeError);
  assert.throws(() => formatSliceName(0), TypeError);
});

test('formats one continuous sequence with at least three digits', () => {
  assert.equal(formatSliceName(1), '001.jpg');
  assert.equal(formatSliceName(999), '999.jpg');
  assert.equal(formatSliceName(1000), '1000.jpg');
});
