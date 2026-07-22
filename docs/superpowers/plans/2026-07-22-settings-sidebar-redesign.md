# Settings Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow Settings column with an accessible category rail and focused content panels.

**Architecture:** Put category navigation behavior in a small browser/Node-compatible `settings-tabs.js` module. Preserve every existing setting ID and handler while reorganizing the HTML into five tab panels and moving dialog geometry into scoped CSS.

**Tech Stack:** Electron 33, HTML, CSS, vanilla JavaScript, Node.js test runner

## Global Constraints

- Desktop dialog width is `min(920px, calc(100vw - 48px))` and height is `min(720px, calc(100vh - 48px))`.
- Existing element IDs and renderer handlers remain unchanged.
- Only the content panel scrolls on desktop; below 720px the category rail becomes a horizontal tab bar.
- Do not change stored settings data or save behavior.

---

### Task 1: Accessible category controller

**Files:**
- Create: `src/settings-tabs.js`
- Create: `test/settings-tabs.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `SettingsTabs.resolveTabIndex(currentIndex, key, count): number`
- Produces: `SettingsTabs.initSettingsTabs(root): { activate(id): void, activeId(): string }`

- [ ] **Step 1: Write the failing controller tests**

```js
test('arrow home and end keys resolve category positions', () => {
  assert.equal(resolveTabIndex(0, 'ArrowRight', 5), 1);
  assert.equal(resolveTabIndex(0, 'ArrowLeft', 5), 4);
  assert.equal(resolveTabIndex(3, 'Home', 5), 0);
  assert.equal(resolveTabIndex(1, 'End', 5), 4);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/settings-tabs.test.js`
Expected: FAIL because `src/settings-tabs.js` does not exist.

- [ ] **Step 3: Implement the minimal controller**

```js
function resolveTabIndex(currentIndex, key, count) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + count) % count;
  return currentIndex;
}
```

`initSettingsTabs` must update `aria-selected`, `tabIndex`, panel `hidden`, and focus the selected tab for keyboard navigation. It retains the last active tab in module state.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test test/settings-tabs.test.js`
Expected: all controller tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- src/settings-tabs.js src/index.html test/settings-tabs.test.js
git commit -m "feat: add accessible Settings category controller"
```

### Task 2: Wide category-based Settings layout

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`
- Create: `test/settings-sidebar-layout.test.js`

**Interfaces:**
- Consumes: `SettingsTabs.initSettingsTabs(settingsDialog)`
- Preserves: all existing Settings input and button IDs.

- [ ] **Step 1: Write the failing layout contract**

```js
for (const category of ['ai', 'appearance', 'typography', 'retouch', 'updates']) {
  assert.equal((html.match(new RegExp(`data-settings-tab="${category}"`, 'g')) || []).length, 1);
  assert.equal((html.match(new RegExp(`data-settings-panel="${category}"`, 'g')) || []).length, 1);
}
assert.match(css, /width:\s*min\(920px,\s*calc\(100vw - 48px\)\)/);
assert.match(css, /@media\s*\(max-width:\s*720px\)/);
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node --test test/settings-sidebar-layout.test.js`
Expected: FAIL because the tabs, panels, and wide layout do not exist.

- [ ] **Step 3: Recompose the Settings markup and styles**

Create a `.settings-layout` with a `.settings-category-rail` tablist and `.settings-content` panels for AI, appearance, typography, retouch, and updates. Use a fixed header/footer, scroll only `.settings-content`, and initialize the controller once from `src/index.js`.

- [ ] **Step 4: Verify focused and full suites**

Run: `node --test test/settings-tabs.test.js test/settings-sidebar-layout.test.js test/settings-help-and-update-ui.test.js test/ui-scale-settings-contract.test.js`
Expected: all focused tests pass.

Run: `npm.cmd test`
Expected: 0 failures.

- [ ] **Step 5: Restart and visually verify**

Open Settings at normal desktop width and confirm the category rail, content scrolling, sticky footer, API guide, update section, and responsive tab bar render without clipping.

- [ ] **Step 6: Commit**

```powershell
git add -- src/index.html src/index.js src/style.css test/settings-sidebar-layout.test.js
git commit -m "feat: redesign Settings with category navigation"
```
