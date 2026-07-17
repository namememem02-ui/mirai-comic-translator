const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const FORMAT = 'mirai-comictranslator-backup';
const SCHEMA_VERSION = 1;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.jfif']);
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 10000,
  maxFileBytes: 512 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024 * 1024,
  maxCompressionRatio: 200,
});

function validateSegment(value, label) {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}`);
  const name = value.trim();
  if (value !== name || !name || name.length > 200 || name === '.' || name === '..'
    || /[\x00-\x1f\x7f-\x9f\\/:*?"<>|]/.test(name) || /[. ]$/.test(name) || WINDOWS_RESERVED.test(name)) {
    throw new Error(`Invalid ${label}`);
  }
  return name;
}

function validateFilename(value, label = 'filename') {
  const name = validateSegment(value, label);
  if (path.basename(name) !== name) throw new Error(`Invalid ${label}`);
  return name;
}

function sanitizeZipFilename(name) {
  let safe = String(name ?? '').trim().replace(/[\x00-\x1f\\/:*?"<>|]/g, '');
  safe = safe.replace(/[. ]+$/g, '').replace(/(?:\.zip)+$/i, '').replace(/[. ]+$/g, '').trim();
  if (!safe || safe === '.' || safe === '..' || WINDOWS_RESERVED.test(safe)) safe = 'backup';
  return `${safe}.zip`;
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function validateArchivePath(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f\x7f-\x9f]/.test(value)
    || path.posix.isAbsolute(value) || /^[a-z]:[\\/]/i.test(value)
    || path.posix.normalize(value) !== value
    || value.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Invalid archive path: ${value}`);
  }
  return value;
}

function isManagedFile(name, sourceBases) {
  if (/^(?:quality-state\.json|_watermark\.(?:json|png|jpe?g|webp))$/i.test(name)) return true;
  if (/^(?:custom_(?:mask|paint)_.+|.+_custom_(?:mask|paint))\.png$/i.test(name)) return true;
  if (/^page_.*\.json$/i.test(name)) return true;
  if (path.extname(name).toLowerCase() === '.json' && sourceBases.has(path.basename(name, '.json').toLowerCase())) return true;
  return false;
}

function addInventoryFile(files, archivePaths, archivePath, absolutePath) {
  const normalized = archivePath.replace(/\\/g, '/');
  const duplicateKey = normalized.toLowerCase();
  if (archivePaths.has(duplicateKey)) throw new Error(`Duplicate archive path: ${normalized}`);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Unreadable backup file: ${absolutePath}`, { cause: error });
  }
  if (!stat.isFile()) throw new Error(`Unreadable backup file: ${absolutePath}`);
  archivePaths.add(duplicateKey);
  files.push({ archivePath: normalized, absolutePath: path.resolve(absolutePath), size: stat.size });
}

function buildProjectInventory({ project, projectsRoot, projectMap, appVersion }) {
  const projectName = validateSegment(project, 'project');
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) throw new Error('Invalid projects root');
  if (!projectMap || typeof projectMap !== 'object' || Array.isArray(projectMap)) throw new Error('Invalid project map');

  const prefix = `${projectName}/`;
  const registrations = Object.entries(projectMap)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, sourceDirectory]) => ({
      name: validateSegment(key.slice(prefix.length), 'chapter'),
      sourceDirectory,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));
  if (!registrations.length) throw new Error(`No registered chapters for project: ${projectName}`);
  const chapterNames = new Set();
  for (const chapter of registrations) {
    const key = chapter.name.toLowerCase();
    if (chapterNames.has(key)) throw new Error(`Duplicate chapter: ${chapter.name}`);
    chapterNames.add(key);
  }

  const files = [];
  const archivePaths = new Set(['manifest.json']);
  const glossaryCandidates = [
    path.join(projectsRoot, projectName, 'memory.json'),
    path.join(projectsRoot, projectName, 'glossary.json'),
  ];
  const glossary = glossaryCandidates.find(candidate => fs.existsSync(candidate));
  if (glossary) addInventoryFile(files, archivePaths, 'data/glossary.json', glossary);

  const chapters = registrations.map((registration, index) => {
    const id = `chapter-${String(index + 1).padStart(3, '0')}`;
    if (typeof registration.sourceDirectory !== 'string' || !path.isAbsolute(registration.sourceDirectory)) {
      throw new Error(`Invalid source directory for chapter: ${registration.name}`);
    }
    let entries;
    try {
      if (!fs.statSync(registration.sourceDirectory).isDirectory()) throw new Error('not a directory');
      entries = fs.readdirSync(registration.sourceDirectory, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Missing or unreadable source directory for chapter: ${registration.name}`, { cause: error });
    }
    const imageNames = entries.filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(entry => validateFilename(entry.name, 'source image filename')).sort(naturalCompare);
    for (const imageName of imageNames) {
      addInventoryFile(files, archivePaths, `source/${id}/${imageName}`, path.join(registration.sourceDirectory, imageName));
    }

    const sourceBases = new Set(imageNames.map(name => path.basename(name, path.extname(name)).toLowerCase()));
    const managedDirectory = path.join(projectsRoot, projectName, registration.name);
    let managedNames = [];
    if (fs.existsSync(managedDirectory)) {
      const stat = fs.statSync(managedDirectory);
      if (!stat.isDirectory()) throw new Error(`Invalid managed chapter directory: ${registration.name}`);
      managedNames = fs.readdirSync(managedDirectory, { withFileTypes: true })
        .filter(entry => entry.isFile() && isManagedFile(entry.name, sourceBases))
        .map(entry => validateFilename(entry.name, 'managed filename')).sort(naturalCompare);
      for (const managedName of managedNames) {
        addInventoryFile(files, archivePaths, `data/${id}/${managedName}`, path.join(managedDirectory, managedName));
      }
    }
    return { name: registration.name, id, sourceImages: imageNames, managedDataFiles: managedNames };
  });

  return {
    manifest: {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: String(appVersion ?? ''),
      originalProjectName: projectName,
      createdAt: new Date().toISOString(),
      chapters,
      totalImageCount: chapters.reduce((sum, chapter) => sum + chapter.sourceImages.length, 0),
      totalUncompressedBytes: files.reduce((sum, file) => sum + file.size, 0),
    },
    files,
  };
}

async function createProjectBackupBuffer(inventory) {
  if (!inventory || typeof inventory.manifest !== 'object' || !Array.isArray(inventory.files)) {
    throw new Error('Invalid project backup inventory');
  }
  const paths = new Set(['manifest.json']);
  for (const file of inventory.files) {
    if (!file || typeof file.archivePath !== 'string' || typeof file.absolutePath !== 'string') {
      throw new Error('Invalid inventory file');
    }
    validateArchivePath(file.archivePath);
    if (!path.isAbsolute(file.absolutePath)) throw new Error(`Invalid absolute source path: ${file.absolutePath}`);
    const key = file.archivePath.toLowerCase();
    if (paths.has(key)) throw new Error(`Duplicate archive path: ${file.archivePath}`);
    paths.add(key);
  }

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(inventory.manifest, null, 2));
  for (const file of inventory.files) {
    let contents;
    try {
      contents = fs.readFileSync(file.absolutePath);
    } catch (error) {
      throw new Error(`Unreadable backup file: ${file.absolutePath}`, { cause: error });
    }
    zip.file(file.archivePath, contents);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function zipEntryPath(entry) {
  const original = entry.unsafeOriginalName || entry.name;
  validateArchivePath(original.replace(/\/$/, ''));
  if (original.includes('\\') || /^[a-z]:/i.test(original) || /^\/{2}/.test(original)) {
    throw new Error(`Invalid archive path: ${original}`);
  }
  return original.replace(/\/$/, '');
}

function validateManifest(manifest) {
  if (!manifest || manifest.format !== FORMAT) throw new Error('Unsupported backup format');
  if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported schema version');
  validateSegment(manifest.originalProjectName, 'project');
  if (typeof manifest.appVersion !== 'string' || !Array.isArray(manifest.chapters)) throw new Error('Invalid manifest');
  if (!Number.isSafeInteger(manifest.totalImageCount) || manifest.totalImageCount < 0
    || !Number.isSafeInteger(manifest.totalUncompressedBytes) || manifest.totalUncompressedBytes < 0) throw new Error('Invalid manifest counts');
  const names = new Set();
  const ids = new Set();
  const declared = new Map();
  let imageCount = 0;
  for (const chapter of manifest.chapters) {
    if (!chapter || !Array.isArray(chapter.sourceImages) || !Array.isArray(chapter.managedDataFiles)) throw new Error('Invalid chapter');
    const name = validateSegment(chapter.name, 'chapter');
    const id = validateSegment(chapter.id, 'chapter id');
    if (!/^chapter-\d{3,}$/.test(id)) throw new Error('Invalid chapter id');
    if (names.has(name.toLowerCase())) throw new Error(`Duplicate chapter: ${name}`);
    if (ids.has(id.toLowerCase())) throw new Error(`Duplicate chapter id: ${id}`);
    names.add(name.toLowerCase()); ids.add(id.toLowerCase());
    const chapterFiles = new Set();
    for (const filename of chapter.sourceImages) {
      const safe = validateFilename(filename, 'image filename');
      if (!IMAGE_EXTENSIONS.has(path.extname(safe).toLowerCase())) throw new Error(`Invalid image type: ${safe}`);
      if (chapterFiles.has(safe.toLowerCase())) throw new Error(`Duplicate filename: ${safe}`);
      chapterFiles.add(safe.toLowerCase());
      declared.set(`source/${id}/${safe}`.toLowerCase(), { path: `source/${id}/${safe}`, kind: 'image', chapter });
      imageCount += 1;
    }
    const sourceBases = new Set(chapter.sourceImages.map(file => path.basename(file, path.extname(file)).toLowerCase()));
    for (const filename of chapter.managedDataFiles) {
      const safe = validateFilename(filename, 'managed filename');
      if (!isManagedFile(safe, sourceBases)) throw new Error(`Invalid managed data file: ${safe}`);
      if (chapterFiles.has(safe.toLowerCase())) throw new Error(`Duplicate filename: ${safe}`);
      chapterFiles.add(safe.toLowerCase());
      declared.set(`data/${id}/${safe}`.toLowerCase(), { path: `data/${id}/${safe}`, kind: 'managed', chapter });
    }
  }
  if (imageCount !== manifest.totalImageCount) throw new Error('Manifest image count mismatch');
  declared.set('data/glossary.json', { path: 'data/glossary.json', kind: 'glossary' });
  return { declared, imageCount };
}

async function inspectProjectBackup(buffer, limits = {}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) throw new Error('Invalid backup buffer');
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) throw new Error('Invalid limits');
  const knownLimits = new Set(Object.keys(DEFAULT_LIMITS));
  if (Object.keys(limits).some(key => !knownLimits.has(key))) throw new Error('Invalid limit key');
  const bounded = { ...DEFAULT_LIMITS, ...limits };
  for (const key of ['maxEntries', 'maxFileBytes', 'maxTotalBytes']) {
    if (!Number.isSafeInteger(bounded[key]) || bounded[key] < 0) throw new Error(`Invalid limit: ${key}`);
  }
  if (!Number.isFinite(bounded.maxCompressionRatio) || bounded.maxCompressionRatio <= 0) {
    throw new Error('Invalid limit: maxCompressionRatio');
  }
  let zip;
  try { zip = await JSZip.loadAsync(buffer, { createFolders: false }); } catch (error) { throw new Error('Invalid ZIP archive', { cause: error }); }
  const rawEntries = Object.values(zip.files);
  if (rawEntries.length > bounded.maxEntries) throw new Error('Archive exceeds entry limit');
  const seen = new Map();
  const files = [];
  let rawTotal = 0;
  for (const entry of rawEntries) {
    const entryPath = zipEntryPath(entry);
    const key = entryPath.toLowerCase();
    if (seen.has(key)) {
      if (seen.get(key).dir !== entry.dir) throw new Error(`Directory/file conflict: ${entryPath}`);
      throw new Error(`Duplicate archive path: ${entryPath}`);
    }
    for (const previous of seen.keys()) {
      if (key.startsWith(`${previous}/`) || previous.startsWith(`${key}/`)) {
        const other = seen.get(previous);
        if (!entry.dir && !other.dir) throw new Error(`Directory/file conflict: ${entryPath}`);
      }
    }
    const mode = typeof entry.unixPermissions === 'number' ? entry.unixPermissions & 0o170000 : 0;
    if (mode && mode !== 0o100000 && mode !== 0o040000) throw new Error(`Invalid entry type or symlink: ${entryPath}`);
    seen.set(key, entry);
    if (!entry.dir) {
      const data = entry._data || {};
      const size = Number(data.uncompressedSize);
      const compressed = Number(data.compressedSize);
      if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid entry size: ${entryPath}`);
      if (size > bounded.maxFileBytes) throw new Error(`File size limit exceeded: ${entryPath}`);
      rawTotal += size;
      if (rawTotal > bounded.maxTotalBytes) throw new Error('Archive total size limit exceeded');
      if (size > 0 && (!Number.isFinite(compressed) || compressed <= 0 || size / compressed > bounded.maxCompressionRatio)) {
        throw new Error(`Compression ratio limit exceeded: ${entryPath}`);
      }
      files.push({ path: entryPath, entry, size });
    }
  }
  const manifestFile = files.find(item => item.path.toLowerCase() === 'manifest.json');
  if (!manifestFile) throw new Error('Missing manifest.json');
  let manifest;
  try { manifest = JSON.parse(await manifestFile.entry.async('string')); } catch (error) { throw new Error('Invalid manifest JSON', { cause: error }); }
  const { declared, imageCount } = validateManifest(manifest);
  const allowedDirectories = new Set();
  for (const declaration of declared.values()) {
    const segments = declaration.path.split('/');
    segments.pop();
    while (segments.length) {
      allowedDirectories.add(segments.join('/').toLowerCase());
      segments.pop();
    }
  }
  for (const entry of seen.values()) {
    const entryPath = zipEntryPath(entry);
    if (entry.dir && !allowedDirectories.has(entryPath.toLowerCase())) throw new Error(`Unexpected archive entry: ${entryPath}/`);
  }
  const inspectedEntries = [];
  let total = 0;
  for (const item of files) {
    if (item === manifestFile) continue;
    const declaration = declared.get(item.path.toLowerCase());
    if (!declaration) throw new Error(`Unexpected archive entry: ${item.path}`);
    declared.delete(item.path.toLowerCase());
    const size = item.size;
    total += size;
    inspectedEntries.push({ ...item, ...declaration, size });
  }
  declared.delete('data/glossary.json');
  if (declared.size) throw new Error(`Missing declared file: ${declared.values().next().value.path}`);
  if (total !== manifest.totalUncompressedBytes) throw new Error('Manifest byte count mismatch');
  return {
    manifest,
    summary: {
      originalProjectName: manifest.originalProjectName,
      backupVersion: `${manifest.format}/v${manifest.schemaVersion}`,
      schemaVersion: manifest.schemaVersion,
      appVersion: manifest.appVersion,
      chapterCount: manifest.chapters.length,
      imageCount,
      totalUncompressedBytes: total,
    },
    entries: inspectedEntries,
  };
}

function chooseRestoredProjectName(originalName, projectsRoot, projectMap) {
  const original = validateSegment(originalName, 'project');
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) throw new Error('Invalid projects root');
  if (!projectMap || typeof projectMap !== 'object' || Array.isArray(projectMap)) throw new Error('Invalid project map');
  const occupiedMapProjects = new Set(Object.keys(projectMap)
    .map(key => key.split(/[\\/]/, 1)[0].toLowerCase()));
  const occupied = candidate => fs.existsSync(path.join(projectsRoot, candidate))
    || occupiedMapProjects.has(candidate.toLowerCase());
  if (!occupied(original)) return original;
  let suffix = 1;
  while (true) {
    const candidate = `${original}_สำเนา${suffix === 1 ? '' : `_${suffix}`}`;
    if (!occupied(candidate)) return candidate;
    suffix += 1;
  }
}

async function restoreProjectBackup({ inspected, projectsRoot, projectMap, writeProjectMap }) {
  if (!inspected || !inspected.manifest || !Array.isArray(inspected.entries)) throw new Error('Invalid inspected backup');
  if (typeof writeProjectMap !== 'function') throw new Error('Invalid project map writer');
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) throw new Error('Invalid projects root');
  const project = chooseRestoredProjectName(inspected.manifest.originalProjectName, projectsRoot, projectMap);
  fs.mkdirSync(projectsRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(projectsRoot, '.restore-'));
  const stagedProject = path.join(staging, project);
  const finalProject = path.join(projectsRoot, project);
  let finalCreated = false;
  try {
    for (const chapter of inspected.manifest.chapters) {
      fs.mkdirSync(path.join(stagedProject, '_source', chapter.id), { recursive: true });
      fs.mkdirSync(path.join(stagedProject, chapter.name), { recursive: true });
    }
    for (const item of inspected.entries) {
      let relative;
      if (item.kind === 'image') relative = path.join('_source', item.chapter.id, path.basename(item.path));
      else if (item.kind === 'managed') relative = path.join(item.chapter.name, path.basename(item.path));
      else if (item.kind === 'glossary') relative = 'memory.json';
      else throw new Error(`Invalid inspected entry type: ${item.kind}`);
      const destination = path.join(stagedProject, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const contents = await item.entry.async('nodebuffer');
      if (contents.length !== item.size) throw new Error(`Extracted size mismatch: ${item.path}`);
      fs.writeFileSync(destination, contents);
    }
    fs.renameSync(stagedProject, finalProject);
    finalCreated = true;
    fs.rmSync(staging, { recursive: true, force: true });
    const chapterMappings = {};
    for (const chapter of inspected.manifest.chapters) {
      chapterMappings[`${project}/${chapter.name}`] = path.join(finalProject, '_source', chapter.id);
    }
    const nextMap = { ...projectMap, ...chapterMappings };
    await writeProjectMap(nextMap);
    return { project, chapterMappings };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    if (finalCreated) fs.rmSync(finalProject, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  FORMAT,
  SCHEMA_VERSION,
  buildProjectInventory,
  createProjectBackupBuffer,
  sanitizeZipFilename,
  inspectProjectBackup,
  chooseRestoredProjectName,
  restoreProjectBackup,
};
