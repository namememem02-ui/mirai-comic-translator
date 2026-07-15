# Adjustable UI Scale Design

## Goal

Make ComicTranslator readable on high-resolution and full-screen displays by adding a saved, program-wide UI scale setting. The default scale is 115%.

## Scale choices and persistence

- Add `ขนาด UI` to the existing settings dialog with choices `100%`, `115%`, and `130%`.
- New installations and existing settings without a scale value default to `115%`.
- Apply a changed scale immediately without restarting the application.
- Save the selected value through the existing app-settings IPC and restore it during startup.
- Reject unknown values and fall back to 115%.

## Scaling behavior

- Scale interface typography, button heights and padding, form controls, tabs, list rows, toolbars, badges, dialogs, and common spacing.
- Use root CSS custom properties and semantic size tokens rather than browser zoom.
- Existing inline pixel font sizes receive scoped override rules so legacy controls participate without rewriting unrelated markup.
- Scale the left explorer and right editor panel widths within responsive minimum and maximum bounds.
- Keep the central comic viewport as the flexible remaining column.
- Toolbars wrap into orderly additional rows when controls no longer fit.
- Panels and dialogs scroll internally when their content exceeds available height.

## Canvas and editing isolation

- Do not scale source image pixels, Canvas backing-store dimensions, SVG view boxes, exported images, translation coordinates, watermark coordinates, or bubble geometry.
- The viewport may become narrower because surrounding UI is larger, but existing Fit Width, Full Page, manual zoom, drag, and resize calculations continue to use measured screen/image dimensions.
- UI scale changes trigger the existing viewport layout refresh so overlays remain aligned with the displayed image.

## Responsive layout

- At 100%, preserve the current compact density while using the new tokens.
- At 115%, use readable body text around 14–15px and controls around 14px.
- At 130%, prioritize readability; allow toolbar wrapping and internal scrolling rather than shrinking text.
- Constrain the explorer and editor panels so together they cannot consume the whole workspace on supported window sizes.
- Preserve the application's existing minimum window size and three-column editing workflow.

## Accessibility and feedback

- Keep visible labels for the three scale choices and indicate the active choice.
- Maintain existing focus behavior, disabled states, and color theme.
- The settings preview updates as soon as a scale choice changes; saving persists it, while closing without saving restores the previously saved scale.

## Testing

- Unit-test scale normalization, defaulting, and mapping to CSS values.
- Test loading legacy settings without `uiScale` and invalid stored values.
- Test settings save/cancel behavior for immediate preview and rollback.
- Run the complete Node test suite and JavaScript syntax checks.
- Manually verify 100%, 115%, and 130% in a maximized Electron window, including toolbars, page list, glossary, dialogue editor, settings/export dialogs, continuous review, bubble drag/resize, Fit Width, and Full Page.

## Non-goals

- Do not change translated comic font sizes.
- Do not change export resolution or JPEG quality.
- Do not redesign the color theme or navigation structure.
- Do not add arbitrary free-form scaling in this phase.
