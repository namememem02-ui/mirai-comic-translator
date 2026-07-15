# Responsive Bubble Resize and Fit Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow text boxes on very tall comic images to shrink to a practical screen-pixel minimum and add fit-width and fit-page viewing controls.

**Architecture:** Keep geometry calculations in the existing browser/Node-compatible `bubble-geometry.js` module so they can be unit tested without Electron. The renderer owns view-mode state and applies calculated image dimensions to the existing viewport container, preserving the current zoom slider as a custom zoom mode.

**Tech Stack:** Electron renderer, vanilla JavaScript, SVG overlay, CSS, Node.js built-in test runner.

## Global Constraints

- Existing saved project and bubble data formats must not change.
- A resize handle and its minimum box size must remain approximately 16 screen pixels at every zoom and image aspect ratio.
- Default view mode is fit width; fit page shows the entire image inside the available canvas.
- Slider and Ctrl+wheel switch to custom zoom; reset returns to fit width.
- Do not add runtime dependencies.

---

### Task 1: Aspect-Ratio-Aware Geometry

**Files:**
- Modify: `src/bubble-geometry.js`
- Modify: `test/bubble-geometry.test.js`

**Interfaces:**
- Consumes: SVG coordinates in a 1000 by 1000 normalized view box and displayed overlay dimensions.
- Produces: `resizeBoxFromSouthEast(initialBox, dx, dy, minWidth, minHeight)` and `calculateFitScale(imageWidth, imageHeight, availableWidth, availableHeight, mode)`.

- [ ] **Step 1: Write failing tests for independent minimum width/height and fit scales**

```js
test('uses independent screen-derived minimum dimensions', () => {
  const result = resizeBoxFromSouthEast([100, 100, 400, 400], -900, -900, 20, 2);
  assert.deepEqual(result, [100, 100, 102, 120]);
});

test('calculates fit-width and fit-page scale for a tall image', () => {
  assert.equal(calculateFitScale(800, 9500, 760, 700, 'fit-width'), 0.95);
  assert.equal(calculateFitScale(800, 9500, 760, 700, 'fit-page'), 700 / 9500);
});
```

- [ ] **Step 2: Run the geometry tests and verify they fail**

Run: `node --test test/bubble-geometry.test.js`

Expected: FAIL because the resize function does not accept an independent height and `calculateFitScale` is not defined.

- [ ] **Step 3: Implement independent minimum dimensions and fit-scale calculation**

```js
function resizeBoxFromSouthEast(initialBox, dx, dy, minWidth = 20, minHeight = minWidth) {
  const [ymin, xmin, ymax, xmax] = initialBox;
  const nextXmax = Math.max(xmin + minWidth, Math.min(1000, xmax + dx));
  const nextYmax = Math.max(ymin + minHeight, Math.min(1000, ymax + dy));
  return [ymin, xmin, Math.round(nextYmax), Math.round(nextXmax)];
}

function calculateFitScale(imageWidth, imageHeight, availableWidth, availableHeight, mode) {
  if (imageWidth <= 0 || imageHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) return 1;
  const widthScale = availableWidth / imageWidth;
  return mode === 'fit-page' ? Math.min(widthScale, availableHeight / imageHeight) : widthScale;
}
```

- [ ] **Step 4: Run the geometry tests and verify they pass**

Run: `node --test test/bubble-geometry.test.js`

Expected: all geometry tests PASS.

- [ ] **Step 5: Commit the geometry change**

```powershell
git add src/bubble-geometry.js test/bubble-geometry.test.js
git commit -m "fix: scale bubble minimums by viewport axes"
```

### Task 2: Fit-Width and Fit-Page Controls

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `BubbleGeometry.calculateFitScale(...)`, active image natural dimensions, and canvas client dimensions.
- Produces: `applyViewMode('fit-width' | 'fit-page')`; buttons `fitWidthBtn` and `fitPageBtn`; custom zoom state for slider and Ctrl+wheel.

- [ ] **Step 1: Add fit mode controls beside the zoom controls**

```html
<button id="fitWidthBtn" class="btn-view-mode active" type="button">พอดีกว้าง</button>
<button id="fitPageBtn" class="btn-view-mode" type="button">เต็มภาพ</button>
```

- [ ] **Step 2: Add renderer state and apply calculated viewport width**

```js
let viewMode = 'fit-width';

function applyViewMode(mode) {
  if (!activeImage.naturalWidth || !activeImage.naturalHeight) return;
  const availableWidth = Math.max(1, canvasWrapper.clientWidth - 32);
  const availableHeight = Math.max(1, canvasWrapper.clientHeight - 32);
  const scale = window.BubbleGeometry.calculateFitScale(
    activeImage.naturalWidth,
    activeImage.naturalHeight,
    availableWidth,
    availableHeight,
    mode
  );
  viewMode = mode;
  viewportContainer.style.width = `${activeImage.naturalWidth * scale}px`;
  requestAnimationFrame(updateSVGOverlayOnly);
}
```

- [ ] **Step 3: Wire controls and mode transitions**

```js
fitWidthBtn.addEventListener('click', () => applyViewMode('fit-width'));
fitPageBtn.addEventListener('click', () => applyViewMode('fit-page'));
zoomSlider.addEventListener('input', () => {
  viewMode = 'custom';
  setZoom(Number(zoomSlider.value) / 100);
});
zoomResetBtn.addEventListener('click', () => applyViewMode('fit-width'));
```

Also reapply the active fit mode after image load and window resize, while preserving a custom zoom width.

- [ ] **Step 4: Use independent screen-pixel minimums during resize**

```js
const minimum = window.BubbleGeometry.screenPixelsToSvgUnits(
  16,
  bubbleOverlay.getBoundingClientRect().width,
  bubbleOverlay.getBoundingClientRect().height
);
bubble.box_2d = window.BubbleGeometry.resizeBoxFromSouthEast(
  initialBox,
  dx,
  dy,
  minimum.x,
  minimum.y
);
```

- [ ] **Step 5: Style active view-mode controls consistently with existing toolbar buttons**

```css
.btn-view-mode.active {
  color: var(--accent-color);
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
}
```

- [ ] **Step 6: Run automated verification**

Run: `npm test`

Expected: all tests PASS.

Run: `node --check src/index.js; node --check src/bubble-geometry.js; git diff --check`

Expected: all commands exit with code 0 and no whitespace errors.

- [ ] **Step 7: Commit the fit-mode UI**

```powershell
git add src/index.html src/index.js src/styles.css
git commit -m "feat: add comic fit width and full image modes"
```
