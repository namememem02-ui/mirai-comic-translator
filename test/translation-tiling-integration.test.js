const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

test('Electron imports native image cropping and the long-page helper', () => {
  assert.match(mainSource, /const \{[^}]*nativeImage[^}]*\} = require\(['"]electron['"]\)/);
  assert.match(mainSource, /require\(['"]\.\/lib\/translation-tiling['"]\)/);
});

test('Gemini request logic is reusable for a full page or a tile', () => {
  assert.match(mainSource, /async function requestGeminiTranslation\(\{ data, mimeType, glossary \}\)/);
  assert.match(mainSource, /data:\s*data\.toString\(['"]base64['"]\)/);
  assert.match(mainSource, /responseMimeType:\s*['"]application\/json['"]/);
  assert.doesNotMatch(mainSource, /const data = await res\.json/);
});

test('translate-page preserves the original path and sequences tall-page tiles', () => {
  const handler = mainSource.slice(
    mainSource.indexOf("ipcMain.handle('translate-page'"),
    mainSource.indexOf("// Local project save/load handlers")
  );

  assert.match(handler, /nativeImage\.createFromPath\(imagePath\)/);
  assert.match(handler, /planTranslationTiles\(imageSize\.width, imageSize\.height/);
  assert.match(handler, /if \(tiles\[0\]\.isFullPage\)/);
  assert.match(handler, /fs\.readFileSync\(imagePath\)/);
  assert.match(handler, /for \(const tile of tiles\)/);
  assert.match(handler, /sourceImage\.crop\(\{[\s\S]*y:\s*tile\.cropStart[\s\S]*height:\s*tile\.height/);
  assert.match(handler, /await requestGeminiTranslation/);
  assert.match(handler, /mergeTileResults\(tileEntries, imageSize\.width, imageSize\.height\)/);
});
