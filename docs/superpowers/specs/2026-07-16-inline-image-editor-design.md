# Inline Image Editor — Design

## Goal

Let users edit a bubble's Thai translation directly over the rendered image while `ดูหน้าแปลไทย` is active, without changing the existing inspector textarea workflow.

## Entry and Selection

- Inline editing is available only when Thai preview mode is active.
- Double-clicking inside a visible bubble's `box_2d` opens the editor for that bubble.
- Hidden bubbles and bubbles without a valid four-number `box_2d` are ignored.
- Pointer coordinates are converted from the viewport's current screen rectangle to the normalized 0–1000 bubble coordinate system, so hit-testing remains correct at every zoom level.
- If boxes overlap, select the smallest-area matching box because it is the most specific target.
- Opening a different bubble cancels the current unconfirmed session before opening the new one.

## Editor UI

- Add one absolutely positioned `<textarea>` inside `viewportContainer`, above the typeset canvas and below interaction handles only when editing.
- Position and size use percentages derived from `box_2d`, so the editor follows zoom and fit-width/fit-page changes without separate pixel-position bookkeeping.
- Match the bubble's font family, text alignment, text color, and approximate scaled font size. Use a high-contrast translucent background and focus border so the editing state is unambiguous.
- Focus the textarea and select its content when opened.
- The inspector card for the same bubble is highlighted and scrolled into view.

## Keyboard and IME Behavior

- `Enter` inserts a newline.
- `Ctrl+Enter` or `Cmd+Enter` confirms.
- `Escape` cancels and restores the pre-session value.
- Track `compositionstart` and `compositionend`. Confirmation and cancellation shortcuts do nothing while an IME composition is active, preventing Thai text selection/composition from being interrupted.
- Clicking outside the textarea does not silently save; it cancels the session.

## Preview, Confirm, and Cancel

- Keep a session object containing page identity, bubble ID, original text, draft text, and composition state.
- During `input`, update only the session draft and a temporary render override, then redraw Thai preview. Do not mutate `activePageTranslation` or write JSON.
- Confirm checks that the same page and bubble still exist. It pushes one Undo snapshot, writes `translated_text`, clears the temporary override, saves through the existing atomic page-save path, redraws the inspector and preview, then closes the editor.
- If saving fails, restore the original text and Undo-stack length, redraw, and keep the editor open with a Thai error message for retry.
- Cancel clears the temporary override, redraws the original text, and closes without Undo or disk writes.

## Automatic Cancellation

Cancel the editor before:

- selecting another page;
- turning Thai preview off;
- deleting the edited bubble;
- resetting/retranslating the page;
- starting drag/resize or another canvas tool;
- opening the previous-page copy workflow.

Zooming, scrolling, and fit-mode changes do not cancel because percentage positioning follows the bubble.

## Module Boundary

Create `src/inline-editor.js` as a browser/CommonJS-compatible pure helper with:

- `findBubbleAtPoint(bubbles, x, y)` for valid, visible, smallest-area hit-testing;
- `normalizeInlineShortcut(event, composing)` returning `confirm`, `cancel`, or `none`;
- `buildEditorStyle(bubble)` returning safe font/alignment/color values and normalized percentage geometry.

`src/index.js` owns DOM events, session state, temporary draft rendering, Undo, saving, rollback, and lifecycle cancellation.

## Rendering Integration

- `refreshTypesetView()` reads the active session's draft for only the matching bubble; every other bubble uses stored `translated_text`.
- Export, chapter review, quality checks, and saved JSON always use stored translations, never the draft override.
- The existing inspector textarea remains the source of truth outside an inline session and is rerendered after confirmation.

## Testing

- Hit-testing handles normal, invalid, hidden, edge, and overlapping boxes.
- Shortcut handling covers Enter, Ctrl/Cmd+Enter, Escape, unrelated keys, and active IME composition.
- Editor styles clamp invalid geometry and preserve font/alignment/color choices safely.
- UI contract tests verify the textarea, status element, CSS stacking, helper script order, and preview-only entry event.
- Renderer contract tests verify draft-only preview, one Undo per confirmation, atomic-save rollback, and every automatic-cancel path.
- Real Electron smoke testing verifies double-click, multiline Thai input, cancel, confirm, zoom tracking, and page-change cancellation.

## Out of Scope

- Editing original OCR text directly on the image.
- Rich-text spans or per-word formatting.
- Moving/resizing a bubble while its inline editor remains open.
- Inline editing in chapter-review or export-preview surfaces.
