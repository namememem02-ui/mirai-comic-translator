const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('every renderer getElementById dependency exists exactly once', () => {
  const ids = [...script.matchAll(/^const\s+\w+\s*=\s*document\.getElementById\(['"]([^'"]+)['"]\)/gm)]
    .map((match) => match[1]);
  const intentionallyUnusedLegacyIds = new Set(['zoomInBtn', 'zoomOutBtn']);
  for (const id of new Set(ids)) {
    if (intentionallyUnusedLegacyIds.has(id)) continue;
    const count = [...html.matchAll(new RegExp(`id=["']${id}["']`, 'g'))].length;
    assert.equal(count, 1, `${id} must exist exactly once`);
  }
});

test('all redesigned surfaces expose stable layout hooks', () => {
  const hooks = [
    'workspace-shell',
    'page-rail',
    'canvas-stage',
    'context-inspector',
    'settings-surface',
    'export-surface',
    'review-workspace',
  ];
  for (const hook of hooks) {
    assert.match(html, new RegExp(`class=["'][^"']*${hook}`), `missing ${hook}`);
  }
});

test('canvas layer IDs and order remain stable', () => {
  const ordered = [
    'brushMaskCanvas',
    'bubbleOverlay',
    'typesetTextCanvas',
    'watermarkCanvas',
    'colorPaintCanvas',
    'activeImage',
  ];
  const positions = ordered.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('workspace separates primary commands from contextual tools', () => {
  assert.match(html, /class="[^"]*command-bar[^"]*"[\s\S]*id="translatePageBtn"[\s\S]*id="exportChapterBtn"/);
  assert.match(html, /id="studioToolbar" class="[^"]*context-tool-bar[^"]*"[\s\S]*id="undoBtn"[\s\S]*id="watermarkToggleBtn"/);
  assert.match(html, /class="[^"]*page-rail-body[^"]*"[\s\S]*id="thumbnailsList"/);
  assert.match(html, /class="[^"]*inspector-dialogues[^"]*"[\s\S]*id="bubblesList"/);
});

test('Gridgeist CSS exposes tokens and responsive interaction contracts', () => {
  for (const token of ['--surface-0', '--surface-1', '--rule', '--accent', '--danger', '--space-1', '--radius-sm']) {
    assert.match(css, new RegExp(`${token}:`), `missing ${token}`);
  }
  assert.match(css, /\.workspace-shell\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*959px\)/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('secondary surfaces use the shared workbench structure', () => {
  for (const hook of ['settings-section', 'dialog-actions', 'export-step', 'review-toolbar', 'review-page-row']) {
    assert.match(html, new RegExp(`class=["'][^"']*${hook}`), `missing ${hook}`);
  }
  assert.match(css, /\.settings-surface\s*,\s*\.export-surface/);
  assert.match(css, /\.bubble-editor-card/);
  assert.match(css, /\.chapter-review-header\s*\{[^}]*position:\s*sticky/s);
});
