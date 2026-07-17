(function exposeChapterFindReplace(root) {
  const WORD_CHARACTER = /[\p{L}\p{N}\p{M}_]/u;

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isWordCharacter(character) {
    return Boolean(character && WORD_CHARACTER.test(character));
  }

  function replaceLiteral(text, search, replacement, wholeWord = true) {
    const source = String(text ?? '');
    const needle = String(search ?? '');
    if (!needle) return { text: source, count: 0 };
    const matcher = new RegExp(escapeRegExp(needle), 'giu');
    let output = '';
    let cursor = 0;
    let count = 0;
    for (const match of source.matchAll(matcher)) {
      const start = match.index;
      const end = start + match[0].length;
      const before = Array.from(source.slice(0, start)).at(-1);
      const after = Array.from(source.slice(end))[0];
      if (wholeWord && (isWordCharacter(before) || isWordCharacter(after))) continue;
      output += source.slice(cursor, start) + String(replacement ?? '');
      cursor = end;
      count += 1;
    }
    if (!count) return { text: source, count: 0 };
    return { text: output + source.slice(cursor), count };
  }

  function resultKey(pageIndex, bubbleId) {
    return `${pageIndex}:${bubbleId}`;
  }

  function findChapterMatches(pages, search, replacement, wholeWord = true) {
    if (!String(search ?? '')) return [];
    const results = [];
    for (const page of pages || []) {
      for (const bubble of page.bubbles || []) {
        const before = String(bubble.translated_text ?? '');
        const replaced = replaceLiteral(before, search, replacement, wholeWord);
        if (!replaced.count) continue;
        results.push(Object.freeze({
          pageIndex: page.pageIndex,
          pageName: page.pageName,
          bubbleId: bubble.bubble_id,
          before,
          after: replaced.text,
          occurrenceCount: replaced.count,
        }));
      }
    }
    return results;
  }

  function applySelectedMatches(pages, results, selectedKeys) {
    const replacements = new Map();
    for (const result of results || []) {
      if (selectedKeys?.has(resultKey(result.pageIndex, result.bubbleId))) {
        replacements.set(resultKey(result.pageIndex, result.bubbleId), result.after);
      }
    }
    const updates = new Map();
    for (const page of pages || []) {
      const hasSelected = (page.bubbles || []).some(bubble =>
        replacements.has(resultKey(page.pageIndex, bubble.bubble_id)));
      if (!hasSelected) continue;
      const bubbles = JSON.parse(JSON.stringify(page.bubbles || []));
      bubbles.forEach(bubble => {
        const key = resultKey(page.pageIndex, bubble.bubble_id);
        if (replacements.has(key)) bubble.translated_text = replacements.get(key);
      });
      updates.set(page.pageIndex, bubbles);
    }
    return updates;
  }

  const api = { applySelectedMatches, findChapterMatches, replaceLiteral, resultKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChapterFindReplace = api;
})(typeof window !== 'undefined' ? window : globalThis);
