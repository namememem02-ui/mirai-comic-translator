const test = require('node:test');
const assert = require('node:assert/strict');
const { isTextOverflowing, measureTextOverflow, wrapText } = require('../src/text-overflow');

const adapter = { measure: text => [...text].length * 10 };

test('wraps words within the available width', () => {
  assert.deepEqual(wrapText('หนึ่ง สอง สาม', 100, adapter), ['หนึ่ง สอง', 'สาม']);
});

test('detects vertical overflow and exact fit', () => {
  assert.equal(isTextOverflowing({ text: 'หนึ่ง สอง สาม', boxWidth: 80, boxHeight: 40, fontSize: 16, lineHeight: 20 }, adapter), false);
  assert.equal(isTextOverflowing({ text: 'หนึ่ง สอง สาม', boxWidth: 80, boxHeight: 39, fontSize: 16, lineHeight: 20 }, adapter), true);
});

test('detects an unbreakable token wider than the box', () => {
  assert.equal(isTextOverflowing({ text: 'abcdefghij', boxWidth: 50, boxHeight: 100, fontSize: 16 }, adapter), true);
});

test('invalid dimensions are treated as overflow', () => {
  assert.equal(isTextOverflowing({ text: 'ข้อความ', boxWidth: 0, boxHeight: 100, fontSize: 16 }, adapter), true);
});

test('reports safe and near vertical usage at the 85 percent boundary', () => {
  assert.equal(measureTextOverflow({ text: 'one', boxWidth: 100, boxHeight: 24, lineHeight: 20 }, adapter).status, 'safe');
  const near = measureTextOverflow({ text: 'one', boxWidth: 100, boxHeight: 23.5, lineHeight: 20 }, adapter);
  assert.equal(near.status, 'near');
  assert.equal(near.lineCount, 1);
  assert.ok(near.usage >= 0.85 && near.usage < 1);
});

test('reports vertical and wide-token overflow details', () => {
  const vertical = measureTextOverflow({ text: 'one two', boxWidth: 35, boxHeight: 19, lineHeight: 20 }, adapter);
  assert.equal(vertical.status, 'overflow');
  assert.equal(vertical.hasWideToken, false);
  const wide = measureTextOverflow({ text: 'abcdefghij', boxWidth: 50, boxHeight: 100, lineHeight: 20 }, adapter);
  assert.equal(wide.status, 'overflow');
  assert.equal(wide.hasWideToken, true);
});

test('empty text is safe and invalid geometry preserves compatibility overflow', () => {
  assert.equal(measureTextOverflow({ text: '', boxWidth: 100, boxHeight: 100 }, adapter).status, 'safe');
  assert.equal(measureTextOverflow({ text: 'x', boxWidth: 0, boxHeight: 100 }, adapter).status, 'overflow');
  assert.equal(isTextOverflowing({ text: 'x', boxWidth: 0, boxHeight: 100 }, adapter), true);
});
