# Filesystem and Window Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Electron web security while preserving Unicode-named projects and loading only explicitly authorized local comic assets.

**Architecture:** Pure Node helpers validate Unicode path segments, enforce root containment, and maintain main-process source-folder authorization. A custom `mirai-asset://local/<base64url>` protocol serves allowlisted image files; renderer code receives protocol URLs rather than constructing `file://` URLs. BrowserWindow navigation and popup policies deny escape from the packaged UI.

**Tech Stack:** Electron 33 `protocol`/`net`, Node.js CommonJS, `node:test`, existing main/preload/renderer IPC.

## Global Constraints

- Preserve Thai, Chinese, Japanese, spaces, and Unicode punctuation in project/chapter/page names.
- Reject traversal, separators, NUL/control characters, Windows trailing dots/spaces, and reserved device names.
- Preserve existing project folders, mappings, and `mirai-comictranslator-backup` archives.
- Preserve folder selection and drag/drop; a dropped folder requires one native authorization confirmation before main-process access.
- Never serve non-image files through the local asset protocol.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and set `webSecurity: true`.
- Do not move project storage, package the app, change Gemini models, export behavior, or LaMa setup in this plan.

---

### Task 1: Unicode-safe path and authorization helpers

**Files:**
- Create: `lib/safe-paths.js`
- Create: `lib/source-folder-registry.js`
- Create: `test/safe-paths.test.js`
- Create: `test/source-folder-registry.test.js`

**Interfaces:**
- Produces: `validatePathSegment(value, label)`, `resolveWithin(root, ...segments)`, `isWithin(root, candidate)`, and `createSourceFolderRegistry({ path, initialRoots })` with `authorize(root)`, `isAuthorized(candidate)`, and `listRoots()`.

- [ ] **Step 1: Write failing path tests**

```js
test('accepts Thai Chinese Japanese spaces and ordinary Unicode punctuation', () => {
  for (const name of ['ตอนที่ 1', '第一話', '第１話', 'โปรเจกต์—พิเศษ']) {
    assert.equal(validatePathSegment(name, 'name'), name);
  }
});

test('rejects traversal separators controls trailing Windows dots and device names', () => {
  for (const name of ['', '.', '..', '../escape', 'a/b', 'a\\b', 'bad\0name', 'chapter. ', 'CON', 'LPT1.png']) {
    assert.throws(() => validatePathSegment(name, 'name'));
  }
});

test('resolves only descendants of an absolute root', () => {
  assert.equal(resolveWithin('C:\\projects', 'เรื่องไทย', 'ตอน 1'), 'C:\\projects\\เรื่องไทย\\ตอน 1');
  assert.throws(() => resolveWithin('projects', 'ตอน 1'), /absolute/);
});
```

Run: `node --test test/safe-paths.test.js`

Expected: FAIL because `lib/safe-paths.js` does not exist.

- [ ] **Step 2: Implement minimal Unicode-safe containment**

Use `path.resolve`, `path.relative`, and case-insensitive comparison on Windows. Validation must not trim or normalize an accepted name because that would change existing on-disk identities.

- [ ] **Step 3: Verify path tests GREEN**

Run: `node --test test/safe-paths.test.js`

Expected: all path cases pass.

- [ ] **Step 4: Write failing registry tests**

Test exact-root and descendant authorization, case-insensitive Windows paths, sibling-prefix rejection (`C:\comic` must not authorize `C:\comic-evil`), relative-root rejection, and duplicate authorization.

- [ ] **Step 5: Implement registry and verify GREEN**

The registry stores canonical absolute roots and uses `isWithin()` for authorization. It exposes copies, not its mutable internal set.

Run: `node --test test/source-folder-registry.test.js`

Expected: all registry tests pass.

- [ ] **Step 6: Run full tests and commit**

Run: `npm.cmd test`

```powershell
git add lib/safe-paths.js lib/source-folder-registry.js test/safe-paths.test.js test/source-folder-registry.test.js
git commit -m "feat: add Unicode-safe filesystem boundaries"
```

---

### Task 2: Secure local image protocol

**Files:**
- Create: `lib/local-asset-protocol.js`
- Create: `test/local-asset-protocol.test.js`

**Interfaces:**
- Consumes: `isWithin()` and a callback returning current allowed roots.
- Produces: `createLocalAssetProtocol({ path, allowedRoots, allowedExtensions })` with `urlForPath(absolutePath)` and `resolveRequestUrl(url)`.

- [ ] **Step 1: Write failing protocol tests**

Cover Unicode round-trip, malformed base64/URL input, relative paths, root escape, sibling-prefix escape, unsupported extensions, and case-insensitive image extensions. The URL format is `mirai-asset://local/<base64url-encoded-absolute-path>`.

Run: `node --test test/local-asset-protocol.test.js`

Expected: FAIL because the protocol helper does not exist.

- [ ] **Step 2: Implement URL creation and resolution**

```js
const DEFAULT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.jfif']);

function urlForPath(absolutePath) {
  if (!path.isAbsolute(absolutePath)) throw new Error('Asset path must be absolute');
  return `mirai-asset://local/${Buffer.from(absolutePath, 'utf8').toString('base64url')}`;
}
```

`resolveRequestUrl()` must decode strictly, require host `local`, require exactly one pathname segment, confirm an image extension, and confirm containment in at least one current allowed root.

- [ ] **Step 3: Verify focused and full tests**

Run: `node --test test/local-asset-protocol.test.js`

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```powershell
git add lib/local-asset-protocol.js test/local-asset-protocol.test.js
git commit -m "feat: add secure local asset protocol"
```

---

### Task 3: Main-process filesystem integration

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `src/index.js`
- Create: `test/filesystem-security-contract.test.js`
- Create: `test/unicode-folder-naming.test.js`

**Interfaces:**
- Consumes: Tasks 1-2 helpers.
- Produces: authorized `select-folder`, `authorize-source-folder`, guarded `read-folder`/translation paths, `mirai-asset` URLs, and validated project/output paths.

- [ ] **Step 1: Write failing integration contracts**

Assert that `main.js` uses `resolveWithin()` for every renderer-controlled project/chapter/page write, does not interpolate `file:///`, returns `assetProtocol.urlForPath()`, checks `sourceFolders.isAuthorized()` before folder/image reads, and exposes `authorizeSourceFolder(folderPath)` in preload.

Run: `node --test test/filesystem-security-contract.test.js`

Expected: FAIL on current direct `path.join`, `file:///`, and unrestricted reads.

- [ ] **Step 2: Write failing Unicode folder-name tests**

Extract `deriveProjectChapter(folderName)` into `lib/safe-paths.js`. Verify `เรื่องไทย_12` becomes `{ project: 'เรื่องไทย', chapter: '12' }`, `第一話` stays `{ project: '第一話', chapter: '01' }`, invalid/reserved names fall back to `{ project: 'default', chapter: '01' }`, and names are never ASCII-stripped.

- [ ] **Step 3: Register trusted roots**

Initialize the registry with existing valid `projects_map.json` values and last-folder data. Folder dialog selection authorizes its returned path. Drag/drop calls `authorize-source-folder`; main validates the directory and shows a native confirmation containing the resolved path before authorizing. Cancellation returns `{ authorized: false }`.

- [ ] **Step 4: Guard source reads and managed writes**

Before `read-folder`, `translate-page`, or protocol serving, require source authorization. Replace renderer-controlled `path.join(PROJECTS_DIR|OUTPUT_DIR, ...)` with `resolveWithin()`. Validate map keys and rename inputs before reads, writes, renames, or deletes. Keep existing store-level validation as defense in depth.

- [ ] **Step 5: Replace renderer file URLs**

Return `fileUrl: assetProtocol.urlForPath(absolutePath)` from folder/watermark/mask/paint loaders. Update renderer code to use returned `fileUrl` directly and remove every `file:///` construction.

- [ ] **Step 6: Verify integration**

Run: `node --test test/filesystem-security-contract.test.js test/unicode-folder-naming.test.js`

Run: `npm.cmd test`

Expected: all existing projects/backup tests and new security tests pass.

- [ ] **Step 7: Commit**

```powershell
git add main.js preload.js src/index.js lib/safe-paths.js test/filesystem-security-contract.test.js test/unicode-folder-naming.test.js
git commit -m "feat: enforce authorized Unicode-safe file access"
```

---

### Task 4: Electron web and navigation security

**Files:**
- Modify: `main.js`
- Modify: `src/index.html`
- Create: `test/electron-window-security.test.js`

**Interfaces:**
- Consumes: Task 2 protocol resolver and Task 3 authorized roots.
- Produces: privileged scheme registration, protocol handler, `webSecurity: true`, restrictive CSP, denied popups, and blocked unexpected navigation.

- [ ] **Step 1: Write failing window-security tests**

Assert privileged scheme registration occurs before `app.whenReady`, `protocol.handle('mirai-asset', ...)` uses `net.fetch(pathToFileURL(...))`, BrowserWindow has `webSecurity: true`, `setWindowOpenHandler(() => ({ action: 'deny' }))`, a `will-navigate` guard, and HTML includes a CSP allowing only self/data/mirai-asset images plus required inline styles.

Run: `node --test test/electron-window-security.test.js`

Expected: FAIL because current code has `webSecurity: false` and no protocol/window policy.

- [ ] **Step 2: Register and handle the protocol**

Import Electron `protocol`/`net` and Node `pathToFileURL`. Register `mirai-asset` as standard and secure before readiness. Inside `app.whenReady`, install one handler that resolves through the pure helper and returns `net.fetch()` for the resulting file URL; reject invalid requests with a non-success `Response`.

- [ ] **Step 3: Enable window and document restrictions**

Set `webSecurity: true`, deny `window.open`, prevent navigation unless the destination equals the current packaged document URL, and add CSP:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: blob: mirai-asset:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://127.0.0.1:* https://generativelanguage.googleapis.com">
```

- [ ] **Step 4: Run focused/full tests and Electron smoke test**

Run: `node --test test/electron-window-security.test.js test/local-asset-protocol.test.js`

Run: `npm.cmd test`

Then launch with a temporary APPDATA directory, authorize a Thai-named sample folder, confirm thumbnails render, settings open, unexpected popup/navigation are denied by contract, and close the app without touching the real config.

- [ ] **Step 5: Commit**

```powershell
git add main.js src/index.html test/electron-window-security.test.js
git commit -m "feat: enable Electron web and navigation security"
```
