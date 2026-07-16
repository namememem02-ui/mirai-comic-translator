const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('export dialog exposes quality scan controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  for (const id of [
    'qualityPanel', 'qualityProgress', 'qualitySummary', 'qualityFilterAll',
    'qualityFilterErrors', 'qualityFilterWarnings', 'qualityFilterPassed',
    'qualityIssueList', 'qualityRescanBtn', 'qualityBackToEditBtn', 'qualityContinueBtn',
  ]) assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
});

test('quality scan uses stored translations and never export composition', () => {
  const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.match(script, /async function runExportQualityScan/);
  const body = script.match(/async function runExportQualityScan[\s\S]*?\n}/)?.[0] || '';
  assert.match(body, /loadPageTranslation/);
  assert.doesNotMatch(body, /composeExportPage|runAIInpaint|translatePage/);
});
