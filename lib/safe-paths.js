const path = require('node:path');

const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function validatePathSegment(value, label = 'path segment') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  if (value === '.' || value === '..') throw new Error(`${label} is not allowed`);
  if (/[\\/]/.test(value)) throw new Error(`${label} must not contain path separators`);
  if (/[\x00-\x1f\x7f-\x9f]/.test(value)) throw new Error(`${label} contains control characters`);
  if (/[. ]$/.test(value)) throw new Error(`${label} must not end with a dot or space`);
  if (WINDOWS_DEVICE_NAME.test(value)) throw new Error(`${label} uses a reserved Windows name`);
  return value;
}

function isWithin(root, candidate) {
  if (!path.isAbsolute(root) || !path.isAbsolute(candidate)) return false;
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveWithin(root, ...segments) {
  if (!path.isAbsolute(root)) throw new Error('Filesystem root must be absolute');
  const validated = segments.map((segment, index) => validatePathSegment(segment, `path segment ${index + 1}`));
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...validated);
  if (!isWithin(resolvedRoot, candidate)) throw new Error('Resolved path escapes its allowed root');
  return candidate;
}

function deriveProjectChapter(folderName) {
  try {
    validatePathSegment(folderName, 'folder name');
    const cleanFolder = folderName.trim();
    
    // 1. Underscore or hyphen delimited: "Name_01" or "Name-02"
    const delimMatch = cleanFolder.match(/^(.+?)[_-]([0-9.-]+)$/u);
    if (delimMatch) {
      const p = delimMatch[1].trim();
      const c = delimMatch[2].trim();
      if (p && c) {
        validatePathSegment(p, 'project');
        validatePathSegment(c, 'chapter');
        return { project: p, chapter: c };
      }
    }
    
    // 2. English/Thai chapter keywords: "Name Chapter 01", "Name Ch.02", "Name ตอนที่ 3", "Name ตอน 4", "Name Vol 5"
    const keywordMatch = cleanFolder.match(/^(.+?)\s+(?:chapter|ch\.?|ตอนที่|ตอน|vol\.?|volume)\s*([0-9.-]+)$/ui);
    if (keywordMatch) {
      const p = keywordMatch[1].trim();
      const c = keywordMatch[2].trim();
      if (p && c) {
        validatePathSegment(p, 'project');
        validatePathSegment(c, 'chapter');
        return { project: p, chapter: c };
      }
    }
    
    // 3. Parentheses/brackets suffix: "Name (01)" or "Name [02]"
    const parenMatch = cleanFolder.match(/^(.+?)\s*[\(\[]([0-9.-]+)[\)\]]$/u);
    if (parenMatch) {
      const p = parenMatch[1].trim();
      const c = parenMatch[2].trim();
      if (p && c) {
        validatePathSegment(p, 'project');
        validatePathSegment(c, 'chapter');
        return { project: p, chapter: c };
      }
    }
    
    // 4. Space separated trailing number: "Name 01" or "Name 2"
    const numMatch = cleanFolder.match(/^(.+?)\s+([0-9.-]+)$/u);
    if (numMatch) {
      const p = numMatch[1].trim();
      const c = numMatch[2].trim();
      if (p && c) {
        validatePathSegment(p, 'project');
        validatePathSegment(c, 'chapter');
        return { project: p, chapter: c };
      }
    }

    validatePathSegment(cleanFolder, 'project');
    return { project: cleanFolder, chapter: '01' };
  } catch {
    return { project: 'default', chapter: '01' };
  }
}

module.exports = { validatePathSegment, resolveWithin, isWithin, deriveProjectChapter };
