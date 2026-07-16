const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectPage, inspectChapter } = require('../src/export-quality');

const bubble = (overrides = {}) => ({
  bubble_id: 1,
  box_2d: [100, 100, 300, 400],
  original_text: 'Lu Renbing arrives.',
  translated_text: 'ลู่เหรินปิงมาแล้ว',
  ...overrides,
});

test('untranslated pages warn unless explicitly excluded', () => {
  assert.equal(inspectPage({ pageName: '1.jpg', pageIndex: 0, translation: null }).issues[0].code, 'PAGE_UNTRANSLATED');
  assert.equal(inspectPage({ pageName: '1.jpg', pageIndex: 0, translation: null, excluded: true }).status, 'excluded');
});

test('hidden bubbles skip text checks but still validate their box', () => {
  const result = inspectPage({
    pageName: '1.jpg', pageIndex: 0, glossary: { 'Lu Renbing': 'ลู่เหรินปิง' },
    translation: [bubble({ hidden: true, translated_text: '', box_2d: [-1, 100, 300, 400] })],
    measureOverflow: () => true,
  });
  assert.deepEqual(result.issues.map(issue => issue.code), ['INVALID_BOX']);
});

test('reports empty text, overflow, and glossary mismatch in stable order', () => {
  const result = inspectPage({
    pageName: '2.jpg', pageIndex: 1, glossary: { 'Lu Renbing': 'ลู่เหรินปิง' },
    translation: [bubble({ translated_text: '  ' }), bubble({ bubble_id: 2, translated_text: 'ชื่ออื่น' })],
    measureOverflow: ({ bubble }) => bubble.bubble_id === 2,
  });
  assert.deepEqual(result.issues.map(issue => issue.code), [
    'EMPTY_TEXT', 'GLOSSARY_MISMATCH', 'TEXT_OVERFLOW', 'GLOSSARY_MISMATCH',
  ]);
});

test('does not match a glossary source inside another word', () => {
  const result = inspectPage({
    pageName: '3.jpg', pageIndex: 2, glossary: { Ren: 'เหริน' },
    translation: [bubble({ original_text: 'Renaissance', translated_text: 'ยุคฟื้นฟู' })],
  });
  assert.equal(result.issues.length, 0);
});

test('chapter summary counts page states', () => {
  const result = inspectChapter([
    { pageName: '1.jpg', pageIndex: 0, translation: null },
    { pageName: '2.jpg', pageIndex: 1, excluded: true, translation: null },
    { pageName: '3.jpg', pageIndex: 2, translation: [bubble()] },
  ]);
  assert.deepEqual(result.summary, { errors: 0, warnings: 1, passed: 1, excluded: 1 });
});
