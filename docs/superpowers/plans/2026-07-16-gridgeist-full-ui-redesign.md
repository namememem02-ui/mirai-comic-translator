# ComicTranslator Gridgeist Full UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every ComicTranslator surface as a precise Gridgeist translation workbench while preserving every existing renderer behavior and DOM contract.

**Architecture:** Keep the current Electron renderer and all JavaScript event wiring intact. Add contract tests first, then recompose existing HTML elements without changing their IDs, and replace scattered visual overrides with a token-driven CSS layer that covers the workspace, dialogs, dynamic bubble controls, and chapter review.

**Tech Stack:** Electron 33, semantic HTML, CSS custom properties, vanilla JavaScript, Node.js built-in test runner.

## Global Constraints

- Preserve all existing element IDs referenced by `src/index.js`.
- Preserve IPC, persistence, translation, canvas drawing, watermark, review, and export behavior.
- Preserve canvas and overlay z-order and pointer behavior.
- Do not add a UI framework or runtime dependency.
- Keep UI Scale behavior and comic-canvas isolation intact.
- Use TDD: every production change follows a failing contract test.

---

### Task 1: Lock the renderer DOM and surface contracts

**Files:**
- Create: `test/gridgeist-ui-contract.test.js`
- Read: `src/index.js`
- Read: `src/index.html`

**Interfaces:**
- Consumes: DOM IDs retrieved through `document.getElementById()` in `src/index.js`.
- Produces: Regression contract ensuring those IDs remain unique and the four surfaces retain their controls.

- [ ] **Step 1: Write the failing DOM inventory test**

Create `test/gridgeist-ui-contract.test.js` with Node built-ins only. Extract every literal ID from `getElementById('...')`, assert exactly one matching `id="..."` exists in the HTML, and assert the required surface hooks are present:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('every renderer getElementById dependency exists exactly once', () => {
  const ids = [...script.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
  for (const id of new Set(ids)) {
    const count = [...html.matchAll(new RegExp(`id=["']${id}["']`, 'g'))].length;
    assert.equal(count, 1, `${id} must exist exactly once`);
  }
});

test('all redesigned surfaces expose stable layout hooks', () => {
  for (const hook of ['workspace-shell', 'page-rail', 'canvas-stage', 'context-inspector', 'settings-surface', 'export-surface', 'review-workspace']) {
    assert.match(html, new RegExp(`class=["'][^"']*${hook}`), `missing ${hook}`);
  }
});

test('canvas layer IDs and order remain stable', () => {
  const ordered = ['brushMaskCanvas', 'bubbleOverlay', 'typesetTextCanvas', 'watermarkCanvas', 'colorPaintCanvas', 'activeImage'];
  const positions = ordered.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test test/gridgeist-ui-contract.test.js`  
Expected: FAIL because the new Gridgeist surface hooks do not exist yet; the ID and canvas-order tests already protect the baseline.

- [ ] **Step 3: Add only the stable surface hooks**

In `src/index.html`, add classes without moving controls yet:

- `.workspace-shell` on the existing `.workspace`
- `.page-rail` on `.explorer-panel`
- `.canvas-stage` on `.viewport-panel`
- `.context-inspector` on `.editor-panel`
- `.settings-surface` on `#settingsDialog`
- `.export-surface` on `#exportDialog`
- `.review-workspace` on `#chapterReviewOverlay`

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `node --test test/gridgeist-ui-contract.test.js`  
Expected: 3 tests PASS.

- [ ] **Step 5: Run the full baseline suite**

Run: `npm test`  
Expected: all existing and new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add test/gridgeist-ui-contract.test.js src/index.html
git commit -m "test: lock ComicTranslator UI contracts"
```

### Task 2: Recompose the workspace hierarchy without changing behavior

**Files:**
- Modify: `test/gridgeist-ui-contract.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: Stable IDs and layer order from Task 1.
- Produces: Semantic command and context groups addressable by CSS while retaining the existing elements and events.

- [ ] **Step 1: Write the failing workspace composition test**

Append:

```js
test('workspace separates primary commands from contextual tools', () => {
  assert.match(html, /class="[^"]*command-bar[^"]*"[\s\S]*id="translatePageBtn"[\s\S]*id="exportChapterBtn"/);
  assert.match(html, /class="[^"]*context-tool-bar[^"]*"[\s\S]*id="undoBtn"[\s\S]*id="watermarkToggleBtn"/);
  assert.match(html, /class="[^"]*page-rail-body[^"]*"[\s\S]*id="thumbnailsList"/);
  assert.match(html, /class="[^"]*inspector-dialogues[^"]*"[\s\S]*id="bubblesList"/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/gridgeist-ui-contract.test.js`  
Expected: FAIL with missing `command-bar` or related composition hook.

- [ ] **Step 3: Recompose existing HTML**

In `src/index.html`:

- Make the existing viewport action container `.command-bar`.
- Make `#studioToolbar` `.context-tool-bar` while preserving its display behavior.
- Wrap the existing project/drop-zone/thumbnail area in `.page-rail-body` without moving IDs outside the rail.
- Add `.inspector-glossary` and `.inspector-dialogues` to the two existing editor sections.
- Replace decorative emoji-only spans with text/icon pairs only where the button still keeps its original ID and accessible label.
- Remove inline visual declarations only when equivalent CSS rules are added in Task 3; retain inline `display` values that renderer code depends on until confirmed safe.

- [ ] **Step 4: Verify GREEN and regression suite**

Run: `node --test test/gridgeist-ui-contract.test.js && npm test`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add test/gridgeist-ui-contract.test.js src/index.html
git commit -m "refactor: compose translation workspace hierarchy"
```

### Task 3: Implement the shared Gridgeist visual system and responsive workspace

**Files:**
- Modify: `test/gridgeist-ui-contract.test.js`
- Modify: `src/style.css`
- Modify: `src/index.html` only to remove superseded inline visual styles

**Interfaces:**
- Consumes: Layout hooks from Tasks 1–2 and existing UI scale variables.
- Produces: Shared tokens, three-rail desktop layout, responsive transformations, focus states, and reduced-motion behavior.

- [ ] **Step 1: Write the failing CSS system test**

Append:

```js
test('Gridgeist CSS exposes tokens and responsive interaction contracts', () => {
  for (const token of ['--surface-0', '--surface-1', '--rule', '--accent', '--danger', '--space-1', '--radius-sm']) {
    assert.match(css, new RegExp(`${token}:`), `missing ${token}`);
  }
  assert.match(css, /\.workspace-shell\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*959px\)/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/gridgeist-ui-contract.test.js`  
Expected: FAIL because the new token and responsive contracts are absent.

- [ ] **Step 3: Implement tokens and base controls**

At the end of `src/style.css`, add a clearly delimited `Gridgeist Workbench` layer defining:

- neutral surfaces, one blue accent family, semantic success/warning/danger colors
- spacing 4/8/12/16/24/32px
- radius 0/4/8px and quiet 1px rules
- 13px minimum controls at 100% UI scale, 14px body, 16–20px headings
- shared button/input/select/range/focus/disabled/active styles
- no canvas transform scaling and no pointer-event changes to drawing layers

- [ ] **Step 4: Implement the desktop three-rail layout**

Define `.workspace-shell` as a grid using the existing explorer/editor width variables, with `.canvas-stage` as the flexible dominant column. Make `.app-header`, `.command-bar`, and `.context-tool-bar` visually distinct by role, keep toolbar controls reachable, and make Page Rail and Inspector independently scrollable without changing the Canvas wrapper scroll behavior.

- [ ] **Step 5: Implement responsive transformations**

- At 960–1279px, narrow the rail widths and allow ordered toolbar wrapping.
- At 720–959px, place Inspector below the Canvas while Page Rail remains a narrow first column.
- Below 720px, stack Page Rail, Canvas, then Inspector; dialogs occupy nearly the viewport; targets become at least 40px high.
- Preserve UI Scale variables and the existing `dialog[open]` behavior.

- [ ] **Step 6: Verify GREEN**

Run: `node --test test/gridgeist-ui-contract.test.js test/ui-scale-css-contract.test.js test/ui-scale-settings-contract.test.js`  
Expected: all targeted tests PASS.

- [ ] **Step 7: Run full suite and commit**

Run: `npm test`  
Expected: all tests PASS with no warnings or failures.

```bash
git add test/gridgeist-ui-contract.test.js src/style.css src/index.html
git commit -m "feat: apply Gridgeist workbench visual system"
```

### Task 4: Redesign Settings, Export, dynamic editors, and Chapter Review

**Files:**
- Modify: `test/gridgeist-ui-contract.test.js`
- Modify: `src/index.html`
- Modify: `src/style.css`
- Inspect only: `src/index.js`

**Interfaces:**
- Consumes: Shared visual tokens from Task 3 and all existing dialog/control IDs.
- Produces: Consistent secondary surfaces without event or data-flow changes.

- [ ] **Step 1: Write failing secondary-surface tests**

Append tests asserting these hooks and CSS rules:

```js
test('secondary surfaces use the shared workbench structure', () => {
  for (const hook of ['settings-section', 'dialog-actions', 'export-step', 'review-toolbar', 'review-page-row']) {
    assert.match(html + css, new RegExp(hook), `missing ${hook}`);
  }
  assert.match(css, /\.settings-surface[\s\S]*\.export-surface/);
  assert.match(css, /\.bubble-item|\.bubble-card/);
  assert.match(css, /\.chapter-review-header\s*\{[^}]*position:\s*sticky/s);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/gridgeist-ui-contract.test.js`  
Expected: FAIL because the secondary-surface hooks are missing.

- [ ] **Step 3: Recompose Settings and Export HTML**

- Add `.settings-section` to each existing settings category without changing input IDs.
- Add `.dialog-actions` to the existing footer/action rows.
- Add `.export-step` to scope, naming/options, selection, and progress groups.
- Keep `facebookArchiveName`, `facebookMaxImages`, mode buttons, progress, cancel, Facebook export, and normal export unchanged.

- [ ] **Step 4: Style dynamic bubble editors and dialogs**

Use the actual dynamic classes already emitted by `src/index.js`; style them through selectors only. Normalize labels, fields, selected state, errors, and destructive actions. Do not change renderer templates or event listeners unless a test proves an accessibility attribute is missing.

- [ ] **Step 5: Recompose Chapter Review**

- Add `.review-toolbar` to the existing header controls and `.review-page-row` to the existing selector row class emitted by the renderer or its static container selector.
- Make the review header sticky, selector independently scrollable, and preview column dominant.
- Keep width modes, filename/boundary toggles, page selection commands, and close behavior unchanged.

- [ ] **Step 6: Verify GREEN and full regression suite**

Run: `node --test test/gridgeist-ui-contract.test.js test/facebook-ui-contract.test.js test/review-controller.test.js && npm test`  
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add test/gridgeist-ui-contract.test.js src/index.html src/style.css
git commit -m "feat: unify ComicTranslator secondary surfaces"
```

### Task 5: Rendered QA and behavior-preservation verification

**Files:**
- Modify if needed: `src/style.css`
- Modify if needed: `src/index.html`
- Modify if a regression is discovered: `test/gridgeist-ui-contract.test.js`

**Interfaces:**
- Consumes: Completed redesign.
- Produces: Verified desktop and narrow-window UI with documented regression evidence.

- [ ] **Step 1: Run automated verification**

Run: `npm test`  
Expected: all tests PASS.

- [ ] **Step 2: Launch Electron and inspect the empty state**

Run: `npm start`  
Verify at wide and narrow window sizes: header hierarchy, three-rail composition, readable typography, focus visibility, Settings, Export, and Chapter Review surfaces.

- [ ] **Step 3: Run the behavior smoke flow**

Using a real comic project, verify opening/choosing pages, zoom and fit modes, single/all translation and Stop, preview isolation, selection and resize, add bubble, Brush, Paint, Undo/Redo, Watermark, Glossary, search, Settings save, Chapter Review, normal export, selected-page export, and Facebook ZIP export.

- [ ] **Step 4: Fix visual defects using test-first changes**

For every discovered structural regression, add a failing assertion to `test/gridgeist-ui-contract.test.js`, run it to confirm RED, apply the smallest HTML/CSS correction, and rerun to GREEN. Pure pixel tuning may modify CSS directly, followed by the full suite and rendered reinspection.

- [ ] **Step 5: Final verification**

Run: `npm test`  
Expected: all tests PASS. Reopen Electron and confirm no clipped controls, unreadable text, horizontal page scrolling, canvas layer misalignment, or inaccessible dialog action at supported window sizes.

- [ ] **Step 6: Commit**

```bash
git add test/gridgeist-ui-contract.test.js src/index.html src/style.css
git commit -m "fix: refine Gridgeist responsive UI"
```

