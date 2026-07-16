const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

test('double click opens only a preview bubble through normalized hit testing', () => {
  assert.match(renderer, /viewportContainer\.addEventListener\(['"]dblclick['"]/);
  assert.match(renderer, /if \(!isPreviewMode\) return/);
  assert.match(renderer, /window\.InlineEditor\.findBubbleAtPoint/);
  assert.match(renderer, /openInlineEditor\(bubble\)/);
});

test('draft preview and IME shortcuts stay isolated from stored text', () => {
  assert.match(renderer, /function getInlineDisplayText\(bubble\)/);
  assert.match(renderer, /getInlineDisplayText\(bubble\)/);
  assert.match(renderer, /inlineTranslationEditor\.addEventListener\(['"]compositionstart['"]/);
  assert.match(renderer, /inlineTranslationEditor\.addEventListener\(['"]compositionend['"]/);
  assert.match(renderer, /window\.InlineEditor\.normalizeInlineShortcut/);
});

test('confirmation uses one Undo and rolls back a failed atomic save', () => {
  assert.match(renderer, /async function confirmInlineEditor\(\)/);
  assert.match(renderer, /const undoLengthBeforeInline = undoStack\.length/);
  assert.match(renderer, /pushUndoState\(\)[\s\S]*bubble\.translated_text = inlineEditorSession\.draft/);
  assert.match(renderer, /await saveCurrentPageTranslation\(inlineEditorSession\.pageIndex/);
  assert.match(renderer, /if \(saveResult !== true\)[\s\S]*bubble\.translated_text = originalText/);
  assert.match(renderer, /undoStack\.length = undoLengthBeforeInline/);
});

test('destructive lifecycle paths cancel an open editor', () => {
  assert.match(renderer, /async function selectPage\(idx\)\s*\{[\s\S]*cancelInlineEditor\(\)/);
  assert.match(renderer, /if \(!isPreviewMode\) cancelInlineEditor\(\)/);
  assert.match(renderer, /copyPreviousPageBtn\.addEventListener\(['"]click['"][\s\S]*cancelInlineEditor\(\)/);
  assert.match(renderer, /bubbleOverlay\.addEventListener\(['"]mousedown['"][\s\S]*cancelInlineEditor\(\)/);
  assert.match(renderer, /function switchTool\([^)]*\)\s*\{[\s\S]*cancelInlineEditor\(\)/);
});
