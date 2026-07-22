const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const checklistSource = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'release', 'windows-clean-machine-checklist.md'),
  'utf8'
);
const publishingSource = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'release', 'lama-component-publishing.md'),
  'utf8'
);

test('windows-clean-machine-checklist.md details clean installation and fallback verification', () => {
  assert.match(checklistSource, /Mee-a-rai-ComicTranslator-Setup-0\.1\.0\.exe/);
  assert.match(checklistSource, /Clean Installation/);
  assert.match(checklistSource, /LaMa Component Onboarding/);
  assert.match(checklistSource, /Fallback & Recovery/);
});

test('lama-component-publishing.md documents release tags and upload order', () => {
  assert.match(publishingSource, /components-v1\.0\.0/);
  assert.match(publishingSource, /v0\.1\.0/);
  assert.match(publishingSource, /lama-cpu-win-x64-v1\.0\.0\.zip/);
  assert.match(publishingSource, /lama-components\.json/);
  assert.match(publishingSource, /FIRST/);
});
