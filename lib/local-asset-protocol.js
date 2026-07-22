const { isWithin } = require('./safe-paths');

const DEFAULT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.jfif'];
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function createLocalAssetProtocol({
  path,
  allowedRoots,
  allowedExtensions = DEFAULT_EXTENSIONS,
}) {
  if (!path || typeof path.resolve !== 'function') throw new Error('A path implementation is required');
  if (typeof allowedRoots !== 'function') throw new Error('allowedRoots must be a function');

  const extensions = new Set(allowedExtensions.map((extension) => extension.toLowerCase()));

  function validateAssetPath(candidate) {
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
      throw new Error('Local asset path must be absolute');
    }

    const resolved = path.resolve(candidate);
    if (!extensions.has(path.extname(resolved).toLowerCase())) {
      throw new Error('Local asset extension is not allowed');
    }

    const roots = allowedRoots();
    if (!Array.isArray(roots) || !roots.some((root) => isWithin(path.resolve(root), resolved))) {
      throw new Error('Local asset path is outside an authorized root');
    }
    return resolved;
  }

  function urlForPath(candidate) {
    const resolved = validateAssetPath(candidate);
    return `mirai-asset://local/${Buffer.from(resolved, 'utf8').toString('base64url')}`;
  }

  function resolveRequestUrl(requestUrl) {
    let parsed;
    try {
      parsed = new URL(requestUrl);
    } catch {
      throw new Error('Malformed local asset URL');
    }
    if (parsed.protocol !== 'mirai-asset:' || parsed.hostname !== 'local') {
      throw new Error('Invalid local asset URL origin');
    }

    const payload = parsed.pathname.slice(1);
    if (!payload || parsed.pathname.indexOf('/', 1) !== -1 || !BASE64URL.test(payload)) {
      throw new Error('Invalid local asset URL payload');
    }

    let decoded;
    try {
      decoded = Buffer.from(payload, 'base64url').toString('utf8');
    } catch {
      throw new Error('Invalid local asset URL payload');
    }
    if (!decoded || Buffer.from(decoded, 'utf8').toString('base64url') !== payload) {
      throw new Error('Invalid local asset URL payload');
    }
    return validateAssetPath(decoded);
  }

  return { urlForPath, resolveRequestUrl };
}

module.exports = { createLocalAssetProtocol };
