const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTranslationPrompt } = require('../lib/translation-prompt');

test('prompt requests tight glyph boxes with a small safety margin', () => {
  const prompt = buildTranslationPrompt({});

  assert.match(prompt, /visible glyph/i);
  assert.match(prompt, /2-3%/);
  assert.match(prompt, /not the speech bubble/i);
  assert.match(prompt, /visually separate/i);
});

test('prompt transliterates unknown Chinese names and honors glossary spellings', () => {
  const prompt = buildTranslationPrompt({ 'Lin Du': 'หลินตู้' });

  assert.match(prompt, /romanized Chinese/i);
  assert.match(prompt, /Lu Renbing/);
  assert.match(prompt, /ลู่ เหรินปิง/);
  assert.match(prompt, /หลินตู้/);
});
