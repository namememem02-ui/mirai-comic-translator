const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUiScale, getUiScaleTokens, applyUiScale } = require('../src/ui-scale');

test('defaults missing and invalid UI scales to 115', () => {
  for (const value of [undefined, null, '', 99, 120, 'large']) assert.equal(normalizeUiScale(value), 115);
  assert.equal(normalizeUiScale('100'), 100);
  assert.equal(normalizeUiScale(130), 130);
});

test('maps each scale to stable interface tokens', () => {
  assert.deepEqual(getUiScaleTokens(100), { scale: 1, bodyFont: 13, controlFont: 13, explorerWidth: 280, editorWidth: 380 });
  assert.deepEqual(getUiScaleTokens(115), { scale: 1.15, bodyFont: 15, controlFont: 14, explorerWidth: 310, editorWidth: 420 });
  assert.deepEqual(getUiScaleTokens(130), { scale: 1.3, bodyFont: 17, controlFont: 16, explorerWidth: 340, editorWidth: 460 });
});

test('applies normalized tokens to a root style', () => {
  const values = {};
  const root = { dataset: {}, style: { setProperty: (name, value) => { values[name] = value; } } };
  assert.equal(applyUiScale(root, 130), 130);
  assert.equal(root.dataset.uiScale, '130');
  assert.equal(values['--ui-body-font'], '17px');
  assert.equal(values['--ui-editor-width'], '460px');
});
