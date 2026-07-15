# Tight Text Detection and Chinese Name Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gemini return tight glyph-region boxes and automatically remember Thai transliterations of newly discovered romanized Chinese character names.

**Architecture:** Extract prompt construction into a Node module used by the Electron main process. Add a browser/Node-compatible translation-result module that normalizes legacy and new responses and safely merges discovered names into the existing project Glossary; the renderer then persists the merged memory through its existing API.

**Tech Stack:** Electron, vanilla JavaScript, Gemini generateContent API, Node.js built-in test runner.

## Global Constraints

- Saved page translation JSON remains a bare array.
- Existing project Glossary values always win and comparisons are case-insensitive.
- Automatically learned values must be non-empty Thai strings.
- Bounding boxes surround visible glyphs with approximately 2–3% safety padding, not balloons or artwork.
- No runtime dependency is added.

---

### Task 1: Testable Translation Prompt

**Files:**
- Create: `lib/translation-prompt.js`
- Create: `test/translation-prompt.test.js`
- Modify: `main.js:173-190`

**Interfaces:**
- Consumes: `buildTranslationPrompt(glossary: Record<string,string>): string`.
- Produces: Gemini instructions for glyph boxes and `{ bubbles, discovered_names }` JSON.

- [ ] **Step 1: Write failing prompt-content tests**

```js
test('prompt requests tight glyph boxes and Chinese Thai transliteration', () => {
  const prompt = buildTranslationPrompt({ 'Lin Du': 'หลินตู้' });
  assert.match(prompt, /visible glyph/i);
  assert.match(prompt, /2-3%/);
  assert.match(prompt, /romanized Chinese/i);
  assert.match(prompt, /ลู่ เหรินปิง/);
  assert.match(prompt, /discovered_names/);
  assert.match(prompt, /หลินตู้/);
});
```

- [ ] **Step 2: Verify the prompt test fails**

Run: `node --test test/translation-prompt.test.js`

Expected: FAIL because `lib/translation-prompt.js` does not exist.

- [ ] **Step 3: Implement and use `buildTranslationPrompt`**

The prompt must state that boxes include only visible glyphs plus 2–3% padding, visually separate blocks remain separate, Glossary spellings are exact, unknown romanized Chinese names are transliterated into Thai, and only actual character names appear in `discovered_names`. Require JSON shaped as `{ "bubbles": [], "discovered_names": {} }` and include `Lu Renbing` → `ลู่ เหรินปิง` in the example.

- [ ] **Step 4: Run the prompt and full tests**

Run: `node --test test/translation-prompt.test.js; npm.cmd test`

Expected: all tests PASS.

### Task 2: Response Normalization and Safe Name Memory

**Files:**
- Create: `src/translation-result.js`
- Create: `test/translation-result.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces: `normalizeTranslationResult(result)` returning `{ bubbles, discoveredNames }` and `mergeDiscoveredNames(glossary, discoveredNames)` returning `{ glossary, added }`.
- Consumes: legacy arrays or new object responses and existing Glossary mappings.

- [ ] **Step 1: Write failing normalization and merge tests**

```js
test('normalizes new and legacy translation responses', () => {
  const legacyBubble = { bubble_id: 1, box_2d: [1, 2, 3, 4], original_text: 'A', translated_text: 'ก' };
  const newBubble = { bubble_id: 2, box_2d: [5, 6, 7, 8], original_text: 'B', translated_text: 'ข' };
  assert.deepEqual(normalizeTranslationResult([legacyBubble]).bubbles, [legacyBubble]);
  assert.deepEqual(normalizeTranslationResult({ bubbles: [newBubble], discovered_names: { 'Lu Renbing': 'ลู่ เหรินปิง' } }), {
    bubbles: [newBubble],
    discoveredNames: { 'Lu Renbing': 'ลู่ เหรินปิง' }
  });
});

test('merge protects user spellings case-insensitively and ignores non-Thai values', () => {
  const result = mergeDiscoveredNames({ 'LU RENBING': 'ลู่ เหรินปิง (ผู้ใช้)' }, {
    'Lu Renbing': 'ลู่ เหรินปิง',
    'Fan Jian': 'Fan Jian',
    'Lin Du': 'หลินตู้'
  });
  assert.deepEqual(result.added, { 'Lin Du': 'หลินตู้' });
});
```

- [ ] **Step 2: Verify the result tests fail**

Run: `node --test test/translation-result.test.js`

Expected: FAIL because `src/translation-result.js` does not exist.

- [ ] **Step 3: Implement the UMD result module and load it before `index.js`**

Validation keeps only bubble objects with numeric four-element `box_2d` arrays and string text fields. Name merging accepts non-empty keys and values containing `/[\u0E00-\u0E7F]/`, and never replaces a case-insensitive existing key.

- [ ] **Step 4: Run result and full tests**

Run: `node --test test/translation-result.test.js; npm.cmd test`

Expected: all tests PASS.

### Task 3: Renderer Integration

**Files:**
- Modify: `src/index.js:1646-1730`

**Interfaces:**
- Consumes: `window.TranslationResult.normalizeTranslationResult` and `mergeDiscoveredNames`.
- Produces: valid `activePageTranslation` arrays and atomically persisted project Glossary additions.

- [ ] **Step 1: Add one integration helper used by both translation paths**

```js
async function applyTranslationResult(result) {
  const normalized = window.TranslationResult.normalizeTranslationResult(result);
  const merged = window.TranslationResult.mergeDiscoveredNames(projectGlossary, normalized.discoveredNames);
  activePageTranslation = normalized.bubbles;
  if (Object.keys(merged.added).length > 0) {
    projectGlossary = merged.glossary;
    await window.api.saveMemory({ project: currentProject, memoryData: projectGlossary });
    renderGlossary();
  }
}
```

- [ ] **Step 2: Replace direct result assignment in translate-page and translate-all**

Both paths call `await applyTranslationResult(result)` before saving the page array. Translation continues when no names are returned.

- [ ] **Step 3: Run final verification**

Run: `npm.cmd test; node --check main.js; node --check lib/translation-prompt.js; node --check src/translation-result.js; node --check src/index.js; git diff --check`

Expected: all tests PASS and all checks exit 0.

- [ ] **Step 4: Commit implementation**

```powershell
git add main.js lib/translation-prompt.js src/translation-result.js src/index.html src/index.js test/translation-prompt.test.js test/translation-result.test.js docs/superpowers/plans/2026-07-15-tight-text-detection-and-chinese-name-memory.md
git commit -m "feat: tighten OCR boxes and remember Chinese names"
```
