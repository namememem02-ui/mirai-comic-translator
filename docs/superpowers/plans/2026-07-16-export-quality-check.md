# Export Quality Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-blocking chapter quality scan before ComicTranslator export, with actionable issues that navigate directly to the affected page and bubble.

**Architecture:** Put deterministic validation in a dependency-free CommonJS/browser module, keep text measurement behind an injected adapter, and isolate navigation in a controller. Persist excluded pages through the existing atomic JSON path in the main process, then integrate the scan as a new first step inside the existing Export dialog without changing image/ZIP generation.

**Tech Stack:** Electron 33, vanilla JavaScript, Canvas 2D, Node.js built-in test runner, existing atomic JSON helper.

## Global Constraints

- Quality checks never call Gemini, AI Inpainting, or export file generation.
- Warnings and errors never block export.
- Hidden bubbles remain eligible for retouch and box validation but skip empty-text, overflow, and glossary checks.
- Preserve normal export and Facebook ZIP behavior.
- Use TDD for every production behavior.
- Do not add runtime dependencies.

---

### Task 1: Build the deterministic quality-check engine

**Files:**
- Create: `src/export-quality.js`
- Create: `test/export-quality.test.js`
- Modify: `src/index.html` to load the module before `index.js`

**Interfaces:**
- Produces: `ExportQuality.inspectPage(input)`, `ExportQuality.inspectChapter(pages)`, `ExportQuality.createGlossaryMatcher(glossary)`.
- Page input: `{ pageName, pageIndex, translation, excluded, glossary, imageSize, measureOverflow }`.

- [ ] Write failing tests for untranslated/excluded pages, whitespace text, hidden bubbles, invalid/out-of-range boxes, glossary matches, stable issue ordering, and chapter summary.
- [ ] Run `node --test test/export-quality.test.js`; verify failures are caused by the missing module.
- [ ] Implement issue codes `PAGE_UNTRANSLATED`, `EMPTY_TEXT`, `INVALID_BOX`, `TEXT_OVERFLOW`, `GLOSSARY_MISMATCH`, and `INSPECTION_INCOMPLETE` with the exact result shape in the approved spec.
- [ ] Normalize bubble IDs without altering their original string/number value; deduplicate glossary issues per bubble/source pair.
- [ ] Run the targeted test to GREEN, then `npm test`.
- [ ] Commit with `feat: add export quality engine`.

### Task 2: Extract deterministic text-layout measurement

**Files:**
- Create: `src/text-overflow.js`
- Create: `test/text-overflow.test.js`
- Modify: `src/index.html`
- Modify: `src/index.js` only to reuse the shared wrapping helper where safe

**Interfaces:**
- Produces: `TextOverflow.createCanvasAdapter(context)` and `TextOverflow.isTextOverflowing(input, adapter)`.
- Input: `{ text, boxWidth, boxHeight, fontSize, fontFamily, outline, lineHeight }`.

- [ ] Write failing tests using a deterministic width adapter for exact fit, vertical overflow, an unbreakable word, multiline Thai text, invalid dimensions, and hidden/empty bypass handled by the caller.
- [ ] Verify RED with `node --test test/text-overflow.test.js`.
- [ ] Implement wrapping and height calculation without DOM access; Canvas adapter delegates only `measureText`.
- [ ] Compare the helper with `drawTypesetText` wrapping rules and extract only shared pure logic that does not change current rendering output.
- [ ] Verify targeted and full suites, then commit `feat: measure translated text overflow`.

### Task 3: Persist pages marked “no translation needed”

**Files:**
- Create: `lib/chapter-quality-store.js`
- Create: `test/chapter-quality-store.test.js`
- Modify: `main.js`
- Modify: `preload.js`

**Interfaces:**
- Produces IPC methods `loadChapterQualityState({ project, chapter, pageNames })` and `saveChapterQualityState({ project, chapter, pageNames, excludedPages })`.
- Stored data: `{ schemaVersion: 1, excludedPages: string[] }`.

- [ ] Write failing tests for normalization, stale-page removal, unsafe names, duplicate removal, import/load/save/remove, and atomic recovery behavior.
- [ ] Verify RED.
- [ ] Implement the store with the existing `lib/atomic-json.js`; validate project/chapter/page values using current path guards rather than duplicating weaker validation.
- [ ] Add narrowly scoped IPC handlers in `main.js` and expose only the two methods through `preload.js`.
- [ ] Verify targeted and full suites; commit `feat: persist export quality exclusions`.

### Task 4: Add issue navigation controller

**Files:**
- Create: `src/export-quality-controller.js`
- Create: `test/export-quality-controller.test.js`
- Modify: `src/index.html`
- Modify: `src/index.js`

**Interfaces:**
- Produces: `ExportQualityController.create({ selectPage, waitForPage, selectBubble, revealBubble, notify })` and async `goToIssue(issue)`.

- [ ] Write failing tests for page-only issues, bubble issues, stale/deleted bubbles, page-load rejection, and rapid consecutive navigation where only the newest action selects a bubble.
- [ ] Verify RED.
- [ ] Implement token-guarded navigation with injected callbacks.
- [ ] Wire callbacks to the existing page-selection path, `activeBubbleId`, `renderPageTranslation()`, and the matching Inspector card; do not duplicate page loading.
- [ ] Verify targeted and full suites; commit `feat: navigate from export issues to bubbles`.

### Task 5: Integrate quality scan into the Export dialog

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`
- Modify: `test/gridgeist-ui-contract.test.js`
- Create: `test/export-quality-ui-contract.test.js`

**Interfaces:**
- Consumes: Tasks 1–4 APIs.
- Produces: Scan step, progress, filters, issue list, exclusion toggles, rescan, return-to-edit, and continue-export controls.

- [ ] Write failing UI contract tests for IDs: `qualityPanel`, `qualityProgress`, `qualitySummary`, `qualityFilterAll`, `qualityFilterErrors`, `qualityFilterWarnings`, `qualityFilterPassed`, `qualityIssueList`, `qualityRescanBtn`, `qualityBackToEditBtn`, and `qualityContinueBtn`.
- [ ] Verify RED.
- [ ] Add the QA step before existing export mode/options. Keep all old export IDs and handlers intact; the Continue button reveals the existing panels rather than invoking export itself.
- [ ] Load translations and image dimensions sequentially with UI yielding; update `กำลังตรวจหน้า X/Y`; never call render/export helpers that perform inpainting.
- [ ] Render grouped accessible issue buttons, severity summary, filters, and no-translation-needed toggles.
- [ ] Wire issue clicks through the navigation controller and exclusion changes through the new IPC methods.
- [ ] Add Gridgeist styles for severity rules, compact grouped rows, progress, keyboard focus, and responsive dialog layout.
- [ ] Verify targeted tests, `npm test`, and rendered Electron QA for empty, warning, clean, excluded, and continue-export paths.
- [ ] Commit `feat: add pre-export quality workflow`.

### Task 6: Final regression and behavior verification

**Files:**
- Modify only if a failing regression test requires a correction.

**Interfaces:**
- Produces: verified feature branch ready to integrate.

- [ ] Run `npm test` and confirm zero failures.
- [ ] Verify quality scan does not call Gemini/Inpainting by instrumenting the relevant renderer functions during a smoke run.
- [ ] Verify normal all-page, selected-page, and Facebook exports remain reachable after `ส่งออกต่อแม้มีคำเตือน`.
- [ ] Verify hidden bubbles erase source text but do not render Thai and receive only box issues.
- [ ] Verify issue navigation opens the correct page, selects the correct box, and tolerates a deleted bubble.
- [ ] Verify `git diff --check` and clean working tree after the final commit.
- [ ] Commit any test-first refinements as `fix: refine export quality workflow`.

