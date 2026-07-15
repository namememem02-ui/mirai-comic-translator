const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('CSS scales interface controls while isolating comic canvases', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');
  assert.match(css, /--ui-body-font:\s*15px/);
  assert.match(css, /width:\s*clamp\([^;]*--ui-explorer-width/);
  assert.match(css, /\.viewport-actions[^{]*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /dialog\[open\]/);
  assert.match(css, /\.canvas-wrapper\s*>\s*canvas/);
  assert.doesNotMatch(css, /\.canvas-wrapper[^}]*transform:\s*scale/s);
});
