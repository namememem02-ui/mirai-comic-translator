# Managed LaMa Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Windows installer whose Settings page securely downloads and manages a CPU LaMa component, automatically detects NVIDIA readiness, exposes CPU/GPU state, and visibly falls back from GPU to CPU.

**Architecture:** A main-process component manager owns manifests, machine detection, downloads, archive validation, activation, and sidecar launch decisions. Small pure modules define manifest/status/selection contracts, preload exposes fixed IPC calls, and the renderer only presents structured state. CPU packaging is reproducible and independent from the Electron installer; the NVIDIA contract is implemented now while its downloadable asset stays unavailable until certified.

**Tech Stack:** Electron 33, Node.js CommonJS and `node:test`, a controlled two-pass extractor built on pinned `yauzl`, Python 3.11 embeddable runtime, FastAPI/Uvicorn, CPU-only PyTorch, Simple LaMa, electron-builder/NSIS, PowerShell packaging scripts.

## Global Constraints

- Windows x64 is the first supported packaged target.
- Application identifier remains `comic-translator`; backup identifier remains `mirai-comictranslator-backup`.
- Main installer excludes Python, PyTorch, virtual environments, LaMa weights, projects, outputs, and API keys.
- Managed packages live below `app.getPath('userData')/components/lama` and require no administrator access.
- Default backend mode is `auto`; default fallback policy is `automatic`.
- CPU and NVIDIA packages never share a Python environment.
- The renderer cannot supply download URLs, executable paths, archive paths, or process arguments.
- Every archive is HTTPS-only, size-bounded, SHA-256 verified, path-safe, and atomically activated.
- Translation/editing remain usable when retouch is unavailable.
- Screen Translator and system Python are not prerequisites for packaged builds.
- Component manifest URL is `https://github.com/namememem02-ui/mirai-comic-translator/releases/latest/download/lama-components.json`.

---

### Task 1: Component contracts and backend selection

**Files:**
- Create: `lib/lama-component-contract.js`
- Test: `test/lama-component-contract.test.js`

**Interfaces:**
- Produces: `validateComponentManifest(value, options)`, `normalizeComponentSettings(value)`, `selectLamaBackend(input)`, and `safeComponentStatus(value)`.
- Consumes: plain JSON values only; no Electron or filesystem dependency.

- [ ] **Step 1: Write failing contract tests**

```js
test('auto recommends CPU when NVIDIA driver is unavailable', () => {
  assert.equal(selectLamaBackend({ mode: 'auto', cpuReady: true, nvidiaReady: false, nvidiaCompatible: false }).backend, 'cpu');
});

test('automatic fallback announces GPU to CPU transition', () => {
  assert.deepEqual(selectLamaBackend({ mode: 'nvidia', fallback: 'automatic', cpuReady: true, nvidiaReady: true, nvidiaCompatible: true, gpuFailure: 'driver-too-old' }), {
    backend: 'cpu', state: 'gpu-fallback', reason: 'driver-too-old', automatic: true,
  });
});

test('manifest rejects HTTP URLs and invalid SHA-256', () => {
  assert.throws(() => validateComponentManifest({ schema: 1, packages: [{ backend: 'cpu', url: 'http://example.test/a.zip', sha256: 'bad' }] }));
});
```

- [ ] **Step 2: Run `node --test test/lama-component-contract.test.js` and confirm failure because the module is absent**
- [ ] **Step 3: Implement strict enums, bounded strings/bytes, HTTPS URL validation, 64-character SHA-256 validation, version fields, safe status projection, and deterministic selection**
- [ ] **Step 4: Run the focused test and confirm all cases pass**
- [ ] **Step 5: Commit with `git commit -m "feat: define managed LaMa component contracts"`**

### Task 2: Machine detection and compatibility reporting

**Files:**
- Create: `lib/lama-machine-detector.js`
- Test: `test/lama-machine-detector.test.js`

**Interfaces:**
- Produces: `createLamaMachineDetector({ execFile, platform, arch, freeDisk })` with `detect(componentRoot)` returning `{ platform, arch, freeBytes, nvidia: { present, driverVersion, compatible, reason } }`.
- Consumes: NVIDIA minimum driver from the validated component contract.

- [ ] **Step 1: Write failing tests for missing `nvidia-smi`, supported driver output, malformed output, non-x64 Windows, and bounded diagnostics**

```js
test('missing nvidia-smi is a normal CPU-only result', async () => {
  const detector = createLamaMachineDetector({ platform: 'win32', arch: 'x64', freeDisk: async () => 9e9, execFile: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } });
  assert.deepEqual((await detector.detect('C:\\components')).nvidia, { present: false, driverVersion: '', compatible: false, reason: 'not-detected' });
});
```

- [ ] **Step 2: Run `node --test test/lama-machine-detector.test.js` and verify the missing-module failure**
- [ ] **Step 3: Implement `nvidia-smi --query-gpu=name,driver_version --format=csv,noheader` parsing without a shell and compare dotted driver versions numerically**
- [ ] **Step 4: Run focused tests and confirm pass**
- [ ] **Step 5: Commit with `git commit -m "feat: detect LaMa compute compatibility"`**

### Task 3: Secure component downloader and atomic installer

**Files:**
- Create: `lib/lama-component-installer.js`
- Create: `lib/safe-zip-extractor.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/lama-component-installer.test.js`
- Test: `test/safe-zip-extractor.test.js`

**Interfaces:**
- Produces: `createLamaComponentInstaller({ fetch, fs, extract, hashFile, now })` with `download(pkg, paths, signal, onProgress)`, `install(pkg, paths, signal, onProgress)`, `remove(backend, paths)`, and `inspect(backend, paths)`.
- Consumes: a validated package object; all destination paths are derived from a trusted component root.
- Dependency: direct production dependency `yauzl` pinned through `package-lock.json`; the controlled extractor pre-scans and validates the complete central directory before creating archive-derived paths or writing file data.

- [ ] **Step 1: Write failing tests for streaming progress, cancellation cleanup, content-length mismatch, insufficient disk, checksum mismatch, traversal/absolute/symlink/duplicate entries, extraction size and count limits, failed probe rollback, atomic activation, repair, and backend-scoped removal**

```js
test('checksum failure never replaces the active component', async () => {
  const installer = createHarness({ downloadedHash: '0'.repeat(64), expectedHash: '1'.repeat(64), activeVersion: '0.9.0' });
  await assert.rejects(installer.installCpu(), /checksum/);
  assert.equal(await installer.activeVersion('cpu'), '0.9.0');
  assert.equal(await installer.hasPartialFiles(), false);
});
```

- [ ] **Step 2: Run focused tests and verify failures identify missing installer behavior**
- [ ] **Step 3: Add pinned `yauzl` and implement a controlled two-pass extractor, staged `.partial` download, incremental SHA-256, abort handling, pre/post disk checks, Windows-canonical path validation, bounded extraction, `component.json` validation, executable/model probes, immutable version-directory promotion, and atomic `active.json` replacement**
- [ ] **Step 4: Run installer tests, then `npm.cmd test`**
- [ ] **Step 5: Commit with `git commit -m "feat: securely install LaMa components"`**

### Task 4: Orchestrating component lifecycle and fallback

**Files:**
- Create: `lib/lama-component-manager.js`
- Test: `test/lama-component-manager.test.js`

**Interfaces:**
- Produces: `createLamaComponentManager(options)` with `initialize()`, `getState()`, `check()`, `install(backend)`, `cancel()`, `repair(backend)`, `remove(backend)`, `setPreferences(settings)`, `startRetouch()`, `reportRuntimeFailure(code)`, `shutdown()`, and `subscribe(listener)`.
- Consumes: contract, detector, installer, manifest loader, settings store, and existing sidecar manager adapters.

- [ ] **Step 1: Write failing state-machine tests for every documented state and fallback policy**

```js
test('GPU failure remains visible after automatic CPU fallback', async () => {
  const manager = createHarness({ mode: 'auto', fallback: 'automatic', cpuReady: true, nvidiaReady: true });
  await manager.startRetouch();
  await manager.reportRuntimeFailure('cuda-out-of-memory');
  assert.match(manager.getState().label, /CPU/);
  assert.equal(manager.getState().transition, 'GPU -> CPU');
  assert.equal(manager.getState().reason, 'cuda-out-of-memory');
});
```

- [ ] **Step 2: Run focused tests and verify state-machine failures**
- [ ] **Step 3: Implement serialized mutations, immutable public states, progress mapping, safe Thai messages, CPU-download-required handling, and non-silent fallback retention for the session**
- [ ] **Step 4: Run focused tests and full Node suite**
- [ ] **Step 5: Commit with `git commit -m "feat: manage LaMa lifecycle and fallback"`**

### Task 5: Integrate managed runtime with the sidecar

**Files:**
- Modify: `lib/inpaint-sidecar-manager.js`
- Modify: `sidecar/inpaint_server.py`
- Modify: `sidecar/test_inpaint.py`
- Modify: `test/inpaint-sidecar-manager.test.js`
- Modify: `test/inpaint-sidecar-contract.test.js`

**Interfaces:**
- Produces: managed launch descriptor `{ pythonPath, serverPath, modelPath, backend, componentVersion }` and health `{ state, backend, componentVersion, errorCode, message }`.
- Consumes: component manager's selected launch descriptor.

- [ ] **Step 1: Add failing Node/Python tests proving packaged mode never probes system Python, development mode preserves existing candidates, `LAMA_MODEL` and `LAMA_BACKEND` are explicit, and CUDA initialization/inference errors return stable codes**
- [ ] **Step 2: Run `node --test test/inpaint-sidecar-manager.test.js test/inpaint-sidecar-contract.test.js` and `sidecar\.venv\Scripts\python.exe -m unittest sidecar.test_inpaint` to verify RED**
- [ ] **Step 3: Inject launch descriptors, pass environment without inheriting arbitrary overrides, select `torch.device('cpu')` or `torch.device('cuda')`, and map `driver-too-old`, `cuda-unavailable`, `cuda-out-of-memory`, `model-missing`, and `startup-failed`**
- [ ] **Step 4: Run focused Node/Python tests and full Node suite**
- [ ] **Step 5: Commit with `git commit -m "feat: launch managed LaMa runtimes"`**

### Task 6: Add narrow Electron IPC and persisted preferences

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `lib/app-settings-store.js` if present, otherwise the existing app-settings functions in `main.js`
- Create: `test/lama-component-ipc-contract.test.js`

**Interfaces:**
- Renderer methods: `getLamaComponentState()`, `checkLamaComponents()`, `installLamaComponent(backend)`, `cancelLamaComponentDownload()`, `repairLamaComponent(backend)`, `removeLamaComponent(backend)`, `saveLamaPreferences({ mode, fallback })`, and `onLamaComponentState(listener)`.
- Backend arguments accept only `cpu` or `nvidia`; preferences accept only contract enums.

- [ ] **Step 1: Write failing source-contract tests proving no renderer method accepts URLs/paths and all IPC handlers validate enums**
- [ ] **Step 2: Run `node --test test/lama-component-ipc-contract.test.js` and confirm RED**
- [ ] **Step 3: Instantiate the manager after `app.whenReady`, derive its root from `app.getPath('userData')`, register handlers, broadcast state changes, and shut down owned work on quit**
- [ ] **Step 4: Run focused tests and full suite**
- [ ] **Step 5: Commit with `git commit -m "feat: expose managed LaMa controls"`**

### Task 7: Build the Settings retouch component UI

**Files:**
- Modify: `src/index.html`
- Modify: `src/index.js`
- Modify: `src/style.css`
- Create: `src/lama-component-view.js`
- Create: `test/lama-component-ui.test.js`
- Create: `test/lama-component-view.test.js`

**Interfaces:**
- Produces: `window.LamaComponentView.render(state)` and event binding for fixed preload methods.
- Consumes: safe public component state only.

- [ ] **Step 1: Write failing DOM/source tests for backend selector, fallback selector, hardware summary, progress element, cancel/install/repair/remove controls, persistent GPU-to-CPU notice, header badges, and Thai error actions**
- [ ] **Step 2: Run focused UI tests and confirm missing elements/module failures**
- [ ] **Step 3: Implement the Retouch panel and header states: `AI รีทัช · CPU`, `AI รีทัช · GPU`, `กำลังเปลี่ยน GPU → CPU`, and `AI รีทัชไม่พร้อม`; never render diagnostics with `innerHTML`**
- [ ] **Step 4: Add responsive styling matching the current category-based Settings surface and verify keyboard focus/ARIA live regions**
- [ ] **Step 5: Run focused tests and full suite, then manually inspect Electron at desktop and narrow window widths**
- [ ] **Step 6: Commit with `git commit -m "feat: add LaMa component controls to Settings"`**

### Task 8: Produce a reproducible CPU component archive

**Files:**
- Create: `scripts/build-lama-cpu.ps1`
- Create: `scripts/write-lama-manifest.js`
- Create: `sidecar/requirements-cpu.lock`
- Create: `component/lama/component.template.json`
- Create: `test/lama-component-build-contract.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `artifacts/components/lama-cpu-win-x64-v1.0.0.zip`, its SHA-256, and `artifacts/components/lama-components.json`.
- Release URL: `https://github.com/namememem02-ui/mirai-comic-translator/releases/download/components-v1.0.0/lama-cpu-win-x64-v1.0.0.zip`.

- [ ] **Step 1: Write failing build-contract tests for pinned versions, CPU-only torch index, included `big-lama.pt`, launch descriptor, forbidden virtual-environment metadata, manifest URL/hash/size, and ignored artifacts**
- [ ] **Step 2: Run the contract test and verify RED**
- [ ] **Step 3: Implement a PowerShell build that creates a clean Python 3.11 runtime, installs only locked CPU packages, copies sidecar files/model, removes caches/tests/metadata not needed at runtime, probes imports and model load, archives the directory, and invokes the manifest writer**
- [ ] **Step 4: Run `powershell -ExecutionPolicy Bypass -File scripts\build-lama-cpu.ps1`, verify archive checksum and extracted launch probe, and record final compressed/uncompressed sizes**
- [ ] **Step 5: Run all Node/Python tests**
- [ ] **Step 6: Commit scripts/locks/templates only with `git commit -m "build: add reproducible CPU LaMa component"`; do not commit artifacts**

### Task 9: Build the Windows NSIS installer

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `build/installer.nsh`
- Create: `test/windows-installer-contract.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `artifacts/installer/Mee-a-rai-ComicTranslator-Setup-0.1.0.exe`.
- Consumes: application source only; LaMa assets are explicitly excluded.

- [ ] **Step 1: Write a failing packaging contract test for app id, artifact name, x64 NSIS target, per-user install, shortcut/uninstall metadata, ASAR usage, required resources, and exclusions for `.venv`, `node_modules` source extras, projects, outputs, components, tests, docs, and artifacts**
- [ ] **Step 2: Run focused test and verify RED**
- [ ] **Step 3: Add pinned `electron-builder`, `build` configuration, `dist:win` script, and NSIS configuration without code-signing claims**
- [ ] **Step 4: Run `npm.cmd run dist:win`, install on the development machine, confirm launch with no system sidecar dependency, uninstall, and confirm user projects/components are preserved unless explicitly removed by the user**
- [ ] **Step 5: Run full tests and commit with `git commit -m "build: add Windows ComicTranslator installer"`**

### Task 10: Clean-machine release verification and publishing handoff

**Files:**
- Create: `docs/release/windows-clean-machine-checklist.md`
- Create: `docs/release/lama-component-publishing.md`
- Create: `test/release-artifact-contract.test.js`

**Interfaces:**
- Produces: reproducible release commands and evidence for the application installer, CPU component, and manifest.

- [ ] **Step 1: Write failing artifact tests that open the installer/component metadata and assert versions, hashes, forbidden content, and exact release filenames**
- [ ] **Step 2: Run focused tests and verify RED until artifacts exist**
- [ ] **Step 3: Document exact GitHub release tags `components-v1.0.0` and `v0.1.0`, asset names, upload order (component archive before manifest), rollback steps, and checksum verification**
- [ ] **Step 4: On a clean Windows x64 environment without Python, Screen Translator, CUDA, or developer tools: install, launch, download CPU, cancel/retry once, retouch one page, restart offline, repair, uninstall/reinstall, and verify translation remains usable throughout**
- [ ] **Step 5: Run `npm.cmd test`, Python tests, installer artifact tests, and component artifact tests; save command output with the release record**
- [ ] **Step 6: Commit with `git commit -m "docs: add Windows release verification workflow"`**

## Plan Self-Review

- Spec coverage: component security, machine detection, CPU/GPU selection, visible fallback, download lifecycle, sidecar integration, independent updates, installer, and clean-machine verification each map to a task.
- Placeholder scan: no unresolved placeholders or unspecified production behavior remains; the NVIDIA binary is intentionally gated by explicit certification while its contract and UI are implemented.
- Type consistency: backend values are `cpu|nvidia`; modes are `auto|cpu|nvidia`; fallback values are `automatic|ask|never`; public state flows manager -> IPC -> view without renderer-controlled paths or URLs.
