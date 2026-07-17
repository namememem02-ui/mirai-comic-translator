# Live Text Overflow Warning Design

## Goal

Warn while editing when translated Thai text is close to filling or actually exceeds its bubble box. Warnings are advisory only: saving, page navigation, and export remain available.

## Selected Interaction

- Scan every visible bubble once when a translated page is rendered.
- After that initial scan, recalculate only the bubble whose text, font size, font family, or geometry changes.
- Use three states:
  - `safe`: vertical text usage is below 85% and no unbreakable token exceeds the available width.
  - `near`: vertical text usage is at least 85% but does not overflow.
  - `overflow`: required height exceeds the box or an unbreakable token exceeds the available width.
- A `near` SVG box uses amber styling. An `overflow` SVG box uses red styling. The selected/hover outline remains visible without hiding the warning state.
- The editor card shows a compact clickable badge: `ใกล้ล้น` or `ข้อความล้นกรอบ`. Clicking it scrolls to and selects that bubble.
- Hidden bubbles do not show a text warning because hidden text is not exported. Invalid boxes retain the existing export-quality invalid-box warning behavior and are not classified as text overflow here.

## Shared Measurement

Extend `src/text-overflow.js` with a measurement function that returns:

```js
{
  status: 'safe' | 'near' | 'overflow',
  lineCount: number,
  requiredHeight: number,
  availableHeight: number,
  usage: number,
  hasWideToken: boolean
}
```

Both live warnings and Export Quality use this same result. The existing `isTextOverflowing` API remains as a compatibility wrapper that returns `status === 'overflow'`.

Measurement must use the same effective layout values as typesetting:

- box width and height use 85% of the detected box dimensions;
- selected font size and family are applied to the canvas context;
- line height is `fontSize × 1.25`;
- explicit line breaks are retained;
- Thai wrapping uses the existing text-measure adapter contract.

When automatic font size is enabled, live inspection uses the same fit-down behavior as preview: start from the automatic size and reduce to the minimum supported size. A box is not marked overflow merely because a larger initial automatic size would overflow after the preview has already reduced it.

## Renderer State

Keep warning results in an in-memory map keyed by `bubble_id`. Do not add warning fields to translation JSON.

- Clear the map when selecting another page or replacing/resetting page translation.
- Rebuild all warnings after the image dimensions and translation are available.
- Recalculate one entry after text input, font-size changes, font-family changes, dragging, resizing, Undo/Redo, copy-previous-page, and inline-edit confirmation.
- Remove an entry when its bubble is hidden or deleted.

The first full-page scan uses one offscreen canvas and runs synchronously because it only performs text measurement. Subsequent edits update one bubble and its SVG/card classes without rebuilding the whole page.

## Data Safety and Failure Handling

- Warning calculation never writes JSON and never calls Gemini, inpainting, or export generation.
- A missing image size or canvas context leaves the bubble unclassified instead of blocking editing.
- Measurement errors clear the live warning for that bubble and log a development warning; they do not show a modal.
- Export continues to allow `ส่งออกต่อแม้มีคำเตือน` exactly as before.

## Testing

Automated tests cover:

- `safe`, `near`, vertical overflow, and wide-token overflow classification;
- empty text and invalid geometry;
- compatibility of `isTextOverflowing`;
- renderer contracts for initial full scan and targeted recalculation;
- text, font, geometry, Undo/Redo, copy, inline-edit, hide, delete, and page-change lifecycle hooks;
- amber/red SVG and editor-card badge styling;
- Export Quality consuming the shared overflow result without changing its existing issue code.

Manual verification uses a copied translated page: type progressively longer Thai text, resize the box through safe/near/overflow states, confirm the badge jumps to the bubble, and verify export can still continue.

## Out of Scope

- Automatically resizing boxes or changing font size.
- Blocking save or export.
- Persisting warning status to disk.
- Scanning every bubble on every keystroke.
