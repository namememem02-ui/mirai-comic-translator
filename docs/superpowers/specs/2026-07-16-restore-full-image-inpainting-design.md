# Restore Full-Image LaMa Inpainting

## Problem

The current sidecar finds each mask contour, crops a small patch, runs LaMa on that patch, and pastes the result back. This optimization reduces surrounding context and can create visible blocks, seams, and inconsistent texture. The previous full-image implementation produced better retouch quality.

## Approved Design

- Send the original full-resolution image and its complete mask to LaMa in one operation.
- Remove contour detection, patch cropping, resizing, and patch paste-back from the inpainting request path.
- Keep the existing API endpoint, request fields, JPEG quality, GPU/CPU selection, and error reporting unchanged.
- Do not change translation, export, quality-check, watermark, review, or editor behavior.

## Mask Behavior

The renderer remains responsible for producing the mask. This change only restores how the Python sidecar processes that image and mask. Tight-mask behavior is intentionally excluded from this fix so that the quality regression has one isolated cause and one measurable correction.

## Verification

- Add a contract test proving that the sidecar calls LaMa with the full image and full mask.
- The test must reject reintroduction of contour-based patch processing.
- Run the complete Node test suite.
- Compare the same page and mask in the running application after restarting the sidecar, checking for patch seams and block-shaped texture changes.

## Rollback

The change is isolated to `sidecar/inpaint_server.py` and its regression test, so it can be reverted without affecting saved projects or translations.
