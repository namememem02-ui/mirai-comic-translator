(function exposeBubbleGeometry(root) {
  function resizeBoxFromSouthEast(initialBox, dx, dy, minSize = 20) {
    const [ymin, xmin, ymax, xmax] = initialBox;
    const nextXmax = Math.max(xmin + minSize, Math.min(1000, xmax + dx));
    const nextYmax = Math.max(ymin + minSize, Math.min(1000, ymax + dy));
    return [ymin, xmin, Math.round(nextYmax), Math.round(nextXmax)];
  }

  function screenPixelsToSvgUnits(pixelSize, overlayWidth, overlayHeight) {
    return {
      x: overlayWidth > 0 ? (pixelSize * 1000) / overlayWidth : pixelSize,
      y: overlayHeight > 0 ? (pixelSize * 1000) / overlayHeight : pixelSize,
    };
  }

  const api = { resizeBoxFromSouthEast, screenPixelsToSvgUnits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BubbleGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis);
