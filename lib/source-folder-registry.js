const path = require('node:path');
const { isWithin } = require('./safe-paths');

function createSourceFolderRegistry({ initialRoots = [] } = {}) {
  const roots = new Map();
  const keyFor = value => process.platform === 'win32' ? value.toLowerCase() : value;

  function authorize(root) {
    if (typeof root !== 'string' || !path.isAbsolute(root)) {
      throw new Error('Authorized source root must be absolute');
    }
    const canonical = path.resolve(root);
    const key = keyFor(canonical);
    if (roots.has(key)) return roots.get(key);
    roots.set(key, canonical);
    return canonical;
  }

  function isAuthorized(candidate) {
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
    const resolved = path.resolve(candidate);
    return [...roots.values()].some(root => isWithin(root, resolved));
  }

  function listRoots() {
    return [...roots.values()];
  }

  for (const root of initialRoots) authorize(root);
  return { authorize, isAuthorized, listRoots };
}

module.exports = { createSourceFolderRegistry };
