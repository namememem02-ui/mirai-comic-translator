(function exposeInpaintMaskGeometry(root) {
  function calculateMaskRect(input = {}) {
    const x = Number(input.x) || 0;
    const y = Number(input.y) || 0;
    const width = Math.max(1, Number(input.width) || 0);
    const height = Math.max(1, Number(input.height) || 0);
    if (input.mode !== 'tight') {
      const padX = Math.max(8, width * 0.04);
      const padY = Math.max(12, height * 0.08);
      return { x: x - padX, y: y - padY, width: width + padX * 2, height: height + padY * 2 };
    }

    const padX = Math.max(2, width * 0.03);
    const padY = Math.max(2, height * 0.03);
    const left = Math.max(0, x - padX);
    const top = Math.max(0, y - padY);
    const right = Math.min(Number(input.imageWidth) || x + width + padX, x + width + padX);
    const bottom = Math.min(Number(input.imageHeight) || y + height + padY, y + height + padY);
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  const api = { calculateMaskRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.InpaintMaskGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis);
