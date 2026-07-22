const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');

test('preload.js exposes narrow LaMa component API methods without raw paths or URLs', () => {
  const methods = [
    'getLamaComponentState',
    'checkLamaComponents',
    'installLamaComponent',
    'cancelLamaComponentDownload',
    'repairLamaComponent',
    'removeLamaComponent',
    'saveLamaPreferences',
    'onLamaComponentState',
  ];
  for (const m of methods) {
    assert.ok(preloadSource.includes(m), `preload.js missing ${m}`);
  }
  assert.doesNotMatch(preloadSource, /installLamaComponent\s*:\s*\([^)]*url/i);
  assert.doesNotMatch(preloadSource, /installLamaComponent\s*:\s*\([^)]*path/i);
});

test('main.js registers narrow IPC channels for LaMa components', () => {
  const channels = [
    'get-lama-component-state',
    'check-lama-components',
    'install-lama-component',
    'cancel-lama-component-download',
    'repair-lama-component',
    'remove-lama-component',
    'save-lama-preferences',
  ];
  for (const ch of channels) {
    assert.ok(mainSource.includes(`'${ch}'`) || mainSource.includes(`"${ch}"`), `main.js missing IPC channel ${ch}`);
  }
});

test('main.js validates backend arguments against allowed enums (cpu, nvidia)', () => {
  assert.match(mainSource, /validateBackend|['"]cpu['"]\s*,\s*['"]nvidia['"]/);
});
