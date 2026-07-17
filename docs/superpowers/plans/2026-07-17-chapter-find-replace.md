# Chapter Find and Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add previewable, selectively applied chapter-wide replacement for translated bubble text with rollback and one-batch undo.

**Architecture:** A pure `chapter-find-replace.js` module owns Unicode literal matching, immutable result generation, selected-result application, and sequential transaction orchestration. The renderer owns dialog state, page loading, grouped preview, navigation, cache invalidation, and active-page refresh.

**Tech Stack:** Electron renderer, vanilla JavaScript, Unicode property escapes, Node built-in test runner, existing atomic page-translation IPC.

## Global Constraints

- Only `translated_text` may change.
- Matching is case-insensitive; whole-word mode defaults to enabled.
- Empty search is invalid; empty replacement is valid.
- One result represents one bubble and reports all occurrences in that bubble.
- Page writes are sequential; failure triggers reverse rollback of already-saved pages.
- Only the latest successful batch is retained for in-memory undo.

---

### Task 1: Unicode find/replace engine

**Files:**
- Create: `src/chapter-find-replace.js`
- Create: `test/chapter-find-replace.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `replaceLiteral(text, search, replacement, wholeWord) -> { text, count }`
- Produces: `findChapterMatches(pages, search, replacement, wholeWord) -> result[]`
- Produces: `applySelectedMatches(pages, results, selectedKeys) -> Map<pageIndex, bubble[]>`
- Produces: `resultKey(pageIndex, bubbleId) -> string`

- [ ] Write failing tests for literal metacharacters, Unicode case-insensitive matching, whole-word Latin boundaries, Thai combining marks, substring mode, repeated occurrences, empty search, empty replacement, immutable results, and selected-only application.
- [ ] Run `node --test test/chapter-find-replace.test.js` and confirm failure because the module is missing.
- [ ] Implement literal scanning with Unicode word-character boundary checks and immutable result objects.
- [ ] Implement deep-copy selected application that changes only `translated_text`.
- [ ] Load the helper before `index.js`, run focused tests, and commit `feat: find and replace translated chapter text`.

### Task 2: Atomic batch transaction and undo orchestration

**Files:**
- Modify: `src/chapter-find-replace.js`
- Modify: `test/chapter-find-replace.test.js`

**Interfaces:**
- Produces: `saveReplacementBatch({ originals, updates, savePage }) -> { ok, changedIndices, undoRecord?, error?, rollbackErrors? }`
- Produces: `undoReplacementBatch(undoRecord, savePage) -> { ok, restoredIndices, error? }`

- [ ] Add failing tests for sequential successful saves, failure stopping later writes, reverse rollback, rollback error reporting, and undo retaining original page order.
- [ ] Run the focused test and confirm missing functions fail.
- [ ] Implement sequential transaction orchestration without renderer dependencies.
- [ ] Run focused tests and commit `feat: transact chapter text replacements safely`.

### Task 3: Full-workspace dialog and editor synchronization

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`
- Create: `test/chapter-find-replace-ui-contract.test.js`

**Interfaces:**
- Consumes: all `window.ChapterFindReplace` interfaces from Tasks 1 and 2.
- Produces renderer functions: `runChapterFindReplaceSearch()`, `renderChapterFindReplaceResults()`, `applyChapterFindReplace()`, `undoLastChapterReplace()`, and `openFindReplaceResult(pageIndex, bubbleId)`.

- [ ] Write failing contract tests for one command, one dialog, whole-word default, select-all/none, grouped results, before/after fields, selected totals, apply confirmation, navigation, status/progress, and undo control.
- [ ] Run the UI contract test and confirm missing contracts fail.
- [ ] Add toolbar command and full-workspace dialog with accessible controls and stable IDs.
- [ ] Load all page translations tolerantly, run pure search, store selection keys separately, and render grouped page/bubble results.
- [ ] Apply selected results through `saveReplacementBatch`, show confirmation totals, and retain only the latest successful undo record.
- [ ] On success or undo, invalidate changed page caches, reload the active page if changed, rerender warnings/filters/preview, and refresh page status indicators.
- [ ] Implement result navigation by closing the dialog and calling `selectPage(pageIndex)` followed by bubble focus/highlight.
- [ ] Run focused tests and commit `feat: add chapter find and replace workspace`.

### Task 4: Regression verification

**Files:**
- Modify only if verification identifies a defect.

- [ ] Run `node --check src/index.js` and all find/replace focused tests.
- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Run `git diff --check`, inspect `git status --short`, and preserve `.agents/`.
- [ ] Inspect the final diff to verify no `original_text`, glossary, image, or export write path changed.
