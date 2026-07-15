# Facebook Fixed-Slice Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Facebook export action that slices translated chapter pages into ordered 4:5 JPEG images and saves them in a user-named ZIP archive.

**Architecture:** A pure renderer-safe module calculates slice rectangles and filenames. The renderer reuses the existing page composition pipeline, cuts each composed canvas sequentially, and sends JPEG data to one new preload API; the main process validates the request, asks for the ZIP location, and writes the archive with JSZip.

**Tech Stack:** Electron 33, browser Canvas, CommonJS, JSZip, Node.js built-in test runner

## Global Constraints

- Output slices use the original source width and a height of `round(width × 1.25)`; never upscale or crop horizontally.
- The final slice keeps only the remaining height with no padding or stretching.
- JPEG quality is exactly `0.95`.
- Files inside the ZIP use one continuous sequence: `001.jpg`, `002.jpg`, and so on.
- The user names only the ZIP before saving; individual filenames are automatic.
- This phase does not add smart cut detection, manual cut lines, or Facebook upload.

---

### Task 1: Pure Facebook slicing rules

**Files:**
- Create: `src/facebook-export.js`
- Create: `test/facebook-export.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `getTargetSliceHeight(width) -> number`, `getSliceRects(width, height) -> Array<{x,y,width,height}>`, `formatSliceName(sequence) -> string`, exposed as `window.FacebookExport` and `module.exports`.

- [ ] **Step 1: Write failing unit tests** covering width `800` => height `1000`, a `2500`-pixel page => heights `[1000,1000,500]`, a short page, rounded fractional width, invalid dimensions, and filenames `001.jpg`/`1000.jpg`.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getTargetSliceHeight, getSliceRects, formatSliceName } = require('../src/facebook-export');

test('builds fixed 4:5 slices and preserves the remainder', () => {
  assert.equal(getTargetSliceHeight(800), 1000);
  assert.deepEqual(getSliceRects(800, 2500).map(r => r.height), [1000, 1000, 500]);
  assert.equal(formatSliceName(1), '001.jpg');
});
```

- [ ] **Step 2: Run `node --test test/facebook-export.test.js`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement the UMD-style pure module**, rejecting non-positive/non-finite dimensions with `TypeError`, iterating `y` until the full height is covered, and padding only sequences below 1000 with `String(sequence).padStart(3, '0')`.
- [ ] **Step 4: Add `<script src="facebook-export.js"></script>` before `index.js`**, rerun the focused test, and expect all tests to pass.
- [ ] **Step 5: Commit** with `git commit -m "feat: add Facebook slice calculations"`.

### Task 2: ZIP save boundary and filename validation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/facebook-archive.js`
- Create: `test/facebook-archive.test.js`
- Modify: `main.js`
- Modify: `preload.js`

**Interfaces:**
- Consumes: `{ archiveName, files: Array<{name,dataUrl}> }` from renderer.
- Produces: `sanitizeArchiveName(name) -> string`, `decodeJpegDataUrl(dataUrl) -> Buffer`, preload method `saveFacebookArchive(args)`, IPC response `{success, absolutePath}` or `{canceled:true}` / `{error}`.

- [ ] **Step 1: Install JSZip** with `npm install jszip@3.10.1 --save`.
- [ ] **Step 2: Write failing tests** asserting `ตอน 1` becomes `ตอน 1.zip`, path separators and Windows-invalid characters are removed, blank names fall back to `facebook-export.zip`, valid JPEG data URLs decode, and non-JPEG inputs throw.
- [ ] **Step 3: Run `node --test test/facebook-archive.test.js`** and verify failure because the helper does not exist.
- [ ] **Step 4: Implement `lib/facebook-archive.js`** with pure validation helpers; filenames must match `/^\d{3,}\.jpg$/` and JPEG payloads must start with `data:image/jpeg;base64,`.
- [ ] **Step 5: Add `save-facebook-archive` IPC handling** that calls `dialog.showSaveDialog` with the sanitized default name and ZIP filter, returns cancellation without writing, adds validated buffers to JSZip in input order, generates a Node buffer, and writes it to the chosen path.
- [ ] **Step 6: Expose `saveFacebookArchive` from preload**, run the focused archive test, `node --check main.js`, and `node --check preload.js`; expect success.
- [ ] **Step 7: Commit** with `git commit -m "feat: save Facebook image ZIP archives"`.

### Task 3: Renderer export workflow and UI

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: current export selection, existing `images`, translation/custom-paint/watermark state, `window.FacebookExport`, and `window.api.saveFacebookArchive`.
- Produces: `composeExportPage(index) -> Promise<HTMLCanvasElement>` shared by normal and Facebook export, `sliceCanvasForFacebook(canvas, startSequence) -> Array<{name,dataUrl}>`, and `runFacebookExport(indices) -> Promise<void>`.

- [ ] **Step 1: Extract the current per-page Canvas composition from `runExport` into `composeExportPage(index)`** without changing drawing order: inpainting, base image, custom paint, translated text, then watermark.
- [ ] **Step 2: Verify the normal exporter still calls `canvas.toDataURL('image/jpeg', 0.95)` and `saveTypesetImage`, then run `npm test` and expect all existing tests to pass.
- [ ] **Step 3: Add a `ส่งออก Facebook` button and warning** to the export dialog; keep the existing normal export button and all/selected-page controls unchanged.
- [ ] **Step 4: Implement fixed slicing** by drawing each rectangle returned by `getSliceRects` into a same-width temporary canvas, encoding with `toDataURL('image/jpeg', 0.95)`, and incrementing one sequence across every selected source page.
- [ ] **Step 5: Implement the workflow** to prompt for an archive name in the renderer, estimate slice count from loaded image dimensions, process one source page at a time, update progress, then call `saveFacebookArchive`; cancellation must show no success message.
- [ ] **Step 6: Add disabled/loading states** for both export actions during work and show the source filename in any composition/encoding error.
- [ ] **Step 7: Run `node --check src/index.js` and `npm test`**, expecting syntax success and a fully passing suite.
- [ ] **Step 8: Commit** with `git commit -m "feat: add Facebook fixed-slice export UI"`.

### Task 4: End-to-end verification

**Files:**
- Modify if needed: files from Tasks 1-3 only

**Interfaces:**
- Verifies the complete renderer-to-main-process behavior; produces no new API.

- [ ] **Step 1: Run `npm test`**, expecting every test to pass with zero failures.
- [ ] **Step 2: Run syntax checks**: `node --check main.js`, `node --check preload.js`, `node --check src/index.js`, `node --check src/facebook-export.js`, and `node --check lib/facebook-archive.js`; expect no output and exit code 0.
- [ ] **Step 3: Start with `npm start` and manually export a tall manhwa page**; verify slice dimensions at 4:5 except the remainder, sharpness at 100% zoom, correct Thai text/layer ordering, and the configured watermark on every slice.
- [ ] **Step 4: Open the ZIP** and verify continuous `001.jpg` ordering, no missing/duplicate image, a short final slice without padding, custom ZIP naming, and clean cancellation.
- [ ] **Step 5: Run `git diff --check` and `git status --short`**, then commit any verification fixes as `fix: finalize Facebook export workflow` only if changes were required.
