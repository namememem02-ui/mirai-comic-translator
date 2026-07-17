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

  const api = { createReviewSession, createTaskQueue, loadReviewTranslations, normalizeReviewSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ReviewController = api;
})(typeof window !== 'undefined' ? window : globalThis);
