# Managed LaMa Sidecar Design

## Goal

ComicTranslator automatically starts and monitors the LaMa inpainting sidecar. When LaMa is unavailable, the application must preserve the original image instead of silently filling dialogue regions with blurred color blocks.

## Process Ownership

- On application startup, probe `127.0.0.1:5000/health`.
- If a healthy LaMa server already exists, use it and do not start another process.
- Otherwise locate an available Python executable and launch `sidecar/inpaint_server.py` as a hidden child process.
- Track whether ComicTranslator owns the child process.
- On application shutdown, terminate only the child process owned by ComicTranslator. Never terminate an independently started server.
- Prevent duplicate startup attempts while one attempt is in progress.

## Readiness

- Add `GET /health` to the sidecar.
- The endpoint reports `loading`, `ready`, or `error`; `ready` is returned only after `SimpleLama` has loaded successfully.
- Electron polls readiness with a bounded timeout and exposes the current state to the renderer.
- Renderer states are `starting`, `ready`, and `unavailable` with a concise explanation when unavailable.

## Safe Degradation

- If LaMa is not ready, do not run `drawSmoothErase` automatically.
- Thai preview and export remain available, but use the untouched source image as the background.
- Display a warning that original lettering has not been retouched.
- Manual paint and user-authored layers remain unchanged.
- Existing saved translations and project data are never modified by sidecar status.

## UI

- Add a compact retouch status indicator near the existing Gemini connection status.
- `starting`: neutral progress styling and “กำลังเปิด AI รีทัช”.
- `ready`: green styling and “AI รีทัชพร้อม”.
- `unavailable`: amber/red styling and “AI รีทัชไม่พร้อม”; clicking it shows the reason and retry action.
- Retrying re-runs the probe/start sequence without restarting Electron.

## Python Discovery

Use a deterministic ordered list:

1. Project-managed Python path saved in application configuration, when present.
2. Active virtual environment Python under the project, when present.
3. Windows `py` launcher.
4. `python` available on PATH.

Each candidate must pass a lightweight version probe before launch. Failure to locate Python produces an `unavailable` state rather than a silent image fallback.

## Testing

- Unit-test health-state normalization, process ownership, duplicate-start prevention, timeout, retry, and shutdown behavior with injected process/network adapters.
- Add renderer contract tests for the three status states and retry control.
- Add a regression test proving automatic smooth-fill fallback is not called when LaMa is unavailable.
- Run the complete Node test suite and validate Python syntax.
- Manually verify ready and unavailable states in the Electron window without exporting user files.

## Scope Exclusions

- Packaging Python and LaMa into the final installer.
- Changing OCR boxes or Tight Fit mask dimensions.
- Changing translation, glossary, watermark, review, ZIP naming, or export selection behavior.
