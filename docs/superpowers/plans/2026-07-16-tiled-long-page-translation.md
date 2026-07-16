# Tiled Long-Page Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve OCR box accuracy on long manhwa pages by translating overlapping vertical tiles and remapping tile-local boxes to the full page.

**Architecture:** A pure CommonJS helper plans crops and merges normalized results. The Electron main process keeps the existing one-request path for normal pages, crops tall pages with `nativeImage`, sends tiles sequentially through the existing Gemini fallback chain, and returns the unchanged renderer response shape.

**Tech Stack:** Electron 33 `nativeImage`, Node.js CommonJS, Gemini REST API, Node built-in test runner.

## Global Constraints

- Pages with `height / width <= 4` use one unchanged full-page request.
- Tall-page tile cores are at most three image widths high and use vertical overlap.
- Ownership by box center prevents duplicate overlap detections.
- No partial result is returned when any tile request fails.
- Saved JSON, renderer, inpainting, inline editing, review, and export formats remain unchanged.
- Do not add an image-processing dependency.

---

### Task 1: Pure tile planning and coordinate merge

**Files:**
- Create: `lib/translation-tiling.js`
- Create: `test/translation-tiling.test.js`

**Interfaces:**
- Produces: `planTranslationTiles(width, height, options?) -> Tile[]`
- Produces: `mergeTileResults(tileEntries, width, height) -> { bubbles, discovered_names }`
- A tile contains `{ cropStart, cropEnd, coreStart, coreEnd, width, height, isFullPage }` in source pixels.
- A tile entry contains `{ tile, result }`, where result uses Gemini's existing `{ bubbles, discovered_names }` shape.

- [ ] **Step 1: Write failing tile-plan tests**

Test that `800 × 3,200` produces one full-page tile and `800 × 9,500` produces four core regions, complete gap-free core coverage, crops within image bounds, and overlap between neighboring crops.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/translation-tiling.test.js`

Expected: FAIL because `../lib/translation-tiling` does not exist.

- [ ] **Step 3: Implement minimal tile planning**

Use defaults `maxAspectRatio: 4`, `coreHeightInWidths: 3`, and `overlapInWidths: 0.2`. Return one full tile below the threshold. For tall pages, calculate sequential core ranges and expand each crop by the overlap while clamping to `[0, height]`.

- [ ] **Step 4: Write failing merge tests**

Test local-to-global box conversion, rejection outside the owning core, retention at the last core boundary, `0–1000` clamping, visual sorting, sequential IDs, invalid-box removal, and case-insensitive first-spelling-wins name merge.

- [ ] **Step 5: Implement minimal merge behavior**

Convert local Y through `cropStart + localY / 1000 * tile.height`, normalize by full height, keep boxes whose center is in `[coreStart, coreEnd)` except the last tile includes its end, retain X coordinates, then sort by `ymin`, `xmin` and renumber.

- [ ] **Step 6: Verify and commit Task 1**

Run: `node --test test/translation-tiling.test.js`

Expected: all tile helper tests PASS.

Commit: `feat: calculate long-page translation tiles`

### Task 2: Electron tall-page translation orchestration

**Files:**
- Modify: `main.js:1-280`
- Create: `test/translation-tiling-integration.test.js`

**Interfaces:**
- Consumes: `planTranslationTiles` and `mergeTileResults` from Task 1.
- Produces internally: `requestGeminiTranslation({ data, mimeType, glossary }) -> Promise<object>`.
- The `translate-page` IPC contract remains `{ imagePath, glossary } -> { bubbles, discovered_names }`.

- [ ] **Step 1: Write failing integration contract tests**

Assert that `main.js` imports `nativeImage` and the tiling helper, extracts the existing Gemini request loop into `requestGeminiTranslation`, keeps a direct full-page request for `isFullPage`, crops tall tiles with `nativeImage.crop`, sends tiles sequentially, and merges all tile entries only after every request resolves.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/translation-tiling-integration.test.js`

Expected: FAIL because the current handler sends only `fileToBase64(imagePath)`.

- [ ] **Step 3: Extract the existing request function without changing behavior**

Move model fallback, REST body, response parsing, and error handling into `requestGeminiTranslation`. Keep the same model order, JSON response MIME type, prompt, and retry rules.

- [ ] **Step 4: Add native image sizing, cropping, and sequential requests**

Load the source with `nativeImage.createFromPath(imagePath)`, reject an empty image, obtain the actual size, and call `planTranslationTiles`. For a full-page tile, preserve the original file bytes and MIME type. Otherwise crop full-width rectangles, encode PNG sources as PNG and other sources as JPEG quality 95, request each tile with `await` in a loop, then call `mergeTileResults`.

- [ ] **Step 5: Verify Task 2 and the existing translation contracts**

Run: `node --test test/translation-tiling-integration.test.js test/translation-prompt.test.js test/translation-result.test.js`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit Task 2**

Commit: `fix: translate long pages in accurate tiles`

### Task 3: Full regression and copied-project smoke test

**Files:**
- Modify only if a test exposes a defect in Task 1 or Task 2.

**Interfaces:**
- Consumes the unchanged renderer and IPC contracts.
- Produces verification evidence for normal and long pages.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm.cmd test`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Copy test project data into the isolated worktree**

Copy `projects/ReturnoftheApexPlayer` and the project map into the ignored worktree `projects` directory. Do not edit the original project.

- [ ] **Step 3: Retranslate one copied `800 × 9,500` page**

Launch ComicTranslator from the worktree, select the copied project, and press `แปลหน้านี้`. Confirm the operation makes four sequential tile requests and finishes as one page translation.

- [ ] **Step 4: Visually inspect several boxes**

Check at least one text block near the page top, middle, bottom, and one tile boundary. Confirm boxes match visible source glyphs with a small margin and no duplicated boundary text.

- [ ] **Step 5: Verify clean source state and commit any test-driven correction**

Run: `git diff --check`, `git status --short`, and `npm.cmd test` after any correction. Never commit copied `projects` data.

