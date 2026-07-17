const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

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

test('main injects production dependencies into the coordinator', () => {
  assert.match(mainSource, /createProjectBackupIpcCoordinator\(\{/);
  assert.match(mainSource, /appVersion:\s*app\.getVersion\(\)/);
  assert.match(mainSource, /tokenTtlMs:\s*5 \* 60 \* 1000/);
  assert.match(mainSource, /maxPendingTokens:\s*8/);
  assert.match(mainSource, /fingerprint:\s*buffer => crypto\.createHash\('sha256'\)/);
  assert.match(mainSource, /readJson:\s*readJsonWithRecovery/);
  assert.match(mainSource, /writeJson:\s*writeJsonAtomic/);
  assert.match(mainSource, /showSaveDialog:\s*options => dialog\.showSaveDialog\(mainWin, options\)/);
  assert.match(mainSource, /showOpenDialog:\s*options => dialog\.showOpenDialog\(mainWin, options\)/);
  assert.match(mainSource, /ipcMain\.handle\('backup-project', projectBackupHandlers\.backupProject\)/);
  assert.match(mainSource, /ipcMain\.handle\('inspect-project-backup', projectBackupHandlers\.inspectProjectBackup\)/);
  assert.match(mainSource, /ipcMain\.handle\('confirm-restore-project', projectBackupHandlers\.confirmRestoreProject\)/);
});

test('existing API-key and export IPC channels remain present', () => {
  assert.match(mainSource, /ipcMain\.handle\('save-api-key'/);
  assert.match(mainSource, /ipcMain\.handle\('save-facebook-archive'/);
  assert.match(preloadSource, /saveApiKey:.*invoke\('save-api-key'/);
  assert.match(preloadSource, /saveFacebookArchive:.*invoke\('save-facebook-archive'/);
});
