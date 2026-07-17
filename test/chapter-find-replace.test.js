const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applySelectedMatches,
  findChapterMatches,
  replaceLiteral,
  resultKey,
} = require('../src/chapter-find-replace');

test('replaces escaped literal text case-insensitively and counts repeats', () => {
  assert.deepEqual(replaceLiteral('A+B a+b untouched', 'a+b', 'X', false), {
    text: 'X X untouched', count: 2,
  });
  assert.deepEqual(replaceLiteral('aaa', 'a', '', false), { text: '', count: 3 });
  assert.deepEqual(replaceLiteral('text', '', 'x', false), { text: 'text', count: 0 });
});

test('whole-word matching respects Latin and Thai Unicode boundaries', () => {
  assert.deepEqual(replaceLiteral('LIN Linwood lin', 'lin', 'หลิน', true), {
    text: 'หลิน Linwood หลิน', count: 2,
  });
  assert.deepEqual(replaceLiteral('ก้ ก้ข', 'ก้', 'X', true), { text: 'X ก้ข', count: 1 });
  assert.deepEqual(replaceLiteral('ก้ข', 'ก้', 'X', false), { text: 'Xข', count: 1 });
});

test('finds one immutable result per matching bubble', () => {
  const pages = [{ pageIndex: 0, pageName: '001.jpg', bubbles: [
    { bubble_id: 7, translated_text: 'Lin และ LIN', original_text: 'keep' },
    { bubble_id: 8, translated_text: 'none' },
  ] }];
  const results = findChapterMatches(pages, 'lin', 'หลิน', true);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    pageIndex: 0, pageName: '001.jpg', bubbleId: 7,
    before: 'Lin และ LIN', after: 'หลิน และ หลิน', occurrenceCount: 2,
  });
  assert.equal(Object.isFrozen(results[0]), true);
});

test('applies only selected results to deep copies and preserves other fields', () => {
  const pages = [{ pageIndex: 0, pageName: '001.jpg', bubbles: [
    { bubble_id: 1, translated_text: 'Lin', original_text: 'A', box_2d: [1, 2, 3, 4] },
    { bubble_id: 2, translated_text: 'Lin', original_text: 'B' },
  ] }];
  const results = findChapterMatches(pages, 'lin', 'หลิน', true);
  const updates = applySelectedMatches(pages, results, new Set([resultKey(0, 1)]));
  assert.equal(updates.get(0)[0].translated_text, 'หลิน');
  assert.equal(updates.get(0)[0].original_text, 'A');
  assert.deepEqual(updates.get(0)[0].box_2d, [1, 2, 3, 4]);
  assert.equal(updates.get(0)[1].translated_text, 'Lin');
  assert.equal(pages[0].bubbles[0].translated_text, 'Lin');
});
