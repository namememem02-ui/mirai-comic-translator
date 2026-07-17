const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('chapter find and replace exposes one full workspace dialog', () => {
  for (const id of [
    'chapterFindReplaceBtn', 'chapterFindReplaceDialog', 'findReplaceSearch',
    'findReplaceReplacement', 'findReplaceWholeWord', 'findReplaceRun',
    'findReplaceSelectAll', 'findReplaceSelectNone', 'findReplaceResults',
    'findReplaceSummary', 'findReplaceApply', 'findReplaceUndo',
    'findReplaceStatus', 'closeFindReplaceBtn',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /id="findReplaceWholeWord"[^>]*checked/);
  assert.match(css, /\.chapter-find-replace-dialog/);
});

test('renderer searches, groups results, applies a transaction and keeps latest undo', () => {
  assert.match(indexSource, /async function runChapterFindReplaceSearch\(\)/);
  assert.match(indexSource, /function renderChapterFindReplaceResults\(\)/);
  assert.match(indexSource, /async function applyChapterFindReplace\(\)/);
  assert.match(indexSource, /async function undoLastChapterReplace\(\)/);
  assert.match(indexSource, /findChapterMatches/);
  assert.match(indexSource, /saveReplacementBatch/);
  assert.match(indexSource, /let lastChapterReplaceUndo = null/);
});

test('result navigation returns to the exact editor page and bubble', () => {
  assert.match(indexSource, /async function openFindReplaceResult\(pageIndex, bubbleId\)/);
  assert.match(indexSource, /await selectPage\(pageIndex\)/);
  assert.match(indexSource, /focusCard\(bubbleId\)/);
  assert.match(indexSource, /highlightOverlayRect\(bubbleId\)/);
});

test('opening another chapter clears stale search preview and undo state', () => {
  const loadFolderBody = indexSource.match(/async function loadFolder\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(loadFolderBody, /lastChapterReplaceUndo = null/);
  assert.match(loadFolderBody, /findReplaceUndo\.disabled = true/);
  assert.match(loadFolderBody, /invalidateChapterFindReplacePreview\(\)/);
  assert.match(indexSource, /comparison\.className = 'find-replace-copy'/);
});

test('renderer replacement path does not write source text or glossary', () => {
  const applyBody = indexSource.match(/async function applyChapterFindReplace\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(applyBody, /original_text|projectGlossary|saveMemory/);
});
