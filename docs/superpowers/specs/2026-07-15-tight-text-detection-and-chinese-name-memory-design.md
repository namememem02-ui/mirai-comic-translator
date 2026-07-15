# Tight Text Detection and Chinese Name Memory Design

## Goal

Improve AI-generated text boxes so they tightly surround visible text rather than speech balloons or panel artwork, and consistently transliterate romanized Chinese character names into Thai across a project.

## Detection behavior

- Ask the vision model to locate the visible glyph region of each text block, not the speech balloon, caption panel, character, or surrounding artwork.
- Keep a small safety margin around the glyphs so ascenders, descenders, outlines, and punctuation are not clipped.
- The requested safety margin is approximately 2–3% of the detected text block dimensions, with coordinates clamped to the normalized 0–1000 image bounds.
- Each visually separate text block receives its own box. Multi-line text belonging to one block remains one box.
- Existing manual resize controls remain available for exceptional pages.

## Chinese name behavior

- Existing project Glossary entries have highest priority and must be followed exactly.
- If a romanized Chinese proper name is absent from the Glossary, translate it into readable Thai phonetics instead of preserving Latin characters.
- Example default: `Lu Renbing` becomes `ลู่ เหรินปิง`.
- The model returns newly discovered source-to-Thai name mappings together with translated bubbles.
- The renderer merges only previously unknown mappings into the project Glossary and saves them through the existing atomic memory writer.
- Automatic discovery never overwrites a mapping created or edited by the user.
- Ordinary English words, UI labels, classes, and skill names must not be learned as character names.

## API response and compatibility

The translation response changes from a bare array to this object:

```json
{
  "bubbles": [
    {
      "bubble_id": 1,
      "box_2d": [100, 200, 250, 450],
      "original_text": "ID: LU RENBING",
      "translated_text": "ID: ลู่ เหรินปิง"
    }
  ],
  "discovered_names": {
    "Lu Renbing": "ลู่ เหรินปิง"
  }
}
```

The renderer normalizes both formats:

- New object response: use `bubbles` and merge `discovered_names`.
- Legacy array response: use the array as bubbles and skip automatic name learning.

Saved page translation JSON remains an array, so existing projects and editing code require no data migration.

## Validation and failure handling

- Reject or ignore malformed bubble records without changing valid saved work.
- Accept discovered-name mappings only when both source and Thai values are non-empty strings and the Thai value contains Thai characters.
- Do not replace any existing Glossary key, including keys whose capitalization differs; comparison is case-insensitive.
- If name discovery is empty or malformed, translation still completes normally.

## Testing

- Unit-test prompt content for tight glyph boxes, padding, Glossary priority, and Chinese-name transliteration.
- Unit-test response normalization for both new object and legacy array formats.
- Unit-test case-insensitive Glossary merging, Thai-character validation, and protection of user mappings.
- Run the full Node test suite and JavaScript syntax checks.

## Expected result

- The example speech text `WHERE'D THIS STINKING PEASANT COME FROM~` receives a box close to the letters rather than extending down the character's body.
- `Lu Renbing` is output as `ลู่ เหรินปิง` by default and reused consistently after being learned.
- A user can change that mapping in the Glossary, and later translations will follow the user's spelling.
