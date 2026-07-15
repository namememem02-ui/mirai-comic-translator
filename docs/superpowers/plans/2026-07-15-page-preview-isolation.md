# Page Preview Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure preview text and asynchronously generated preview images from an old page can never appear after the user selects another page.

**Architecture:** Add a small generation-token guard shared by browser code and Node tests. `selectPage()` starts a new generation and synchronously clears transient layers; all asynchronous translation loading, image loading, and preview rendering confirm ownership before mutating the shared viewport.

**Tech Stack:** Electron renderer, vanilla JavaScript, Canvas, Node.js built-in test runner.

## Global Constraints

- Saved translation JSON and export behavior must not change.
- Old-page work exits silently and cannot alter the current loader, image, Canvas, cache, or translation state.
- Page layers are cleared synchronously before awaiting disk or image work.
- No runtime dependency is added.

---

### Task 1: Render Generation Guard

**Files:**
- Create: `src/render-guard.js`
- Create: `test/render-guard.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `createRenderGuard()` with `begin(pageKey)`, `isCurrent(token)`, and `current()`.
- Consumes: stable page keys such as image filenames.

- [ ] **Step 1: Write failing generation tests**

```js
test('a newer page invalidates the previous page token', () => {
  const guard = createRenderGuard();
  const first = guard.begin('1.jpeg');
  const second = guard.begin('2.jpeg');
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('reselecting the same page still invalidates old work', () => {
  const guard = createRenderGuard();
  const first = guard.begin('1.jpeg');
  const second = guard.begin('1.jpeg');
  assert.equal(guard.isCurrent(first), false);
  assert.deepEqual(guard.current(), second);
});
```

- [ ] **Step 2: Verify the guard test fails**

Run: `node --test test/render-guard.test.js`

Expected: FAIL because `src/render-guard.js` does not exist.

- [ ] **Step 3: Implement the immutable generation guard and load it before `index.js`**

```js
function createRenderGuard() {
  let generation = 0;
  let latest = null;
  return {
    begin(pageKey) {
      latest = Object.freeze({ generation: ++generation, pageKey });
      return latest;
    },
    isCurrent(token) {
      return Boolean(token && latest && token.generation === latest.generation && token.pageKey === latest.pageKey);
    },
    current() { return latest; }
  };
}
```

- [ ] **Step 4: Run the guard and full tests**

Run: `node --test test/render-guard.test.js; npm.cmd test`

Expected: all tests PASS.

### Task 2: Synchronous Layer Reset and Async Ownership

**Files:**
- Modify: `src/index.js:895-1009`
- Modify: `src/index.js:1820-1985`

**Interfaces:**
- Consumes: `window.RenderGuard.createRenderGuard()` and page tokens.
- Produces: `clearTransientPreviewLayers()` and guarded `renderTypesetImage(renderToken)`.

- [ ] **Step 1: Create the guard and clear preview layers at selection start**

```js
const pageRenderGuard = window.RenderGuard.createRenderGuard();

function clearTransientPreviewLayers() {
  const canvas = document.getElementById('typesetTextCanvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  bubbleOverlay.innerHTML = '';
  bubblesList.innerHTML = '';
  canvasLoader.style.display = 'none';
}
```

At the first line of `selectPage(idx)`, create `const renderToken = pageRenderGuard.begin(images[idx].name)` and clear layers before the first `await`.

- [ ] **Step 2: Guard translation loading and image handlers**

After `loadPageTranslation`, return immediately when `!pageRenderGuard.isCurrent(renderToken)`. The assigned image `onload` handler also checks the captured token before applying view mode or loading mask/paint layers. The global image load listener passes the current token to preview rendering.

- [ ] **Step 3: Guard every asynchronous preview mutation**

Change the signature to `renderTypesetImage(renderToken = pageRenderGuard.current())`. After each awaited inpainting or image-load operation, exit when the token is stale. Check ownership before writing `cleanedBgCache`, assigning `activeImage.src`, drawing the text layer, or hiding the loader. Always revoke temporary object URLs even for stale work.

- [ ] **Step 4: Run final verification**

Run: `npm.cmd test; node --check src/render-guard.js; node --check src/index.js; git diff --check`

Expected: all tests PASS and all checks exit 0.

- [ ] **Step 5: Commit implementation**

```powershell
git add src/render-guard.js src/index.html src/index.js test/render-guard.test.js docs/superpowers/plans/2026-07-15-page-preview-isolation.md
git commit -m "fix: isolate translated previews between pages"
```
