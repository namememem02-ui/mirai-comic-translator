# Copy Translation from Previous Page — Design

## Goal

Add a safe `คัดลอกจากหน้าก่อน` workflow that reuses translation work from the immediately preceding page without navigating away from the current page or silently overwriting it.

## User Interface

- Add one button to the Studio Toolbar. It is disabled on the first page and whenever no active page exists.
- Clicking it loads the saved translation JSON for `images[activeIndex - 1]` and opens a modal dialog.
- The dialog shows the source page name, source bubble count, current bubble count, selected mode, a short impact preview, and any unmatched count.
- The default mode is `text` and the user must confirm before any page data changes.
- If the previous page has no saved bubbles, the dialog explains this and disables confirmation.
- Closing or cancelling the dialog changes nothing.

## Copy Modes

### Text only (`text`)

Pair source and current bubbles by array order. Copy only `translated_text` into each paired current bubble. Preserve every other current-bubble field. Copy `min(sourceCount, currentCount)` pairs and report the unmatched source or current count in the preview.

### Text and typography (`text-style`)

Pair bubbles by array order. Copy `translated_text` plus these presentation fields when present: `font_size`, `font_family`, `text_align`, `text_color`, and `outline`. If a presentation field is absent on the source, remove it from the destination so that the source/default rendering behavior is reproduced. Preserve current `bubble_id`, `box_2d`, `original_text`, `hidden`, `manualAdd`, and `rotate`.

### Entire bubbles (`full-bubble`)

Append deep copies of all source bubbles to the current page. Preserve their content, typography, geometry, original text, visibility, rotation, and manual-add state, but replace every `bubble_id` with a new integer ID. IDs start after the highest finite numeric ID on the current page and remain unique. Existing current bubbles are not removed or modified.

## Data Flow and Safety

1. The renderer asks the existing `loadPageTranslation` IPC API for the previous page; no new filesystem IPC is needed.
2. A pure `copy-previous-page` module calculates the preview summary and resulting bubble array. Inputs are never mutated.
3. On confirmation, call the existing `pushUndoState()` exactly once, replace `activePageTranslation` with the calculated result, invalidate the current page's cleaned-background cache, save through the existing atomic page-save path, render the cards/overlays, and refresh Thai preview when active.
4. A failed load or save displays a Thai error and leaves the dialog available for retry. A save failure restores the pre-confirmation in-memory data and removes the newly pushed undo entry so UI and disk stay consistent.
5. Page changes invalidate/close an open copy dialog so a late result cannot write into a different page.

## Module Boundary

`src/copy-previous-page.js` exposes a small browser/CommonJS-compatible API:

- `buildCopyPreview({ source, current, mode })`
- `copyPreviousPage({ source, current, mode })`

The module owns matching, field selection, deep cloning, and ID allocation. DOM handling, IPC, Undo, saving, rendering, and stale-page guards remain in `src/index.js`.

## Testing

- Text-only copy changes only paired `translated_text` values.
- Unequal counts copy the available pairs and produce correct unmatched counts.
- Text-and-typography copies/removes the explicit presentation fields while preserving geometry and identity.
- Entire-bubble copy appends rather than replaces, deep-clones input, and allocates unique IDs even with missing or nonnumeric existing IDs.
- Empty source disables confirmation through the preview model.
- UI contract tests verify the toolbar button, modal controls, script load order, first-page disabled handling, confirmation path, and Undo/save integration.
- Run the complete Node test suite and a real Electron smoke test after implementation.

## Out of Scope

- Matching bubbles by OCR text, geometry, or AI similarity.
- Copying custom retouch masks, paint layers, watermarks, or cleaned-background cache.
- Copying from an arbitrary non-adjacent page.
- Remembering the last-selected mode across application restarts.
