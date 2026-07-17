(function exposeBubbleIssueFilter(root) {
  const FILTERS = new Set(['all', 'overflow', 'near', 'untranslated', 'hidden']);

  function classifyBubble(bubble = {}, warning) {
    if (bubble.hidden) return 'hidden';
    if (warning?.status === 'overflow') return 'overflow';
    if (warning?.status === 'near') return 'near';
    if (!String(bubble.translated_text ?? '').trim()) return 'untranslated';
    return 'ordinary';
  }

  function countBubbleIssues(bubbles = [], warningMap = new Map()) {
    const counts = { all: bubbles.length, overflow: 0, near: 0, untranslated: 0, hidden: 0 };
    bubbles.forEach(bubble => {
      const issue = classifyBubble(bubble, warningMap.get(bubble.bubble_id));
      if (Object.hasOwn(counts, issue)) counts[issue] += 1;
    });
    return counts;
  }

  function matchesBubbleFilter(bubble, warning, filter = 'all') {
    if (!FILTERS.has(filter)) return false;
    return filter === 'all' || classifyBubble(bubble, warning) === filter;
  }

  const api = { classifyBubble, countBubbleIssues, matchesBubbleFilter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BubbleIssueFilter = api;
})(typeof window !== 'undefined' ? window : globalThis);
