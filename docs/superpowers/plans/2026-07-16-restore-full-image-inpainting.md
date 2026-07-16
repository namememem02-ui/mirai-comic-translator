# Restore Full-Image LaMa Inpainting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the higher-quality full-image LaMa processing path and prevent contour-based patch processing from returning.

**Architecture:** Keep the existing FastAPI endpoint and renderer mask generation unchanged. Replace only the sidecar's patch-crop pipeline with one `lama(img_pil, mask_pil)` call and protect that contract with a source-level regression test that runs in the existing Node test suite without importing heavy Python AI dependencies.

**Tech Stack:** Python, FastAPI, SimpleLama, Node.js built-in test runner

## Global Constraints

- Do not change translation, export, quality-check, watermark, review, or editor behavior.
- Preserve the existing `/inpaint` API, GPU/CPU configuration, JPEG quality, and exception reporting.
- Process the original full-resolution image and complete mask in one LaMa call.

---

### Task 1: Restore the full-image processing contract

**Files:**
- Create: `test/inpaint-sidecar-contract.test.js`
- Modify: `sidecar/inpaint_server.py:80-119`

**Interfaces:**
- Consumes: uploaded PIL `img_pil` and `mask_pil` objects.
- Produces: `result_pil = lama(img_pil, mask_pil)` for the existing JPEG response.

- [ ] **Step 1: Write the failing regression test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'sidecar', 'inpaint_server.py'), 'utf8');

test('LaMa processes the complete image and mask without patch cropping', () => {
  assert.match(source, /result_pil\s*=\s*lama\(img_pil,\s*mask_pil\)/);
  assert.doesNotMatch(source, /findContours|boundingRect|crop_img|crop_mask|result_np\[y1:y2/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/inpaint-sidecar-contract.test.js`

Expected: FAIL because the current sidecar contains `findContours`, `crop_img`, and patch paste-back.

- [ ] **Step 3: Restore the minimal full-image implementation**

Replace the patch-processing block after PIL conversion with:

```python
        # LaMa needs the full surrounding page context for the best texture reconstruction.
        result_pil = lama(img_pil, mask_pil)
```

Keep response encoding and error handling unchanged.

- [ ] **Step 4: Run targeted and complete verification**

Run: `node --test test/inpaint-sidecar-contract.test.js`

Expected: 1 pass, 0 fail.

Run: `npm.cmd test`

Expected: all tests pass with 0 failures.

- [ ] **Step 5: Validate Python syntax and commit**

Run: `python -m py_compile sidecar/inpaint_server.py`

Expected: exit code 0.

Commit:

```text
git add sidecar/inpaint_server.py test/inpaint-sidecar-contract.test.js
git commit -m "fix: restore full-image LaMa inpainting"
```
