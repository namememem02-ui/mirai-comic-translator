const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, calculateRect, dragToNormalized } = require('../src/watermark-geometry');

test('normalizes defaults and clamps watermark settings', () => {
  assert.deepEqual(normalizeSettings({ x: 2, y: -1, widthRatio: 0.9, opacity: -2 }), {
    enabled: false, imageFile: '', x: 1, y: 0, widthRatio: 0.5, opacity: 0,
  });
});

test('calculates an aspect-preserving rectangle and keeps it on page', () => {
  assert.deepEqual(
    calculateRect({ x: 1, y: 1, widthRatio: 0.2 }, 1000, 2000, 400, 200),
    { x: 800, y: 1900, width: 200, height: 100 }
  );
});

test('drag converts pixels to clamped normalized top-left position', () => {
  assert.deepEqual(dragToNormalized(950, -20, 200, 100, 1000, 2000), { x: 0.8, y: 0 });
});
