(function exposeExportQualityController(root) {
  function create(dependencies = {}) {
    let token = 0;
    async function goToIssue(issue = {}) {
      const current = ++token;
      await dependencies.selectPage?.(issue.pageIndex);
      await dependencies.waitForPage?.(issue.pageIndex);
      if (current !== token || issue.bubbleId === null || issue.bubbleId === undefined) return;
      const found = dependencies.selectBubble?.(issue.bubbleId);
      if (!found) {
        dependencies.notify?.('ไม่พบกล่องข้อความนี้แล้ว อาจถูกลบหลังการตรวจ');
        return;
      }
      dependencies.revealBubble?.(issue.bubbleId);
    }
    return { goToIssue };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportQualityController = api;
})(typeof window !== 'undefined' ? window : globalThis);
