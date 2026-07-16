# Inline Image Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit Thai bubble text directly over the image in Thai-preview mode with safe IME, Undo, cancellation, and atomic-save behavior.

**Architecture:** A pure UMD/CommonJS helper owns normalized hit-testing, shortcut classification, and safe editor geometry/style. The renderer owns one textarea and a session object; preview rendering reads a draft override without mutating stored translation data until confirmation.

**Tech Stack:** Electron 33, browser JavaScript, HTML textarea, CSS, Node built-in test runner.

## Global Constraints

- Entry is available only while Thai preview is active.
- Draft input must never reach export, review, quality checks, or JSON before confirmation.
- Enter inserts a newline; Ctrl/Cmd+Enter confirms; Escape cancels; IME composition suppresses shortcuts.
- One confirmed session produces one Undo snapshot.
- Page/tool/preview/bubble lifecycle changes cancel safely; zoom and scroll do not.

---

### Task 1: Pure Inline Editor Geometry and Shortcuts

**Files:**
- Create: `src/inline-editor.js`
- Test: `test/inline-editor.test.js`

**Interfaces:**
- Produces `findBubbleAtPoint(bubbles, x, y)`, `normalizeInlineShortcut(event, composing)`, and `buildEditorStyle(bubble)` through `window.InlineEditor` and CommonJS.

- [ ] **Step 1: Write failing tests**

Cover hidden/invalid boxes, inclusive edges, smallest-area overlap selection, normal Enter, Ctrl/Cmd+Enter, Escape, IME suppression, unrelated keys, percentage geometry, and safe font/alignment/color defaults.

- [ ] **Step 2: Verify RED**

Run: `node --test test/inline-editor.test.js`

Expected: FAIL because `../src/inline-editor` is missing.

- [ ] **Step 3: Implement the pure helper**

Use normalized bounds clamped to 0–1000. Return editor geometry as `{ left, top, width, height }` percentage strings. Accept only `left|center|right` alignment, a nonempty font family, and CSS hex/rgb/hsl color strings; otherwise use `center`, `Sarabun`, and `#111827`.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
node --test test/inline-editor.test.js
git add src/inline-editor.js test/inline-editor.test.js
git commit -m "feat: calculate inline editor interactions"
```

### Task 2: Inline Textarea Surface

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Test: `test/inline-editor-ui-contract.test.js`

**Interfaces:**
- Produces `inlineTranslationEditor` textarea and `inlineEditorStatus` live-status element inside `viewportContainer`.

- [ ] **Step 1: Write a failing UI contract**

Assert both IDs exist once, the textarea is inside `viewportContainer`, is hidden initially, has an accessible label, helper script loads before `index.js`, and CSS defines `.inline-translation-editor`, focus, error, and composing states with z-index above the typeset canvas.

- [ ] **Step 2: Verify RED**

Run: `node --test test/inline-editor-ui-contract.test.js`

Expected: FAIL because the surface and script tag are missing.

- [ ] **Step 3: Add the surface and styling**

Place the textarea after `watermarkCanvas`, with `spellcheck="false"`, `aria-label="แก้คำแปลบนภาพ"`, and hidden state. Add a compact live-status element. Style it as an absolute, resizable-disabled, high-contrast editor with a visible focus border and responsive minimum padding.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
node --test test/inline-editor-ui-contract.test.js
git add src/index.html src/style.css test/inline-editor-ui-contract.test.js
git commit -m "feat: add inline translation surface"
```

### Task 3: Draft Rendering, Lifecycle, Undo, and Atomic Save

**Files:**
- Modify: `src/index.js`
- Test: `test/inline-editor-integration.test.js`

**Interfaces:**
- Consumes `window.InlineEditor`, existing `activePageTranslation`, `pushUndoState`, `saveCurrentPageTranslation`, `renderPageTranslation`, `refreshTypesetView`, and `focusCard`.
- Produces `openInlineEditor`, `cancelInlineEditor`, `confirmInlineEditor`, `getInlineDisplayText`, and page-aware event wiring.

- [ ] **Step 1: Write failing renderer contracts**

Assert preview-only double-click hit-testing, temporary draft lookup in `refreshTypesetView`, composition listeners, shortcut routing, one `pushUndoState()` before mutation, awaited atomic save, rollback of text and Undo length on failure, and cancellation calls from page change, preview-off, bubble deletion, reset/retranslate, canvas tools, previous-page copy, drag, and resize.

- [ ] **Step 2: Verify RED**

Run: `node --test test/inline-editor-integration.test.js`

Expected: FAIL because renderer integration is absent.

- [ ] **Step 3: Implement the session workflow**

Maintain `{ pageIndex, pageName, bubbleId, originalText, draft, composing }`. On double-click convert the point through `viewportContainer.getBoundingClientRect()`, hit-test, position/style/focus the textarea, and highlight its card. Input updates `draft` and refreshes preview only. Confirmation validates identity, pushes Undo once, writes the draft, awaits save, and closes on success. Failure restores the original text and Undo length, keeps the editor open, and shows an error. Cancellation clears draft UI and redraws stored text without save.

- [ ] **Step 4: Wire lifecycle cancellation**

Call `cancelInlineEditor()` before page selection, preview deactivation, deletion of the edited bubble, page reset/translation, switching canvas tools, opening previous-page copy, and pointer drag/resize starts. Do not cancel from zoom, scroll, or fit-mode handlers.

- [ ] **Step 5: Verify focused and full suites**

```powershell
node --test test/inline-editor.test.js test/inline-editor-ui-contract.test.js test/inline-editor-integration.test.js
npm.cmd test
git diff --check
```

Expected: zero failures and no diff errors.

- [ ] **Step 6: Commit and smoke-test**

```powershell
git add src/index.js test/inline-editor-integration.test.js
git commit -m "feat: edit Thai translations on the image"
```

In Electron verify page one preview double-click, multiline Thai composition, Escape restore, Ctrl+Enter save, one Undo restore, zoom tracking, and page-change cancellation.
