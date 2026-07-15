# Continuous Chapter Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen, lazy-rendered, continuous Thai chapter viewer with page selection and click-to-edit navigation.

**Architecture:** A testable review controller owns normalized viewer state and a two-job async queue. The renderer builds lightweight aspect-ratio page shells, uses IntersectionObserver to enqueue nearby pages, composes each page independently with existing translation/watermark rules, and invalidates late work when review closes.

**Tech Stack:** Electron renderer, vanilla JavaScript, IntersectionObserver, Canvas, Node.js built-in test runner.

## Global Constraints

- No giant chapter Canvas and no combined-file export.
- Saved translations and original images remain unchanged.
- At most two review pages render concurrently.
- Closing review invalidates late async results and releases review-only resources.
- No runtime dependency is added.

---

### Task 1: Review State and Queue

**Files:** Create `src/review-controller.js`, create `test/review-controller.test.js`, modify `src/index.html`.

**Interfaces:** `normalizeReviewSettings(value)`, `createReviewSession()`, and `createTaskQueue(limit)`.

- [ ] Write failing tests proving width normalization, session invalidation, two-job concurrency, and continued processing after a rejected job.
- [ ] Run `node --test test/review-controller.test.js`; expect missing-module failure.
- [ ] Implement a browser/Node-compatible controller and load it before `index.js`.
- [ ] Run the controller and full test suite; expect all PASS.

### Task 2: Full-Screen Review UI and Lazy Page Shells

**Files:** Modify `src/index.html`, `src/style.css`, and `src/index.js`.

**Interfaces:** Add `openChapterReview()`, `closeChapterReview()`, `buildReviewPages()`, and `enqueueReviewPage(element)`.

- [ ] Add the `📖 รีวิวรวม` button and full-screen overlay with sticky controls, selection drawer, width buttons, filename/boundary toggles, scroll viewport, and page column.
- [ ] Build selected page shells with original aspect ratios, default all selected, and IntersectionObserver using a 1200px root margin.
- [ ] Connect all/select-none/translated/individual selection controls and rebuild shells without changing saved data.
- [ ] Close on Escape and invalidate the session, observer, queue, object URLs, and Canvas pixels.

### Task 3: Page Composition and Navigation

**Files:** Modify `src/index.js`.

**Interfaces:** Add `composeChapterPage(imgObj, translation)` returning a Canvas; reuse it in review and Export.

- [ ] Extract the existing export composition sequence: original/inpainted background, custom paint, Thai text, and final watermark.
- [ ] Render review pages through the two-job queue, cache data URLs for the current session, and show retry UI per failed page.
- [ ] Apply width, filename, and boundary controls without rerendering page pixels.
- [ ] Clicking a rendered page closes review, selects its editor page, and enables Thai Preview.
- [ ] Run `npm.cmd test`, syntax checks, and `git diff --check`; expect exit 0.
- [ ] Commit with `git commit -m "feat: add continuous chapter review"`.
