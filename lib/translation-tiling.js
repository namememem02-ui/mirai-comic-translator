function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function planTranslationTiles(width, height, options = {}) {
  const pageWidth = positiveNumber(width, 1);
  const pageHeight = positiveNumber(height, 1);
  const maxAspectRatio = positiveNumber(options.maxAspectRatio, 4);
  const coreHeight = Math.max(1, Math.round(pageWidth * positiveNumber(options.coreHeightInWidths, 3)));
  const overlap = Math.max(0, Math.round(pageWidth * positiveNumber(options.overlapInWidths, 0.2)));

  if (pageHeight / pageWidth <= maxAspectRatio) {
    return [{
      cropStart: 0,
      cropEnd: pageHeight,
      coreStart: 0,
      coreEnd: pageHeight,
      width: pageWidth,
      height: pageHeight,
      isFullPage: true,
      isLast: true,
    }];
  }

  const tiles = [];
  for (let coreStart = 0; coreStart < pageHeight; coreStart += coreHeight) {
    const coreEnd = Math.min(pageHeight, coreStart + coreHeight);
    const cropStart = Math.max(0, coreStart - overlap);
    const cropEnd = Math.min(pageHeight, coreEnd + overlap);
    tiles.push({
      cropStart,
      cropEnd,
      coreStart,
      coreEnd,
      width: pageWidth,
      height: cropEnd - cropStart,
      isFullPage: false,
      isLast: coreEnd === pageHeight,
    });
  }
  return tiles;
}

function validBox(box) {
  return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite);
}

function clampNormalized(value) {
  return Math.max(0, Math.min(1000, Math.round(value)));
}

function mergeTileResults(tileEntries = [], width, height) {
  const pageHeight = positiveNumber(height, 1);
  const bubbles = [];
  const discoveredNames = {};
  const seenNames = new Set();

  tileEntries.forEach(({ tile, result }) => {
    Object.entries(result?.discovered_names || {}).forEach(([name, thai]) => {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanThai = typeof thai === 'string' ? thai.trim() : '';
      const key = cleanName.toLocaleLowerCase();
      if (!cleanName || !cleanThai || seenNames.has(key)) return;
      seenNames.add(key);
      discoveredNames[cleanName] = cleanThai;
    });

    (Array.isArray(result?.bubbles) ? result.bubbles : []).forEach(bubble => {
      if (!bubble || !validBox(bubble.box_2d)) return;
      const [localYMin, localXMin, localYMax, localXMax] = bubble.box_2d;
      const centerY = tile.cropStart + (((localYMin + localYMax) / 2) / 1000) * tile.height;
      const ownsCenter = centerY >= tile.coreStart
        && (centerY < tile.coreEnd || (tile.isLast && centerY <= tile.coreEnd));
      if (!ownsCenter) return;

      const fullYMin = tile.cropStart + (localYMin / 1000) * tile.height;
      const fullYMax = tile.cropStart + (localYMax / 1000) * tile.height;
      bubbles.push({
        ...bubble,
        box_2d: [
          clampNormalized((fullYMin / pageHeight) * 1000),
          clampNormalized(localXMin),
          clampNormalized((fullYMax / pageHeight) * 1000),
          clampNormalized(localXMax),
        ],
      });
    });
  });

  bubbles.sort((a, b) => a.box_2d[0] - b.box_2d[0] || a.box_2d[1] - b.box_2d[1]);
  bubbles.forEach((bubble, index) => { bubble.bubble_id = index + 1; });
  return { bubbles, discovered_names: discoveredNames };
}

module.exports = { planTranslationTiles, mergeTileResults };
