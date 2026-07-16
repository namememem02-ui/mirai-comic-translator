const test = require('node:test');
const assert = require('node:assert/strict');
const { findBubbleAtPoint, normalizeInlineShortcut, buildEditorStyle } = require('../src/inline-editor');

test('hit testing ignores invalid and hidden bubbles and includes edges', () => {
  const bubbles = [
    { bubble_id: 1, hidden: true, box_2d: [0, 0, 500, 500] },
    { bubble_id: 2, box_2d: [100, 100, 400, 400] },
    { bubble_id: 3, box_2d: [1, 2, 3] },
  ];
  assert.equal(findBubbleAtPoint(bubbles, 100, 100).bubble_id, 2);
  assert.equal(findBubbleAtPoint(bubbles, 400, 400).bubble_id, 2);
  assert.equal(findBubbleAtPoint(bubbles, 99, 100), null);
});

test('overlap hit testing selects the smallest matching box', () => {
  const bubbles = [
    { bubble_id: 1, box_2d: [0, 0, 900, 900] },
    { bubble_id: 2, box_2d: [100, 100, 300, 300] },
  ];
  assert.equal(findBubbleAtPoint(bubbles, 200, 200).bubble_id, 2);
});

test('shortcut classification preserves newlines and suppresses IME shortcuts', () => {
  assert.equal(normalizeInlineShortcut({ key: 'Enter' }, false), 'none');
  assert.equal(normalizeInlineShortcut({ key: 'Enter', ctrlKey: true }, false), 'confirm');
  assert.equal(normalizeInlineShortcut({ key: 'Enter', metaKey: true }, false), 'confirm');
  assert.equal(normalizeInlineShortcut({ key: 'Escape' }, false), 'cancel');
  assert.equal(normalizeInlineShortcut({ key: 'Escape' }, true), 'none');
  assert.equal(normalizeInlineShortcut({ key: 'x' }, false), 'none');
});

test('editor style clamps geometry and sanitizes typography', () => {
  assert.deepEqual(buildEditorStyle({
    box_2d: [-20, 100, 1200, 900],
    font_family: 'Prompt',
    text_align: 'left',
    text_color: '#123456',
  }), {
    left: '10%', top: '0%', width: '80%', height: '100%',
    fontFamily: 'Prompt', textAlign: 'left', color: '#123456',
  });
  assert.deepEqual(buildEditorStyle({ box_2d: [200, 300, 100, 200], text_align: 'bad', text_color: 'url(x)' }), {
    left: '20%', top: '10%', width: '10%', height: '10%',
    fontFamily: 'Sarabun', textAlign: 'center', color: '#111827',
  });
});
