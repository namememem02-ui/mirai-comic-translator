# Chapter Review Cache and Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache screen-sized translated review pages for one review session, prepare all selected pages in the background, and expose determinate progress.

**Architecture:** Add pure preview sizing and progress helpers to `review-controller.js`, then make the renderer retain encoded previews until review close. The renderer queues every selected page once, restores cache hits without recomposition, and keeps the existing full-resolution export path unchanged.

**Tech Stack:** Electron renderer, vanilla JavaScript, Canvas 2D, Node built-in test runner.

## Global Constraints

- Maximum review-preview width is 1600 pixels and smaller images are never enlarged.
- Review cache is memory-only and is cleared when Chapter Review closes.
- All selected pages are prepared, including pages outside the viewport.
- Failed pages count as finished for the current pass and retain their source preview.
- Export composition and resolution must not change.

---

### Task 1: Pure preview sizing and progress state

**Files:**
- Modify: `src/review-controller.js`
- Modify: `test/review-controller.test.js`

**Interfaces:**
- Produces: `calculateReviewPreviewSize(width, height, maxWidth = 1600) -> { width, height }`
- Produces: `getReviewProgress(selectedIndices, cache, finishedIndices) -> { value, max, label, complete }`

- [ ] Add failing tests that assert 2400x6000 becomes 1600x4000, 1200x3000 remains unchanged, empty selection reports `ไม่มีหน้าที่เลือก`, partial reports `กำลังเตรียมภาพแปล 1/3 หน้า`, and complete reports `พร้อมรีวิว 3/3 หน้า`.
- [ ] Run `node --test test/review-controller.test.js` and confirm failure because both helpers are missing.
- [ ] Implement clamped aspect-preserving dimensions and progress derived from cached or finished page indices.
- [ ] Run the focused test and commit `feat: calculate chapter review preview progress`.

### Task 2: Session cache, background queue, and progress UI

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`
- Create: `test/review-cache-progress-contract.test.js`

**Interfaces:**
- Consumes: `window.ReviewController.calculateReviewPreviewSize` and `getReviewProgress`.
- Produces: `updateReviewProgress()`, `enqueueSelectedReviewPages()`, and session-only `reviewFinished` state.

- [ ] Add failing contract tests for progress DOM elements, downscaled JPEG encoding, no `reviewCache.delete(index)`, cache-hit restoration, all-selected background enqueue, progress updates, and cache clearing on close.
- [ ] Run `node --test test/review-cache-progress-contract.test.js` and confirm the missing contracts fail.
- [ ] Add `#chapterReviewProgress` and `#chapterReviewProgressText` to the review header with accessible progress semantics and compact Gridgeist styling.
- [ ] Before JPEG encoding, draw the composed full-resolution canvas into a preview canvas returned by `calculateReviewPreviewSize`; release both canvases after encoding.
- [ ] Keep `reviewCache` entries when pages leave the viewport; on intersection, restore cached data immediately and enqueue only idle uncached pages.
- [ ] After building pages, enqueue every selected idle uncached page. Use page status to prevent duplicate queue entries.
- [ ] Track completed and failed indices in `reviewFinished`, update progress after each result and selection rebuild, and clear cache/finished/queue state only on close or new review session.
- [ ] Run focused tests and commit `feat: cache chapter review previews with progress`.

### Task 3: Regression verification

**Files:**
- Modify only if verification finds a defect.

- [ ] Run `node --check src/index.js` and `node --test test/review-controller.test.js test/review-cache-progress-contract.test.js test/review-progressive-preview-contract.test.js`.
- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Run `git diff --check` and inspect `git status --short` to preserve the user-owned `.agents/` directory.
- [ ] Verify the final diff does not alter export composition functions or JPEG export quality.
