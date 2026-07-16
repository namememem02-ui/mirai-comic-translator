const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const srcDir = path.join(__dirname, '..', 'src');

test('loads mask geometry before the renderer entry point', () => {
  const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
  const geometryScript = html.indexOf('<script src="inpaint-mask-geometry.js"></script>');
  const rendererScript = html.indexOf('<script src="index.js"></script>');

  assert.notEqual(geometryScript, -1);
  assert.notEqual(rendererScript, -1);
  assert.ok(geometryScript < rendererScript);
});

test('renderer uses shared mask geometry without legacy shrinking', () => {
  const renderer = fs.readFileSync(path.join(srcDir, 'index.js'), 'utf8');

  assert.match(renderer, /window\.InpaintMaskGeometry\.calculateMaskRect/);
  assert.doesNotMatch(renderer, /shrinkX|shrinkY/);
});
