# Bubble Issue Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-select issue filters with counts and previous/next navigation to the active-page bubble editor.

**Architecture:** A new pure helper classifies bubbles from saved bubble data plus transient live-overflow statuses. The renderer combines this classification with the existing search query, controls card visibility, and navigates the ordered visible results without persisting filter state.

**Tech Stack:** Electron renderer, vanilla JavaScript, DOM/CSS, Node built-in test runner.

## Global Constraints

- Filters are single-select: `all`, `overflow`, `near`, `untranslated`, `hidden`.
- Hidden bubbles are excluded from overflow, near, and untranslated classifications.
- Counts ignore the search query; visible results satisfy both active filter and search.
- Filter state is transient and must not be added to bubble JSON.
- Existing save, preview, and export behavior must remain unchanged.

---

### Task 1: Pure issue classification

**Files:**
- Create: `src/bubble-issue-filter.js`
- Create: `test/bubble-issue-filter.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `classifyBubble(bubble, warning) -> 'overflow' | 'near' | 'untranslated' | 'hidden' | 'ordinary'`
- Produces: `countBubbleIssues(bubbles, warningMap) -> { all, overflow, near, untranslated, hidden }`
- Produces: `matchesBubbleFilter(bubble, warning, filter) -> boolean`

- [ ] Write failing unit tests for each classification, hidden precedence, counts, unknown filters, and untranslated whitespace.
- [ ] Run `node --test test/bubble-issue-filter.test.js` and confirm failure because the module is missing.
- [ ] Implement the three pure functions and expose them to CommonJS and `window.BubbleIssueFilter`.
- [ ] Load `bubble-issue-filter.js` before `index.js` in `index.html`.
- [ ] Run focused tests and commit `feat: classify bubble issues for filtering`.

### Task 2: Filter UI, combined search, and navigation

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`
- Create: `test/bubble-issue-filter-ui-contract.test.js`

**Interfaces:**
- Consumes: `window.BubbleIssueFilter.countBubbleIssues` and `matchesBubbleFilter`.
- Produces: `refreshBubbleIssueFilters()`, `applyBubbleListFilters()`, and `navigateBubbleFilterResult(direction)`.

- [ ] Write failing contract tests for one toolbar, five stable filter values, count labels, combined search and filter logic, empty state, live refresh hooks, and wrapping previous/next navigation.
- [ ] Run `node --test test/bubble-issue-filter-ui-contract.test.js` and confirm missing-contract failures.
- [ ] Add the segmented toolbar, previous/next controls, visible-result count, and empty-state element above `#bubblesList`.
- [ ] Add transient `activeBubbleIssueFilter = 'all'`, update counts from `activePageTranslation` plus `liveOverflowWarnings`, and preserve this value across page renders.
- [ ] Replace the existing search-only card visibility handler with `applyBubbleListFilters()`, matching original/translated text and the selected issue filter.
- [ ] Update filter state after live overflow measurement, text input, font changes, geometry changes, hide/delete, and full page renders without triggering extra saves.
- [ ] Implement wrapping navigation through visible card IDs using `focusCard` and `highlightOverlayRect`.
- [ ] Run focused tests and commit `feat: filter and navigate bubble issues`.

### Task 3: Regression verification

**Files:**
- Modify only if verification finds a defect.

- [ ] Run `node --check src/index.js` and both focused bubble-filter tests.
- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Run `git diff --check`, inspect `git status --short`, and verify `.agents/` remains untouched.
- [ ] Inspect the final diff to confirm no bubble filter field is saved and export functions are unchanged.
