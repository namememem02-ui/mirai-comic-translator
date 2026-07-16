# Tight Fit Inpainting Mask Design

## Goal

Make Tight Fit reliably cover all detected lettering without erasing excessive balloon or artwork background.

## Approved Geometry

- Treat the OCR `box_2d` as the detected lettering boundary.
- Do not shrink that box again.
- Expand each side by 3% of the detected box width or height.
- Use a minimum expansion of 2 image pixels per side.
- Clamp the final rectangle to the image bounds.
- Guarantee a positive mask width and height for every valid source box.

## Mode Behavior

- `tight`: use the expanded and clamped OCR rectangle described above.
- `full`: preserve the existing padded Full Box behavior without modification.
- Manual brush-mask compositing remains unchanged.
- Manually added bubbles continue to be excluded from automatic inpainting.

## Architecture

Move mask rectangle calculation into a small browser/CommonJS geometry module. The renderer uses that module when drawing each inpainting mask, allowing deterministic unit tests without a canvas or LaMa process.

## Testing

- Verify a normal Tight Fit box expands by 3% on every side.
- Verify a small box receives at least 2 pixels of padding.
- Verify a box touching an image edge is clamped inside the image.
- Verify Full Box returns the current padding calculation unchanged.
- Run the complete Node test suite and visually compare the same translated page after restarting ComicTranslator.

## Scope Exclusions

- OCR prompt or box detection changes.
- LaMa model changes.
- Export, review, watermark, glossary, or translation changes.
