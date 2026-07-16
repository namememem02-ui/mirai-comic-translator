# Copy Translation from Previous Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed three-mode workflow for copying saved translation data from the immediately preceding page.

**Architecture:** Put all matching, cloning, style selection, preview counting, and ID allocation in a pure UMD/CommonJS module. Keep page loading, stale-page protection, Undo, atomic saving, rendering, and modal state in the existing renderer.

**Tech Stack:** Electron 33, browser JavaScript, CommonJS-compatible UMD modules, HTML `<dialog>`, Node built-in test runner.

## Global Constraints

- The default mode is `text`; no page data changes before explicit confirmation.
- Text modes pair bubbles by array order and process `min(sourceCount, currentCount)` pairs.
- Full-bubble mode appends source bubbles and assigns new unique integer IDs.
- Existing atomic page-save and Undo systems must be reused.
- Do not copy masks, paint layers, watermarks, cleaned backgrounds, or arbitrary pages.

---

### Task 1: Pure Copy Engine

**Files:**
- Create: `src/copy-previous-page.js`
- Test: `test/copy-previous-page.test.js`

**Interfaces:**
- Consumes: `{ source: Bubble[], current: Bubble[], mode: 'text'|'text-style'|'full-bubble' }`.
- Produces: `buildCopyPreview(input)` returning counts and `canConfirm`; `copyPreviousPage(input)` returning a deep-cloned `Bubble[]`.

- [ ] **Step 1: Write failing behavior tests**

Test that text-only changes only paired `translated_text`, text-style copies/removes the five style fields while preserving identity/geometry/source state, full-bubble appends deep copies with sequential unique IDs, unequal counts report unmatched items, empty source cannot confirm, and invalid modes throw `Unknown copy mode`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/copy-previous-page.test.js`

Expected: FAIL because `../src/copy-previous-page` does not exist.

- [ ] **Step 3: Implement the pure API**

Use a UMD wrapper matching other renderer helpers. Define:

```js
const STYLE_FIELDS = ['font_size', 'font_family', 'text_align', 'text_color', 'outline'];

function buildCopyPreview({ source = [], current = [], mode = 'text' } = {}) {
  validateMode(mode);
  const pairedCount = mode === 'full-bubble' ? 0 : Math.min(source.length, current.length);
  return {
    sourceCount: source.length,
    currentCount: current.length,
    pairedCount,
    appendedCount: mode === 'full-bubble' ? source.length : 0,
    unmatchedSourceCount: mode === 'full-bubble' ? 0 : Math.max(0, source.length - pairedCount),
    unmatchedCurrentCount: mode === 'full-bubble' ? 0 : Math.max(0, current.length - pairedCount),
    canConfirm: source.length > 0 && (mode === 'full-bubble' || pairedCount > 0)
  };
}
```

`copyPreviousPage` must deep-clone inputs, use the preview pairing count, copy the exact fields from the spec, and compute the first new ID as one greater than the highest finite numeric current ID, or `1` when none exists.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/copy-previous-page.test.js`

Expected: all copy-engine tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/copy-previous-page.js test/copy-previous-page.test.js
git commit -m "feat: calculate previous-page copy results"
```

### Task 2: Toolbar and Confirmation Dialog

**Files:**
- Modify: `src/index.html`
- Modify: `src/styles.css`
- Test: `test/copy-previous-page-ui-contract.test.js`

**Interfaces:**
- Consumes: the pure module via `window.CopyPreviousPage`.
- Produces DOM IDs `copyPreviousPageBtn`, `copyPreviousPageDialog`, `copyPreviousSourcePage`, `copyPreviousCounts`, `copyPreviousMode`, `copyPreviousWarning`, `cancelCopyPreviousBtn`, and `confirmCopyPreviousBtn`.

- [ ] **Step 1: Write a failing UI contract test**

Read HTML/CSS as text and assert the toolbar button and all dialog IDs exist exactly once, `copy-previous-page.js` loads before `index.js`, the select has values `text`, `text-style`, and `full-bubble`, and the dialog has shared `dialog-actions` styling hooks.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test test/copy-previous-page-ui-contract.test.js`

Expected: FAIL because the button, dialog, and script tag do not exist.

- [ ] **Step 3: Add accessible UI**

Add the toolbar button after Undo/Redo, disabled by default. Add a modal after the settings dialog with a heading, source/count summary, mode `<select>`, warning area, Cancel button, and disabled Confirm button. Load `copy-previous-page.js` before `index.js`. Style the dialog through focused `.copy-previous-*` selectors while reusing the existing grid tokens and button classes.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `node --test test/copy-previous-page-ui-contract.test.js`

Expected: all UI contract tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/index.html src/styles.css test/copy-previous-page-ui-contract.test.js
git commit -m "feat: add previous-page copy dialog"
```

### Task 3: Renderer Workflow, Safety, and Verification

**Files:**
- Modify: `src/index.js`
- Test: `test/copy-previous-page-integration.test.js`

**Interfaces:**
- Consumes: existing `window.api.loadPageTranslation`, `saveCurrentPageTranslation`, `pushUndoState`, `pageRenderGuard`, and `window.CopyPreviousPage`.
- Produces: page-aware button state, preview loading, mode refresh, confirmed copy, rollback on save failure, and renderer refresh.

- [ ] **Step 1: Write a failing renderer integration contract**

Assert that the renderer disables the button when `activeIndex <= 0`, loads `images[activeIndex - 1]`, captures the active page/render token before awaiting, calls `buildCopyPreview` on load and mode change, calls `pushUndoState()` before replacement, awaits `saveCurrentPageTranslation()`, restores the prior data and Undo stack on failure, deletes `cleanedBgCache[activePage.name]`, and refreshes both normal and Thai-preview renderers after success.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `node --test test/copy-previous-page-integration.test.js`

Expected: FAIL because no copy workflow exists in `src/index.js`.

- [ ] **Step 3: Implement renderer orchestration**

Cache the dialog DOM references. Update the button at the end of every `selectPage` and when no project/page is active. On click, capture `{ activeIndex, pageName, renderToken }`, load the previous JSON, reject a stale response, normalize non-arrays to `[]`, render the preview, and call `showModal()`. Rebuild the preview on mode change.

On confirmation: deep-clone the current state, remember Undo length, compute the result, call `pushUndoState()` once, assign the result, invalidate the cleaned background, then await save. Treat any value other than `true` as failure. On failure restore the previous data and Undo length, render the restored page, and show a Thai error. On success close the dialog, render cards/overlays, and refresh Thai preview if active. Cancel and page changes close the dialog without mutation.

- [ ] **Step 4: Run focused tests and the full suite**

Run:

```powershell
node --test test/copy-previous-page.test.js test/copy-previous-page-ui-contract.test.js test/copy-previous-page-integration.test.js
npm.cmd test
git diff --check
```

Expected: all focused tests PASS, full suite reports zero failures, and diff check emits no errors.

- [ ] **Step 5: Smoke-test Electron**

Open ComicTranslator, verify page one has a disabled button, page two opens the modal, changing modes updates counts, Cancel leaves data unchanged, Confirm changes the expected fields, and one Undo restores the complete previous state.

- [ ] **Step 6: Commit**

```powershell
git add src/index.js test/copy-previous-page-integration.test.js
git commit -m "feat: copy translations from previous page"
```
