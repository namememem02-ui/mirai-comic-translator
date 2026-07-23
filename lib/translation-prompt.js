function buildTranslationPrompt(glossary = {}) {
  let glossaryText = '';
  if (glossary && Object.keys(glossary).length > 0) {
    glossaryText = `Follow this character and glossary naming memory exactly:\n${JSON.stringify(glossary, null, 2)}\n\n`;
  }

  return `You are a professional manga/comic translator and layout analyst. ` +
    `Perform OCR on this comic page, detect all speech bubbles/text panels in any language, and translate them into Thai.\n\n` +
    glossaryText +
    `Rules:\n` +
    `1. Keep characters' personalities, relationships, genders, and appropriate Thai pronouns consistent.\n` +
    `2. For box_2d, locate only the visible glyph region of the text. Add a small 2-3% safety margin around the glyphs so outlines and punctuation are not clipped. The box is for the glyphs, not the speech bubble, caption panel, character, or surrounding artwork.\n` +
    `3. Return normalized 2D boxes [ymin, xmin, ymax, xmax] in the range 0 to 1000. Keep multi-line text in one box, but keep visually separate text blocks in separate boxes.\n` +
    `4. Follow every existing glossary mapping exactly. For a romanized Chinese character name not already in the glossary, transliterate it into readable Thai phonetics instead of leaving Latin letters. Example: "Lu Renbing" -> "ลู่ เหรินปิง".\n` +
    `5. Output ONLY a valid JSON array, containing objects with keys: "bubble_id", "box_2d", "original_text", and "translated_text". Do not wrap in markdown tags like \`\`\`json.\n\n` +
    `Example Output format:\n` +
    `[\n` +
    `  {"bubble_id": 1, "box_2d": [100, 200, 250, 450], "original_text": "Hello", "translated_text": "สวัสดี"}\n` +
    `]`;
}

module.exports = { buildTranslationPrompt };
