const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeDiscoveredNames,
  normalizeTranslationResult,
} = require('../src/translation-result');

const legacyBubble = {
  bubble_id: 1,
  box_2d: [1, 2, 3, 4],
  original_text: 'A',
  translated_text: 'ก',
};

const newBubble = {
  bubble_id: 2,
  box_2d: [5, 6, 7, 8],
  original_text: 'B',
  translated_text: 'ข',
};

test('normalizes new and legacy translation responses', () => {
  assert.deepEqual(normalizeTranslationResult([legacyBubble]), {
    bubbles: [legacyBubble],
    discoveredNames: {},
  });
  assert.deepEqual(
    normalizeTranslationResult({
      bubbles: [newBubble],
      discovered_names: { 'Lu Renbing': 'ลู่ เหรินปิง' },
    }),
    {
      bubbles: [newBubble],
      discoveredNames: { 'Lu Renbing': 'ลู่ เหรินปิง' },
    }
  );
});

test('normalization removes malformed bubbles and name containers', () => {
  const result = normalizeTranslationResult({
    bubbles: [legacyBubble, { bubble_id: 9, box_2d: [1, 2] }, null],
    discovered_names: ['not', 'an', 'object'],
  });

  assert.deepEqual(result, { bubbles: [legacyBubble], discoveredNames: {} });
});

test('merge protects user spellings case-insensitively and ignores non-Thai values', () => {
  const result = mergeDiscoveredNames(
    { 'LU RENBING': 'ลู่ เหรินปิง (ผู้ใช้)' },
    {
      'Lu Renbing': 'ลู่ เหรินปิง',
      'Fan Jian': 'Fan Jian',
      'Lin Du': 'หลินตู้',
      '': 'ชื่อว่าง',
    }
  );

  assert.deepEqual(result.added, { 'Lin Du': 'หลินตู้' });
  assert.deepEqual(result.glossary, {
    'LU RENBING': 'ลู่ เหรินปิง (ผู้ใช้)',
    'Lin Du': 'หลินตู้',
  });
});
