const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateFitScale,
  resizeBoxFromSouthEast,
  screenPixelsToSvgUnits,
} = require('../src/bubble-geometry');

test('dragging the south-east handle left and up shrinks the box', () => {
  assert.deepEqual(
    resizeBoxFromSouthEast([100, 200, 500, 800], -150, -100),
    [100, 200, 400, 650]
  );
});

test('resize enforces minimum dimensions and image bounds', () => {
  assert.deepEqual(resizeBoxFromSouthEast([100, 200, 500, 800], -900, -900), [100, 200, 120, 220]);
  assert.deepEqual(resizeBoxFromSouthEast([100, 200, 500, 800], 900, 900), [100, 200, 1000, 1000]);
});

test('screen pixel size converts to independent SVG x/y units', () => {
  assert.deepEqual(screenPixelsToSvgUnits(14, 500, 1000), { x: 28, y: 14 });
});

test('resize uses independent screen-derived minimum dimensions', () => {
  assert.deepEqual(
    resizeBoxFromSouthEast([100, 100, 400, 400], -900, -900, 20, 2),
    [100, 100, 102, 120]
  );
});

test('fit scales keep a tall comic within the requested viewport axes', () => {
  assert.equal(calculateFitScale(800, 9500, 760, 700, 'fit-width'), 0.95);
  assert.equal(calculateFitScale(800, 9500, 760, 700, 'fit-page'), 700 / 9500);
});
