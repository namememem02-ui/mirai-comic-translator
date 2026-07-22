# Settings Help and Online Update Design

## Goal

Add a safe Gemini API-key setup guide and an online update checker to Settings.

## Design

The API-key section shows three Thai setup steps, links only to
`https://aistudio.google.com/apikey`, and reminds users that the key stays on
their device. The renderer cannot open arbitrary URLs; it asks the main process
to open one allowlisted URL in the system browser.

The update section shows the installed app version and a “ตรวจสอบอัปเดต”
button. A focused main-process module checks a configured HTTPS JSON manifest,
validates its shape, compares semantic versions, applies a timeout, and returns
safe structured states to the renderer. No package is downloaded or installed
in this increment. When no release URL has been configured, Settings says so
explicitly instead of reporting a false success.

## Update manifest

```json
{
  "version": "0.2.0",
  "releaseNotes": "รายละเอียดเวอร์ชัน",
  "downloadUrl": "https://updates.example.com/ComicTranslator-0.2.0.exe"
}
```

Only HTTPS manifest and download URLs are accepted. The application, Python
sidecar, and LaMa model remain separately versionable so a future installer
update does not need to replace the model for ordinary UI releases.

## Verification

- Unit tests cover version comparison, invalid manifests, timeout, and missing
  configuration.
- Contract tests cover the Settings controls, preload API, IPC handlers, safe
  external-link allowlist, and renderer states.
- The full `npm.cmd test` suite must pass.
