const fs = require('node:fs');
const path = require('node:path');

function writeAndSync(filePath, content) {
  const handle = fs.openSync(filePath, 'w');
  try {
    fs.writeFileSync(handle, content, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function replaceFromContent(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeAndSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const content = `${JSON.stringify(value, null, 2)}\n`;
  JSON.parse(content);

  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    JSON.parse(current);
    replaceFromContent(`${filePath}.bak`, current);
  }

  replaceFromContent(filePath, content);
}

function readJsonWithRecovery(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    try {
      const backupContent = fs.readFileSync(`${filePath}.bak`, 'utf8');
      const recovered = JSON.parse(backupContent);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      replaceFromContent(filePath, `${JSON.stringify(recovered, null, 2)}\n`);
      return recovered;
    } catch {
      return fallback;
    }
  }
}

module.exports = { readJsonWithRecovery, writeJsonAtomic };
