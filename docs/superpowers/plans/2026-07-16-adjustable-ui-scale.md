# Adjustable UI Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a saved 100%/115%/130% interface scale with a 115% default while preserving comic Canvas pixels and editing coordinates.

**Architecture:** A pure `ui-scale` module normalizes settings and maps each choice to CSS tokens. The renderer previews and persists the setting through the existing app-settings flow, while CSS variables scale interface components and bounded side-panel widths without applying browser zoom or transforms to the comic viewport.

**Tech Stack:** Electron 33, CommonJS/UMD JavaScript, CSS custom properties, Node.js built-in test runner

## Global Constraints

- Supported values are exactly `100`, `115`, and `130`; missing or invalid values normalize to `115`.
- Changes preview immediately; Save persists them; close/backdrop without Save restores the saved value.
- Do not scale Canvas backing stores, SVG view boxes, image pixels, export output, watermark coordinates, or bubble geometry.
- Preserve the existing minimum window size and three-column editor.

---

### Task 1: Pure scale model

**Files:**
- Create: `src/ui-scale.js`
- Create: `test/ui-scale.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces `normalizeUiScale(value) -> 100|115|130`, `getUiScaleTokens(value) -> {scale, bodyFont, controlFont, explorerWidth, editorWidth}`, and `applyUiScale(root, value) -> normalizedValue`.

- [ ] Write failing tests for missing/invalid values, all three valid choices, token mapping, and CSS property assignment to a fake root.
- [ ] Run `node --test test/ui-scale.test.js`; expect module-not-found failure.
- [ ] Implement the UMD module with explicit token maps: 100% = 13/13px and 280/380px, 115% = 15/14px and 310/420px, 130% = 17/16px and 340/460px.
- [ ] Load `ui-scale.js` before `index.js`, rerun the focused test, and expect all tests to pass.
- [ ] Commit as `feat: add UI scale model`.

### Task 2: Settings preview, save, and rollback

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Create: `test/ui-scale-settings-contract.test.js`

**Interfaces:**
- Consumes `window.UiScale.applyUiScale(document.documentElement, value)`.
- Adds `appSettings.uiScale`, DOM control `settingsUiScale`, and renderer state `savedUiScale`.

- [ ] Write a failing contract test requiring the select values 100/115/130, default setting 115, immediate input/change application, save assignment, and close rollback.
- [ ] Run the contract test and verify it fails.
- [ ] Add a `ขนาด UI` select to the settings dialog with visible labels `100%`, `115% (แนะนำ)`, and `130%`.
- [ ] Normalize and apply scale during `initApp`, snapshot `savedUiScale` on dialog open, preview on select change, persist on Save, and restore on close/backdrop when unsaved.
- [ ] After applying scale, call the existing viewport/layout refresh path without changing `zoomLevel` or Canvas dimensions.
- [ ] Run focused tests, full `npm.cmd test`, and `node --check src/index.js`; expect success.
- [ ] Commit as `feat: add saved UI scale setting`.

### Task 3: Scalable responsive interface CSS

**Files:**
- Modify: `src/style.css`
- Modify: `src/index.html`
- Create: `test/ui-scale-css-contract.test.js`

**Interfaces:**
- Consumes root properties `--ui-scale`, `--ui-body-font`, `--ui-control-font`, `--ui-explorer-width`, and `--ui-editor-width`.

- [ ] Write a failing CSS contract test requiring root fallbacks, bounded side-panel widths, common control overrides, wrapped toolbars, scrollable dialogs, and an explicit exclusion for Canvas/SVG scaling.
- [ ] Run the focused test and verify failure.
- [ ] Add root fallback tokens for 115%, apply them to body text, headings, buttons, inputs, selects, textareas, labels, badges, list rows, tabs, dialogs, and review controls.
- [ ] Override legacy inline font sizes using scoped selectors and `!important` only inside UI regions; exclude `.canvas-wrapper`, Canvas, SVG overlays, and `.review-page img`.
- [ ] Set explorer/editor widths with `clamp()` around token widths, keep viewport `min-width:0; flex:1`, wrap toolbar/action groups, and add internal overflow to settings/export dialogs.
- [ ] Add responsive rules at narrow supported widths to cap side panels and retain readable text rather than shrinking fonts.
- [ ] Run the CSS contract test and full suite; expect success.
- [ ] Commit as `feat: scale and reflow application UI`.

### Task 4: Final verification

**Files:**
- Modify only files from Tasks 1–3 if verification exposes a defect.

- [ ] Run `npm.cmd test`; expect zero failures.
- [ ] Run `node --check src/index.js` and `node --check src/ui-scale.js`; expect exit code 0.
- [ ] Launch Electron and verify 100%, 115%, and 130% in the page list, toolbar, glossary, bubble editor, settings/export dialogs, and chapter review.
- [ ] At each scale, verify Fit Width, Full Page, bubble drag/resize, watermark alignment, and exported dimensions remain unchanged.
- [ ] Close settings without saving and verify rollback; save 130%, restart, and verify persistence; restore 115% before handoff.
- [ ] Run `git diff --check` and `git status --short`; commit any verification-only correction as `fix: finalize adjustable UI scale`.
