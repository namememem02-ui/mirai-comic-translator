const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applySelectedMatches,
  findChapterMatches,
  replaceLiteral,
  resultKey,
  saveReplacementBatch,
  undoReplacementBatch,
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

test('saves changed pages sequentially and creates an undo record', async () => {
  const originals = new Map([[0, [{ translated_text: 'A' }]], [1, [{ translated_text: 'B' }]]]);
  const updates = new Map([[0, [{ translated_text: 'X' }]], [1, [{ translated_text: 'Y' }]]]);
  const calls = [];
  const result = await saveReplacementBatch({
    originals, updates,
    savePage: async (index, data) => { calls.push([index, data[0].translated_text]); return true; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.changedIndices, [0, 1]);
  assert.deepEqual(calls, [[0, 'X'], [1, 'Y']]);
  assert.deepEqual(result.undoRecord.originals.get(0), [{ translated_text: 'A' }]);
});

test('save failure stops later writes and rolls back saved pages in reverse', async () => {
  const originals = new Map([[0, [{ translated_text: 'A' }]], [1, [{ translated_text: 'B' }]], [2, [{ translated_text: 'C' }]]]);
  const updates = new Map([[0, [{ translated_text: 'X' }]], [1, [{ translated_text: 'Y' }]], [2, [{ translated_text: 'Z' }]]]);
  const calls = [];
  const result = await saveReplacementBatch({
    originals, updates,
    savePage: async (index, data) => {
      calls.push(`${index}:${data[0].translated_text}`);
      if (index === 1 && data[0].translated_text === 'Y') return { error: 'disk full' };
      return true;
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['0:X', '1:Y', '0:A']);
  assert.deepEqual(result.changedIndices, [0]);
  assert.deepEqual(result.rollbackErrors, []);
});

test('reports rollback errors and undo restores pages in order', async () => {
  const originals = new Map([[0, [{ translated_text: 'A' }]], [1, [{ translated_text: 'B' }]]]);
  const updates = new Map([[0, [{ translated_text: 'X' }]], [1, [{ translated_text: 'Y' }]]]);
  const failed = await saveReplacementBatch({
    originals, updates,
    savePage: async (index, data) => {
      if (index === 1) throw new Error('save failed');
      if (data[0].translated_text === 'A') throw new Error('rollback failed');
      return true;
    },
  });
  assert.equal(failed.rollbackErrors.length, 1);

  const calls = [];
  const undone = await undoReplacementBatch({ originals, updates, changedIndices: [0, 1] }, async (index, data) => {
    calls.push(`${index}:${data[0].translated_text}`);
    return true;
  });
  assert.equal(undone.ok, true);
  assert.deepEqual(calls, ['0:A', '1:B']);
});
