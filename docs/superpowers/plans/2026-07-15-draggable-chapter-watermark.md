# Draggable Chapter Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chapter-level image watermark that can be dragged on Thai Preview, resized, faded, persisted, and embedded into every exported page.

**Architecture:** Keep normalized settings and draw geometry in testable modules. Electron main owns the managed watermark asset and atomic settings file; the renderer owns the panel, preview Canvas, pointer dragging, and final export composition.

**Tech Stack:** Electron IPC, vanilla JavaScript, HTML Canvas, atomic JSON storage, Node.js built-in test runner.

## Global Constraints

- Watermarks are chapter-scoped and never modify original comic images or saved translation JSON.
- Preview and export use identical normalized geometry.
- Managed files stay inside `projects/<project>/<chapter>`.
- Export continues without watermark if the asset cannot load.
- No runtime dependency is added.

---

### Task 1: Watermark Geometry

**Files:**
- Create: `src/watermark-geometry.js`
- Create: `test/watermark-geometry.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `normalizeSettings(value)`, `calculateRect(settings, pageWidth, pageHeight, imageWidth, imageHeight)`, and `dragToNormalized(pointerX, pointerY, rectWidth, rectHeight, pageWidth, pageHeight)`.

- [ ] Write tests proving default/clamped settings, preserved aspect ratio, and drag clamping.
- [ ] Run `node --test test/watermark-geometry.test.js` and verify missing-module failure.
- [ ] Implement the UMD geometry module and load it before `index.js`.
- [ ] Run the geometry and full test suites; expect all PASS.

### Task 2: Managed Asset and Atomic Chapter Settings

**Files:**
- Create: `lib/watermark-store.js`
- Create: `test/watermark-store.test.js`
- Modify: `main.js`
- Modify: `preload.js`

**Interfaces:**
- Produces IPC methods `selectWatermark`, `loadWatermark`, `saveWatermarkSettings`, and `removeWatermark`.
- The load result is `{ settings, exists, absolutePath, fileUrl }`.

- [ ] Write filesystem tests using a temporary project root to prove settings round-trip, managed asset copy/replacement, and removal without touching the source image.
- [ ] Run `node --test test/watermark-store.test.js` and verify missing-module failure.
- [ ] Implement safe project/chapter path resolution, extension validation, atomic JSON settings, managed asset cleanup, and Electron image picker integration.
- [ ] Expose the four IPC calls through preload and run the full suite; expect all PASS.

### Task 3: Panel, Preview Dragging, and Export Composition

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `src/index.js`

**Interfaces:**
- Consumes the four watermark IPC methods and `window.WatermarkGeometry`.
- Produces chapter state, panel controls, `renderWatermarkPreview()`, pointer dragging, and `drawWatermark(ctx, image, settings)` for export.

- [ ] Add the toolbar button, floating panel, enable checkbox, image selector, opacity/size sliders, remove action, and transparent `watermarkCanvas` above the text Canvas.
- [ ] Load chapter watermark state in `loadFolder`, redraw only in Thai Preview, and clear it in original mode/page transition.
- [ ] Implement pointer drag using normalized coordinates, clamped geometry, immediate redraw, and save on pointer-up.
- [ ] Draw the watermark as the final layer of `runExport` for translated and untranslated pages.
- [ ] Run `npm.cmd test`, JavaScript syntax checks, and `git diff --check`; expect exit 0.
- [ ] Commit with `git commit -m "feat: add draggable chapter watermarks"`.
