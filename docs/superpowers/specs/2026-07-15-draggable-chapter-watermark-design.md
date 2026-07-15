# Draggable Chapter Watermark Design

## Goal

Allow the user to select an image watermark, drag it to a custom position, adjust its size and opacity, reuse the same placement across every page in a chapter, preview it in Thai preview mode, and embed it in exported images.

## User interface

- Add a `ลายน้ำ` control to the studio toolbar.
- Opening it shows:
  - image selection for PNG, JPG/JPEG, or WebP;
  - an enable/disable checkbox;
  - an opacity slider from 0% to 100%, default 35%;
  - a size slider from 5% to 50% of page width, default 15%;
  - a remove-watermark action.
- When a watermark is enabled and Thai preview mode is active, it appears over the current page.
- The user drags the watermark directly on the page to choose its position.
- Dragging is clamped so the complete watermark remains inside the page.
- Position, size, opacity, and enabled state update the preview immediately.

## Coordinate model

- Store watermark position as normalized top-left coordinates `x` and `y` from 0 to 1.
- Store size as `widthRatio`, the watermark width divided by page width.
- Preserve the watermark image's natural aspect ratio.
- Convert normalized settings to the current image or export Canvas dimensions when rendering.
- One normalized setting is shared by all pages in the current project and chapter, including pages with different pixel dimensions.

## Rendering architecture

- Add a dedicated transparent `watermarkCanvas` inside `viewportContainer`, above the typeset text Canvas and below editing SVG handles.
- Preview rendering clears and redraws only this Canvas when watermark settings change; it does not regenerate AI inpainting or modify `activeImage`.
- Pointer dragging uses the displayed watermark Canvas coordinates, converts the new position to normalized values, and saves after drag completion.
- Page switching redraws the watermark only for the current page render token, following the existing preview-isolation guard.
- Original-image mode hides or clears the watermark; Thai preview mode shows it.

## Export integration

- The existing export pipeline draws the watermark as the final layer after the translated image and Thai text.
- Both export-all and export-selected use the same chapter watermark settings.
- Untranslated pages also receive the watermark when watermarking is enabled, because the setting applies to the exported chapter rather than only translated content.
- Export output dimensions determine the final watermark dimensions, so the result is not reduced to Preview resolution.

## Persistence and file ownership

- Add an Electron file picker restricted to PNG, JPG/JPEG, and WebP.
- Copy the selected image into `projects/<project>/<chapter>/_watermark.<ext>` so moving or deleting the original file does not break the project.
- Save settings atomically in `projects/<project>/<chapter>/_watermark.json`:

```json
{
  "enabled": true,
  "imageFile": "_watermark.png",
  "x": 0.8,
  "y": 0.9,
  "widthRatio": 0.15,
  "opacity": 0.35
}
```

- Selecting a replacement removes only the previous managed `_watermark` asset for this chapter.
- Removing a watermark deletes the managed asset and settings file but never deletes the user's original selected image.

## Validation and error handling

- Clamp `x`, `y`, `widthRatio`, and `opacity` to valid ranges on load and save.
- Validate the selected extension and confirm the copied asset exists before enabling.
- If the managed asset is missing or cannot load, disable preview/export watermark drawing and show a concise error in the watermark panel.
- Export continues without a watermark if loading fails; translated images are still exported.
- Settings for other chapters and projects are untouched.

## Testing

- Unit-test settings normalization and coordinate clamping.
- Unit-test drawing geometry for pages of different dimensions while preserving aspect ratio.
- Unit-test drag conversion from display pixels to normalized coordinates.
- Unit-test atomic settings persistence and managed-asset replacement boundaries.
- Run the full Node test suite and JavaScript syntax checks.
- Manually verify selecting a watermark, dragging it, adjusting opacity/size, switching pages, toggling original/Thai preview, and exporting selected and all pages.

## Expected result

- The same watermark placement appears consistently across every page in a chapter.
- Preview adjustments are immediate and do not rerun inpainting.
- Exported images contain the watermark at full output resolution with the chosen opacity.
- Saved translations and original comic images remain unchanged.
