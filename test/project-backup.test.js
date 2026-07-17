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
} = require('../lib/project-backup');

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
