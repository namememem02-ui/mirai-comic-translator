# Managed LaMa Component Design

## Goal

Ship a small ComicTranslator installer and let the application install, verify, update, repair, and remove the LaMa retouch runtime as a separately downloaded component. The application detects the machine, recommends CPU or NVIDIA GPU execution, exposes the active backend at all times, and falls back from GPU to CPU without silently changing behavior.

## Product Decisions

- The main Windows installer does not embed Python, PyTorch, or `big-lama.pt`.
- ComicTranslator remains usable for translation and editing before the retouch component is installed.
- CPU and NVIDIA GPU are separate component packages. They must never share one Python environment.
- The default execution setting is `auto`; users may explicitly choose `cpu` or `nvidia`.
- The first production component is CPU. NVIDIA uses the same component contract and UI, then becomes downloadable after its package passes compatibility testing.
- Offline fonts and unrelated export, translation, backup, or project-format changes are out of scope.

## Architecture

### Main-process component manager

Create a main-process-only manager responsible for machine detection, manifest retrieval, downloads, checksums, extraction, activation, repair, removal, backend selection, and fallback. The renderer receives structured status objects through narrow preload APIs and never receives unrestricted filesystem or process access.

Components live below Electron's per-user `userData` directory:

```text
components/lama/
  active.json
  downloads/
  cpu/<component-version>/
  nvidia/<component-version>/
```

Installation uses a sibling staging directory. A package becomes active only after its SHA-256 checksum, archive layout, executable probe, model presence, and `/health` startup probe pass. Failed staging directories are removed without replacing a working component.

### Component packages

Each archive is self-contained and includes:

- a private Windows Python runtime;
- pinned Python dependencies;
- exactly one PyTorch compute build;
- the LaMa server;
- `big-lama.pt`;
- `component.json` describing backend, component version, application compatibility, files, and launch command.

The CPU archive contains CPU-only PyTorch. The NVIDIA archive contains one selected CUDA runtime family and declares its minimum NVIDIA driver version. ComicTranslator never installs or updates a display driver.

### Online manifest

An HTTPS manifest describes currently supported CPU and NVIDIA packages. Each entry includes version, URL, byte size, SHA-256, minimum application version, archive format, backend, and minimum driver when applicable. The manifest URL is application configuration owned by the main process. Unknown fields are ignored; missing or unsafe required values reject the manifest.

## Machine Detection and Selection

Detection reports Windows architecture, available memory and disk space, NVIDIA GPU presence, driver version when available, and whether each installed package passes its local integrity probe.

Backend modes behave as follows:

- `auto`: recommend and start NVIDIA only when a compatible installed NVIDIA component and supported driver are confirmed; otherwise use CPU.
- `cpu`: start only the CPU component.
- `nvidia`: start NVIDIA when compatible; if it cannot start, follow the configured fallback policy.

The fallback policy is one of:

- `automatic` (default): visibly announce GPU failure, then switch to an installed healthy CPU component.
- `ask`: report the failure and present a CPU switch action.
- `never`: keep retouch unavailable until the user changes the backend or repairs NVIDIA.

If CPU is required but not installed, the UI presents `Download CPU and continue`; it never starts an unverified system Python as a substitute for a managed component.

## State Model and UI

Settings > Retouch contains a component card with backend selector, detected-hardware summary, package size, version, disk location summary, progress, and actions. Supported states are:

- `not-installed`
- `detecting`
- `checking-update`
- `downloading` with received bytes, total bytes, percentage, and cancel
- `installing`
- `ready-cpu`
- `ready-nvidia`
- `gpu-fallback` with the reason and `GPU -> CPU` transition
- `cpu-download-required`
- `update-available`
- `repair-required`
- `error` with a safe Thai explanation and retry/repair action

The application header always exposes a compact state:

- green `AI retouch · CPU`;
- green `AI retouch · GPU`;
- amber `Switching GPU -> CPU`;
- red `AI retouch unavailable`.

A backend change is never silent. After an automatic fallback, the UI retains a notice stating that the current session uses CPU and why GPU failed. Technical details are available through a bounded diagnostic view that excludes user paths, API keys, and project contents.

## Download and Recovery

- Check available disk space before downloading and before extraction.
- Stream downloads to a `.partial` file and expose byte progress.
- Cancellation leaves no active partial installation.
- Retry may resume only when the server and package metadata prove the partial file belongs to the same immutable artifact; otherwise restart safely.
- Verify SHA-256 before extraction.
- Reject absolute paths, traversal, symlinks, duplicate paths, excessive file counts, and extracted sizes above manifest limits.
- Activate with an atomic metadata replacement after the package health probe succeeds.
- Repair re-downloads or re-extracts the selected package without deleting a different healthy backend.
- Removal stops only a process owned by ComicTranslator and removes only the selected managed component directory.

## Sidecar Integration

The existing sidecar manager gains a managed-runtime candidate ahead of development candidates. Packaged applications use only the managed component. Development mode may retain project `.venv`, user `ct_venv`, `py`, and `python` candidates for contributor convenience.

The sidecar receives an explicit `LAMA_MODEL` path from the component package and an explicit backend. Health responses include state, backend, component version, and a safe error code. GPU initialization or inference failures are categorized so the main process can apply the configured fallback policy. Existing behavior that preserves the original image when retouch is unavailable remains unchanged.

## Updates

ComicTranslator application updates and LaMa component updates are independent. A normal application update does not re-download LaMa when the installed component remains compatible. Component activation metadata records schema, backend, version, checksum, and installation timestamp. Incompatible components remain on disk but are not launched until repaired or updated.

## Security and Privacy

- Only HTTPS package URLs are accepted.
- Download and extraction run in the main process with strict size and path limits.
- All archives require a pinned SHA-256 from a validated manifest.
- The renderer cannot choose arbitrary URLs, paths, executables, or command-line arguments.
- Diagnostics must not expose API keys, full user paths, source images, translations, or project data.
- Component packages and generated installers stay out of Git history and are published as release assets.

## Verification

- Unit tests cover manifest validation, detection normalization, selection, fallback policies, progress, cancellation, checksum failure, archive rejection, atomic activation, repair, removal, and safe diagnostics.
- Contract tests prove renderer APIs cannot pass arbitrary paths or URLs.
- Sidecar tests cover explicit CPU/GPU selection and safe health/error codes.
- Build tests assert installers exclude development environments and include only application resources.
- A CPU package is tested on a clean supported Windows machine without Python, Screen Translator, CUDA, or developer tools.
- NVIDIA release testing includes no NVIDIA hardware, unsupported driver, supported driver, initialization failure, inference out-of-memory, and successful GPU retouch.
- Full `npm.cmd test`, Python tests, packaged-app launch, installation, uninstall, and reinstall must pass before release.

## Delivery Phases

1. Component contract, secure manager, Settings state UI, and CPU package.
2. Windows installer using the managed CPU download flow.
3. NVIDIA detection, package, compatibility checks, and visible fallback.
4. Release manifests and independent component/application update publishing.

Each phase must leave translation/editing usable and must not require Screen Translator or a system Python installation.
