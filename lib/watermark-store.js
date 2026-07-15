const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, readJsonWithRecovery } = require('./atomic-json');
const { normalizeSettings } = require('../src/watermark-geometry');

const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function safeSegment(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\\/]/.test(value) || /^\.+$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value.trim();
}

function createWatermarkStore(projectsRoot) {
  function chapterDir(project, chapter) {
    return path.join(projectsRoot, safeSegment(project, 'project'), safeSegment(chapter, 'chapter'));
  }

  function settingsPath(project, chapter) {
    return path.join(chapterDir(project, chapter), '_watermark.json');
  }

  function removeManagedAssets(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      if (/^_watermark\.(png|jpe?g|webp)$/i.test(file)) fs.unlinkSync(path.join(dir, file));
    });
  }

  function load(project, chapter) {
    const dir = chapterDir(project, chapter);
    const settings = normalizeSettings(readJsonWithRecovery(settingsPath(project, chapter), {}));
    const absolutePath = settings.imageFile ? path.join(dir, path.basename(settings.imageFile)) : '';
    const exists = Boolean(absolutePath && fs.existsSync(absolutePath));
    return { settings, exists, absolutePath: exists ? absolutePath : '' };
  }

  function saveSettings(project, chapter, value) {
    const dir = chapterDir(project, chapter);
    fs.mkdirSync(dir, { recursive: true });
    const current = load(project, chapter).settings;
    const settings = normalizeSettings({ ...current, ...value, imageFile: current.imageFile || value.imageFile });
    writeJsonAtomic(settingsPath(project, chapter), settings);
    return settings;
  }

  function importAsset(project, chapter, sourcePath) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!EXTENSIONS.has(ext)) throw new Error('รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP');
    if (!fs.existsSync(sourcePath)) throw new Error('ไม่พบไฟล์ลายน้ำ');
    const dir = chapterDir(project, chapter);
    fs.mkdirSync(dir, { recursive: true });
    removeManagedAssets(dir);
    const imageFile = `_watermark${ext}`;
    const absolutePath = path.join(dir, imageFile);
    fs.copyFileSync(sourcePath, absolutePath);
    const previous = load(project, chapter).settings;
    const settings = normalizeSettings({ ...previous, enabled: true, imageFile });
    writeJsonAtomic(settingsPath(project, chapter), settings);
    return { settings, exists: true, absolutePath };
  }

  function remove(project, chapter) {
    const dir = chapterDir(project, chapter);
    removeManagedAssets(dir);
    const file = settingsPath(project, chapter);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  }

  return { importAsset, load, remove, saveSettings };
}

module.exports = { createWatermarkStore };
