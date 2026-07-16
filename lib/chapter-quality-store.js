const path = require('node:path');
const { readJsonWithRecovery, writeJsonAtomic } = require('./atomic-json');

function safeSegment(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '.' || text === '..' || /[\\/:*?"<>|]/.test(text)) {
    throw new Error('Unsafe project or chapter path segment');
  }
  return text;
}

function normalizePageNames(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => path.basename(String(value ?? '').trim()))
    .filter(Boolean))];
}

function createChapterQualityStore(projectsRoot) {
  function filePath(project, chapter) {
    return path.join(projectsRoot, safeSegment(project), safeSegment(chapter), 'quality-state.json');
  }

  function normalize(data, pageNames) {
    const allowed = new Set(normalizePageNames(pageNames));
    return {
      schemaVersion: 1,
      excludedPages: normalizePageNames(data?.excludedPages).filter(name => allowed.has(name)),
    };
  }

  function load(project, chapter, pageNames) {
    return normalize(readJsonWithRecovery(filePath(project, chapter), {}), pageNames);
  }

  function save(project, chapter, pageNames, excludedPages) {
    const value = normalize({ excludedPages }, pageNames);
    writeJsonAtomic(filePath(project, chapter), value);
    return value;
  }

  return { load, save };
}

module.exports = { createChapterQualityStore, normalizePageNames, safeSegment };
