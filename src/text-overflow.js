(function exposeTextOverflow(root) {
  function measure(adapter, text) {
    return Number(adapter?.measure?.(text)) || 0;
  }

  function wrapText(text, maxWidth, adapter) {
    const lines = [];
    for (const paragraph of String(text ?? '').split(/\r?\n/)) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure(adapter, candidate) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function isTextOverflowing(input = {}, adapter) {
    const width = Number(input.boxWidth);
    const height = Number(input.boxHeight);
    if (!(width > 0) || !(height > 0)) return true;
    const text = String(input.text ?? '').trim();
    if (!text) return false;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.some(token => measure(adapter, token) > width)) return true;
    const lineHeight = Number(input.lineHeight) > 0
      ? Number(input.lineHeight)
      : Math.max(1, Number(input.fontSize) || 16) * 1.25;
    return wrapText(text, width, adapter).length * lineHeight > height;
  }

  function createCanvasAdapter(context) {
    return { measure: text => context.measureText(text).width };
  }

  const api = { createCanvasAdapter, isTextOverflowing, wrapText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextOverflow = api;
})(typeof window !== 'undefined' ? window : globalThis);
