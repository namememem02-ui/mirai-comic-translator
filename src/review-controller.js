(function exposeReviewController(root) {
  function normalizeReviewSettings(value = {}) {
    const allowedWidths = new Set(['50', '75', '100', 'fit']);
    return {
      width: allowedWidths.has(value.width) ? value.width : 'fit',
      showNames: Boolean(value.showNames),
      showBoundaries: Boolean(value.showBoundaries),
    };
  }

  function createReviewSession() {
    let generation = 0;
    let current = null;
    return {
      begin() {
        current = Object.freeze({ generation: ++generation });
        return current;
      },
      close() {
        generation += 1;
        current = null;
      },
      isCurrent(token) {
        return Boolean(current && token && current.generation === token.generation);
      },
    };
  }

  function createTaskQueue(limit = 2) {
    const pending = [];
    let active = 0;
    function drain() {
      while (active < limit && pending.length > 0) {
        const item = pending.shift();
        active += 1;
        Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(() => {
          active -= 1;
          drain();
        });
      }
    }
    return {
      add(task) {
        return new Promise((resolve, reject) => {
          pending.push({ task, resolve, reject });
          drain();
        });
      },
      clear() {
        pending.splice(0).forEach(item => item.reject(new Error('Queue cleared')));
      },
    };
  }

  async function loadReviewTranslations(images, loadTranslation) {
    const translations = new Map();
    await Promise.all(images.map(async (image, index) => {
      try {
        const data = await loadTranslation(image, index);
        translations.set(index, Array.isArray(data) ? data : []);
      } catch (error) {
        translations.set(index, []);
      }
    }));
    return translations;
  }

  function calculateReviewPreviewSize(width, height, maxWidth = 1600) {
    const sourceWidth = Math.max(1, Math.round(Number(width) || 1));
    const sourceHeight = Math.max(1, Math.round(Number(height) || 1));
    const limit = Math.max(1, Math.round(Number(maxWidth) || 1600));
    if (sourceWidth <= limit) return { width: sourceWidth, height: sourceHeight };
    return {
      width: limit,
      height: Math.max(1, Math.round(sourceHeight * (limit / sourceWidth))),
    };
  }

  function getReviewProgress(selectedIndices, cache, finishedIndices) {
    const selected = Array.from(selectedIndices || []);
    const max = selected.length;
    if (!max) return { value: 0, max: 0, label: 'ไม่มีหน้าที่เลือก', complete: true };
    const value = selected.filter(index => cache?.has(index) || finishedIndices?.has(index)).length;
    const complete = value >= max;
    return {
      value,
      max,
      label: complete ? `พร้อมรีวิว ${max}/${max} หน้า` : `กำลังเตรียมภาพแปล ${value}/${max} หน้า`,
      complete,
    };
  }

  const api = {
    calculateReviewPreviewSize,
    createReviewSession,
    createTaskQueue,
    getReviewProgress,
    loadReviewTranslations,
    normalizeReviewSettings,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReviewController = api;
})(typeof window !== 'undefined' ? window : globalThis);
