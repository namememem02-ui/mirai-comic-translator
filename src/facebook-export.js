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

  function allocateSliceCounts(heights, maximum) {
    if (!Array.isArray(heights) || heights.length === 0) throw new TypeError('heights must not be empty');
    const normalized = heights.map((height) => {
      requirePositiveFinite(height, 'height');
      return Math.max(1, Math.round(height));
    });
    if (!Number.isInteger(maximum) || maximum <= 0) throw new TypeError('maximum must be a positive integer');
    const target = Math.min(Math.max(normalized.length, maximum), normalized.reduce((a, b) => a + b, 0));
    const counts = normalized.map(() => 1);
    let remaining = target - counts.length;
    while (remaining > 0) {
      const eligible = normalized.map((height, index) => ({ height, index, capacity: height - counts[index] }))
        .filter(item => item.capacity > 0);
      if (!eligible.length) break;
      const totalWeight = eligible.reduce((sum, item) => sum + item.height, 0);
      const ranked = eligible.map(item => ({
        ...item,
        quota: remaining * item.height / totalWeight
      }));
      let assigned = 0;
      for (const item of ranked) {
        const extra = Math.min(item.capacity, Math.floor(item.quota));
        counts[item.index] += extra;
        assigned += extra;
      }
      remaining -= assigned;
      if (remaining <= 0) break;
      ranked.sort((a, b) => (b.quota - Math.floor(b.quota)) - (a.quota - Math.floor(a.quota)) || a.index - b.index);
      let awarded = false;
      for (const item of ranked) {
        if (remaining <= 0) break;
        if (counts[item.index] < item.height) {
          counts[item.index]++;
          remaining--;
          awarded = true;
        }
      }
      if (!awarded) break;
    }
    return counts;
  }

  function getEqualSliceRects(width, height, count) {
    requirePositiveFinite(width, 'width');
    requirePositiveFinite(height, 'height');
    const w = Math.round(width);
    const h = Math.round(height);
    if (!Number.isInteger(count) || count <= 0 || count > h) throw new TypeError('count must fit the pixel height');
    const base = Math.floor(h / count);
    const remainder = h % count;
    const rectangles = [];
    let y = 0;
    for (let index = 0; index < count; index++) {
      const sliceHeight = base + (index < remainder ? 1 : 0);
      rectangles.push({ x: 0, y, width: w, height: sliceHeight });
      y += sliceHeight;
    }
    return rectangles;
  }

  return { getTargetSliceHeight, getSliceRects, formatSliceName, allocateSliceCounts, getEqualSliceRects };
});
