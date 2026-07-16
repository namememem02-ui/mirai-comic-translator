(function exposeExportQuality(root) {
  const ISSUE_META = {
    PAGE_UNTRANSLATED: ['warning', 'หน้านี้ยังไม่แปล'],
    EMPTY_TEXT: ['warning', 'กล่องข้อความยังไม่มีคำแปลไทย'],
    INVALID_BOX: ['error', 'กรอบข้อความอยู่นอกภาพหรือมีขนาดไม่ถูกต้อง'],
    TEXT_OVERFLOW: ['error', 'ข้อความไทยล้นกรอบ'],
    GLOSSARY_MISMATCH: ['warning', 'ชื่อเฉพาะไม่ตรงกับ Glossary'],
    INSPECTION_INCOMPLETE: ['warning', 'ตรวจหน้านี้ไม่สมบูรณ์'],
  };

  function issue(code, bubbleId = null, details = {}) {
    const [severity, message] = ISSUE_META[code];
    return { code, severity, bubbleId, message, details };
  }

  function validBox(box) {
    return Array.isArray(box)
      && box.length === 4
      && box.every(Number.isFinite)
      && box[0] >= 0 && box[1] >= 0 && box[2] <= 1000 && box[3] <= 1000
      && box[0] < box[2] && box[1] < box[3];
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createGlossaryMatcher(glossary = {}) {
    return Object.entries(glossary)
      .map(([source, thai]) => [String(source).trim(), String(thai).trim()])
      .filter(([source, thai]) => source && thai)
      .map(([source, thai]) => ({
        source,
        thai,
        regex: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(source)}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
      }));
  }

  function inspectPage(input = {}) {
    const pageName = input.pageName || '';
    const pageIndex = Number.isInteger(input.pageIndex) ? input.pageIndex : 0;
    if (input.excluded) return { pageName, pageIndex, status: 'excluded', issues: [] };
    if (!Array.isArray(input.translation) || input.translation.length === 0) {
      return { pageName, pageIndex, status: 'warning', issues: [issue('PAGE_UNTRANSLATED')] };
    }

    const issues = [];
    const glossary = createGlossaryMatcher(input.glossary);
    for (const bubble of input.translation) {
      const bubbleId = bubble?.bubble_id ?? null;
      if (!validBox(bubble?.box_2d)) issues.push(issue('INVALID_BOX', bubbleId));
      if (bubble?.hidden === true) continue;

      const translated = typeof bubble?.translated_text === 'string' ? bubble.translated_text.trim() : '';
      if (!translated) issues.push(issue('EMPTY_TEXT', bubbleId));
      if (translated && typeof input.measureOverflow === 'function' && input.measureOverflow({ bubble, input })) {
        issues.push(issue('TEXT_OVERFLOW', bubbleId));
      }

      const original = typeof bubble?.original_text === 'string' ? bubble.original_text : '';
      for (const entry of glossary) {
        if (entry.regex.test(original) && !translated.toLocaleLowerCase().includes(entry.thai.toLocaleLowerCase())) {
          issues.push(issue('GLOSSARY_MISMATCH', bubbleId, { source: entry.source, expected: entry.thai }));
        }
      }
    }

    const status = issues.some(item => item.severity === 'error')
      ? 'error'
      : issues.length ? 'warning' : 'pass';
    return { pageName, pageIndex, status, issues };
  }

  function inspectChapter(pages = []) {
    const results = pages.map(inspectPage);
    const summary = { errors: 0, warnings: 0, passed: 0, excluded: 0 };
    for (const result of results) {
      if (result.status === 'error') summary.errors += 1;
      else if (result.status === 'warning') summary.warnings += 1;
      else if (result.status === 'excluded') summary.excluded += 1;
      else summary.passed += 1;
    }
    return { results, summary };
  }

  const api = { createGlossaryMatcher, inspectChapter, inspectPage, validBox };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExportQuality = api;
})(typeof window !== 'undefined' ? window : globalThis);
