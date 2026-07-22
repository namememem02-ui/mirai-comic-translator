# Shared Secure API Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ComicTranslator and Screen Translator independently manage the same DPAPI-protected Gemini API key without exposing a stored raw key to either renderer.

**Architecture:** Each application owns an identical, dependency-injected `secure-api-key-store` module and points it at `%APPDATA%\mirai-screenmind\config.json`. The store preserves unrelated config fields, atomically migrates legacy plaintext, returns raw credentials only to main-process callers, and exposes renderer-safe metadata through IPC.

**Tech Stack:** Electron 33 `safeStorage`, Node.js CommonJS, `node:test`, existing atomic JSON helpers.

## Global Constraints

- ComicTranslator must work without Screen Translator installed, and Screen Translator must work without ComicTranslator installed.
- Preserve `comic-translator`, `com.mirai.screenmind`, `mirai-screenmind`, and `mirai-comictranslator-backup` identifiers.
- Never return a stored raw API key from configuration IPC.
- Preserve unrelated fields in the shared config file.
- Never delete a legacy plaintext key unless encryption and atomic persistence both succeed.
- Do not add offline fonts, packaging, Gemini model changes, filesystem protocol changes, or unrelated UI redesign in this plan.

---

### Task 1: ComicTranslator secure credential store

**Files:**
- Create: `lib/secure-api-key-store.js`
- Create: `test/secure-api-key-store.test.js`

**Interfaces:**
- Consumes: `safeStorage.isEncryptionAvailable()`, `safeStorage.encryptString(value)`, `safeStorage.decryptString(buffer)`, `readJson(file, fallback)`, and `writeJson(file, value)`.
- Produces: `createSecureApiKeyStore(options)` with `getKey()`, `getMetadata()`, `saveKey(value)`, and `deleteKey()`.

- [ ] **Step 1: Write failing tests for empty state and encrypted save/load**

```js
test('reports needsKey without exposing a key on a new install', () => {
  const store = createStore({});
  assert.deepEqual(store.getMetadata(), {
    hasKey: false, apiKeyMasked: '', keyState: 'needsKey'
  });
});

test('persists only encrypted key material and returns safe metadata', () => {
  const h = createStore({ theme: 'dark' });
  h.store.saveKey('AIza-secret-value');
  assert.equal(h.writes.at(-1).apiKey, undefined);
  assert.equal(h.writes.at(-1).apiKeyFormatVersion, 1);
  assert.match(h.writes.at(-1).apiKeyEncrypted, /^[A-Za-z0-9+/]+=*$/);
  assert.equal(h.store.getKey(), 'AIza-secret-value');
  assert.deepEqual(h.store.getMetadata(), {
    hasKey: true, apiKeyMasked: 'AIza-s…', keyState: 'secure'
  });
  assert.equal(h.writes.at(-1).theme, 'dark');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- test/secure-api-key-store.test.js`

Expected: FAIL because `../lib/secure-api-key-store` does not exist.

- [ ] **Step 3: Implement the minimal store API**

```js
const FORMAT_VERSION = 1;

function createSecureApiKeyStore({ configPath, safeStorage, readJson, writeJson }) {
  const read = () => readJson(configPath, {});
  const decrypt = cfg => safeStorage.decryptString(Buffer.from(cfg.apiKeyEncrypted, 'base64'));

  function getKey() {
    const cfg = read();
    if (cfg.apiKeyEncrypted) return decrypt(cfg);
    return String(cfg.apiKey || '').trim();
  }

  function saveKey(value) {
    const key = String(value || '').trim();
    if (!key) throw new Error('กรุณากรอก Gemini API Key');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('ระบบเข้ารหัสของ Windows ยังไม่พร้อม');
    const cfg = read();
    cfg.apiKeyEncrypted = safeStorage.encryptString(key).toString('base64');
    cfg.apiKeyFormatVersion = FORMAT_VERSION;
    delete cfg.apiKey;
    writeJson(configPath, cfg);
    return getMetadata();
  }

  function getMetadata() {
    try {
      const key = getKey();
      return key
        ? { hasKey: true, apiKeyMasked: `${key.slice(0, 6)}…`, keyState: 'secure' }
        : { hasKey: false, apiKeyMasked: '', keyState: 'needsKey' };
    } catch {
      return { hasKey: false, apiKeyMasked: '', keyState: 'needsKey' };
    }
  }

  function deleteKey() {
    const cfg = read();
    delete cfg.apiKey;
    delete cfg.apiKeyEncrypted;
    delete cfg.apiKeyFormatVersion;
    writeJson(configPath, cfg);
    return getMetadata();
  }

  return { getKey, getMetadata, saveKey, deleteKey };
}

module.exports = { FORMAT_VERSION, createSecureApiKeyStore };
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm.cmd test -- test/secure-api-key-store.test.js`

Expected: the new empty-state and encrypted-round-trip tests pass.

- [ ] **Step 5: Add failing migration and recovery tests**

Cover these exact cases in separate tests:

```js
test('atomically migrates a legacy plaintext key on read', () => {});
test('keeps plaintext readable when encryption is unavailable', () => {});
test('keeps plaintext when the migration write fails', () => {});
test('returns needsKey when encrypted data cannot be decrypted', () => {});
test('deletes only key fields and preserves unrelated settings', () => {});
test('replaces an existing encrypted key', () => {});
```

Expected RED: legacy `getKey()` does not persist an encrypted replacement and metadata does not distinguish `legacyUnsecured`/`needsKey` correctly.

- [ ] **Step 6: Implement idempotent migration and explicit states**

`getKey()` must attempt migration when `apiKey` exists. It must return the legacy key for the current session if `isEncryptionAvailable()` is false or `writeJson` throws. `getMetadata()` must return `keyState: 'legacyUnsecured'` in that condition and `keyState: 'needsKey'` for undecryptable encrypted data. Do not log the exception, ciphertext, or key.

- [ ] **Step 7: Run focused and full ComicTranslator tests**

Run: `npm.cmd test -- test/secure-api-key-store.test.js`

Run: `npm.cmd test`

Expected: all existing 203 tests plus the new credential-store tests pass.

- [ ] **Step 8: Commit Task 1**

```powershell
git add lib/secure-api-key-store.js test/secure-api-key-store.test.js
git commit -m "feat: add secure shared API key store"
```

---

### Task 2: ComicTranslator main-process and settings integration

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `src/index.html`
- Modify: `src/index.js`
- Create: `test/api-key-ipc-contract.test.js`
- Create: `test/api-key-ui-contract.test.js`

**Interfaces:**
- Consumes: Task 1 `createSecureApiKeyStore()` methods.
- Produces: `get-config` safe metadata, `save-api-key`, and `delete-api-key` IPC; renderer APIs `saveApiKey(args)` and `deleteApiKey()`.

- [ ] **Step 1: Write failing IPC contract tests**

Assert that `main.js` imports `safeStorage` and `createSecureApiKeyStore`, `get-config` does not contain an `apiKey` property, Gemini translation calls `apiKeyStore.getKey()`, and handlers exist for saving and deleting the key.

Run: `npm.cmd test -- test/api-key-ipc-contract.test.js`

Expected: FAIL because the current response contains `apiKey: cfg.apiKey || ''` and no delete handler exists.

- [ ] **Step 2: Integrate the store in `main.js`**

Import Electron `safeStorage`, instantiate the store with `SHARED_CONFIG_PATH`, `readJsonWithRecovery`, and `writeJsonAtomic`, then replace direct `cfg.apiKey` reads/writes:

```js
ipcMain.handle('get-config', () => ({
  ...apiKeyStore.getMetadata(),
  lastFolderPath: loadLastFolderPath(),
}));

ipcMain.handle('save-api-key', (_event, { apiKey } = {}) => {
  try { return { success: true, ...apiKeyStore.saveKey(apiKey) }; }
  catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('delete-api-key', () => {
  try { return { success: true, ...apiKeyStore.deleteKey() }; }
  catch (error) { return { success: false, error: error.message }; }
});
```

The translation handler must obtain the key only inside the main process with `apiKeyStore.getKey()`.

- [ ] **Step 3: Run the IPC contract test and verify GREEN**

Run: `npm.cmd test -- test/api-key-ipc-contract.test.js`

Expected: PASS.

- [ ] **Step 4: Write failing UI/preload contract tests**

Assert that preload exposes `deleteApiKey`, settings HTML contains `deleteApiKeyBtn`, renderer never creates masked text with `key.slice`, and renderer refreshes key state through `getConfig()` after save/delete.

Run: `npm.cmd test -- test/api-key-ui-contract.test.js`

Expected: FAIL because delete UI/API and metadata refresh are absent.

- [ ] **Step 5: Add standalone first-run/save/delete UI behavior**

Add a Thai delete button beside the existing save button. Centralize status rendering in `refreshApiKeyStatus()` using only `hasKey`, `apiKeyMasked`, and `keyState`. On save/delete, clear the password field immediately and call `refreshApiKeyStatus()`; never derive a masked key from the submitted renderer value.

- [ ] **Step 6: Run focused and full ComicTranslator tests**

Run: `npm.cmd test -- test/api-key-ipc-contract.test.js test/api-key-ui-contract.test.js`

Run: `npm.cmd test`

Expected: all tests pass and no raw-key configuration contract remains.

- [ ] **Step 7: Commit Task 2**

```powershell
git add main.js preload.js src/index.html src/index.js test/api-key-ipc-contract.test.js test/api-key-ui-contract.test.js
git commit -m "feat: secure ComicTranslator API key flow"
```

---

### Task 3: Screen Translator compatible credential store

**Files:**
- Create: `../Screen Translator/src/secure-api-key-store.js`
- Create: `../Screen Translator/test/secure-api-key-store.test.js`
- Modify: `../Screen Translator/package.json`

**Interfaces:**
- Consumes: Screen Translator's `CONFIG_PATH()`, Electron `safeStorage`, JSON read, and atomic JSON write dependencies.
- Produces: local `createSecureApiKeyStore(options)` with `getKey()`, `getMetadata()`, `saveKey(value)`, and `deleteKey()`, persisting `apiKeyEncrypted` plus `apiKeyFormatVersion: 1`.

- [ ] **Step 1: Write failing shared-schema tests**

Copy `ComicTranslator/test/secure-api-key-store.test.js` to `Screen Translator/test/secure-api-key-store.test.js`, change its module import from `../lib/secure-api-key-store` to `../src/secure-api-key-store`, and add:

```js
test('a second standalone store reads the shared encrypted schema', () => {
  const first = createStore({});
  first.store.saveKey('AIza-shared-secret');
  const second = createStore(first.currentConfig());
  assert.equal(second.store.getKey(), 'AIza-shared-secret');
  assert.equal(second.store.getMetadata().keyState, 'secure');
});
```

Run from Screen Translator: `node --test test/secure-api-key-store.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the compatible module**

Copy the tested Task 1 module into the Screen Translator source tree during development:

```powershell
Copy-Item -LiteralPath '..\ComicTranslator\lib\secure-api-key-store.js' -Destination '.\src\secure-api-key-store.js'
```

The resulting packaged application owns this file; there is no runtime cross-repository import.

- [ ] **Step 3: Add a test script and verify GREEN**

Add `"test": "node --test"` to Screen Translator scripts.

Run: `npm.cmd test -- test/secure-api-key-store.test.js`

Expected: all shared-schema tests pass.

- [ ] **Step 4: Commit Task 3 in the Screen Translator repository**

```powershell
git add src/secure-api-key-store.js test/secure-api-key-store.test.js package.json
git commit -m "feat: add compatible secure API key store"
```

---

### Task 4: Screen Translator main-process and settings integration

**Files:**
- Modify: `../Screen Translator/main.js`
- Modify: `../Screen Translator/preload.js`
- Modify: `../Screen Translator/src/settings.html`
- Modify: `../Screen Translator/src/settings.js`
- Create: `../Screen Translator/test/api-key-security-contract.test.js`

**Interfaces:**
- Consumes: Task 3 `createSecureApiKeyStore()`.
- Produces: safe `get-config`, encrypted `save-key`, `delete-key`, typed-key `test-key`, and unchanged first-run settings opening.

- [ ] **Step 1: Write the failing integration contract**

Assert that stored config reads never return raw keys to renderer code; `loadConfig()` supplies a decrypted key only to main-process translation paths; save/delete use the secure store; and first run still calls `openSettings()` when `getMetadata().hasKey` is false.

Run: `npm.cmd test -- test/api-key-security-contract.test.js`

Expected: FAIL because `save-key` currently writes `cfg.apiKey` directly.

- [ ] **Step 2: Integrate secure key access**

Keep general settings reads/writes intact but route key operations through the store. Main-process translation, image translation, and Ask AI obtain `apiKeyStore.getKey()`. `get-config` merges only safe metadata. `test-key` may use the newly submitted value, otherwise it calls `getKey()`.

- [ ] **Step 3: Add delete behavior to preload and settings UI**

Expose `deleteKey()`, add a Thai “ลบ API Key” button, clear the input after save/delete, and refresh metadata. Preserve the existing test-key button and automatic first-run settings window.

- [ ] **Step 4: Run Screen Translator tests**

Run: `npm.cmd test -- test/api-key-security-contract.test.js test/secure-api-key-store.test.js`

Run: `npm.cmd test`

Expected: all Screen Translator tests pass.

- [ ] **Step 5: Commit Task 4 in the Screen Translator repository**

```powershell
git add main.js preload.js src/settings.html src/settings.js test/api-key-security-contract.test.js
git commit -m "feat: encrypt Screen Translator API keys"
```

---

### Task 5: Cross-application compatibility and regression verification

**Files:**
- Create: `test/shared-api-key-compatibility.test.js`
- Modify only if verification finds a contract mismatch: credential modules and their tests in either repository.

**Interfaces:**
- Consumes: both stores' version-1 persisted schema.
- Produces: evidence that either independently installed executable can create/read/delete the shared credential.

- [ ] **Step 1: Write a failing cross-module compatibility test**

Load both factories, point them to one temporary config and one deterministic `safeStorage` harness, save through ComicTranslator, read through Screen Translator, replace through Screen Translator, read through ComicTranslator, then delete and verify both report `needsKey`.

Run: `npm.cmd test -- test/shared-api-key-compatibility.test.js`

Expected on first run: FAIL if either module differs in schema or behavior.

- [ ] **Step 2: Make only compatibility corrections required by the test**

Do not introduce a runtime cross-repository import. Align constants, state strings, and migration behavior locally in each module.

- [ ] **Step 3: Run complete automated verification in both repositories**

Run in ComicTranslator: `npm.cmd test`

Expected: existing 203 tests plus all new credential tests pass.

Run in Screen Translator: `npm.cmd test`

Expected: all existing and new Screen Translator tests pass.

- [ ] **Step 4: Run secret-leak static checks**

```powershell
rg -n "return\s*\{[^}]*apiKey:|cfg\.apiKey\s*=|apiKey:\s*cfg\.apiKey" main.js preload.js src test
```

Expected: no stored raw key returned to a renderer and no direct plaintext config assignment. Typed user input is allowed only in save/test IPC arguments.

- [ ] **Step 5: Manual Electron verification**

Back up `%APPDATA%\mirai-screenmind\config.json`, then verify: legacy migration, ComicTranslator-only first run, Screen Translator-only first run, shared recognition, replace, delete, and copied/undecryptable config recovery. Restore the backup after testing. Never print the key or config contents.

- [ ] **Step 6: Commit final compatibility evidence**

```powershell
git add test/shared-api-key-compatibility.test.js
git commit -m "test: verify shared encrypted API key compatibility"
```

---

## Follow-up plan boundary

After this plan is green, create and execute a separate TDD plan for ComicTranslator filesystem containment, the secure local-asset protocol, `webSecurity: true`, and navigation/popup restrictions. Keeping that work separate prevents credential changes across two repositories from being mixed with the larger image/path migration.
