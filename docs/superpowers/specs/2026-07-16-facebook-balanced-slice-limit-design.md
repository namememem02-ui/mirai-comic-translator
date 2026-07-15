# Facebook Balanced Slice Limit Design

## Goal

Replace fixed 4:5 Facebook slicing with a chapter-wide image limit so a typical 11-page chapter produces 33 ordered images instead of roughly 100.

## User controls

- Add a maximum-output selector to Facebook export with choices 11, 22, 33, and 44 images.
- Default to 33 images.
- Show the calculated output count before composition begins.
- Update explanatory text to state that slices are distributed by source-page length and may be taller than 4:5.

## Allocation algorithm

- Every selected source page receives at least one output slice.
- The effective target is the larger of the selected source-page count and the selected maximum. This prevents any page from being omitted when more pages are selected than the configured maximum.
- Distribute remaining slices proportionally by source pixel height.
- Use largest-remainder allocation: calculate each page's fractional share, assign floor values, then award remaining slices to the largest fractional remainders with stable source order as the tie breaker.
- Never allocate more slices to a page than its pixel height permits; every slice has at least one pixel of height.
- Split each source page into its allocated number of nearly equal integer-height rectangles covering every source row exactly once.

## Output behavior

- Compose translated text, custom paint, and watermark before slicing, using the existing Facebook export pipeline.
- Preserve source width with no horizontal crop or upscale.
- Continue one automatic filename sequence across all pages: `001.jpg`, `002.jpg`, and so on.
- Keep JPEG quality 0.95, ZIP naming, cancellation, progress, and save behavior unchanged.

## Testing

- Unit-test proportional allocation, stable ties, minimum one slice per page, selected pages exceeding the maximum, tiny page heights, and exact total counts.
- Unit-test equal-height rectangle coverage with integer remainders and no gaps or overlaps.
- Update the UI contract test for the 11/22/33/44 selector and removal of 4:5 copy.
- Run the full Node suite and syntax checks.
- Manually verify that the current 11-page sample reports and produces 33 images in natural order.

## Non-goals

- No OCR-, whitespace-, scene-, or speech-bubble-aware cutting.
- No manual cut-line editor.
- No automatic Facebook upload.
