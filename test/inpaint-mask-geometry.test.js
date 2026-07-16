const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMaskRect } = require('../src/inpaint-mask-geometry');

test('Tight Fit expands the OCR box by three percent', () => {
  assert.deepEqual(calculateMaskRect({ x: 100, y: 100, width: 200, height: 100, imageWidth: 1000, imageHeight: 1000, mode: 'tight' }),
    { x: 94, y: 97, width: 212, height: 106 });
});

test('Tight Fit uses at least two pixels and clamps to image edges', () => {
  assert.deepEqual(calculateMaskRect({ x: 0, y: 0, width: 20, height: 20, imageWidth: 100, imageHeight: 100, mode: 'tight' }),
    { x: 0, y: 0, width: 22, height: 22 });
});

test('Full Box preserves its existing padding calculation', () => {
  assert.deepEqual(calculateMaskRect({ x: 100, y: 100, width: 200, height: 100, imageWidth: 1000, imageHeight: 1000, mode: 'full' }),
    { x: 92, y: 88, width: 216, height: 124 });
});
