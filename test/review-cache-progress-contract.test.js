const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('review header exposes determinate progress UI', () => {
  assert.match(html, /id="chapterReviewProgress"/);
  assert.match(html, /id="chapterReviewProgressText"/);
  assert.match(css, /\.chapter-review-progress/);
});

test('review composition encodes a screen-sized preview canvas', () => {
  assert.match(indexSource, /calculateReviewPreviewSize\(canvas\.width, canvas\.height\)/);
  assert.match(indexSource, /previewCanvas\.toDataURL\('image\/jpeg', 0\.92\)/);
});

test('offscreen pages retain cache and cache hits restore without composition', () => {
  assert.doesNotMatch(indexSource, /reviewCache\.delete\(index\)/);
  assert.match(indexSource, /function showCachedReviewPage\(pageElement, index, dataUrl\)/);
  assert.match(indexSource, /if \(cached\) \{[\s\S]{0,180}showCachedReviewPage/);
});

test('all selected review pages are queued and progress updates after results', () => {
  assert.match(indexSource, /function enqueueSelectedReviewPages\(\)/);
  assert.match(indexSource, /chapterReviewColumn\.querySelectorAll\('\.review-page'\)[\s\S]{0,180}enqueueReviewPage/);
  assert.match(indexSource, /function updateReviewProgress\(\)/);
  assert.match(indexSource, /reviewFinished\.add\(index\)[\s\S]{0,120}updateReviewProgress\(\)/);
});

test('closing review releases cache and finished state', () => {
  assert.match(indexSource, /reviewCache\.clear\(\);\s*reviewFinished\.clear\(\)/);
});
