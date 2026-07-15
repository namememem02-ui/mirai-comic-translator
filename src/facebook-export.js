(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FacebookExport = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function requirePositiveFinite(value, label) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`${label} must be a positive finite number`);
    }
  }

  function getTargetSliceHeight(width) {
    requirePositiveFinite(width, 'width');
    return Math.round(width * 1.25);
  }

  function getSliceRects(width, height) {
    requirePositiveFinite(width, 'width');
    requirePositiveFinite(height, 'height');
    const normalizedWidth = Math.round(width);
    const normalizedHeight = Math.round(height);
    const targetHeight = getTargetSliceHeight(normalizedWidth);
    const slices = [];
    for (let y = 0; y < normalizedHeight; y += targetHeight) {
      slices.push({
        x: 0,
        y,
        width: normalizedWidth,
        height: Math.min(targetHeight, normalizedHeight - y)
      });
    }
    return slices;
  }

  function formatSliceName(sequence) {
    if (!Number.isInteger(sequence) || sequence <= 0) {
      throw new TypeError('sequence must be a positive integer');
    }
    return `${String(sequence).padStart(3, '0')}.jpg`;
  }

  return { getTargetSliceHeight, getSliceRects, formatSliceName };
});
