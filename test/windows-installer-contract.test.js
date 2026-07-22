const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkgSource = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');

test('package.json contains electron-builder configuration and dist:win script', () => {
  const pkg = JSON.parse(pkgSource);
  assert.ok(pkg.scripts['dist:win'], 'package.json missing scripts["dist:win"]');
  assert.ok(pkg.build, 'package.json missing "build" section');

  const build = pkg.build;
  assert.equal(build.appId, 'comic-translator');
  assert.equal(build.productName, 'Mee-a-rai Comic Translator');
  assert.equal(build.directories?.output, 'artifacts/installer');
  assert.ok(build.win?.target?.includes('nsis') || build.win?.target === 'nsis');

  // Verify exclusions
  const files = build.files || [];
  const filesStr = JSON.stringify(files);
  assert.match(filesStr, /!.*\.venv/);
  assert.match(filesStr, /!.*projects/);
  assert.match(filesStr, /!.*output/);
  assert.match(filesStr, /!.*artifacts/);
  assert.match(filesStr, /!.*test/);
});

test('build/installer.nsh exists for NSIS custom installer configuration', () => {
  const nshPath = path.join(__dirname, '..', 'build', 'installer.nsh');
  assert.ok(fs.existsSync(nshPath), 'build/installer.nsh must exist');
});
