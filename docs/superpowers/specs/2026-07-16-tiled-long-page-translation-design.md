# Tiled Long-Page Translation Design

## Problem

ComicTranslator currently sends every page to Gemini as one image and trusts the returned normalized `box_2d` coordinates. This works for ordinary manga pages, but the current manhwa pages are approximately `800 × 9,500 px` (aspect ratio about 11.9:1). Gemini can read much of the text, but its spatial grounding becomes unreliable on an image this tall, so translated bubbles are paired with boxes that do not tightly match the source glyphs.

The SVG renderer already maps `[ymin, xmin, ymax, xmax]` from the `0–1000` coordinate space to the full image correctly. The fix therefore belongs at the image-analysis boundary, before translation results reach the renderer.

## Selected Approach

Use tiled translation only for unusually tall pages. Ordinary pages keep the existing single-request path.

- A page with `height / width <= 4` is sent to Gemini once, unchanged.
- A taller page is divided into vertical core regions whose height is at most three image widths.
- Each request includes the core region plus a small vertical overlap above and below it. The full image width is preserved.
- Gemini returns tile-local normalized boxes using the existing prompt and response shape.
- Tile-local boxes are converted back to normalized coordinates for the original full page.
- A detected text block is owned by the tile whose non-overlapping core contains the vertical center of that block. Detections in overlap-only areas are discarded. This prevents duplicate boxes while retaining text that crosses a tile boundary.
- Merged bubbles receive new sequential `bubble_id` values in top-to-bottom, then left-to-right order.
- `discovered_names` from all tiles are merged case-insensitively without replacing an earlier spelling.

For an `800 × 9,500 px` page this normally produces four Gemini requests. A normal manga page still produces one request.

## Components

### Pure tiling helper

Add `lib/translation-tiling.js` with functions that:

1. Plan core and crop ranges from image dimensions.
2. Convert a tile-local normalized box into full-page normalized coordinates.
3. Keep only detections owned by the tile core.
4. Merge and sort tile results into the existing `{ bubbles, discovered_names }` response.

The helper contains no Electron, filesystem, or network code, making coordinate behavior directly testable.

### Image cropping and Gemini calls

Refactor the current `translate-page` handler in `main.js` so one internal Gemini request accepts an encoded image buffer and MIME type.

For tall pages, Electron `nativeImage` reads the source image and creates full-width vertical crops. Each crop is encoded as JPEG or PNG and sent sequentially. Sequential requests avoid sudden API bursts and preserve predictable failure behavior.

### Renderer compatibility

The renderer receives the same response shape as before. No changes are required to saved page JSON, SVG rendering, manual resizing, inline editing, preview, inpainting, review, or export.

## Failure and Data Safety

- No partial tile result is returned or saved. If any tile request fails, translation fails as a whole and the page's previous stored translation remains unchanged.
- Invalid boxes are ignored using the same numeric four-coordinate requirements already used by translation result normalization.
- Converted coordinates are rounded and clamped to `0–1000`.
- Empty tiles are valid and do not fail the page.
- Existing model fallback behavior remains available independently for every tile request.

## Testing

Automated tests will cover:

- Ordinary pages produce one full-page tile.
- A `800 × 9,500` page produces bounded vertical crops with overlap and complete core coverage.
- Tile-local boxes remap to the expected full-page coordinates.
- Overlap detections are owned by only one core and do not duplicate.
- Merged bubbles are sorted and renumbered consistently.
- Discovered names merge without overwriting an earlier case-insensitive spelling.
- The Electron translation handler uses the tiling helper while preserving the existing single-image path.

Manual verification will retranslate a copied long manhwa page and compare several boxes near the top, middle, and tile boundaries. Original project files will not be used for destructive testing.

## Out of Scope

- Replacing Gemini OCR with a local OCR model.
- Automatically correcting old saved boxes without retranslation.
- Changing font fitting, inpainting masks, or manual resize behavior.
- Parallel tile requests or new user-facing translation settings.
