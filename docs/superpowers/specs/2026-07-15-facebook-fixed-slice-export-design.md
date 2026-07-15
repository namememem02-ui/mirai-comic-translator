# Facebook Fixed-Slice Export Design

## Goal

Add a Facebook export option that converts the current chapter's translated long-form comic pages into ordered, high-quality portrait images. This avoids uploading extremely tall source images that become difficult to inspect clearly in Facebook's multi-photo post layout.

## Entry and selection

- Add a `ส่งออก Facebook` action to the existing chapter export dialog.
- Reuse the dialog's current mode: all pages or selected pages.
- Process pages in the same natural filename order used by the editor and normal chapter export.
- Show the selected source-page count and the estimated output-slice count before starting.
- Display a warning that fixed slicing can cross dialogue or artwork.

## Image composition

- Compose each selected source page with the existing export pipeline: inpainting, custom paint, Thai typesetting, and the current chapter watermark.
- Use the original source width and resolution. Do not upscale a narrow source image.
- Split each composed page vertically into fixed `4:5` portrait slices. Slice height is `source width × 1.25`, rounded to a whole pixel.
- Use the remaining source height for the last slice; do not stretch it or add padding.
- A source page at or below one target slice height produces one output image.
- Never crop horizontally.

## Encoding and filenames

- Encode output as JPEG at high quality (`0.95`).
- Use one continuous sequence across all selected source pages: `001.jpg`, `002.jpg`, and so on.
- Ask the user for the ZIP filename before saving, following the program-wide download naming behavior.
- Store only the automatically named JPEG files inside the ZIP; do not ask for individual image names.
- Sanitize the ZIP name using the application's existing filename rules and append `.zip` when omitted.

## Progress and failures

- Render and encode one source page at a time to limit peak memory usage on tall manhwa images.
- Update progress with the current source page and number of slices produced.
- If composition or encoding fails, stop the export, show the failing source filename, and do not report success.
- Cancelling the save dialog creates no ZIP file.
- Original images, translation JSON, normal exports, and watermark settings remain unchanged.

## Component boundaries

- Add a small pure slicing module responsible for target-height calculation, slice rectangles, and sequential filenames.
- Keep Canvas composition in the renderer and reuse the existing translated-page composition behavior.
- Keep ZIP creation and save-dialog filesystem work behind the Electron preload/main-process API.
- Pass encoded image data and the requested archive name through the existing secure IPC pattern; do not expose direct filesystem access to the renderer.

## Testing

- Unit-test target height and slice rectangles for exact multiples, remainders, short pages, and rounding.
- Unit-test continuous three-digit filenames across multiple source pages.
- Test ZIP-name sanitization and automatic `.zip` extension in the main-process helper.
- Verify JPEG order and ZIP contents with a multi-page fixture.
- Run the full Node test suite and JavaScript syntax checks.
- Manually export at least one tall manhwa page, inspect the first, middle, and final slices at 100% zoom, and confirm Thai text and watermark composition match normal export.

## Non-goals

- No automatic whitespace, scene, speech-bubble, or OCR-aware cut detection in this phase.
- No draggable cut-line editor or per-slice manual adjustment.
- No Facebook upload or account integration.
- No changes to the existing normal chapter export format.
