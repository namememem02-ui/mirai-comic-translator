# Tight Fit Inpainting Mask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tight Fit's destructive double-shrink with a tested 3% safety expansion around the OCR lettering box.

**Architecture:** A UMD/CommonJS geometry module calculates mask rectangles independently of Canvas. The renderer delegates both Tight Fit and unchanged Full Box calculations to it before drawing the mask.

**Tech Stack:** Browser JavaScript, Canvas, Node built-in test runner

## Global Constraints

- Tight Fit expands each OCR edge by 3%, with at least 2 image pixels per side.
- Final mask rectangles remain inside image bounds.
- Full Box behavior and manual brush masks remain unchanged.

---

### Task 1: Tested mask geometry

**Files:**
- Create: `src/inpaint-mask-geometry.js`
- Create: `test/inpaint-mask-geometry.test.js`

**Interfaces:**
- Produces `calculateMaskRect({ x, y, width, height, imageWidth, imageHeight, mode })` returning `{ x, y, width, height }`.

- [ ] Write failing tests for normal Tight Fit expansion, minimum 2px expansion, edge clamping, and unchanged Full Box padding.
- [ ] Run the targeted test and verify RED because the module is missing.
- [ ] Implement the smallest deterministic rectangle calculation.
- [ ] Run the targeted test and verify GREEN.
- [ ] Commit with `feat: calculate safe Tight Fit masks`.

### Task 2: Renderer integration

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Create: `test/inpaint-mask-integration.test.js`

**Interfaces:**
- Consumes `window.InpaintMaskGeometry.calculateMaskRect` from Task 1.

- [ ] Write a failing contract test requiring the script include and renderer delegation, while rejecting the old `shrinkX`/`shrinkY` calculation.
- [ ] Run the targeted test and verify RED.
- [ ] Load the geometry module before `index.js` and replace the inline mask calculation with one module call.
- [ ] Run targeted and complete tests.
- [ ] Manually verify Tight Fit in the running application and commit with `fix: preserve lettering coverage in Tight Fit`.
