const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

function handler(channel, nextChannel) {
  const start = mainSource.indexOf(`ipcMain.handle('${channel}'`);
  assert.notEqual(start, -1, `missing ${channel} handler`);
  const end = nextChannel ? mainSource.indexOf(`ipcMain.handle('${nextChannel}'`, start) : mainSource.length;
  return mainSource.slice(start, end === -1 ? mainSource.length : end);
}

test('preload exposes only argument-forwarding methods for the three backup channels', () => {
  assert.match(preloadSource, /backupProject:\s*\(args\)\s*=>\s*ipcRenderer\.invoke\('backup-project', args\)/);
  assert.match(preloadSource, /inspectProjectBackup:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('inspect-project-backup'\)/);
  assert.match(preloadSource, /confirmRestoreProject:\s*\(args\)\s*=>\s*ipcRenderer\.invoke\('confirm-restore-project', args\)/);
});

test('main registers the exact backup IPC channels and reviewed backup APIs', () => {
  for (const channel of ['backup-project', 'inspect-project-backup', 'confirm-restore-project']) {
    assert.match(mainSource, new RegExp(`ipcMain\\.handle\\('${channel}'`));
  }
  assert.match(mainSource, /require\('\.\/lib\/project-backup'\)/);
  assert.match(mainSource, /buildProjectInventory/);
  assert.match(mainSource, /createProjectBackupBuffer/);
  assert.match(mainSource, /inspectProjectBackup/);
  assert.match(mainSource, /restoreProjectBackup/);
});

test('backup validates the map, uses a ZIP save dialog, and atomically promotes a sibling temp file', () => {
  const source = handler('backup-project', 'inspect-project-backup');
  assert.match(source, /readJsonWithRecovery\(mapFile, \{\}\)/);
  assert.match(source, /Object\.keys\(projectMap\).*startsWith/s);
  assert.match(source, /dialog\.showSaveDialog/);
  assert.match(source, /defaultPath:\s*path\.join\([^,]+, sanitizeZipFilename\(`\$\{project\}-backup`\)\)/);
  assert.match(source, /filters:\s*\[\{\s*name:\s*'ZIP archive',\s*extensions:\s*\['zip'\]/);
  assert.match(source, /if \(result\.canceled[^)]*\) return \{ canceled: true \}/);
  assert.match(source, /tempPath = `\$\{result\.filePath\}\.\$\{[^}]+\}\.tmp`/);
  assert.match(source, /fs\.writeFileSync\(tempPath, archive,/);
  assert.match(source, /fs\.readFileSync\(tempPath\)/);
  assert.match(source, /fs\.renameSync\(tempPath, result\.filePath\)/);
  assert.match(source, /finally[\s\S]*fs\.rmSync\(tempPath, \{ force: true \}\)/);
  assert.match(source, /return \{ success: true, filePath: result\.filePath, summary/);
  assert.match(source, /catch \(error\)[\s\S]*return structuredError\(error\)/);
});

test('inspect uses an Open ZIP dialog and returns only an opaque fingerprint-bound token and summary', () => {
  const source = handler('inspect-project-backup', 'confirm-restore-project');
  assert.match(source, /dialog\.showOpenDialog/);
  assert.match(source, /properties:\s*\['openFile'\]/);
  assert.match(source, /filters:\s*\[\{\s*name:\s*'ZIP archive',\s*extensions:\s*\['zip'\]/);
  assert.match(source, /if \(result\.canceled[^)]*\) \{[\s\S]*return \{ canceled: true \}/);
  assert.match(mainSource, /crypto\.createHash\('sha256'\).*digest\('hex'\)/s);
  assert.match(source, /archiveFingerprint\(archive\)/);
  assert.match(mainSource, /pendingRestoreTokens\.set\(token, \{[\s\S]*filePath:[\s\S]*fingerprint,[\s\S]*expiresAt:/);
  assert.match(source, /storeRestoreToken\(filePath, fingerprint\)/);
  assert.match(source, /return \{ token, summary: inspected\.summary \}/);
  assert.doesNotMatch(source, /return \{[^}]*filePath/);
  assert.doesNotMatch(source, /return \{[^}]*entries/);
});

test('confirm consumes bounded expiring tokens, rejects tampering, re-inspects, restores, and writes the map atomically', () => {
  assert.match(mainSource, /const RESTORE_TOKEN_TTL_MS = \d+/);
  assert.match(mainSource, /const MAX_PENDING_RESTORE_TOKENS = \d+/);
  assert.match(mainSource, /pendingRestoreTokens\.size >= MAX_PENDING_RESTORE_TOKENS/);
  assert.match(mainSource, /pendingRestoreTokens\.delete\(token\)/);
  const source = handler('confirm-restore-project');
  assert.match(source, /if \(!pending\) \{[\s\S]*return structuredError\(/);
  assert.match(source, /pending\.expiresAt <= Date\.now\(\)/);
  assert.match(source, /fingerprint !== pending\.fingerprint/);
  assert.match(source, /await inspectProjectBackup\(archive\)/);
  assert.match(source, /await restoreProjectBackup\(/);
  assert.match(source, /writeProjectMap:\s*nextMap\s*=>\s*writeJsonAtomic\(mapFile, nextMap\)/);
  assert.match(source, /return \{ success: true, project: restored\.project, chapterCount:/);
  assert.match(source, /catch \(error\)[\s\S]*return structuredError\(error\)/);
});

test('existing API-key and export IPC channels remain present', () => {
  assert.match(mainSource, /ipcMain\.handle\('save-api-key'/);
  assert.match(mainSource, /ipcMain\.handle\('save-facebook-archive'/);
  assert.match(preloadSource, /saveApiKey:.*invoke\('save-api-key'/);
  assert.match(preloadSource, /saveFacebookArchive:.*invoke\('save-facebook-archive'/);
});
