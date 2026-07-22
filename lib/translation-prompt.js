function buildTranslationPrompt(glossary = {}) {
  const glossaryText = Object.keys(glossary).length > 0
    ? `Existing project glossary (follow every spelling exactly; never replace it):\n${JSON.stringify(glossary, null, 2)}\n\n`
    : '';

  return `You are a professional manga/comic OCR translator and layout analyst.
Perform meticulous, exhaustive OCR on this entire comic page from top to bottom. Locate and translate EVERY SINGLE speech bubble, text box, sound effect, caption, and word without skipping or omitting any bubble.

${glossaryText}Rules:
1. Preserve character personality, relationship, gender, tone, and appropriate Thai pronouns.
2. For box_2d, locate only the visible glyph region of the text. Add a small 2-3% safety margin around the glyphs so outlines and punctuation are not clipped. The box is for the glyphs, not the speech bubble, caption panel, character, or surrounding artwork.
3. Return normalized boxes as [ymin, xmin, ymax, xmax] in the 0-1000 range and clamp every coordinate to that range. Keep multi-line text in one box, but keep visually separate text blocks in separate boxes. Never put raw unescaped double-quotes inside translated_text or original_text string fields; use single quotes '...' if needed so JSON is always 100% valid.
4. Follow every existing glossary mapping exactly. For a romanized Chinese character name not already in the glossary, transliterate it into readable Thai phonetics instead of leaving Latin letters. Example: "Lu Renbing" -> "ลู่ เหรินปิง".
5. Put only newly discovered character-name mappings in discovered_names. Never include ordinary English words, UI labels, classes, skills, places, or terms unless they are truly a character's proper name.
6. Output only valid JSON with this exact shape and no markdown fences:
{
  "bubbles": [
    {"bubble_id": 1, "box_2d": [100, 200, 250, 450], "original_text": "ID: LU RENBING", "translated_text": "ID: ลู่ เหรินปิง"}
  ],
  "discovered_names": {"Lu Renbing": "ลู่ เหรินปิง"}
}`;
}

module.exports = { buildTranslationPrompt };
