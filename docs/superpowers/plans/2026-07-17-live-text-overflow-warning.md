# Live Text Overflow Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show advisory amber/red overflow warnings immediately while a translated bubble is edited or resized.

**Architecture:** Extend the existing pure text-overflow helper to return detailed usage metrics while preserving its boolean API. The renderer keeps an in-memory warning map, performs one scan after page rendering, and recalculates only the changed bubble during editing.

**Tech Stack:** Electron renderer, vanilla JavaScript, Canvas 2D text measurement, SVG/CSS, Node built-in test runner.

## Global Constraints

- `near` begins at 85% vertical usage; `overflow` means height or token width exceeds the available box.
- Hidden bubbles show no live warning.
- Warnings never write JSON or block save/export.
- Export Quality and live warnings use the same measurement helper.
- No automatic font-size or geometry changes.

---

### Task 1: Shared detailed text measurement

**Files:**
- Modify: `src/text-overflow.js`
- Modify: `test/text-overflow.test.js`

**Interfaces:**
- Produces: `measureTextOverflow(input, adapter) -> { status, lineCount, requiredHeight, availableHeight, usage, hasWideToken }`
- Preserves: `isTextOverflowing(input, adapter) -> boolean`

- [ ] Write failing tests for safe, 85% near, vertical overflow, wide-token overflow, empty text, and invalid geometry.
- [ ] Run `node --test test/text-overflow.test.js` and confirm failure because `measureTextOverflow` is missing.
- [ ] Implement metrics from the existing wrapping and measurement logic; make `isTextOverflowing` return `measureTextOverflow(...).status === 'overflow'`.
- [ ] Run the focused test and commit `feat: report detailed text overflow status`.

### Task 2: Renderer warnings and lifecycle integration

**Files:**
- Modify: `src/index.js`
- Modify: `src/style.css`
- Create: `test/live-overflow-warning-integration.test.js`

**Interfaces:**
- Consumes: `window.TextOverflow.measureTextOverflow`.
- Produces renderer functions: `scanLiveOverflowWarnings()`, `updateLiveOverflowWarning(bubble)`, and `applyLiveOverflowWarning(bubbleId)`.

- [ ] Write failing integration tests asserting one full scan after page render, targeted updates after text/font/drag/resize/Undo/Redo/copy/inline confirmation, removal on hide/delete, badge click focus, and CSS for `near`/`overflow` states.
- [ ] Run `node --test test/live-overflow-warning-integration.test.js` and confirm the expected missing-contract failures.
- [ ] Add an in-memory warning map and one reusable offscreen canvas context. Calculate effective box pixels from the loaded image and reuse the shared metric helper.
- [ ] Add SVG classes and clickable card badges without persisting state. Hidden, deleted, reset, and page-changed bubbles clear their entries.
- [ ] Wire the initial scan and targeted recalculation hooks, preserving all existing save behavior.
- [ ] Run focused tests, then `npm.cmd test`, and commit `feat: warn about overflowing translations live`.

### Task 3: Manual verification and integration

**Files:**
- Modify only when a failing test or smoke test identifies a defect.

- [ ] Launch the isolated worktree with copied project data.
- [ ] Type and resize one bubble through safe, near, and overflow states; verify badge click focuses it.
- [ ] Open Export Quality and confirm export can continue despite overflow.
- [ ] Run `npm.cmd test`, `git diff --check`, and inspect `git status --short`.
- [ ] Merge the verified branch into `master`, rerun `npm.cmd test`, and keep `.agents/` untouched.
