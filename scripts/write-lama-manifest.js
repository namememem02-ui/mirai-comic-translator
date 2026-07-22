const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function buildManifest(zipPath, options = {}) {
  const version = options.version || '1.0.0';
  const repo = options.repo || 'namememem02-ui/mirai-comic-translator';
  const baseUrl = options.baseUrl || `https://github.com/${repo}/releases/download/components-v${version}`;

  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP file not found: ${zipPath}`);
  }

  const stat = fs.statSync(zipPath);
  const buffer = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const zipName = path.basename(zipPath);
  const downloadUrl = `${baseUrl}/${zipName}`;

  const manifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    packages: [
      {
        backend: 'cpu',
        version: version,
        url: downloadUrl,
        sha256: sha256,
        size: stat.size,
        minAppVersion: '0.1.0',
      },
    ],
  };

  return manifest;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const zipPath = args[0] || path.join(__dirname, '..', 'artifacts', 'components', 'lama-cpu-win-x64-v1.0.0.zip');
  const manifestPath = path.join(path.dirname(zipPath), 'lama-components.json');

  try {
    const manifest = buildManifest(zipPath);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`[+] Created manifest at ${manifestPath}`);
  } catch (err) {
    console.error(`[-] Failed to write manifest: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { buildManifest };
