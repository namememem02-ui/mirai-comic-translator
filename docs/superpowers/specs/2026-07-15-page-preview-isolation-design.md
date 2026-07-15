# Page Preview Isolation Design

## Goal

Prevent Thai preview text or generated preview images from a previously selected comic page from appearing on the newly selected page.

## Root cause

- `selectPage()` clears the SVG overlay and bubble list but does not clear `typesetTextCanvas` before awaiting the new page translation and image.
- `renderTypesetImage()` performs asynchronous inpainting and image loading. A render started for page A can finish after the user has selected page B and can still assign page A output to the shared `activeImage`.
- Saved translation files are already page-scoped, so this fix must affect display state only.

## Design

- Maintain a monotonically increasing page-view generation number.
- Increment the generation synchronously at the start of every `selectPage()` call.
- Immediately clear transient preview state when selection begins:
  - clear `typesetTextCanvas`;
  - clear SVG overlays and bubble cards;
  - hide the canvas loader;
  - restore the selected page's original image source when it is assigned.
- Pass or capture the current generation when starting `renderTypesetImage()`.
- Before every shared UI mutation after an asynchronous boundary, confirm that the captured generation still matches the current generation and that the page identity still matches.
- A stale render cleans up its temporary object URL but must not update `activeImage`, cache entries for the wrong page, the text Canvas, or loader visibility for the current page.
- The image load handler renders Thai text only for the currently selected page generation.

## Helper boundary

Create a small browser/Node-compatible helper module exposing:

```js
createRenderGuard()
```

The guard provides:

- `begin(pageKey)` returning an immutable `{ generation, pageKey }` token;
- `isCurrent(token)` returning true only for the latest token;
- `current()` returning the latest token for synchronous event handlers.

This isolates and unit-tests the race-control behavior without requiring Electron or a real Canvas.

## Error handling

- Stale work exits silently because page switching is normal user behavior.
- Real errors from the current render continue to use the existing fallback and warning behavior.
- Loader cleanup occurs only when the render still owns the current generation, preventing an old render from hiding a new page's loader.

## Testing

- Verify the newest page token invalidates all older tokens.
- Verify repeated selection of the same page still creates a new generation and invalidates old work.
- Verify a token cannot become current again.
- Run the full Node test suite and JavaScript syntax checks.
- Manual scenario: enable Thai preview, switch pages quickly while inpainting is active, and confirm no text or preview from the previous page appears.

## Non-goals

- No changes to saved page translation JSON.
- No changes to export output or translation content.
- No per-page permanent Canvas allocation.
