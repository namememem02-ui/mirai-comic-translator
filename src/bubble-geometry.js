(function exposeBubbleGeometry(root) {
  function resizeBoxFromSouthEast(initialBox, dx, dy, minWidth = 20, minHeight = minWidth) {
    const [ymin, xmin, ymax, xmax] = initialBox;
    const nextXmax = Math.max(xmin + minWidth, Math.min(1000, xmax + dx));
    const nextYmax = Math.max(ymin + minHeight, Math.min(1000, ymax + dy));
    return [ymin, xmin, Math.round(nextYmax), Math.round(nextXmax)];
  }

  function screenPixelsToSvgUnits(pixelSize, overlayWidth, overlayHeight) {
    return {
      x: overlayWidth > 0 ? (pixelSize * 1000) / overlayWidth : pixelSize,
      y: overlayHeight > 0 ? (pixelSize * 1000) / overlayHeight : pixelSize,
    };
  }

  function calculateFitScale(imageWidth, imageHeight, availableWidth, availableHeight, mode) {
    if (imageWidth <= 0 || imageHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
      return 1;
    }

    const widthScale = availableWidth / imageWidth;
    return mode === 'fit-page'
      ? Math.min(widthScale, availableHeight / imageHeight)
      : widthScale;
  }

  const api = { calculateFitScale, resizeBoxFromSouthEast, screenPixelsToSvgUnits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BubbleGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis);
