# Facebook Balanced Slice Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distribute Facebook export slices proportionally across selected source pages with a default chapter target of 33 images.

**Architecture:** Extend the pure Facebook export module with deterministic largest-remainder allocation and equal-height rectangle generation. The renderer loads source dimensions once, calculates a chapter plan, displays its exact count, then composes and slices each page according to that plan; ZIP creation remains unchanged.

**Tech Stack:** Electron renderer Canvas, UMD/CommonJS JavaScript, Node.js built-in test runner

## Global Constraints

- Choices are exactly 11, 22, 33, and 44; default is 33.
- Every selected page receives at least one slice.
- Output uses source width, JPEG quality 0.95, continuous automatic names, and the existing named ZIP workflow.
- No OCR/smart cuts, manual cut lines, or Facebook upload.

---

### Task 1: Balanced allocation and rectangles

**Files:** Modify `src/facebook-export.js`; modify `test/facebook-export.test.js`.

**Interfaces:** Produce `allocateSliceCounts(heights, maximum) -> number[]` and `getEqualSliceRects(width, height, count) -> rect[]`.

- [ ] Add failing tests for `[100,100,100]` at 6 => `[2,2,2]`, proportional uneven heights, stable ties, maximum below page count, tiny heights, exact total, and gap-free rectangles.
- [ ] Run `node --test test/facebook-export.test.js`; verify failures for missing functions.
- [ ] Implement largest-remainder allocation with one slice per page and pixel-height caps; implement integer rectangles using quotient/remainder distribution.
- [ ] Retain `formatSliceName`; remove obsolete fixed-4:5 exports after renderer migration.
- [ ] Run focused tests and commit `feat: balance Facebook slices by page height`.

### Task 2: Export UI and renderer workflow

**Files:** Modify `src/index.html`; modify `src/index.js`; modify `test/facebook-ui-contract.test.js`.

**Interfaces:** Add select `facebookMaxImages`; replace dimension estimator with `buildFacebookSlicePlan(indices, maximum) -> Array<{index,rectangles}>`; update `sliceCanvasForFacebook(canvas,startSequence,rectangles)`.

- [ ] Update the UI contract test to require 11/22/33/44, default 33, balanced explanatory copy, and absence of user-facing `4:5` text.
- [ ] Run the focused contract test and verify failure.
- [ ] Add the maximum selector beside ZIP name and update title/warning copy.
- [ ] Load selected image dimensions once, call `allocateSliceCounts`, build exact rectangles, and show the exact planned total in confirmation.
- [ ] Compose pages sequentially and pass each page's planned rectangles into slicing; preserve progress, cancellation, naming, JPEG quality, and archive IPC.
- [ ] Run focused tests, full suite, syntax checks, and commit `feat: limit Facebook export with balanced slicing`.

### Task 3: Verification

**Files:** Modify Task 1–2 files only if a defect is found.

- [ ] Run `npm.cmd test`, `node --check src/index.js`, and `node --check src/facebook-export.js`; expect zero failures.
- [ ] Launch the current 11-page sample, select maximum 33, and verify confirmation reports 33.
- [ ] Verify selection subsets, options 11/22/44, natural ordering, ZIP names, and cancellation.
- [ ] Export the 33-image sample and inspect first/middle/final dimensions plus ZIP entries.
- [ ] Run `git diff --check` and ensure the worktree is clean; commit verification fixes only if needed.
