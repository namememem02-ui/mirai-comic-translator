const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

test('renderer keeps the copy button page-aware and loads only the previous page', () => {
  assert.match(renderer, /copyPreviousPageBtn\.disabled\s*=\s*activeIndex\s*<=\s*0/);
  assert.match(renderer, /images\[copyRequestIndex\s*-\s*1\]/);
  assert.match(renderer, /window\.api\.loadPageTranslation/);
  assert.match(renderer, /activeIndex\s*!==\s*copyRequestIndex/);
  assert.match(renderer, /copyPreviousPageDialog\.close\(\)/);
  assert.match(renderer, /catch \(loadError\)/);
});

test('renderer previews modes and confirms through one Undo plus atomic save', () => {
  assert.match(renderer, /window\.CopyPreviousPage\.buildCopyPreview/);
  assert.match(renderer, /copyPreviousMode\.addEventListener\(['"]change['"]/);
  assert.match(renderer, /window\.CopyPreviousPage\.copyPreviousPage/);
  assert.match(renderer, /const undoLengthBeforeCopy = undoStack\.length/);
  assert.match(renderer, /pushUndoState\(\)[\s\S]*activePageTranslation = copyResult/);
  assert.match(renderer, /await saveCurrentPageTranslation\(copyTargetIndex, copyResult\)/);
  assert.match(renderer, /delete cleanedBgCache\[copyTargetPage\.name\]/);
});

test('renderer rolls back memory and Undo when saving fails', () => {
  assert.match(renderer, /if \(saveResult !== true\)/);
  assert.match(renderer, /catch \(saveError\)/);
  assert.match(renderer, /activePageTranslation = previousTranslation/);
  assert.match(renderer, /undoStack\.length = undoLengthBeforeCopy/);
  assert.match(renderer, /renderPageTranslation\(\)/);
  assert.match(renderer, /if \(isPreviewMode\) refreshTypesetView\(\)/);
});
