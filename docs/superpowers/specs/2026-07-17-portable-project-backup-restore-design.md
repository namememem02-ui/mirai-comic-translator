# Portable Project Backup and Restore Design

**Date:** 2026-07-17  
**Status:** Approved design, pending implementation plan

## Goal

Allow a ComicTranslator project to be backed up into one portable ZIP and restored on another machine without depending on the original source-image folders. A backup contains every registered chapter in the selected project, all original images, and all editable ComicTranslator data.

## User Experience

The project information area gains two commands:

- **Back up project** backs up the currently open project. A native Save dialog asks for the ZIP filename and destination before work begins.
- **Restore project** opens a native file picker for a `.zip`, validates it, then shows a confirmation summary containing the source project name, backup version, chapter count, image count, and uncompressed byte count.

Restore never overwrites an existing project. It chooses a new safe name automatically: `<original>_สำเนา`, then `<original>_สำเนา_2`, and so on. After a successful restore, the saved-project list refreshes and the restored project is available normally. The current editor is not switched automatically, preventing unsaved visual context from changing unexpectedly.

Both operations show progress and a final success or actionable error message. Canceling a native dialog makes no changes.

## Archive Format

The ZIP root contains:

```text
manifest.json
source/<chapter-id>/<original image files>
data/glossary.json
data/<chapter-id>/<managed ComicTranslator files>
```

`manifest.json` contains:

- format identifier `mirai-comictranslator-backup`
- schema version `1`
- application version
- original project name
- creation timestamp
- chapters in stable display order
- for each chapter: its logical name, source directory ID, source image names, and managed data file names
- total image count and uncompressed byte count

Chapter directory IDs are archive-internal safe identifiers and do not reuse unchecked user strings as paths. Original filenames are retained only after validation.

## Included and Excluded Data

Each registered chapter includes all supported source images from its mapped source folder (`jpg`, `jpeg`, `png`, `webp`, and `jfif`). The managed project directory contributes page translations, custom masks, custom paint layers, chapter watermark asset/settings, and quality state. The project glossary is included once.

The archive excludes generated exports, temporary files, `.bak`/`.tmp` recovery artifacts, API keys, application settings, logs, caches, and unrelated files. Missing optional managed files do not block backup. A missing registered source directory or a source image that cannot be read does block backup, because the resulting archive would not be portable.

## Architecture

### `lib/project-backup.js`

A Node-only module owns archive rules and remains independent of Electron UI:

- validates project, chapter, and filenames
- builds a deterministic backup inventory from the project map and filesystem
- creates `manifest.json` and the ZIP buffer with JSZip
- parses and validates a selected ZIP before extraction
- rejects unsafe paths, unsupported schema versions, duplicate logical paths, unexpected entry types, and excessive archive limits
- chooses a collision-free restored project name
- stages restored files and commits them only after full validation

### Electron main process

Two IPC handlers coordinate native dialogs and filesystem access:

- `backup-project({ project })`
- `restore-project()`

The handlers use the shared projects root and `projects_map.json`. They return structured results rather than throwing raw filesystem errors into the renderer.

### Preload and renderer

Preload exposes only the two narrow operations. The renderer owns command state, progress/status text, restore confirmation, and refreshing the saved-project list. It does not receive arbitrary filesystem access.

## Restore Storage and Registration

Restored source images are stored under a managed root inside the current application workspace:

```text
projects/<restored-project>/_source/<chapter-id>/
```

Editable managed data is stored in the existing layout:

```text
projects/<restored-project>/<chapter-name>/
```

After all files are staged and validated, restore atomically updates `projects_map.json` so every restored chapter maps to its managed source directory. Existing projects and mappings are never modified.

## Transaction and Failure Handling

Backup builds the complete inventory before showing the Save result. It writes the ZIP to a temporary sibling file, verifies that the buffer was written, then renames it to the chosen destination. A failed write removes only its temporary file.

Restore reads and validates the entire manifest before writing. It enforces configurable defensive limits for entry count, per-file uncompressed size, total uncompressed size, and compression ratio. Extraction occurs in a unique staging directory beneath `projects/`. The final project directory is renamed into place only after every declared file is present and valid. The project map is then updated with the existing atomic JSON writer. Any pre-commit failure removes the staging directory. If map registration fails after the rename, the newly restored project directory is removed and the previous map remains valid.

Symlinks and absolute or traversal paths are rejected. Archive entries not declared by the manifest are rejected instead of silently extracted.

## Validation Rules

- The manifest format and schema version must match supported values.
- Project and chapter display names must be non-empty and bounded in length.
- Chapter names must be unique within the archive.
- Every declared image and data file must exist exactly once.
- Image extensions must be supported; managed data extensions must match the allowlist.
- ZIP entry paths must be normalized relative paths and remain under their declared chapter directory.
- Restored filenames cannot be Windows reserved names and cannot contain control characters or path separators.
- The archive cannot contain API keys or application configuration paths.

## Testing

Unit tests cover deterministic inventory generation, inclusion/exclusion rules, manifest creation, multiple chapters, missing source directories, safe filename handling, duplicate entries, unsupported versions, traversal and absolute paths, archive limits, collision-free copy naming, staging cleanup, and atomic map registration behavior.

Integration/contract tests verify the IPC and preload surface, native Save/Open dialogs, renderer commands and status, confirmation summary, cancellation, saved-project refresh, and that backup/restore never touches exports, API configuration, or existing project directories.

The full existing test suite must remain green.

## Non-goals

- Incremental or cloud backups
- Password-protected archives
- Restoring over an existing project
- Including generated export images
- Migrating application-wide settings or API credentials
- Automatically opening the restored project

