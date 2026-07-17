const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateReviewPreviewSize,
  createReviewSession,
  createTaskQueue,
  getReviewProgress,
  loadReviewTranslations,
  normalizeReviewSettings,
} = require('../src/review-controller');

test('normalizes review display settings', () => {
  assert.deepEqual(normalizeReviewSettings({ width: 'bad', showNames: 1, showBoundaries: true }), {
    width: 'fit', showNames: true, showBoundaries: true,
  });
  assert.equal(normalizeReviewSettings({ width: '75' }).width, '75');
});

test('new and closed review sessions invalidate old tokens', () => {
  const session = createReviewSession();
  const first = session.begin();
  const second = session.begin();
  assert.equal(session.isCurrent(first), false);
  assert.equal(session.isCurrent(second), true);
  session.close();
  assert.equal(session.isCurrent(second), false);
});

test('task queue limits concurrency and continues after rejection', async () => {
  const queue = createTaskQueue(2);
  let active = 0;
  let peak = 0;
  const task = (fail = false) => queue.add(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active -= 1;
    if (fail) throw new Error('expected');
    return 'ok';
  });
  const results = await Promise.allSettled([task(), task(true), task(), task()]);
  assert.equal(peak, 2);
  assert.deepEqual(results.map(item => item.status), ['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
});

test('review translation loading keeps other pages when one page fails', async () => {
  const images = [{ name: '001.jpg' }, { name: '002.jpg' }, { name: '003.jpg' }];
  const translations = await loadReviewTranslations(images, async image => {
    if (image.name === '002.jpg') throw new Error('corrupt translation');
    return image.name === '001.jpg' ? [{ bubble_id: 1 }] : null;
  });

  assert.deepEqual(translations.get(0), [{ bubble_id: 1 }]);
  assert.deepEqual(translations.get(1), []);
  assert.deepEqual(translations.get(2), []);
});

test('review preview sizing limits width without enlarging smaller pages', () => {
  assert.deepEqual(calculateReviewPreviewSize(2400, 6000), { width: 1600, height: 4000 });
  assert.deepEqual(calculateReviewPreviewSize(1200, 3000), { width: 1200, height: 3000 });
});

test('review progress reports empty partial and complete states', () => {
  const cache = new Map([[0, 'preview']]);
  assert.deepEqual(getReviewProgress([], cache, new Set()), {
    value: 0, max: 0, label: 'ไม่มีหน้าที่เลือก', complete: true,
  });
  assert.deepEqual(getReviewProgress([0, 1, 2], cache, new Set()), {
    value: 1, max: 3, label: 'กำลังเตรียมภาพแปล 1/3 หน้า', complete: false,
  });
  assert.deepEqual(getReviewProgress([0, 1, 2], cache, new Set([1, 2])), {
    value: 3, max: 3, label: 'พร้อมรีวิว 3/3 หน้า', complete: true,
  });
});
