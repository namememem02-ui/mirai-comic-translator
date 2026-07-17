const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');

test('bubble issue toolbar exposes five single-select filters and navigation', () => {
  assert.match(html, /id="bubbleIssueFilters"/);
  for (const filter of ['all', 'overflow', 'near', 'untranslated', 'hidden']) {
    assert.match(html, new RegExp(`data-filter="${filter}"`));
    assert.match(html, new RegExp(`data-filter-count="${filter}"`));
  }
  assert.match(html, /id="bubbleFilterPrevious"/);
  assert.match(html, /id="bubbleFilterNext"/);
  assert.match(html, /id="bubbleFilterEmpty"/);
  assert.match(css, /\.bubble-issue-filters/);
});

test('renderer combines issue filtering with existing text search', () => {
  assert.match(indexSource, /let activeBubbleIssueFilter = 'all'/);
  assert.match(indexSource, /function applyBubbleListFilters\(\)/);
  assert.match(indexSource, /matchesBubbleFilter\(bubble, warning, activeBubbleIssueFilter\)/);
  assert.match(indexSource, /haystack\.includes\(query\)/);
});

test('counts refresh from live warnings and navigation wraps visible results', () => {
  assert.match(indexSource, /function refreshBubbleIssueFilters\(\)/);
  assert.match(indexSource, /countBubbleIssues\(activePageTranslation, liveOverflowWarnings\)/);
  assert.match(indexSource, /function navigateBubbleFilterResult\(direction\)/);
  assert.match(indexSource, /\(currentIndex \+ direction \+ visibleIds\.length\) % visibleIds\.length/);
  assert.match(indexSource, /function updateLiveOverflowWarning[\s\S]{0,1200}refreshBubbleIssueFilters\(\)/);
});

test('filter state stays transient and never becomes a bubble field', () => {
  assert.doesNotMatch(indexSource, /bubble\.(?:issueFilter|issue_filter|filterStatus)/);
});
