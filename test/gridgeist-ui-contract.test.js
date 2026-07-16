const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');

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
