const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyBubble,
  countBubbleIssues,
  matchesBubbleFilter,
} = require('../src/bubble-issue-filter');

test('classifies overflow near untranslated hidden and ordinary bubbles', () => {
  assert.equal(classifyBubble({ translated_text: 'ไทย' }, { status: 'overflow' }), 'overflow');
  assert.equal(classifyBubble({ translated_text: 'ไทย' }, { status: 'near' }), 'near');
  assert.equal(classifyBubble({ translated_text: '   ' }), 'untranslated');
  assert.equal(classifyBubble({ translated_text: '', hidden: true }, { status: 'overflow' }), 'hidden');
  assert.equal(classifyBubble({ translated_text: 'ไทย' }), 'ordinary');
});

test('counts issue classes without counting hidden bubbles twice', () => {
  const bubbles = [
    { bubble_id: 1, translated_text: 'A' },
    { bubble_id: 2, translated_text: 'B' },
    { bubble_id: 3, translated_text: '' },
    { bubble_id: 4, translated_text: '', hidden: true },
    { bubble_id: 5, translated_text: 'ปกติ' },
  ];
  const warnings = new Map([[1, { status: 'overflow' }], [2, { status: 'near' }], [4, { status: 'overflow' }]]);
  assert.deepEqual(countBubbleIssues(bubbles, warnings), {
    all: 5, overflow: 1, near: 1, untranslated: 1, hidden: 1,
  });
});

test('matches all and known filters while rejecting unknown filters', () => {
  const bubble = { translated_text: 'ไทย' };
  assert.equal(matchesBubbleFilter(bubble, { status: 'near' }, 'all'), true);
  assert.equal(matchesBubbleFilter(bubble, { status: 'near' }, 'near'), true);
  assert.equal(matchesBubbleFilter(bubble, { status: 'near' }, 'overflow'), false);
  assert.equal(matchesBubbleFilter(bubble, { status: 'near' }, 'bad'), false);
});
