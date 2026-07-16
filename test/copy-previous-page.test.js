const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCopyPreview, copyPreviousPage } = require('../src/copy-previous-page');

test('text mode copies paired translations and preserves current bubbles', () => {
  const source = [
    { bubble_id: 8, box_2d: [1, 2, 3, 4], original_text: 'A', translated_text: 'หนึ่ง', font_size: 30 },
    { bubble_id: 9, translated_text: 'สอง' },
  ];
  const current = [
    { bubble_id: 1, box_2d: [10, 20, 30, 40], original_text: 'X', translated_text: 'เดิม', font_size: 18 },
    { bubble_id: 2, translated_text: 'เดิมสอง', hidden: true },
    { bubble_id: 3, translated_text: 'คงไว้' },
  ];

  const result = copyPreviousPage({ source, current, mode: 'text' });

  assert.deepEqual(result, [
    { bubble_id: 1, box_2d: [10, 20, 30, 40], original_text: 'X', translated_text: 'หนึ่ง', font_size: 18 },
    { bubble_id: 2, translated_text: 'สอง', hidden: true },
    { bubble_id: 3, translated_text: 'คงไว้' },
  ]);
  assert.notStrictEqual(result, current);
  assert.deepEqual(source[0].box_2d, [1, 2, 3, 4]);
});

test('preview reports unequal paired counts and empty-source confirmation state', () => {
  assert.deepEqual(buildCopyPreview({ source: [{}, {}], current: [{}], mode: 'text' }), {
    sourceCount: 2,
    currentCount: 1,
    pairedCount: 1,
    appendedCount: 0,
    unmatchedSourceCount: 1,
    unmatchedCurrentCount: 0,
    canConfirm: true,
  });
  assert.equal(buildCopyPreview({ source: [], current: [{}], mode: 'text' }).canConfirm, false);
});

test('text-style mode mirrors style presence but preserves current identity and geometry', () => {
  const source = [{ translated_text: 'ใหม่', font_family: 'Sarabun', text_align: 'left', outline: false }];
  const current = [{
    bubble_id: 4,
    box_2d: [100, 200, 300, 400],
    original_text: 'SOURCE',
    translated_text: 'เดิม',
    font_size: 22,
    font_family: 'Arial',
    text_align: 'center',
    text_color: '#fff',
    outline: true,
    hidden: true,
    manualAdd: true,
    rotate: 10,
  }];

  assert.deepEqual(copyPreviousPage({ source, current, mode: 'text-style' }), [{
    bubble_id: 4,
    box_2d: [100, 200, 300, 400],
    original_text: 'SOURCE',
    translated_text: 'ใหม่',
    font_family: 'Sarabun',
    text_align: 'left',
    outline: false,
    hidden: true,
    manualAdd: true,
    rotate: 10,
  }]);
});

test('full-bubble mode appends deep copies with unique sequential IDs', () => {
  const source = [
    { bubble_id: 1, box_2d: [1, 2, 3, 4], translated_text: 'A' },
    { bubble_id: 2, translated_text: 'B' },
  ];
  const current = [{ bubble_id: 7, translated_text: 'เดิม' }, { bubble_id: 'bad' }];

  const result = copyPreviousPage({ source, current, mode: 'full-bubble' });

  assert.deepEqual(result.map(item => item.bubble_id), [7, 'bad', 8, 9]);
  assert.deepEqual(result[2].box_2d, [1, 2, 3, 4]);
  result[2].box_2d[0] = 999;
  assert.equal(source[0].box_2d[0], 1);
  assert.equal(buildCopyPreview({ source, current, mode: 'full-bubble' }).appendedCount, 2);
});

test('rejects unknown copy modes', () => {
  assert.throws(
    () => copyPreviousPage({ source: [], current: [], mode: 'mystery' }),
    /Unknown copy mode/
  );
});
