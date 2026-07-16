# Managed LaMa Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start and monitor LaMa automatically, expose readiness in the UI, and preserve original images when LaMa is unavailable.

**Architecture:** A focused Node manager owns probing, Python discovery, child-process startup, state, retry, and shutdown. Electron main bridges it to the renderer through IPC. The Python sidecar exposes health state while loading the model in a background thread, and renderer preview/review/export paths stop applying automatic smooth-fill fallback.

**Tech Stack:** Electron, Node.js child_process/http, FastAPI, Python threading, Node built-in test runner

## Global Constraints

- Never stop a LaMa server ComicTranslator did not start.
- Never open two managed sidecar processes concurrently.
- Never apply automatic smooth-fill fallback when LaMa is unavailable.
- Preserve translation, glossary, watermark, review, ZIP naming, and export selection behavior.

---

### Task 1: Sidecar lifecycle manager

**Files:**
- Create: `lib/inpaint-sidecar-manager.js`
- Create: `test/inpaint-sidecar-manager.test.js`

**Interfaces:**
- Produces: `createInpaintSidecarManager(options)` with `ensureStarted()`, `getStatus()`, and `shutdown()`.
- Status: `{ state: 'starting'|'ready'|'unavailable', message: string }`.

- [ ] Write tests for existing healthy server reuse, a single concurrent startup, Python candidate fallback, bounded readiness timeout, retry after failure, and owner-only shutdown.
- [ ] Run `node --test test/inpaint-sidecar-manager.test.js` and verify RED because the module is missing.
- [ ] Implement the manager using injected `probe`, `spawn`, `probePython`, `wait`, candidate list, and sidecar path so tests do not start real processes.
- [ ] Run the targeted test and verify GREEN.
- [ ] Commit with `feat: manage LaMa sidecar lifecycle`.

### Task 2: Health endpoint and Electron IPC

**Files:**
- Modify: `sidecar/inpaint_server.py`
- Modify: `main.js`
- Modify: `preload.js`
- Create: `test/inpaint-health-contract.test.js`

**Interfaces:**
- Python produces `GET /health` JSON with `state` and optional `message`.
- Preload produces `getInpaintStatus()`, `retryInpaintSidecar()`, and `onInpaintStatus(callback)`.

- [ ] Write a failing contract test for the health endpoint, IPC names, and shutdown call.
- [ ] Run the contract test and verify RED.
- [ ] Load `SimpleLama` in a daemon thread, protect state with module variables, return HTTP 503 from `/inpaint` until ready, and add `/health`.
- [ ] Instantiate the manager in `main.js`, broadcast state changes, start after Electron readiness, expose status/retry IPC, and call shutdown before quit.
- [ ] Expose the three renderer APIs in `preload.js` with listener cleanup.
- [ ] Run targeted tests and Python `py_compile`; verify GREEN.
- [ ] Commit with `feat: expose LaMa readiness to Electron`.

### Task 3: Renderer status and safe degradation

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`
- Create: `test/inpaint-renderer-contract.test.js`

**Interfaces:**
- Consumes renderer APIs from Task 2.
- Produces status element `inpaintStatus`, retry button `retryInpaintBtn`, and source-image fallback without automatic erase.

- [ ] Write a failing renderer contract test for UI IDs, state rendering, retry, and absence of smooth erase calls in automatic failure branches.
- [ ] Run the contract test and verify RED.
- [ ] Add the header status control and styles for starting/ready/unavailable.
- [ ] Initialize status on load, subscribe to updates, and wire retry.
- [ ] Change preview, chapter review, and export catch branches to keep the untouched source image and show a warning; do not call `drawSmoothErase` automatically.
- [ ] Run targeted and full tests, verify Python syntax, and manually inspect ready/unavailable UI states.
- [ ] Commit with `fix: avoid blocky fallback when LaMa is unavailable`.
