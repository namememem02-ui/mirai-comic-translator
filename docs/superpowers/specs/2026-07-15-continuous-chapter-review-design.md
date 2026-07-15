# Continuous Chapter Review Design

## Goal

Add a full-screen continuous review mode inside ComicTranslator so long-form manhwa and Chinese comics split across multiple files can be inspected as one uninterrupted translated chapter.

## Entry and page selection

- Add a `📖 รีวิวรวม` button beside Thai Preview and Export.
- The button opens a full-screen review overlay for the currently loaded project and chapter.
- The review opens with every chapter page selected in the same natural filename order used by the thumbnail list.
- A compact page selector allows:
  - select all;
  - select none;
  - select translated pages;
  - toggle individual pages.
- Changing selection updates the review list without altering saved translations.

## Continuous viewer

- Display selected pages in a single centered vertical column.
- Default page gap is zero so artwork crossing file boundaries appears continuous.
- Page widths are normalized to the same displayed column width while preserving each image's aspect ratio.
- Provide width controls for 50%, 75%, 100%, and Fit Width.
- Provide optional filename labels and page-boundary guide lines; both are off by default.
- The viewer uses its own scrolling area and does not disturb the editor's current scroll or zoom.

## Rendering behavior

- Review pages use Thai translated output and the current chapter watermark settings.
- Each page is rendered independently with the existing inpainting, custom-paint, Thai typesetting, and watermark composition rules.
- Untranslated pages display the original image plus watermark when enabled.
- Do not concatenate the entire chapter into one Canvas.
- Create only the page Canvas currently near the viewport and release far-away Canvas pixels after they leave the preload range.
- Use `IntersectionObserver` with a preload margin so pages render shortly before they scroll into view.
- Show an aspect-ratio placeholder while each page renders to prevent the scroll position from jumping.

## Cache and concurrency

- Cache completed review output by page name for the current review session.
- Limit active page rendering to two concurrent jobs to avoid excessive inpainting and memory usage.
- Closing review invalidates its session token; late async results must not update the closed or reopened viewer.
- A failed page shows an inline retry button and does not stop other pages from rendering.
- Closing the overlay releases review-only object URLs, Canvas dimensions, observers, and queued work.

## Navigation back to editing

- Clicking a rendered page or its optional filename label closes review mode and selects that page in the normal editor.
- The editor returns to Thai Preview mode for immediate comparison and correction.
- Current project, chapter, translations, watermark settings, and editor state remain unchanged except for the selected page.

## User interface

- Full-screen dark overlay with:
  - chapter title and selected-page count;
  - close button;
  - page-selector drawer;
  - width controls;
  - filename and boundary toggles;
  - centered continuous scroll column;
  - per-page loading and error states.
- Escape closes the overlay.
- Review controls remain sticky while scrolling.

## Testing

- Unit-test page selection and natural ordering helpers.
- Unit-test the two-job render queue and cancellation token behavior.
- Unit-test width mode and optional-label state normalization.
- Verify that failed jobs do not block later pages.
- Run the full Node test suite and JavaScript syntax checks.
- Manually review several tall 800×9500 pages, scroll quickly, close during rendering, reopen, toggle guides, and click a page to return to editing.

## Non-goals

- No separate application.
- No single giant combined image export in this phase.
- No changes to saved translation JSON or original comic files.
- Review mode does not edit text directly; it navigates back to the existing editor.
