# Settings Help and Online Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Gemini setup help and a testable online version checker to Settings.

**Architecture:** Keep network/version logic in `lib/update-checker.js`, expose narrow IPC methods through preload, and render only structured status in Settings. Open only the fixed Google AI Studio URL through the main process.

**Tech Stack:** Electron 33, Node.js test runner, HTML/CSS/vanilla JavaScript

## Global Constraints

- Never expose Node.js or arbitrary URL opening to the renderer.
- Accept only HTTPS update manifests and installer URLs.
- Do not download or install update packages in this increment.
- Preserve existing package IDs, backup formats, and user data.

---

### Task 1: Gemini API-key guide

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`
- Modify: `preload.js`
- Modify: `main.js`
- Test: `test/settings-help-and-update-ui.test.js`

**Interfaces:**
- Produces: `window.api.openGeminiApiKeyPage(): Promise<{ success: boolean, error?: string }>`

- [ ] Write a failing contract test for the guide, fixed URL, preload bridge, and allowlisted main-process handler.
- [ ] Run `node --test test/settings-help-and-update-ui.test.js` and confirm it fails because the controls do not exist.
- [ ] Add the guide and the narrow external-link IPC flow.
- [ ] Run the focused test and confirm it passes.
- [ ] Commit the independently working guide.

### Task 2: Update checker module

**Files:**
- Create: `lib/update-checker.js`
- Test: `test/update-checker.test.js`

**Interfaces:**
- Produces: `compareVersions(left, right): number`
- Produces: `createUpdateChecker({ currentVersion, manifestUrl, fetchImpl, timeoutMs }).check(): Promise<UpdateResult>`

- [ ] Write failing behavior tests for missing configuration, newer/current versions, invalid HTTPS data, network failure, and timeout.
- [ ] Run `node --test test/update-checker.test.js` and confirm the missing module failure.
- [ ] Implement strict manifest validation, semantic comparison, timeout, and structured results.
- [ ] Run the focused test and confirm it passes.
- [ ] Commit the checker module.

### Task 3: Settings update UI and IPC

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`
- Test: `test/settings-help-and-update-ui.test.js`

**Interfaces:**
- Consumes: `createUpdateChecker(...)`
- Produces: `window.api.getUpdateInfo()` and `window.api.checkForUpdates()`

- [ ] Extend the contract test for installed version, check button, busy state, and structured result rendering.
- [ ] Run the focused test and confirm it fails for missing update controls.
- [ ] Wire the checker through IPC/preload and implement the Settings states.
- [ ] Run focused tests, then `npm.cmd test`, and confirm all tests pass.
- [ ] Commit the complete Settings update checker.
