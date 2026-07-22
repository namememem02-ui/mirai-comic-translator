const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('translation uses only current production Gemini fallback models', () => {
  const requestStart = mainSource.indexOf('async function requestGeminiTranslation');
  const requestEnd = mainSource.indexOf("ipcMain.handle('translate-page'", requestStart);
  const requestSource = mainSource.slice(requestStart, requestEnd);

  assert.match(
    requestSource,
    /const models = \['gemini-3\.6-flash', 'gemini-3\.5-flash-lite'\]/
  );
  assert.doesNotMatch(requestSource, /gemini-2\.5|gemini-1\.5|gemini-flash-lite-latest/);
});
