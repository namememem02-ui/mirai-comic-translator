const test = require('node:test');
const assert = require('node:assert/strict');

const {
  planTranslationTiles,
  mergeTileResults,
} = require('../lib/translation-tiling');

test('ordinary pages keep one unchanged full-page request', () => {
  assert.deepEqual(planTranslationTiles(800, 3200), [{
    cropStart: 0,
    cropEnd: 3200,
    coreStart: 0,
    coreEnd: 3200,
    width: 800,
    height: 3200,
    isFullPage: true,
    isLast: true,
  }]);
});

test('long pages use bounded overlapping crops with gap-free cores', () => {
  const tiles = planTranslationTiles(800, 9500);

  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles.map(({ coreStart, coreEnd }) => [coreStart, coreEnd]), [
    [0, 2400],
    [2400, 4800],
    [4800, 7200],
    [7200, 9500],
  ]);
  assert.deepEqual(tiles.map(({ cropStart, cropEnd }) => [cropStart, cropEnd]), [
    [0, 2560],
    [2240, 4960],
    [4640, 7360],
    [7040, 9500],
  ]);
  assert.ok(tiles.every(tile => tile.cropStart >= 0 && tile.cropEnd <= 9500));
  assert.ok(tiles.slice(1).every((tile, index) => tiles[index].cropEnd > tile.cropStart));
});

test('tile boxes remap to the full page and overlap belongs to one core', () => {
  const tiles = planTranslationTiles(800, 9500);
  const result = mergeTileResults([
    {
      tile: tiles[0],
      result: {
        bubbles: [
          { bubble_id: 8, box_2d: [900, 300, 950, 600], original_text: 'KEPT', translated_text: 'เก็บ' },
        ],
        discovered_names: { 'Lu Renbing': 'ลู่ เหรินปิง' },
      },
    },
    {
      tile: tiles[1],
      result: {
        bubbles: [
          { bubble_id: 1, box_2d: [24, 300, 71, 600], original_text: 'DUPLICATE', translated_text: 'ซ้ำ' },
          { bubble_id: 2, box_2d: [100, 100, 200, 200], original_text: 'SECOND', translated_text: 'สอง' },
        ],
        discovered_names: { 'lu renbing': 'การสะกดที่มาทีหลัง', 'Fan Jian': 'ฟาน เจี้ยน' },
      },
    },
  ], 800, 9500);

  assert.deepEqual(result.bubbles.map(bubble => ({
    bubble_id: bubble.bubble_id,
    box_2d: bubble.box_2d,
    original_text: bubble.original_text,
  })), [
    { bubble_id: 1, box_2d: [243, 300, 256, 600], original_text: 'KEPT' },
    { bubble_id: 2, box_2d: [264, 100, 293, 200], original_text: 'SECOND' },
  ]);
  assert.deepEqual(result.discovered_names, {
    'Lu Renbing': 'ลู่ เหรินปิง',
    'Fan Jian': 'ฟาน เจี้ยน',
  });
});

test('merge drops invalid boxes and clamps the final core boundary', () => {
  const tile = {
    cropStart: 700,
    cropEnd: 1000,
    coreStart: 800,
    coreEnd: 1000,
    width: 100,
    height: 300,
    isFullPage: false,
    isLast: true,
  };
  const result = mergeTileResults([{
    tile,
    result: {
      bubbles: [
        { box_2d: [900, -20, 1100, 1020], original_text: 'END', translated_text: 'จบ' },
        { box_2d: [1, 2, 3], original_text: 'BAD', translated_text: 'เสีย' },
      ],
    },
  }], 100, 1000);

  assert.deepEqual(result.bubbles, [{
    bubble_id: 1,
    box_2d: [970, 0, 1000, 1000],
    original_text: 'END',
    translated_text: 'จบ',
  }]);
});
