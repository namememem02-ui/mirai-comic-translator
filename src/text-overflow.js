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

  function measureTextOverflow(input = {}, adapter) {
    const width = Number(input.boxWidth);
    const height = Number(input.boxHeight);
    if (!(width > 0) || !(height > 0)) {
      return {
        status: 'overflow',
        lineCount: 0,
        requiredHeight: Infinity,
        availableHeight: Math.max(0, height || 0),
        usage: Infinity,
        hasWideToken: false,
      };
    }
    const text = String(input.text ?? '').trim();
    if (!text) {
      return {
        status: 'safe',
        lineCount: 0,
        requiredHeight: 0,
        availableHeight: height,
        usage: 0,
        hasWideToken: false,
      };
    }
    const tokens = text.split(/\s+/).filter(Boolean);
    const hasWideToken = tokens.some(token => measure(adapter, token) > width);
    const lineHeight = Number(input.lineHeight) > 0
      ? Number(input.lineHeight)
      : Math.max(1, Number(input.fontSize) || 16) * 1.25;
    const lineCount = wrapText(text, width, adapter).length;
    const requiredHeight = lineCount * lineHeight;
    const usage = requiredHeight / height;
    const status = hasWideToken || requiredHeight > height
      ? 'overflow'
      : usage >= 0.85 ? 'near' : 'safe';
    return { status, lineCount, requiredHeight, availableHeight: height, usage, hasWideToken };
  }

  function isTextOverflowing(input = {}, adapter) {
    return measureTextOverflow(input, adapter).status === 'overflow';
  }

  function createCanvasAdapter(context) {
    return { measure: text => context.measureText(text).width };
  }

  const api = { createCanvasAdapter, isTextOverflowing, measureTextOverflow, wrapText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextOverflow = api;
})(typeof window !== 'undefined' ? window : globalThis);
