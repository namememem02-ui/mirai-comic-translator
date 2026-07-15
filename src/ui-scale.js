(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.UiScale = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TOKENS = {
    100: { scale: 1, bodyFont: 13, controlFont: 13, explorerWidth: 280, editorWidth: 380 },
    115: { scale: 1.15, bodyFont: 15, controlFont: 14, explorerWidth: 310, editorWidth: 420 },
    130: { scale: 1.3, bodyFont: 17, controlFont: 16, explorerWidth: 340, editorWidth: 460 }
  };

  function normalizeUiScale(value) {
    const numeric = Number(value);
    return Object.hasOwn(TOKENS, numeric) ? numeric : 115;
  }

  function getUiScaleTokens(value) {
    return { ...TOKENS[normalizeUiScale(value)] };
  }

  function applyUiScale(rootElement, value) {
    const normalized = normalizeUiScale(value);
    const tokens = TOKENS[normalized];
    rootElement.dataset.uiScale = String(normalized);
    rootElement.style.setProperty('--ui-scale', String(tokens.scale));
    rootElement.style.setProperty('--ui-body-font', `${tokens.bodyFont}px`);
    rootElement.style.setProperty('--ui-control-font', `${tokens.controlFont}px`);
    rootElement.style.setProperty('--ui-explorer-width', `${tokens.explorerWidth}px`);
    rootElement.style.setProperty('--ui-editor-width', `${tokens.editorWidth}px`);
    return normalized;
  }

  return { normalizeUiScale, getUiScaleTokens, applyUiScale };
});
