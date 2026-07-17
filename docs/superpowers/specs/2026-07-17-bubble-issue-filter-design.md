# Bubble Issue Filter Design

## Goal

Let users isolate and navigate problematic translation bubbles on the active page without changing saved translation data or export behavior.

## Approved Interaction

- A segmented filter bar appears above the existing bubble list.
- Exactly one filter is active at a time: `ทั้งหมด`, `ล้น`, `ใกล้ล้น`, `ยังไม่แปล`, or `ซ่อน`.
- Each filter displays its current count for the active page.
- The selected filter combines with the existing text search. A card must satisfy both conditions to remain visible.
- Previous and next buttons cycle through the currently visible results and focus the matching textarea and overlay rectangle.
- When there are no matching results, the list shows a clear empty-state message without modifying bubble data.
- Changing pages preserves the selected issue filter. Existing page-change behavior continues to clear the text search.

## Classification Rules

- `ทั้งหมด`: every bubble on the active page.
- `ล้น`: visible bubbles whose transient live-overflow status is `overflow`.
- `ใกล้ล้น`: visible bubbles whose transient live-overflow status is `near`.
- `ยังไม่แปล`: non-hidden bubbles whose `translated_text` is empty after trimming.
- `ซ่อน`: bubbles whose `hidden` flag is true. Hidden bubbles are not also classified as overflow or untranslated.

Counts are based only on issue classification, not the current search query. This keeps the numbers stable while searching. The visible-result counter and navigation buttons reflect the intersection of the selected filter and search query.

## State and Data Flow

The renderer owns one transient `activeBubbleIssueFilter` string, defaulting to `all`. No filter state is written to project JSON.

One pure helper module classifies bubbles and returns counts. The renderer supplies the live-overflow map to this helper, applies the selected filter plus search query to card visibility, updates the segmented counts, and builds the ordered visible-result list for navigation.

Recalculation runs after:

- initial page rendering and page changes;
- translated-text input;
- font size or font family changes;
- box drag or resize;
- hide, delete, Undo, Redo, copy-from-previous, and inline-edit confirmation;
- search input or filter selection.

Existing render paths already cover several lifecycle actions; targeted live updates must refresh only filter state and card visibility without saving data again.

## UI Behavior

- Filter buttons expose `aria-pressed` and a stable `data-filter` value.
- Issue colors reuse existing semantics: red for overflow, amber for near, neutral for untranslated, and muted red for hidden.
- Previous/next buttons are disabled when no result exists.
- Navigation wraps from last to first and first to last.
- The active result scrolls into view, focuses its textarea, and highlights its SVG rectangle.
- The empty state is separate from the no-bubbles placeholder and disappears as soon as a result matches.

## Error and Edge Handling

- Invalid boxes cannot be overflow or near because live measurement has no valid result.
- Empty pages show zero counts and disabled navigation.
- Deleted bubble IDs are removed naturally when counts and visible results are rebuilt from `activePageTranslation`.
- Search uses the existing case-insensitive matching behavior for original and translated text.

## Testing

- Unit-test classification precedence and counts for overflow, near, untranslated, hidden, and ordinary bubbles.
- Contract-test one filter bar, stable filter values, combined search/filter application, count refresh hooks, empty state, and wrapping navigation.
- Verify no filter fields are persisted on bubbles.
- Run renderer syntax checks and the complete Node test suite.
