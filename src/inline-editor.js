(function exposeInlineEditor(root) {
  function normalizedBox(bubble) {
    if (!Array.isArray(bubble?.box_2d) || bubble.box_2d.length !== 4) return null;
    const values = bubble.box_2d.map(Number);
    if (!values.every(Number.isFinite)) return null;
    const [rawY1, rawX1, rawY2, rawX2] = values;
    const top = Math.max(0, Math.min(1000, Math.min(rawY1, rawY2)));
    const left = Math.max(0, Math.min(1000, Math.min(rawX1, rawX2)));
    const bottom = Math.max(0, Math.min(1000, Math.max(rawY1, rawY2)));
    const right = Math.max(0, Math.min(1000, Math.max(rawX1, rawX2)));
    if (bottom <= top || right <= left) return null;
    return { top, left, bottom, right };
  }

  function findBubbleAtPoint(bubbles = [], x, y) {
    const pointX = Number(x);
    const pointY = Number(y);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return null;
    return bubbles
      .filter(bubble => !bubble?.hidden)
      .map(bubble => ({ bubble, box: normalizedBox(bubble) }))
      .filter(({ box }) => box && pointX >= box.left && pointX <= box.right && pointY >= box.top && pointY <= box.bottom)
      .sort((a, b) => ((a.box.right - a.box.left) * (a.box.bottom - a.box.top)) - ((b.box.right - b.box.left) * (b.box.bottom - b.box.top)))[0]?.bubble || null;
  }

  function normalizeInlineShortcut(event = {}, composing = false) {
    if (composing) return 'none';
    if (event.key === 'Escape') return 'cancel';
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return 'confirm';
    return 'none';
  }

  function buildEditorStyle(bubble = {}) {
    const box = normalizedBox(bubble) || { top: 0, left: 0, bottom: 100, right: 100 };
    const percent = value => `${value / 10}%`;
    const fontFamily = typeof bubble.font_family === 'string' && bubble.font_family.trim() ? bubble.font_family.trim() : 'Sarabun';
    const textAlign = ['left', 'center', 'right'].includes(bubble.text_align) ? bubble.text_align : 'center';
    const colorValue = typeof bubble.text_color === 'string' ? bubble.text_color.trim() : '';
    const color = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i.test(colorValue) ? colorValue : '#111827';
    return {
      left: percent(box.left),
      top: percent(box.top),
      width: percent(box.right - box.left),
      height: percent(box.bottom - box.top),
      fontFamily,
      textAlign,
      color,
    };
  }

  const api = { findBubbleAtPoint, normalizeInlineShortcut, buildEditorStyle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InlineEditor = api;
})(typeof window !== 'undefined' ? window : globalThis);
