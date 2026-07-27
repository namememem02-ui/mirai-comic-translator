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
  const candidateBubbles = [];
  const discoveredNames = {};
  const seenNames = new Set();

  tileEntries.forEach(({ tile, result }) => {
    // 1. Gather names
    const rawNames = (result && typeof result === 'object' && !Array.isArray(result)) 
      ? (result.discovered_names || result.discoveredNames || {}) 
      : {};
      
    Object.entries(rawNames).forEach(([name, thai]) => {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanThai = typeof thai === 'string' ? thai.trim() : '';
      const key = cleanName.toLocaleLowerCase();
      if (!cleanName || !cleanThai || seenNames.has(key)) return;
      seenNames.add(key);
      discoveredNames[cleanName] = cleanThai;
    });

    // 2. Gather bubbles and remap coordinates
    const bubblesArray = Array.isArray(result) 
      ? result 
      : (result?.bubbles || []);

    bubblesArray.forEach(bubble => {
      if (!bubble || !validBox(bubble.box_2d)) return;
      const [localYMin, localXMin, localYMax, localXMax] = bubble.box_2d;
      
      const centerY = tile.cropStart + (((localYMin + localYMax) / 2) / 1000) * tile.height;
      const ownsCenter = centerY >= tile.coreStart
        && (centerY < tile.coreEnd || (tile.isLast && centerY <= tile.coreEnd));

      const fullYMin = tile.cropStart + (localYMin / 1000) * tile.height;
      const fullYMax = tile.cropStart + (localYMax / 1000) * tile.height;
      
      const remappedBox = [
        clampNormalized((fullYMin / pageHeight) * 1000),
        clampNormalized(localXMin),
        clampNormalized((fullYMax / pageHeight) * 1000),
        clampNormalized(localXMax),
      ];

      candidateBubbles.push({
        bubble,
        box_2d: remappedBox,
        tile,
        ownsCenter,
      });
    });
  });

  // 3. Deduplicate candidate bubbles using Intersection over Union (IoU)
  const mergedBubbles = [];

  function getIoU(boxA, boxB) {
    const [yMinA, xMinA, yMaxA, xMaxA] = boxA;
    const [yMinB, xMinB, yMaxB, xMaxB] = boxB;

    const yMinIntersect = Math.max(yMinA, yMinB);
    const xMinIntersect = Math.max(xMinA, xMinB);
    const yMaxIntersect = Math.min(yMaxA, yMaxB);
    const xMaxIntersect = Math.min(xMaxA, xMaxB);

    if (yMinIntersect >= yMaxIntersect || xMinIntersect >= xMaxIntersect) {
      return 0;
    }

    const intersectArea = (yMaxIntersect - yMinIntersect) * (xMaxIntersect - xMinIntersect);
    const areaA = (yMaxA - yMinA) * (xMaxA - xMinA);
    const areaB = (yMaxB - yMinB) * (xMaxB - xMinB);

    const unionArea = areaA + areaB - intersectArea;
    const iou = unionArea > 0 ? (intersectArea / unionArea) : 0;

    // Intersection over minimum area (handles complete nesting/containment)
    const minArea = Math.min(areaA, areaB);
    const containment = minArea > 0 ? (intersectArea / minArea) : 0;

    return Math.max(iou, containment);
  }

  // Sort candidate bubbles from top to bottom
  candidateBubbles.sort((a, b) => a.box_2d[0] - b.box_2d[0] || a.box_2d[1] - b.box_2d[1]);

  candidateBubbles.forEach(candidate => {
    let duplicateIndex = -1;
    for (let i = 0; i < mergedBubbles.length; i++) {
      if (getIoU(candidate.box_2d, mergedBubbles[i]._temp_box_2d) > 0.45) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex === -1) {
      // Add new bubble candidate
      mergedBubbles.push({
        ...candidate.bubble,
        box_2d: candidate.box_2d,
        _temp_box_2d: candidate.box_2d,
        _temp_owns_center: candidate.ownsCenter,
      });
    } else {
      const existing = mergedBubbles[duplicateIndex];
      
      // Determine if candidate is preferred over existing:
      // 1. If candidate belongs to its tile core but existing does not, prefer candidate
      // 2. If existing belongs to its tile core but candidate does not, keep existing
      // 3. Otherwise, fall back to comparing text length (longer text = less likely cropped)
      let preferCandidate = false;
      if (candidate.ownsCenter && !existing._temp_owns_center) {
        preferCandidate = true;
      } else if (!candidate.ownsCenter && existing._temp_owns_center) {
        preferCandidate = false;
      } else {
        const textLenExisting = (existing.original_text || '').length;
        const textLenCandidate = (candidate.bubble.original_text || '').length;
        if (textLenCandidate > textLenExisting) {
          preferCandidate = true;
        } else if (textLenCandidate === textLenExisting) {
          const areaExisting = (existing.box_2d[2] - existing.box_2d[0]) * (existing.box_2d[3] - existing.box_2d[1]);
          const areaCandidate = (candidate.box_2d[2] - candidate.box_2d[0]) * (candidate.box_2d[3] - candidate.box_2d[1]);
          if (areaCandidate > areaExisting) {
            preferCandidate = true;
          }
        }
      }

      if (preferCandidate) {
        mergedBubbles[duplicateIndex] = {
          ...candidate.bubble,
          box_2d: candidate.box_2d,
          _temp_box_2d: candidate.box_2d,
          _temp_owns_center: candidate.ownsCenter,
        };
      }
    }
  });

  // Clean up temp variables, sort, and assign final bubble_id
  mergedBubbles.forEach(b => {
    delete b._temp_box_2d;
    delete b._temp_owns_center;
  });

  mergedBubbles.sort((a, b) => a.box_2d[0] - b.box_2d[0] || a.box_2d[1] - b.box_2d[1]);
  mergedBubbles.forEach((bubble, index) => {
    bubble.bubble_id = index + 1;
  });

  return { bubbles: mergedBubbles, discovered_names: discoveredNames };
}

module.exports = { planTranslationTiles, mergeTileResults };
