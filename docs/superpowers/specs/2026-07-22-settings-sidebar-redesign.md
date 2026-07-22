# Settings Sidebar Redesign

## Goal

Make Settings easier to scan and operate by replacing the narrow scrolling
column with a wider category-based workspace.

## Direction

Use a restrained technical workspace: a persistent category rail on the left,
one focused settings panel on the right, quiet dividers, and the existing blue
accent for selection and primary actions. Preserve the current dark Mee-a-rai
visual language and every existing control behavior.

## Layout

- Desktop dialog width: `min(920px, calc(100vw - 48px))`.
- Dialog height: `min(720px, calc(100vh - 48px))`.
- Fixed header and footer; only the right content panel scrolls.
- Left rail width: 190px.
- Right panel uses a readable content measure and aligned form rows.
- At widths below 720px, the rail becomes a horizontally scrollable category
  bar above the content. Controls stack without horizontal page scrolling.

## Categories

1. **บัญชี AI** — Gemini API Key, save/delete actions, key creation guide.
2. **หน้าตา** — UI scale.
3. **ตัวอักษร** — default size, auto sizing, font family, alignment.
4. **รีทัช** — LaMa inpaint mask mode and its explanation.
5. **อัปเดต** — installed version, online update check, status and release notes.

The initial category is บัญชี AI. Changing category does not save or reset any
form values. Reopening Settings starts at the last category used during the
current app session.

## Interaction and accessibility

- Category controls use a tablist/tab pattern with `aria-selected`, keyboard
  Left/Right/Up/Down navigation, Home, and End.
- Each panel is labelled by its category tab and only one panel is visible.
- The close button remains in the header and Save Settings remains in the
  sticky footer.
- API Key save/delete and online update actions continue working independently
  of the global Save Settings button.
- Focus remains visible; selected state is conveyed by text, border, and color.
- Existing element IDs and renderer handlers remain unchanged.

## Visual system

- Remove layout-critical inline styles from the dialog and move them to scoped
  Settings CSS classes.
- Use one outer dialog border and section dividers rather than card borders
  around every setting.
- Use consistent 36px control height, 12px secondary copy, and a 16px spacing
  rhythm.
- Destructive API-key deletion remains red; primary save/check actions retain
  existing blue/green roles.

## Testing and review

- Contract tests verify all five tabs and panels exist exactly once.
- Behavior tests verify category switching, keyboard navigation, and active
  panel persistence without modifying settings values.
- Existing Settings, API-key, update, UI-scale, and renderer dependency tests
  must continue passing.
- Verify the rendered dialog at desktop width and below 720px, checking focus,
  clipping, footer visibility, and content scrolling.
