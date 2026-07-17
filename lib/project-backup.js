const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const FORMAT = 'mirai-comictranslator-backup';
const SCHEMA_VERSION = 1;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.jfif']);
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function validateSegment(value, label) {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}`);
  const name = value.trim();
  if (!name || name.length > 200 || name === '.' || name === '..'
    || /[\x00-\x1f\\/:*?"<>|]/.test(name) || /[. ]$/.test(name) || WINDOWS_RESERVED.test(name)) {
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
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value)
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

module.exports = {
  FORMAT,
  SCHEMA_VERSION,
  buildProjectInventory,
  createProjectBackupBuffer,
  sanitizeZipFilename,
};
