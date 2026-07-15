(function exposeRenderGuard(root) {
  function createRenderGuard() {
    let generation = 0;
    let latest = null;

    return {
      begin(pageKey) {
        latest = Object.freeze({ generation: ++generation, pageKey });
        return latest;
      },
      isCurrent(token) {
        return Boolean(
          token
          && latest
          && token.generation === latest.generation
          && token.pageKey === latest.pageKey
        );
      },
      current() {
        return latest;
      },
    };
  }

  const api = { createRenderGuard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RenderGuard = api;
})(typeof window !== 'undefined' ? window : globalThis);
