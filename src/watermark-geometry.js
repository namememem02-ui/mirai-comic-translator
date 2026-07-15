(function exposeWatermarkGeometry(root) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

  function normalizeSettings(value = {}) {
    return {
      enabled: value.enabled === true,
      imageFile: typeof value.imageFile === 'string' ? value.imageFile : '',
      x: clamp(Number.isFinite(Number(value.x)) ? value.x : 0.8, 0, 1),
      y: clamp(Number.isFinite(Number(value.y)) ? value.y : 0.9, 0, 1),
      widthRatio: clamp(Number.isFinite(Number(value.widthRatio)) ? value.widthRatio : 0.15, 0.05, 0.5),
      opacity: clamp(Number.isFinite(Number(value.opacity)) ? value.opacity : 0.35, 0, 1),
    };
  }

  function calculateRect(settings, pageWidth, pageHeight, imageWidth, imageHeight) {
    const normalized = normalizeSettings(settings);
    const width = pageWidth * normalized.widthRatio;
    const height = imageWidth > 0 ? width * (imageHeight / imageWidth) : width;
    return {
      x: Math.round(clamp(normalized.x * pageWidth, 0, Math.max(0, pageWidth - width))),
      y: Math.round(clamp(normalized.y * pageHeight, 0, Math.max(0, pageHeight - height))),
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  function dragToNormalized(pointerX, pointerY, rectWidth, rectHeight, pageWidth, pageHeight) {
    return {
      x: clamp(pointerX, 0, Math.max(0, pageWidth - rectWidth)) / pageWidth,
      y: clamp(pointerY, 0, Math.max(0, pageHeight - rectHeight)) / pageHeight,
    };
  }

  const api = { calculateRect, dragToNormalized, normalizeSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WatermarkGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis);
