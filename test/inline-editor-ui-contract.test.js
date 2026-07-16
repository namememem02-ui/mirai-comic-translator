const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');

test('inline editor surface exists once inside the viewport', () => {
  assert.equal((html.match(/id="inlineTranslationEditor"/g) || []).length, 1);
  assert.equal((html.match(/id="inlineEditorStatus"/g) || []).length, 1);
  assert.match(html, /id="viewportContainer"[\s\S]*id="inlineTranslationEditor"[\s\S]*<\/div>/);
  assert.match(html, /id="inlineTranslationEditor"[^>]*aria-label="แก้คำแปลบนภาพ"[^>]*hidden/);
});

test('inline editor styling exposes focus error and composing states above text canvas', () => {
  assert.match(css, /\.inline-translation-editor\s*\{[\s\S]*z-index:\s*7/);
  assert.match(css, /\.inline-translation-editor:focus/);
  assert.match(css, /\.inline-translation-editor\.has-error/);
  assert.match(css, /\.inline-translation-editor\.is-composing/);
});

test('inline helper loads before renderer', () => {
  const helper = html.indexOf('<script src="inline-editor.js"></script>');
  const renderer = html.indexOf('<script src="index.js"></script>');
  assert.notEqual(helper, -1);
  assert.ok(helper < renderer);
});
