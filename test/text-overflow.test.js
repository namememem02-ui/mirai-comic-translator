const test = require('node:test');
const assert = require('node:assert/strict');
const { isTextOverflowing, wrapText } = require('../src/text-overflow');

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
