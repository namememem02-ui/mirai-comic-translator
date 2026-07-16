const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../src/export-quality-controller');

test('opens a page and selects/reveals its bubble', async () => {
  const calls = [];
  const controller = create({
    selectPage: async index => calls.push(['page', index]),
    waitForPage: async () => {},
    selectBubble: id => { calls.push(['bubble', id]); return true; },
    revealBubble: id => calls.push(['reveal', id]),
    notify: message => calls.push(['notify', message]),
  });
  await controller.goToIssue({ pageIndex: 3, bubbleId: 8 });
  assert.deepEqual(calls, [['page', 3], ['bubble', 8], ['reveal', 8]]);
});

test('page-only issues do not select a bubble', async () => {
  let selected = false;
  const controller = create({ selectPage: async () => {}, waitForPage: async () => {}, selectBubble: () => { selected = true; } });
  await controller.goToIssue({ pageIndex: 1, bubbleId: null });
  assert.equal(selected, false);
});

test('notifies when a bubble was deleted', async () => {
  const messages = [];
  const controller = create({
    selectPage: async () => {}, waitForPage: async () => {}, selectBubble: () => false,
    notify: message => messages.push(message),
  });
  await controller.goToIssue({ pageIndex: 1, bubbleId: 99 });
  assert.equal(messages.length, 1);
});
