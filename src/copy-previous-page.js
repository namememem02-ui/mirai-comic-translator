(function exposeCopyPreviousPage(root) {
  const MODES = new Set(['text', 'text-style', 'full-bubble']);
  const STYLE_FIELDS = ['font_size', 'font_family', 'text_align', 'text_color', 'outline'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateMode(mode) {
    if (!MODES.has(mode)) throw new Error(`Unknown copy mode: ${mode}`);
  }

  function buildCopyPreview({ source = [], current = [], mode = 'text' } = {}) {
    validateMode(mode);
    const pairedCount = mode === 'full-bubble' ? 0 : Math.min(source.length, current.length);
    return {
      sourceCount: source.length,
      currentCount: current.length,
      pairedCount,
      appendedCount: mode === 'full-bubble' ? source.length : 0,
      unmatchedSourceCount: mode === 'full-bubble' ? 0 : Math.max(0, source.length - pairedCount),
      unmatchedCurrentCount: mode === 'full-bubble' ? 0 : Math.max(0, current.length - pairedCount),
      canConfirm: source.length > 0 && (mode === 'full-bubble' || pairedCount > 0),
    };
  }

  function copyPreviousPage({ source = [], current = [], mode = 'text' } = {}) {
    const preview = buildCopyPreview({ source, current, mode });
    const result = clone(current);

    if (mode === 'full-bubble') {
      const numericIds = result.map(item => Number(item.bubble_id)).filter(Number.isFinite);
      let nextId = (numericIds.length ? Math.max(...numericIds) : 0) + 1;
      source.forEach(item => result.push({ ...clone(item), bubble_id: nextId++ }));
      return result;
    }

    for (let index = 0; index < preview.pairedCount; index += 1) {
      result[index].translated_text = source[index].translated_text;
      if (mode === 'text-style') {
        STYLE_FIELDS.forEach(field => {
          if (Object.prototype.hasOwnProperty.call(source[index], field)) {
            result[index][field] = clone(source[index][field]);
          } else {
            delete result[index][field];
          }
        });
      }
    }
    return result;
  }

  const api = { buildCopyPreview, copyPreviousPage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CopyPreviousPage = api;
})(typeof window !== 'undefined' ? window : globalThis);
