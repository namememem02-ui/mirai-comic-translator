const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');

test('main owns source authorization and guards source reads', () => {
  assert.match(main, /createSourceFolderRegistry/);
  assert.match(main, /ipcMain\.handle\('authorize-source-folder'/);
  assert.match(main, /sourceFolders\.isAuthorized\(folderPath\)/);
  assert.match(main, /sourceFolders\.isAuthorized\(imagePath\)/);
});

test('renderer receives asset URLs and never constructs file URLs', () => {
  assert.match(main, /assetProtocol\.urlForPath/);
  assert.doesNotMatch(main, /file:\/\/\//);
  assert.doesNotMatch(renderer, /file:\/\/\//);
});

test('preload exposes explicit dropped-folder authorization', () => {
  assert.match(preload, /authorizeSourceFolder:\s*\(folderPath\).*authorize-source-folder/);
  assert.match(renderer, /authorizeSourceFolder\(folderPath\)/);
});

test('managed renderer-controlled paths use the containment helper', () => {
  assert.match(main, /resolveWithin\(PROJECTS_DIR/);
  assert.match(main, /resolveWithin\(OUTPUT_DIR/);
});
