# ComicTranslator Security and Data Compatibility Design

## Goal

Harden ComicTranslator's Electron and filesystem boundaries while preserving existing projects, Unicode names, backup compatibility, and optional Gemini API-key sharing with Mee-a-rai Screen Translator. Either application must remain fully usable when installed by itself.

## Scope

This phase covers Gemini credential storage, renderer secret isolation, filesystem path validation, secure local image loading, navigation restrictions, first-run credential entry, credential deletion, and compatibility tests. It does not move project/output directories, package either application, change Gemini models, redesign export, or install LaMa.

## Credential architecture

Both applications will contain their own copy of a small credential-store module with the same persisted schema. They share only the file at `%APPDATA%\mirai-screenmind\config.json`; neither executable imports code or resources from the other.

The schema preserves unrelated settings and replaces a plaintext `apiKey` with:

```json
{
  "apiKeyEncrypted": "base64-encoded-safeStorage-payload",
  "apiKeyFormatVersion": 1
}
```

Electron `safeStorage` encrypts and decrypts the value in each application's main process. The raw key never crosses into a renderer. Renderer configuration responses contain only `hasKey` and `apiKeyMasked`.

On first read, a valid legacy plaintext `apiKey` is encrypted and atomically migrated. The plaintext field is removed only after encryption and the atomic write succeed. If encryption is unavailable, the application keeps the legacy value readable for the current session and reports that secure persistence is unavailable; it does not destroy the existing key. If an encrypted value cannot be decrypted, the application reports a recoverable `needsKey` state and asks the user to enter the key again.

Each application remains standalone:

- A machine with only ComicTranslator uses its existing settings dialog to enter, replace, or delete the key.
- A machine with only Screen Translator uses its existing settings window and first-run opening behavior.
- When both are installed under the same Windows account, either can read the shared encrypted value.
- Moving the encrypted config to another machine or Windows account requires entering the key again.

## Renderer and window security

ComicTranslator enables `webSecurity`, keeps `contextIsolation: true` and `nodeIntegration: false`, denies unexpected window creation, and blocks navigation away from the packaged application document.

Local project assets are exposed through a privileged custom protocol implemented in the main process. A URL maps only to an allowlisted asset root and is decoded safely. Requests containing traversal, malformed encoding, NUL characters, or a resolved target outside the selected root are rejected.

## Filesystem validation

Path security uses containment, not an ASCII-only filename regex. Project, chapter, and page segments may contain Thai, Chinese, Japanese, spaces, and ordinary Unicode punctuation.

Validation rejects empty segments, `.` and `..`, embedded path separators, NUL characters, trailing Windows dots/spaces, and Windows reserved device names. Full paths selected through Electron dialogs are canonicalized with `path.resolve`; application-generated paths must remain under their configured root. Existing project names and backup format `mirai-comictranslator-backup` remain unchanged.

## UI behavior

ComicTranslator retains its current masked password input and save button, adds a delete-key action, and shows clear states: not configured, securely stored, migration failed, or re-entry required. Saving clears the input immediately and refreshes status from main-process metadata rather than constructing a masked key from renderer-held text.

Screen Translator retains its current settings window, test action, and automatic first-run opening. Saving and testing may accept a newly typed key through IPC, but configuration reads never return the stored raw key. Deleting the shared key from either application makes both applications report an unconfigured state.

Non-Gemini features remain available without a key.

## Error handling and data safety

All config mutations use atomic writes and preserve unrelated fields. Migration is idempotent. A failed migration never removes the plaintext source. A corrupted encrypted payload never crashes startup or leaks ciphertext/key material into logs. Filesystem rejections return user-safe errors without exposing unrestricted host paths.

## Testing

Tests use injected `safeStorage`, filesystem, and path dependencies so credential and containment behavior can run under Node without launching Electron.

Required automated coverage:

- New install with no key.
- Save, load metadata, replace, and delete an encrypted key.
- Plaintext-to-encrypted migration and preservation on migration failure.
- Decryption failure requiring re-entry.
- No raw key in renderer configuration responses.
- Shared schema compatibility between both applications.
- Unicode project/chapter/page names accepted.
- Traversal, separators, NUL, reserved names, and root escape rejected.
- Custom protocol accepts allowlisted images and rejects escaped paths.
- Window navigation and popup policies are registered.
- All existing ComicTranslator tests and relevant Screen Translator tests continue to pass.

Manual verification covers first run on a clean config, migration with an existing key, standalone use of each application, shared use when both are installed, Thai-named projects, image rendering with `webSecurity` enabled, key deletion, and recovery from an undecryptable copied config.

## Compatibility constraints

- Preserve ComicTranslator package name `comic-translator`.
- Preserve Screen Translator app ID `com.mirai.screenmind` and internal name `mirai-screenmind`.
- Preserve `mirai-comictranslator-backup` archives and existing project directories.
- Do not add offline fonts or unrelated UI redesign.
- Do not require Screen Translator for ComicTranslator to run, or vice versa.
