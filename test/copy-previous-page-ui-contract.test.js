const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');

test('previous-page copy controls exist exactly once', () => {
  const ids = [
    'copyPreviousPageBtn', 'copyPreviousPageDialog', 'copyPreviousSourcePage',
    'copyPreviousCounts', 'copyPreviousMode', 'copyPreviousWarning',
    'cancelCopyPreviousBtn', 'confirmCopyPreviousBtn',
  ];
  ids.forEach(id => assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id));
});

test('dialog exposes all copy modes and shared layout hooks', () => {
  assert.match(html, /id="copyPreviousMode"[\s\S]*value="text"[\s\S]*value="text-style"[\s\S]*value="full-bubble"/);
  assert.match(html, /id="copyPreviousPageDialog"[\s\S]*class="dialog-actions"/);
  assert.match(css, /\.copy-previous-dialog/);
  assert.match(css, /\.copy-previous-summary/);
});

test('copy engine loads before renderer entry point', () => {
  const helper = html.indexOf('<script src="copy-previous-page.js"></script>');
  const renderer = html.indexOf('<script src="index.js"></script>');
  assert.notEqual(helper, -1);
  assert.ok(helper < renderer);
});
