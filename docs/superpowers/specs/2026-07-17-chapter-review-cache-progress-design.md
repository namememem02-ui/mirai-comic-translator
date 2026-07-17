# Chapter Review Cache and Progress Design

## Goal

Make Chapter Review immediately usable, prevent completed review pages from being recomposed when the user scrolls away and back, and show clear progress while selected pages are prepared.

## Approved Behavior

- Opening Chapter Review shows each source image immediately.
- Every selected page is queued for translated-review composition, including pages outside the viewport.
- The header shows a progress bar and text in the form `กำลังเตรียมภาพแปล X/Y หน้า`.
- Completed pages replace their source previews progressively.
- Scrolling a completed page out of view and back reuses its cached review image without running inpainting again.
- Selecting or deselecting pages updates the total and progress state.
- Closing Chapter Review releases the session cache and queued work.
- Export remains full resolution and is not affected by review preview sizing.

## Architecture

### Review Preview Cache

`reviewCache` remains session-only and is keyed by page index. A completed canvas is downscaled for review display before JPEG encoding. The maximum review width is 1600 pixels while preserving aspect ratio; images narrower than that are not enlarged. This keeps long manhwa previews readable without retaining every full-resolution canvas in memory.

The cache entry remains present while the review overlay is open. Intersection Observer may detach an offscreen `<img>` to reduce decoded-image pressure, but it must not delete the encoded cache entry. When the page becomes visible again, the cached data URL is restored immediately.

### Background Queue

All selected page elements are enqueued after the review page list is built. Intersection Observer can still prioritize a visible idle page, but queue de-duplication ensures each page has at most one active or pending composition task.

Changing the selection rebuilds the page list and starts a new review generation token. Work from the previous selection becomes stale and must not update the new list or progress.

### Progress State

The review header contains:

- a determinate progress element;
- progress text;
- the existing selected-page count.

Progress counts selected pages whose review images are available in the current session cache. States are:

- `กำลังเตรียมภาพแปล X/Y หน้า` while incomplete;
- `พร้อมรีวิว Y/Y หน้า` when complete;
- `ไม่มีหน้าที่เลือก` when the selection is empty.

Progress updates when a page finishes, fails, selection changes, or the review closes. A failed page remains represented by its source preview and counts as finished for the current pass so the progress bar cannot remain stuck; its retry control can enqueue it again.

## Error Handling

- A page-level inpainting or composition failure does not stop other pages.
- The original image stays visible for a failed page.
- Retry affects only that page and updates progress without clearing successful cache entries.
- Closing or reopening the review invalidates stale async tasks.

## Testing

- Verify review previews are downscaled without enlargement and preserve aspect ratio.
- Verify offscreen cleanup does not delete `reviewCache`.
- Verify all selected pages are queued, not only intersecting pages.
- Verify cache hits restore images without recomposition.
- Verify progress states for empty, partial, complete, failure, and changed selection.
- Run the full Node test suite and syntax checks after integration.
