# Chapter Find and Replace Design

## Goal

Provide a safe, reviewable way to replace translated text across an entire chapter without modifying OCR source text, glossary data, images, or unrelated bubble fields.

## Approved Interaction

- A `ค้นหาและแทนที่ทั้งตอน` command opens a full-workspace dialog.
- Search reads only each bubble's `translated_text`.
- Matching is case-insensitive.
- `ตรงทั้งคำ` is enabled by default and can be disabled for substring matching.
- Results are grouped by page and identify the bubble ID.
- Every result shows before and after text.
- Results can be selected or skipped per bubble, with `เลือกทั้งหมด` and `ไม่เลือก` actions.
- Selecting a result can close the dialog and open that page and bubble in the editor.
- Confirmation summarizes the number of affected pages and bubbles before writing.
- The most recent successful batch can be undone while the application remains open.

## Matching Rules

Search and replacement operate on Unicode strings. Case-insensitive matching uses locale-independent Unicode lowercasing for stable behavior across English names and Thai text.

Whole-word matching treats Unicode letters, numbers, and combining marks as word characters. A candidate matches only when the character before and after it is absent or is not a word character. This prevents a search such as `Lin` from replacing the same letters inside a longer Latin name. Thai names attached directly to other Thai characters may require disabling `ตรงทั้งคำ` because Thai does not consistently use spaces between words.

Empty search text is invalid. Replacement text may be empty, allowing intentional removal after preview and confirmation. Zero-length regular-expression behavior is not exposed because the feature uses escaped literal text only.

## Result Model

The pure search engine returns immutable result objects:

```js
{
  pageIndex,
  pageName,
  bubbleId,
  before,
  after,
  occurrenceCount
}
```

One result represents one bubble even if the search text occurs multiple times inside it. `occurrenceCount` reports how many replacements that bubble will receive.
UI selection is stored separately as a transient set of stable `pageIndex:bubbleId` result keys, keeping search results immutable.

## Data Loading and Preview

Opening the dialog does not load all page JSON immediately. Search execution loads translations for every chapter page using the existing page-translation API, tolerating a missing translation as an empty array. A page load failure is displayed as a page-level warning and does not hide results from other pages.

Changing search text, replacement text, or whole-word mode invalidates the previous preview. The user must run search again before confirmation. Selection state belongs only to the current preview.

## Save Transaction and Rollback

The renderer builds updated copies for selected results and never mutates the loaded originals before saves succeed.

Pages are saved sequentially through the existing atomic `savePageTranslation` API. Before each write, the original page data remains in memory. If any save fails:

1. stop writing new pages;
2. save the original data back to every page already changed in this batch, in reverse order;
3. report the failed page and whether rollback completed;
4. keep the dialog open with the preview and selections intact.

A successful batch stores one in-memory undo record containing the original and updated data for every changed page. Only the latest successful batch is retained. Undo writes the original page data back sequentially and retains the undo record if restoration fails.

## Editor and Cache Synchronization

After a successful replace or undo:

- if the active page changed, reload its translation data and rerender cards, overflow warnings, filters, and Thai preview;
- invalidate cleaned-background and review preview caches for changed page names;
- refresh page translated-status indicators;
- keep source text, glossary, geometry, style, hidden state, and watermark settings unchanged.

The Chapter Review dialog has a session-only cache. If it is not open during replacement, the next opening naturally creates a new cache. If future UI permits both dialogs simultaneously, replacement must close Chapter Review before applying changes.

## UI States

- Idle: search and replacement inputs with whole-word enabled.
- Searching: inputs and confirmation disabled; progress reports pages scanned.
- Results: grouped selectable rows, match totals, page warnings, and navigation links.
- Empty: explicit `ไม่พบข้อความที่ค้นหา` message.
- Confirming: selected page and bubble totals shown.
- Saving or undoing: controls disabled with page-level progress.
- Success or failure: persistent status message; successful save enables `ย้อนกลับการแทนที่ล่าสุด`.

## Testing

- Unit-test literal escaping, case-insensitive matching, whole-word boundaries, Thai combining marks, substring mode, repeated occurrences, empty search, and empty replacement.
- Unit-test applying only selected bubble results without mutating originals.
- Test sequential save orchestration, reverse rollback on failure, and latest-batch undo retention.
- Contract-test one dialog, inputs, whole-word default, selection controls, grouped preview, confirmation totals, navigation, and undo button.
- Verify no original-text or glossary write occurs.
- Run renderer syntax checks and the complete Node test suite.
