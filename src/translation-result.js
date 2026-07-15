(function exposeTranslationResult(root) {
  function isValidBubble(bubble) {
    return Boolean(
      bubble
      && typeof bubble === 'object'
      && Array.isArray(bubble.box_2d)
      && bubble.box_2d.length === 4
      && bubble.box_2d.every(Number.isFinite)
      && typeof bubble.original_text === 'string'
      && typeof bubble.translated_text === 'string'
    );
  }

  function normalizeTranslationResult(result) {
    const isLegacy = Array.isArray(result);
    const bubbles = (isLegacy ? result : result?.bubbles) || [];
    const names = !isLegacy && result?.discovered_names;

    return {
      bubbles: Array.isArray(bubbles) ? bubbles.filter(isValidBubble) : [],
      discoveredNames: names && typeof names === 'object' && !Array.isArray(names) ? names : {},
    };
  }

  function mergeDiscoveredNames(glossary = {}, discoveredNames = {}) {
    const merged = { ...glossary };
    const added = {};
    const existingKeys = new Set(Object.keys(merged).map(key => key.trim().toLocaleLowerCase()));

    Object.entries(discoveredNames).forEach(([source, thai]) => {
      const cleanSource = typeof source === 'string' ? source.trim() : '';
      const cleanThai = typeof thai === 'string' ? thai.trim() : '';
      const normalizedSource = cleanSource.toLocaleLowerCase();
      if (!cleanSource || !cleanThai || !/[\u0E00-\u0E7F]/.test(cleanThai)) return;
      if (existingKeys.has(normalizedSource)) return;

      merged[cleanSource] = cleanThai;
      added[cleanSource] = cleanThai;
      existingKeys.add(normalizedSource);
    });

    return { glossary: merged, added };
  }

  const api = { mergeDiscoveredNames, normalizeTranslationResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TranslationResult = api;
})(typeof window !== 'undefined' ? window : globalThis);
