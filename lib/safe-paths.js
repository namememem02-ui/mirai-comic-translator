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
    const match = folderName.match(/^(.+)_([0-9.-]+)$/u);
    if (match) {
      validatePathSegment(match[1], 'project');
      validatePathSegment(match[2], 'chapter');
      return { project: match[1], chapter: match[2] };
    }
    return { project: folderName, chapter: '01' };
  } catch {
    return { project: 'default', chapter: '01' };
  }
}

module.exports = { validatePathSegment, resolveWithin, isWithin, deriveProjectChapter };
