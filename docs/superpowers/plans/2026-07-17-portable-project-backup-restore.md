# Portable Project Backup and Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back up the current ComicTranslator project, including every registered chapter and source image, into a portable ZIP and safely restore it as a newly named copy.

**Architecture:** A pure Node module owns inventory, manifest, ZIP validation, extraction staging, and collision-free naming. Electron main owns native dialogs and atomic registration; preload exposes two narrow IPC calls; the renderer owns commands, confirmation, progress, and project-list refresh.

**Tech Stack:** Electron 33, Node.js filesystem/path APIs, JSZip 3.10, existing atomic JSON helper, Node built-in test runner, vanilla HTML/CSS/JavaScript.

## Global Constraints

- Archive format is `mirai-comictranslator-backup`, schema version `1`.
- Include all registered chapters, supported source images, translations, masks, paint layers, watermark files/settings, quality state, and project glossary.
- Exclude exports, API credentials, application settings, logs, caches, `.tmp`, and `.bak` files.
- Restore never overwrites; names use `<project>_สำเนา`, `<project>_สำเนา_2`, and so on.
- ZIP paths must be relative, declared in the manifest, normalized, and traversal-safe.
- Backup writes through a sibling temporary file; restore writes through a staging directory.
- Existing project directories and mappings must remain unchanged on failure.

---

### Task 1: Backup inventory and portable archive creation

**Files:**
- Create: `lib/project-backup.js`
- Create: `test/project-backup.test.js`

**Interfaces:**
- Produces: `buildProjectInventory({ project, projectsRoot, projectMap, appVersion }) -> inventory`
- Produces: `createProjectBackupBuffer(inventory) -> Promise<Buffer>`
- Produces: `sanitizeZipFilename(name) -> string`

- [ ] **Step 1: Write failing tests for inventory, inclusion, exclusion, missing sources, and ZIP naming**

```js
test('inventory includes every mapped chapter source and managed file', () => {
  const inventory = buildProjectInventory({ project: 'A', projectsRoot, projectMap, appVersion: '0.1.0' });
  assert.deepEqual(inventory.manifest.chapters.map(c => c.name), ['1', '2']);
  assert.ok(inventory.files.some(f => f.archivePath === 'data/glossary.json'));
  assert.ok(inventory.files.some(f => f.archivePath === 'source/chapter-001/001.jpg'));
  assert.ok(!inventory.files.some(f => /\.bak$|\.tmp$/.test(f.archivePath)));
});

test('missing registered source directory aborts backup', () => {
  assert.throws(() => buildProjectInventory(argsWithMissingSource), /source directory/i);
});

test('ZIP filename is Windows-safe and always has one zip extension', () => {
  assert.equal(sanitizeZipFilename(' A:*? '), 'A.zip');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/project-backup.test.js`  
Expected: FAIL because `../lib/project-backup` does not exist.

- [ ] **Step 3: Implement deterministic inventory and archive generation**

Implement allowlists:

```js
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.jfif']);
const MANAGED_FILE = /^(?:page_.*\.json|quality-state\.json|_watermark\.(?:json|png|jpe?g|webp)|custom_mask_.*\.png|custom_paint_.*\.png)$/i;
const FORMAT = 'mirai-comictranslator-backup';
const SCHEMA_VERSION = 1;
```

Sort chapters using numeric locale comparison, assign `chapter-001` IDs, retain validated image names, and reject duplicate archive paths. Create `manifest.json` plus each inventory file through JSZip using DEFLATE compression. Read buffers only from absolute paths produced by the inventory builder.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test test/project-backup.test.js`  
Expected: all Task 1 tests PASS.

```powershell
git add lib/project-backup.js test/project-backup.test.js
git commit -m "feat: create portable project backup archives"
```

### Task 2: Defensive archive validation and staged restore

**Files:**
- Modify: `lib/project-backup.js`
- Modify: `test/project-backup.test.js`

**Interfaces:**
- Produces: `inspectProjectBackup(buffer, limits?) -> Promise<{ manifest, summary, entries }>`
- Produces: `chooseRestoredProjectName(originalName, projectsRoot, projectMap) -> string`
- Produces: `restoreProjectBackup({ inspected, projectsRoot, projectMap, writeProjectMap }) -> Promise<{ project, chapterMappings }>`

- [ ] **Step 1: Add failing validation and restore transaction tests**

```js
test('inspection rejects traversal undeclared entries and unsupported versions', async () => {
  await assert.rejects(inspectProjectBackup(await zipWith('../escape.json')), /unsafe path/i);
  await assert.rejects(inspectProjectBackup(await zipWith('extra.txt')), /not declared/i);
  await assert.rejects(inspectProjectBackup(await archiveWithVersion(99)), /schema version/i);
});

test('restore chooses a copy name and registers all chapters', async () => {
  const result = await restoreProjectBackup({ inspected, projectsRoot, projectMap, writeProjectMap });
  assert.equal(result.project, 'A_สำเนา_2');
  assert.equal(result.chapterMappings.length, 2);
});

test('failed map registration removes staging and final copy only', async () => {
  await assert.rejects(restoreProjectBackup({ ...args, writeProjectMap: () => { throw new Error('map'); } }));
  assert.equal(fs.existsSync(existingProject), true);
  assert.equal(findStagingDirectories(projectsRoot).length, 0);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/project-backup.test.js`  
Expected: FAIL because inspection/restore exports are missing.

- [ ] **Step 3: Implement strict inspection and transactional extraction**

Use default limits of 10,000 entries, 512 MiB per file, 20 GiB total uncompressed bytes, and compression ratio 200. Normalize every entry with POSIX rules and reject absolute paths, drive prefixes, empty segments, `.`/`..`, backslashes, NUL/control characters, duplicates, directory/file conflicts, symlinks, and entries absent from the manifest. Verify manifest counts and every declared file before extraction.

Extract to `projects/.restore-<random>`, placing source images at `<copy>/_source/<chapter-id>` and managed data at `<copy>/<safe chapter name>`. Rename the staged project to its final collision-free name, then call `writeProjectMap(nextMap)`. On any failure, remove only paths created by this restore attempt.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test test/project-backup.test.js`  
Expected: all backup/restore tests PASS.

```powershell
git add lib/project-backup.js test/project-backup.test.js
git commit -m "feat: validate and restore portable project archives"
```

### Task 3: Electron dialogs, IPC, and atomic filesystem coordination

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Create: `test/project-backup-ipc-contract.test.js`

**Interfaces:**
- Consumes: all `lib/project-backup.js` interfaces.
- Produces renderer APIs: `window.api.backupProject({ project })`, `window.api.inspectProjectBackup()`, `window.api.confirmRestoreProject({ token })`.

- [ ] **Step 1: Write failing IPC contract tests**

```js
test('preload exposes narrow backup and two-stage restore operations', () => {
  assert.match(preload, /backupProject:.*backup-project/);
  assert.match(preload, /inspectProjectBackup:.*inspect-project-backup/);
  assert.match(preload, /confirmRestoreProject:.*confirm-restore-project/);
});

test('main uses native ZIP dialogs and atomic map updates', () => {
  assert.match(main, /showSaveDialog/);
  assert.match(main, /showOpenDialog/);
  assert.match(main, /writeJsonAtomic\(mapFile, nextMap\)/);
});
```

- [ ] **Step 2: Run contract tests and verify RED**

Run: `node --test test/project-backup-ipc-contract.test.js`  
Expected: FAIL because IPC APIs are missing.

- [ ] **Step 3: Implement main/preload coordination**

`backup-project` validates the selected project against `projects_map.json`, shows Save dialog with `<project>-backup.zip`, builds the archive, writes `<target>.tmp`, then renames it. `inspect-project-backup` shows Open dialog, reads and validates the ZIP, stores a short-lived in-memory token containing the selected absolute path plus inspection fingerprint, and returns only token/summary. `confirm-restore-project` re-reads and re-inspects the same path, verifies the fingerprint, restores, and atomically registers mappings. Clear tokens after use, cancel, or failure.

- [ ] **Step 4: Verify focused tests and commit**

Run: `node --test test/project-backup.test.js test/project-backup-ipc-contract.test.js`  
Expected: all focused tests PASS.

```powershell
git add main.js preload.js test/project-backup-ipc-contract.test.js
git commit -m "feat: coordinate project backup and restore dialogs"
```

### Task 4: Project backup and restore UI

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`
- Create: `test/project-backup-ui-contract.test.js`

**Interfaces:**
- Consumes: backup/inspect/confirm preload APIs from Task 3.
- Produces: `backupCurrentProject()`, `inspectBackupForRestore()`, `confirmProjectRestore()`.

- [ ] **Step 1: Write failing UI contract tests**

```js
test('project area exposes backup and restore commands plus confirmation dialog', () => {
  for (const id of ['backupProjectBtn', 'restoreProjectBtn', 'restoreProjectDialog',
    'restoreProjectSummary', 'confirmRestoreProjectBtn', 'cancelRestoreProjectBtn',
    'projectBackupStatus']) assert.match(html, new RegExp(`id="${id}"`));
});

test('restore confirms summary and refreshes saved projects without auto-opening', () => {
  assert.match(renderer, /async function inspectBackupForRestore\(\)/);
  assert.match(renderer, /async function confirmProjectRestore\(\)/);
  assert.match(renderer, /updateSavedProjectsList\(\)/);
  const body = renderer.match(/async function confirmProjectRestore\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(body, /loadFolder\(/);
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test test/project-backup-ui-contract.test.js`  
Expected: FAIL because controls/functions are missing.

- [ ] **Step 3: Implement commands, progress, summary, and confirmation**

Place both commands in the project information action group. Disable backup until a project is loaded; restore remains available. Render the inspected summary with escaped DOM text: source project, version, chapters, images, and formatted bytes. Disable controls while IPC is active, close confirmation after success, show the returned copy name, and call `updateSavedProjectsList()` without opening the restored project.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test test/project-backup-ui-contract.test.js test/project-backup-ipc-contract.test.js test/project-backup.test.js`  
Expected: all focused tests PASS.

```powershell
git add src/index.html src/style.css src/index.js test/project-backup-ui-contract.test.js
git commit -m "feat: add project backup and restore workspace"
```

### Task 5: Regression and archive round-trip verification

**Files:**
- Modify only if verification reveals a defect.

- [ ] Run `node --check main.js`, `node --check preload.js`, and `node --check src/index.js`; expect exit code 0.
- [ ] Run `node --test test/project-backup.test.js test/project-backup-ipc-contract.test.js test/project-backup-ui-contract.test.js`; expect zero failures.
- [ ] Run `npm.cmd test`; expect zero failures in the complete suite.
- [ ] Run `git diff --check` and `git status --short`; preserve the user-owned untracked `.agents/` directory.
- [ ] Inspect `git diff HEAD~4 -- main.js preload.js lib/project-backup.js src/index.js` and verify no API-key, export, or existing-project overwrite path was introduced.

