const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');

const {
  buildProjectInventory,
  createProjectBackupBuffer,
  sanitizeZipFilename,
  inspectProjectBackup,
  chooseRestoredProjectName,
  restoreProjectBackup,
} = require('../lib/project-backup');

async function archive(manifest, files = {}, options = {}) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest));
  for (const [name, value] of Object.entries(files)) zip.file(name, value, options[name] || {});
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' });
}

function validManifest(overrides = {}) {
  return {
    format: 'mirai-comictranslator-backup', schemaVersion: 1, appVersion: '0.1.0',
    originalProjectName: 'Comic', createdAt: new Date().toISOString(),
    chapters: [{ name: 'Chapter 1', id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: ['page_1.json'] }],
    totalImageCount: 1, totalUncompressedBytes: 5,
    ...overrides,
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-backup-'));
  const projectsRoot = path.join(root, 'projects');
  const source1 = path.join(root, 'source-1');
  const source2 = path.join(root, 'source-2');
  fs.mkdirSync(path.join(projectsRoot, 'A', '1'), { recursive: true });
  fs.mkdirSync(path.join(projectsRoot, 'A', '2'), { recursive: true });
  fs.mkdirSync(source1);
  fs.mkdirSync(source2);
  fs.writeFileSync(path.join(source1, '10.webp'), 'ten');
  fs.writeFileSync(path.join(source1, '2.JPG'), 'two');
  fs.writeFileSync(path.join(source1, 'ignore.txt'), 'no');
  fs.writeFileSync(path.join(source2, '001.jfif'), 'one');
  fs.writeFileSync(path.join(projectsRoot, 'A', 'memory.json'), '{"hero":"ฮีโร่"}');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', 'page_001.json'), '[]');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', '001_custom_mask.png'), 'mask');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', 'custom_paint_001.png'), 'paint');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', '_watermark.json'), '{}');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', '_watermark.png'), 'wm');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', 'quality-state.json'), '{}');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', 'page_001.json.bak'), 'no');
  fs.writeFileSync(path.join(projectsRoot, 'A', '1', 'export.png'), 'no');
  return {
    root,
    projectsRoot,
    projectMap: { 'A/2': source2, 'Other/1': source1, 'A/1': source1 },
  };
}

test('inventory includes every mapped chapter source and managed file in stable order', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

  const inventory = buildProjectInventory({
    project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  });

  assert.equal(inventory.manifest.format, 'mirai-comictranslator-backup');
  assert.equal(inventory.manifest.schemaVersion, 1);
  assert.equal(inventory.manifest.appVersion, '0.1.0');
  assert.equal(inventory.manifest.originalProjectName, 'A');
  assert.deepEqual(inventory.manifest.chapters.map(c => [c.name, c.id]), [
    ['1', 'chapter-001'], ['2', 'chapter-002'],
  ]);
  assert.deepEqual(inventory.manifest.chapters[0].sourceImages, ['2.JPG', '10.webp']);
  assert.ok(inventory.files.some(file => file.archivePath === 'data/glossary.json'));
  assert.ok(inventory.files.some(file => file.archivePath === 'source/chapter-001/2.JPG'));
  assert.ok(inventory.files.some(file => file.archivePath === 'data/chapter-001/001_custom_mask.png'));
  assert.ok(inventory.files.some(file => file.archivePath === 'data/chapter-001/custom_paint_001.png'));
  assert.ok(!inventory.files.some(file => /(?:\.bak|\.tmp|export\.png)$/i.test(file.archivePath)));
  assert.equal(inventory.manifest.totalImageCount, 3);
  assert.equal(inventory.manifest.totalUncompressedBytes,
    inventory.files.reduce((sum, file) => sum + file.size, 0));
});

test('archive contains a matching manifest and every inventoried file', async t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const inventory = buildProjectInventory({
    project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  });

  const buffer = await createProjectBackupBuffer(inventory);
  const zip = await JSZip.loadAsync(buffer);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.deepEqual(manifest, inventory.manifest);
  for (const file of inventory.files) assert.ok(zip.file(file.archivePath), file.archivePath);
});

test('missing registered source directory aborts backup', t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  f.projectMap['A/1'] = path.join(f.root, 'missing');
  assert.throws(() => buildProjectInventory({
    project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  }), /source directory/i);
});

test('unsafe names and duplicate archive paths are rejected', async t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  assert.throws(() => buildProjectInventory({
    project: '../A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  }), /invalid project/i);
  const inventory = buildProjectInventory({
    project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  });
  inventory.files.push({ ...inventory.files[0] });
  await assert.rejects(createProjectBackupBuffer(inventory), /duplicate archive path/i);
});

test('archive creation rejects unsafe or non-normalized inventory paths before reading files', async t => {
  const f = fixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const build = () => buildProjectInventory({
    project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0',
  });

  for (const archivePath of [
    '../escape.jpg',
    '/absolute.jpg',
    'C:\\absolute.jpg',
    'source\\chapter-001\\2.JPG',
    'source/chapter-001/../2.JPG',
    'source//chapter-001/2.JPG',
    './source/chapter-001/2.JPG',
  ]) {
    const inventory = build();
    inventory.files[0].archivePath = archivePath;
    await assert.rejects(createProjectBackupBuffer(inventory), /invalid archive path/i, archivePath);
  }

  const inventory = build();
  inventory.files[0].absolutePath = path.relative(process.cwd(), inventory.files[0].absolutePath);
  await assert.rejects(createProjectBackupBuffer(inventory), /absolute source path/i);
});

test('ZIP filename is Windows-safe and always has one zip extension', () => {
  assert.equal(sanitizeZipFilename(' A:*? '), 'A.zip');
  assert.equal(sanitizeZipFilename('comic.zip.zip'), 'comic.zip');
  assert.equal(sanitizeZipFilename('comic.zip. '), 'comic.zip');
  assert.equal(sanitizeZipFilename('...   '), 'backup.zip');
  assert.equal(sanitizeZipFilename('CON'), 'backup.zip');
});

test('inspection accepts a valid archive and returns bounded summary and entries', async () => {
  const manifest = validManifest();
  const inspected = await inspectProjectBackup(await archive(manifest, {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
  }));
  assert.equal(inspected.summary.originalProjectName, 'Comic');
  assert.equal(inspected.summary.backupVersion, 'mirai-comictranslator-backup/v1');
  assert.equal(inspected.summary.chapterCount, 1);
  assert.equal(inspected.summary.imageCount, 1);
  assert.equal(inspected.summary.totalUncompressedBytes, 5);
  assert.deepEqual(inspected.entries.map(entry => entry.path).sort(), ['data/chapter-001/page_1.json', 'source/chapter-001/1.png']);
});

test('inspection rejects unsafe, undeclared, duplicate and conflicting paths', async () => {
  const manifest = validManifest();
  for (const bad of ['../x', '/x', 'C:/x', '\\\\server/share', 'source\\chapter-001\\1.png', 'source//x']) {
    await assert.rejects(inspectProjectBackup(await archive(manifest, { [bad]: 'x' })), /archive path|unexpected|invalid/i, bad);
  }
  await assert.rejects(inspectProjectBackup(await archive(manifest, {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}', 'extra.txt': 'x',
  })), /unexpected/i);
  const duplicateZip = new JSZip();
  duplicateZip.file('manifest.json', JSON.stringify(manifest));
  duplicateZip.file('source/chapter-001/1.png', 'a');
  duplicateZip.file('SOURCE/chapter-001/1.png', 'b');
  duplicateZip.file('data/chapter-001/page_1.json', '{}');
  await assert.rejects(inspectProjectBackup(await duplicateZip.generateAsync({ type: 'nodebuffer' })), /duplicate/i);
  const conflict = validManifest({ chapters: [{ name: 'C', id: 'chapter-001', sourceImages: ['x'], managedDataFiles: [] }], totalImageCount: 1, totalUncompressedBytes: 1 });
  const conflictZip = new JSZip();
  conflictZip.file('manifest.json', JSON.stringify(conflict));
  conflictZip.file('source/chapter-001', 'x');
  conflictZip.file('source/chapter-001/x', 'x');
  await assert.rejects(inspectProjectBackup(await conflictZip.generateAsync({ type: 'nodebuffer' })), /conflict|unexpected/i);
});

test('inspection rejects format, schema, missing declarations and invalid names/types', async () => {
  for (const overrides of [{ format: 'other' }, { schemaVersion: 2 }]) {
    await assert.rejects(inspectProjectBackup(await archive(validManifest(overrides), {})), /format|schema/i);
  }
  await assert.rejects(inspectProjectBackup(await archive(validManifest(), { 'source/chapter-001/1.png': 'img' })), /missing/i);
  for (const chapters of [
    [{ name: '../bad', id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: [] }],
    [{ name: 'C', id: 'chapter-001', sourceImages: ['1.exe'], managedDataFiles: [] }],
    [{ name: 'C', id: 'chapter-001', sourceImages: [], managedDataFiles: ['evil.exe'] }],
    [{ name: 'C', id: 'chapter-001', sourceImages: [], managedDataFiles: [] }, { name: 'c', id: 'chapter-002', sourceImages: [], managedDataFiles: [] }],
  ]) await assert.rejects(inspectProjectBackup(await archive(validManifest({ chapters }), {})), /invalid|duplicate|image|managed/i);
  const symlink = new JSZip();
  symlink.file('manifest.json', JSON.stringify(validManifest({ chapters: [], totalImageCount: 0, totalUncompressedBytes: 0 })));
  symlink.file('link', 'target', { unixPermissions: 0o120777 });
  await assert.rejects(inspectProjectBackup(await symlink.generateAsync({ type: 'nodebuffer', platform: 'UNIX' })), /symlink|unexpected|type/i);
});

test('inspection enforces entry, per-file, total and compression-ratio limits', async () => {
  const empty = validManifest({ chapters: [], totalImageCount: 0, totalUncompressedBytes: 0 });
  await assert.rejects(inspectProjectBackup(await archive(empty), { maxEntries: 0 }), /entry/i);
  const manifest = validManifest({ chapters: [{ name: 'C', id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: [] }], totalImageCount: 1, totalUncompressedBytes: 3 });
  const buf = await archive(manifest, { 'source/chapter-001/1.png': 'abc' });
  await assert.rejects(inspectProjectBackup(buf, { maxFileBytes: 2 }), /file|size/i);
  await assert.rejects(inspectProjectBackup(buf, { maxTotalBytes: 2 }), /total/i);
  const bomb = await archive(validManifest({ chapters: [{ name: 'C', id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: [] }], totalImageCount: 1, totalUncompressedBytes: 10000 }), { 'source/chapter-001/1.png': 'x'.repeat(10000) });
  await assert.rejects(inspectProjectBackup(bomb, { maxCompressionRatio: 2 }), /compression ratio/i);
});

test('collision naming considers directories and map keys', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-restore-name-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'Comic'));
  fs.mkdirSync(path.join(root, 'Comic_สำเนา'));
  assert.equal(chooseRestoredProjectName('Comic', root, { 'Comic_สำเนา_2/C': 'x' }), 'Comic_สำเนา_3');
  assert.equal(chooseRestoredProjectName('Fresh', root, {}), 'Fresh');
});

test('successful round trip restores multiple chapters, glossary and mappings', async t => {
  const f = fixture();
  const restoredRoot = path.join(f.root, 'restored'); fs.mkdirSync(restoredRoot);
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const inventory = buildProjectInventory({ project: 'A', projectsRoot: f.projectsRoot, projectMap: f.projectMap, appVersion: '0.1.0' });
  const inspected = await inspectProjectBackup(await createProjectBackupBuffer(inventory));
  let written;
  const originalMap = { Existing: 'keep' };
  const result = await restoreProjectBackup({ inspected, projectsRoot: restoredRoot, projectMap: originalMap, writeProjectMap: map => { written = map; } });
  assert.equal(result.project, 'A');
  assert.equal(Object.keys(result.chapterMappings).length, 2);
  assert.equal(originalMap.Existing, 'keep');
  assert.notEqual(written, originalMap);
  assert.equal(fs.readFileSync(path.join(restoredRoot, 'A', '_source', 'chapter-001', '2.JPG'), 'utf8'), 'two');
  assert.ok(fs.existsSync(path.join(restoredRoot, 'A', '1', 'page_001.json')));
  assert.ok(fs.existsSync(path.join(restoredRoot, 'A', 'memory.json')));
});

test('restore cleans staging on extraction failure and rolls final directory back on registration failure', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-restore-fail-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = validManifest();
  const inspected = await inspectProjectBackup(await archive(manifest, { 'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}' }));
  inspected.entries[0].entry.async = async () => { throw new Error('extract failed'); };
  await assert.rejects(restoreProjectBackup({ inspected, projectsRoot: root, projectMap: {}, writeProjectMap() {} }), /extract failed/);
  assert.deepEqual(fs.readdirSync(root), []);
  const inspected2 = await inspectProjectBackup(await archive(manifest, { 'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}' }));
  await assert.rejects(restoreProjectBackup({ inspected: inspected2, projectsRoot: root, projectMap: {}, writeProjectMap() { throw new Error('map failed'); } }), /map failed/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('inspection rejects non-canonical whitespace and C0, DEL, and C1 controls in names and paths', async () => {
  for (const originalProjectName of [' Comic ', `Com\u007fic`, `Com\u0085ic`]) {
    await assert.rejects(inspectProjectBackup(await archive(validManifest({ originalProjectName }), {
      'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
    })), /invalid project/i);
  }
  for (const name of [' Chapter 1 ', `Chap\u007fter`, `Chap\u009fter`]) {
    const manifest = validManifest({ chapters: [{ name, id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: ['page_1.json'] }] });
    await assert.rejects(inspectProjectBackup(await archive(manifest, {
      'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
    })), /invalid chapter/i);
  }
  for (const chapter of [
    { name: 'Chapter 1', id: ' chapter-001 ', sourceImages: ['1.png'], managedDataFiles: ['page_1.json'] },
    { name: 'Chapter 1', id: 'chapter-001', sourceImages: [' 1.png'], managedDataFiles: ['page_1.json'] },
    { name: 'Chapter 1', id: 'chapter-001', sourceImages: ['1.png'], managedDataFiles: ['page_1.json '] },
  ]) await assert.rejects(inspectProjectBackup(await archive(validManifest({ chapters: [chapter] }), {})), /invalid/i);
  for (const badPath of [`source/chapter-001/a\u007f.png`, `source/chapter-001/a\u0080.png`]) {
    await assert.rejects(inspectProjectBackup(await archive(validManifest(), { [badPath]: 'img' })), /archive path/i);
  }
});

test('inspection validates custom limit shape, known keys, integer bounds, and positive ratio', async () => {
  const buffer = await archive(validManifest(), { 'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}' });
  for (const limits of [null, [], { unknown: 1 }, { maxEntries: 1.5 }, { maxFileBytes: -1 },
    { maxTotalBytes: Number.MAX_SAFE_INTEGER + 1 }, { maxCompressionRatio: 0 }, { maxCompressionRatio: Infinity }]) {
    await assert.rejects(inspectProjectBackup(buffer, limits), /invalid limit/i);
  }
});

test('inspection rejects manifest count and declaration edge cases', async () => {
  await assert.rejects(inspectProjectBackup(await archive(validManifest({ totalImageCount: 2 }), {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
  })), /image count/i);
  await assert.rejects(inspectProjectBackup(await archive(validManifest({ totalUncompressedBytes: 6 }), {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
  })), /byte count/i);
  const duplicateId = validManifest({ chapters: [
    { name: 'One', id: 'chapter-001', sourceImages: [], managedDataFiles: [] },
    { name: 'Two', id: 'chapter-001', sourceImages: [], managedDataFiles: [] },
  ], totalImageCount: 0, totalUncompressedBytes: 0 });
  await assert.rejects(inspectProjectBackup(await archive(duplicateId)), /duplicate chapter id/i);
});

test('collision matching treats project-map keys as a case-insensitive Windows namespace', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-case-collision-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(chooseRestoredProjectName('Comic', root, { 'comic/Chapter': 'x', 'COMIC_สำเนา/Chapter': 'y' }), 'Comic_สำเนา_2');
});

test('restore rejects relative projectsRoot before creating any path', async () => {
  const relative = `relative-restore-${Date.now()}`;
  assert.equal(fs.existsSync(relative), false);
  await assert.rejects(restoreProjectBackup({ inspected: { manifest: validManifest(), entries: [] }, projectsRoot: relative, projectMap: {}, writeProjectMap() {} }), /projects root/i);
  assert.equal(fs.existsSync(relative), false);
});

test('restore validates project map before creating a missing absolute root', async t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-invalid-map-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const missingRoot = path.join(parent, 'missing-projects');
  await assert.rejects(restoreProjectBackup({
    inspected: { manifest: validManifest(), entries: [] }, projectsRoot: missingRoot,
    projectMap: null, writeProjectMap() {},
  }), /project map/i);
  assert.equal(fs.existsSync(missingRoot), false);
});

test('restore preserves existing projects and input map on hostile extraction failure', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-preserve-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'Comic'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Comic', 'keep.txt'), 'keep');
  const map = { 'Comic/Old': 'unchanged' };
  const inspected = await inspectProjectBackup(await archive(validManifest(), {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
  }));
  inspected.entries[1].entry.async = async () => { throw new Error('hostile extraction'); };
  await assert.rejects(restoreProjectBackup({ inspected, projectsRoot: root, projectMap: map, writeProjectMap() {} }), /hostile extraction/);
  assert.equal(fs.readFileSync(path.join(root, 'Comic', 'keep.txt'), 'utf8'), 'keep');
  assert.deepEqual(map, { 'Comic/Old': 'unchanged' });
  assert.deepEqual(fs.readdirSync(root), ['Comic']);
});

test('restore cleans staging but preserves a destination that appears before final rename', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-rename-race-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inspected = await inspectProjectBackup(await archive(validManifest(), {
    'source/chapter-001/1.png': 'img', 'data/chapter-001/page_1.json': '{}',
  }));
  const originalAsync = inspected.entries[0].entry.async.bind(inspected.entries[0].entry);
  inspected.entries[0].entry.async = async type => {
    fs.mkdirSync(path.join(root, 'Comic'));
    fs.writeFileSync(path.join(root, 'Comic', 'racer.txt'), 'existing');
    return originalAsync(type);
  };
  let mapWriteCalled = false;
  await assert.rejects(restoreProjectBackup({ inspected, projectsRoot: root, projectMap: {}, writeProjectMap() { mapWriteCalled = true; } }), /EEXIST|EPERM|exist|rename/i);
  assert.equal(mapWriteCalled, false);
  assert.equal(fs.readFileSync(path.join(root, 'Comic', 'racer.txt'), 'utf8'), 'existing');
  assert.deepEqual(fs.readdirSync(root), ['Comic']);
});

test('restore creates deterministic source and managed directories for an empty chapter', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-empty-chapter-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = validManifest({
    chapters: [{ name: 'Empty Chapter', id: 'chapter-001', sourceImages: [], managedDataFiles: [] }],
    totalImageCount: 0,
    totalUncompressedBytes: 0,
  });
  const inspected = await inspectProjectBackup(await archive(manifest));
  let writtenMap;
  const result = await restoreProjectBackup({
    inspected, projectsRoot: root, projectMap: {}, writeProjectMap(map) { writtenMap = map; },
  });
  const sourceDirectory = path.join(root, 'Comic', '_source', 'chapter-001');
  const managedDirectory = path.join(root, 'Comic', 'Empty Chapter');
  assert.equal(fs.statSync(sourceDirectory).isDirectory(), true);
  assert.equal(fs.statSync(managedDirectory).isDirectory(), true);
  assert.equal(result.chapterMappings['Comic/Empty Chapter'], sourceDirectory);
  assert.equal(writtenMap['Comic/Empty Chapter'], sourceDirectory);
});
