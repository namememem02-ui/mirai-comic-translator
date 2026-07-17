const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');

const ids = [
  'backupProjectBtn',
  'restoreProjectBtn',
  'projectBackupStatus',
  'restoreProjectDialog',
  'restoreProjectSummary',
  'confirmRestoreProjectBtn',
  'cancelRestoreProjectBtn',
];

test('backup and restore controls have unique stable IDs and semantic status/dialog structure', () => {
  for (const id of ids) {
    assert.equal([...html.matchAll(new RegExp(`id=["']${id}["']`, 'g'))].length, 1, `${id} must exist exactly once`);
  }
  assert.match(html, /<button[^>]*id="backupProjectBtn"[^>]*disabled/);
  assert.match(html, /<button[^>]*id="restoreProjectBtn"/);
  assert.doesNotMatch(html, /<button[^>]*id="restoreProjectBtn"[^>]*disabled/);
  assert.match(html, /id="projectBackupStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /<dialog[^>]*id="restoreProjectDialog"[^>]*aria-labelledby="restoreProjectTitle"/);
  assert.match(html, /<header[^>]*class="[^"]*project-restore-header/);
  assert.match(html, /id="restoreProjectSummary"[\s\S]*<dl/);
  assert.match(html, /สร้างสำเนาใหม่[\s\S]*ไม่เขียนทับ/);
});

test('renderer declares the whole UI dependency contract and transient restore token', () => {
  for (const id of ids) {
    assert.match(script, new RegExp(`document\\.getElementById\\(['"]${id}['"]\\)`));
  }
  assert.match(script, /let pendingProjectRestoreToken = null;/);
  assert.match(script, /async function backupCurrentProject\(\)/);
  assert.match(script, /async function inspectBackupForRestore\(\)/);
  assert.match(script, /async function confirmProjectRestore\(\)/);
});

test('backup sends the exact project payload and always restores both controls', () => {
  const body = script.match(/async function backupCurrentProject\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(body, /window\.api\.backupProject\(\{ project: currentProject \}\)/);
  assert.match(body, /backupProjectBtn\.disabled = true/);
  assert.match(body, /restoreProjectBtn\.disabled = true/);
  assert.match(body, /projectBackupStatus\.textContent = 'กำลังสร้างไฟล์สำรองโครงการ…';[\s\S]*await window\.api\.backupProject/);
  assert.match(body, /if \(result\?\.canceled\) return/);
  assert.match(body, /projectBackupStatus\.textContent/);
  assert.doesNotMatch(body, /innerHTML/);
  assert.match(body, /finally\s*\{[\s\S]*backupProjectBtn\.disabled = !currentProject;[\s\S]*restoreProjectBtn\.disabled = false;/);
});

test('inspection safely renders all summary fields and retains only the token', () => {
  const body = script.match(/async function inspectBackupForRestore\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(body, /window\.api\.inspectProjectBackup\(\)/);
  assert.match(body, /projectBackupStatus\.textContent = 'กำลังตรวจสอบไฟล์สำรอง…';[\s\S]*await window\.api\.inspectProjectBackup/);
  assert.match(body, /pendingProjectRestoreToken = result\.token/);
  assert.doesNotMatch(body, /pendingProjectRestore\s*=/);
  assert.match(script, /restoreProjectSummary\.replaceChildren/);
  assert.match(script, /function renderProjectRestoreSummary\(summary\)[\s\S]*textContent/);
  assert.doesNotMatch(body, /innerHTML/);
  for (const field of ['originalProjectName', 'backupVersion', 'appVersion', 'schemaVersion', 'chapterCount', 'imageCount', 'totalUncompressedBytes']) {
    assert.match(script, new RegExp(`summary\\.${field}`), `missing summary.${field}`);
  }
  assert.match(script, /formatProjectBackupBytes\(summary\.totalUncompressedBytes\)/);
  assert.match(script, /\['รูปแบบไฟล์สำรอง', summary\.backupVersion\]/);
  assert.match(script, /typeof summary\.backupVersion === 'string'/);
  assert.doesNotMatch(script, /summary\.backupVersion \|\| 'ComicTranslator Backup'/);
  assert.match(body, /restoreProjectDialog\.showModal\(\)/);
});

test('confirmation consumes token, refreshes projects, and never switches editor context', () => {
  const body = script.match(/async function confirmProjectRestore\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(body, /const token = pendingProjectRestoreToken;/);
  assert.match(body, /pendingProjectRestoreToken = null;/);
  assert.match(body, /window\.api\.confirmRestoreProject\(\{ token \}\)/);
  assert.match(body, /projectBackupStatus\.textContent = 'กำลังกู้คืนโครงการ…';[\s\S]*await window\.api\.confirmRestoreProject/);
  assert.match(body, /confirmRestoreProjectBtn\.disabled = true/);
  assert.match(body, /cancelRestoreProjectBtn\.disabled = true/);
  assert.match(body, /restoreProjectDialog\.close\(\)/);
  assert.match(body, /result\.project/);
  assert.match(body, /updateSavedProjectsList\(\)/);
  assert.doesNotMatch(body, /loadFolder\(/);
  assert.match(body, /finally\s*\{[\s\S]*confirmRestoreProjectBtn\.disabled = false;[\s\S]*cancelRestoreProjectBtn\.disabled = false;/);
});

test('confirmation failures close the consumed-token dialog before reporting the visible error', () => {
  const body = script.match(/async function confirmProjectRestore\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  const visibleFailure = /restoreProjectDialog\.close\(\);\s*projectBackupStatus\.textContent = 'ไม่สามารถกู้คืนโครงการได้ กรุณาเลือกไฟล์สำรองใหม่';/g;
  assert.equal([...body.matchAll(visibleFailure)].length, 2, 'response and thrown failures must both close before status');
  assert.match(body, /const token = pendingProjectRestoreToken;\s*pendingProjectRestoreToken = null;/);
});

test('all close paths clear tokens and partial responses use stable Thai errors', () => {
  assert.match(script, /function invalidatePendingProjectRestore\(\)[\s\S]*try\s*\{[\s\S]*confirmRestoreProject\(\{ token, cancel: true \}\)[\s\S]*\.catch\(\(\) => \{\}\)[\s\S]*catch\s*\(_\)\s*\{\}/);
  assert.match(script, /function cancelProjectRestore\(\)[\s\S]*invalidatePendingProjectRestore\(\)[\s\S]*restoreProjectDialog\.close\(\)/);
  assert.match(script, /restoreProjectDialog\.addEventListener\('cancel',[\s\S]*cancelProjectRestore\(\)/);
  assert.match(script, /restoreProjectDialog\.addEventListener\('close',[\s\S]*invalidatePendingProjectRestore\(\)/);
  assert.match(script, /restoreProjectDialog\.addEventListener\('click',[\s\S]*event\.target === restoreProjectDialog[\s\S]*cancelProjectRestore\(\)/);
  assert.match(script, /ไม่สามารถสำรองโครงการได้/);
  assert.match(script, /ไม่สามารถตรวจสอบไฟล์สำรองได้/);
  assert.match(script, /ไม่สามารถกู้คืนโครงการได้/);
  assert.match(script, /ข้อมูลไฟล์สำรองไม่สมบูรณ์/);
});

test('project loading enables backup and controls have responsive accessible CSS hooks', () => {
  assert.match(script, /currentProject = res\.project;[\s\S]*backupProjectBtn\.disabled = false;/);
  assert.match(script, /backupProjectBtn\.addEventListener\('click', backupCurrentProject\)/);
  assert.match(script, /restoreProjectBtn\.addEventListener\('click', inspectBackupForRestore\)/);
  assert.match(css, /\.project-backup-actions\s*\{/);
  assert.match(css, /\.project-restore-dialog\s*\{/);
  assert.match(css, /\.project-restore-summary\s+dl\s*\{/);
  assert.match(css, /\.project-backup-actions[^}]*:focus-visible|\.project-restore-dialog[^}]*:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)[\s\S]*\.project-backup-actions/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
