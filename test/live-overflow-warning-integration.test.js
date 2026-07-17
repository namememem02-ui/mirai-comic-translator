const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('renderer owns transient live overflow state and scans after page render', () => {
  assert.match(indexSource, /const liveOverflowWarnings = new Map\(\)/);
  assert.match(indexSource, /function scanLiveOverflowWarnings\(\)/);
  assert.match(indexSource, /bubblesCountBadge[\s\S]{0,300}scanLiveOverflowWarnings\(\)/);
});

test('renderer uses shared metrics and supports targeted updates', () => {
  assert.match(indexSource, /window\.TextOverflow\.measureTextOverflow/);
  assert.match(indexSource, /function updateLiveOverflowWarning\(bubble\)/);
  assert.match(indexSource, /transInput\.addEventListener\('input',[\s\S]{0,250}updateLiveOverflowWarning\(bubble\)/);
  assert.match(indexSource, /sizeSlider\.addEventListener\('input',[\s\S]{0,300}updateLiveOverflowWarning\(bubble\)/);
  assert.match(indexSource, /updateSVGOverlayOnly\(\);\s*updateLiveOverflowWarning\(bubble\)/);
});

test('warning badge focuses its bubble and warning state is not persisted', () => {
  assert.match(indexSource, /live-overflow-badge/);
  assert.match(indexSource, /overflowBadge\.addEventListener\('click',[\s\S]{0,250}focusCard\(bubble\.bubble_id\)/);
  assert.doesNotMatch(indexSource, /bubble\.(?:overflowStatus|overflow_status|liveOverflow)/);
});

test('hidden and deleted bubbles clear warnings and CSS distinguishes near from overflow', () => {
  assert.match(indexSource, /if \(bubble\.hidden[\s\S]{0,180}liveOverflowWarnings\.delete/);
  assert.match(styleSource, /\.bubble-rect\.overflow-near/);
  assert.match(styleSource, /\.bubble-rect\.overflow-error/);
  assert.match(styleSource, /\.live-overflow-badge/);
});
