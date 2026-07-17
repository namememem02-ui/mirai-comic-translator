const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createProjectBackupIpcCoordinator } = require('../lib/project-backup-ipc');

function harness(overrides = {}) {
  let now = 1000;
  let tokenIndex = 0;
  const files = new Map();
  const removed = [];
  const renamed = [];
  const writes = [];
  const logs = [];
  const map = { 'Alpha/01': 'C:\\source\\Alpha\\01' };
  const inspected = {
    manifest: { originalProjectName: 'Alpha', chapters: [{ name: '01' }] },
    summary: { originalProjectName: 'Alpha', chapterCount: 1, imageCount: 1 },
    entries: [],
  };
  const deps = {
    projectsDir: 'C:\\app\\projects',
    appVersion: '1.2.3',
    tokenTtlMs: 100,
    maxPendingTokens: 2,
    now: () => now,
    createToken: () => `token-${++tokenIndex}`,
    fingerprint: buffer => `sha:${buffer.toString()}`,
    defaultBackupPath: filename => path.join('C:\\documents', filename),
    readJson: () => ({ ...map }),
    writeJson: (_file, value) => writes.push(value),
    logger: { error: (...args) => logs.push(args) },
    dialog: {
      showSaveDialog: async () => ({ canceled: true }),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    },
    fs: {
      existsSync: file => files.has(file),
      writeFileSync: (file, data) => files.set(file, Buffer.from(data)),
      readFileSync: file => {
        if (!files.has(file)) throw new Error(`private path ${file}`);
        return Buffer.from(files.get(file));
      },
      renameSync: (from, to) => renamed.push([from, to]),
      rmSync: file => { removed.push(file); files.delete(file); },
    },
    backup: {
      sanitizeZipFilename: name => `${name}.zip`,
      buildProjectInventory: () => ({
        manifest: { originalProjectName: 'Alpha', chapters: [{}], totalImageCount: 1, totalUncompressedBytes: 7 },
        files: [],
      }),
      createProjectBackupBuffer: async () => Buffer.from('archive'),
      inspectProjectBackup: async () => inspected,
      restoreProjectBackup: async ({ writeProjectMap }) => {
        await writeProjectMap({ ...map, 'Alpha_copy/01': 'C:\\app\\projects\\Alpha_copy\\_source\\chapter-001' });
        return { project: 'Alpha_copy', chapterMappings: {} };
      },
    },
    ...overrides,
  };
  const handlers = createProjectBackupIpcCoordinator(deps);
  return { handlers, deps, files, removed, renamed, writes, logs, setNow: value => { now = value; } };
}

test('backup cancellation is structured and performs no write', async () => {
  const h = harness();
  let inventoryBuilds = 0;
  let archiveBuilds = 0;
  h.deps.backup.buildProjectInventory = () => { inventoryBuilds += 1; throw new Error('must not scan'); };
  h.deps.backup.createProjectBackupBuffer = async () => { archiveBuilds += 1; throw new Error('must not build'); };
  assert.deepEqual(await h.handlers.backupProject(null, { project: 'Alpha' }), { canceled: true });
  assert.equal(h.files.size, 0);
  assert.equal(inventoryBuilds, 0);
  assert.equal(archiveBuilds, 0);
});

test('backup safely rejects null and primitive renderer payloads', async () => {
  const h = harness();
  for (const payload of [null, 42, 'Alpha', true]) {
    assert.deepEqual(await h.handlers.backupProject(null, payload), {
      error: 'Project backup failed.', code: 'BACKUP_FAILED',
    });
  }
});

test('backup validates registration and promotes a verified sibling temp file', async () => {
  const target = 'C:\\exports\\Alpha-backup.zip';
  const h = harness({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: target }) } });
  assert.deepEqual(await h.handlers.backupProject(null, { project: 'Missing' }), {
    error: 'Project backup failed.', code: 'BACKUP_FAILED',
  });
  assert.equal(h.files.size, 0);
  const result = await h.handlers.backupProject(null, { project: 'Alpha' });
  assert.equal(result.success, true);
  assert.equal(result.filePath, target);
  assert.equal(h.renamed.length, 1);
  assert.match(h.renamed[0][0], /^C:\\exports\\Alpha-backup\.zip\..+\.tmp$/);
  assert.equal(h.renamed[0][1], target);
});

test('backup returns a stable safe error even when temp cleanup also fails', async () => {
  const target = 'C:\\private\\Alpha-backup.zip';
  const h = harness({
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: target }) },
  });
  h.deps.fs.readFileSync = file => {
    if (file.endsWith('.tmp')) throw new Error(`cannot verify ${file}`);
    throw new Error(`private path ${file}`);
  };
  h.deps.fs.rmSync = file => { throw new Error(`cannot remove ${file}`); };
  const result = await h.handlers.backupProject(null, { project: 'Alpha' });
  assert.deepEqual(result, { error: 'Project backup failed.', code: 'BACKUP_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /private|Alpha-backup|C:\\/);
  assert.ok(h.logs.length >= 2);
});

test('inspect cancellation and inspection failures never expose archive paths or entries', async () => {
  const canceled = harness();
  assert.deepEqual(await canceled.handlers.inspectProjectBackup(), { canceled: true });

  const archivePath = 'C:\\secret\\customer.zip';
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [archivePath] }) } });
  h.files.set(archivePath, Buffer.from('archive'));
  h.deps.backup.inspectProjectBackup = async () => { throw new Error(`bad entry at ${archivePath}/source/private.png`); };
  const result = await h.handlers.inspectProjectBackup();
  assert.deepEqual(result, { error: 'Project backup could not be inspected.', code: 'INSPECTION_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /secret|customer|entries|source/);
});

test('inspect returns only summary and a bounded opaque token', async () => {
  const paths = ['C:\\secret\\one.zip', 'C:\\secret\\two.zip', 'C:\\secret\\three.zip'];
  let index = 0;
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [paths[index++]] }) } });
  for (const file of paths) h.files.set(file, Buffer.from(path.basename(file)));
  const first = await h.handlers.inspectProjectBackup();
  await h.handlers.inspectProjectBackup();
  const third = await h.handlers.inspectProjectBackup();
  assert.deepEqual(Object.keys(third).sort(), ['summary', 'token']);
  assert.doesNotMatch(JSON.stringify(third), /secret|three\.zip|entries/);
  assert.deepEqual(await h.handlers.confirmRestoreProject(null, { token: first.token }), {
    error: 'Restore request is invalid or expired.', code: 'INVALID_RESTORE_TOKEN',
  });
});

test('confirm rejects expired, replayed, and tampered tokens without leaking paths', async () => {
  const archivePath = 'C:\\secret\\restore.zip';
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [archivePath] }) } });
  h.files.set(archivePath, Buffer.from('original'));
  const expired = await h.handlers.inspectProjectBackup();
  h.setNow(1101);
  assert.equal((await h.handlers.confirmRestoreProject(null, { token: expired.token })).code, 'INVALID_RESTORE_TOKEN');

  h.setNow(1200);
  const valid = await h.handlers.inspectProjectBackup();
  assert.deepEqual(await h.handlers.confirmRestoreProject(null, { token: valid.token }), {
    success: true, project: 'Alpha_copy', chapterCount: 1,
  });
  assert.equal((await h.handlers.confirmRestoreProject(null, { token: valid.token })).code, 'INVALID_RESTORE_TOKEN');

  const tampered = await h.handlers.inspectProjectBackup();
  h.files.set(archivePath, Buffer.from('changed'));
  const result = await h.handlers.confirmRestoreProject(null, { token: tampered.token });
  assert.deepEqual(result, { error: 'Project restore failed.', code: 'RESTORE_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /secret|restore\.zip/);
});

test('confirm safely rejects null and primitive renderer payloads', async () => {
  const h = harness();
  for (const payload of [null, 42, 'token-1', true]) {
    assert.deepEqual(await h.handlers.confirmRestoreProject(null, payload), {
      error: 'Restore request is invalid or expired.', code: 'INVALID_RESTORE_TOKEN',
    });
  }
});

test('cancel confirmation consumes a valid token without reading or restoring', async () => {
  const archivePath = 'C:\\secret\\cancel.zip';
  let reads = 0;
  let restores = 0;
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [archivePath] }) } });
  h.files.set(archivePath, Buffer.from('archive'));
  const pending = await h.handlers.inspectProjectBackup();
  const originalRead = h.deps.fs.readFileSync;
  h.deps.fs.readFileSync = file => { reads += 1; return originalRead(file); };
  h.deps.backup.restoreProjectBackup = async () => { restores += 1; };
  assert.deepEqual(await h.handlers.confirmRestoreProject(null, { token: pending.token, cancel: true }), { canceled: true });
  assert.equal(reads, 0);
  assert.equal(restores, 0);
  assert.equal((await h.handlers.confirmRestoreProject(null, { token: pending.token })).code, 'INVALID_RESTORE_TOKEN');
});

test('backup atomically replaces an existing destination under Windows rename semantics', async () => {
  const destination = 'C:\\documents\\Alpha.zip';
  const h = harness({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) } });
  h.files.set(destination, Buffer.from('old'));
  h.deps.fs.renameSync = (from, to) => {
    if (h.files.has(to)) { const error = new Error('destination exists'); error.code = 'EEXIST'; throw error; }
    h.files.set(to, h.files.get(from)); h.files.delete(from);
  };
  assert.equal((await h.handlers.backupProject(null, { project: 'Alpha' })).success, true);
  assert.equal(h.files.get(destination).toString(), 'archive');
  assert.deepEqual([...h.files.keys()].filter(file => /\.tmp$|\.bak$/.test(file)), []);
});

test('failed destination promotion rolls the old ZIP back and cleans siblings', async () => {
  const destination = 'C:\\documents\\Alpha.zip';
  const h = harness({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) } });
  h.files.set(destination, Buffer.from('old'));
  let promotionAttempts = 0;
  h.deps.fs.renameSync = (from, to) => {
    if (from.endsWith('.tmp') && to === destination && ++promotionAttempts === 1) throw new Error('promotion failed');
    if (h.files.has(to)) { const error = new Error('destination exists'); error.code = 'EEXIST'; throw error; }
    h.files.set(to, h.files.get(from)); h.files.delete(from);
  };
  assert.equal((await h.handlers.backupProject(null, { project: 'Alpha' })).code, 'BACKUP_FAILED');
  assert.equal(h.files.get(destination).toString(), 'old');
  assert.deepEqual([...h.files.keys()].filter(file => /\.tmp$|\.bak$/.test(file)), []);
});

test('successful promotion uses unlink fallback when removing the old backup fails', async () => {
  const destination = 'C:\\documents\\Alpha.zip';
  const h = harness({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) } });
  h.files.set(destination, Buffer.from('old'));
  h.deps.fs.renameSync = (from, to) => {
    if (h.files.has(to)) throw new Error('destination exists');
    h.files.set(to, h.files.get(from)); h.files.delete(from);
  };
  h.deps.fs.rmSync = file => {
    if (file.endsWith('.bak')) throw new Error('rm cleanup failed');
    h.files.delete(file);
  };
  h.deps.fs.unlinkSync = file => h.files.delete(file);
  const result = await h.handlers.backupProject(null, { project: 'Alpha' });
  assert.equal(result.success, true);
  assert.equal(h.files.get(destination).toString(), 'archive');
  assert.deepEqual([...h.files.keys()].filter(file => /\.tmp$|\.bak$/.test(file)), []);
});

test('cleanup failure after successful promotion preserves new and old ZIPs with a safe warning', async () => {
  const destination = 'C:\\documents\\Alpha.zip';
  const h = harness({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) } });
  h.files.set(destination, Buffer.from('old'));
  h.deps.fs.renameSync = (from, to) => {
    if (h.files.has(to)) throw new Error('destination exists');
    h.files.set(to, h.files.get(from)); h.files.delete(from);
  };
  h.deps.fs.rmSync = file => {
    if (file.endsWith('.bak')) throw new Error(`private cleanup ${file}`);
    h.files.delete(file);
  };
  h.deps.fs.unlinkSync = file => { throw new Error(`private unlink ${file}`); };
  const result = await h.handlers.backupProject(null, { project: 'Alpha' });
  assert.equal(result.success, true);
  assert.deepEqual(result.warnings, [{ code: 'OLD_BACKUP_CLEANUP_FAILED' }]);
  assert.equal(h.files.get(destination).toString(), 'archive');
  const backupFiles = [...h.files.keys()].filter(file => file.endsWith('.bak'));
  assert.equal(backupFiles.length, 1);
  assert.equal(h.files.get(backupFiles[0]).toString(), 'old');
  assert.doesNotMatch(JSON.stringify(result.warnings), /private|documents|Alpha\.zip/);
});

test('confirm re-inspects and safely handles restore or atomic map-write failures', async () => {
  const archivePath = 'C:\\secret\\restore.zip';
  let inspections = 0;
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [archivePath] }) } });
  h.files.set(archivePath, Buffer.from('archive'));
  h.deps.backup.inspectProjectBackup = async () => { inspections += 1; return { manifest: { chapters: [] }, summary: {}, entries: [] }; };
  h.deps.writeJson = () => { throw new Error('failed at C:\\app\\projects\\projects_map.json'); };
  const pending = await h.handlers.inspectProjectBackup();
  const result = await h.handlers.confirmRestoreProject(null, { token: pending.token });
  assert.equal(inspections, 2);
  assert.deepEqual(result, { error: 'Project restore failed.', code: 'RESTORE_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /projects_map|C:\\/);
  assert.equal((await h.handlers.confirmRestoreProject(null, { token: pending.token })).code, 'INVALID_RESTORE_TOKEN');
});

test('confirm safely handles a staged restore failure and consumes its token', async () => {
  const archivePath = 'C:\\secret\\restore.zip';
  const h = harness({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [archivePath] }) } });
  h.files.set(archivePath, Buffer.from('archive'));
  h.deps.backup.restoreProjectBackup = async () => { throw new Error(`staging failed under ${archivePath}`); };
  const pending = await h.handlers.inspectProjectBackup();
  const result = await h.handlers.confirmRestoreProject(null, { token: pending.token });
  assert.deepEqual(result, { error: 'Project restore failed.', code: 'RESTORE_FAILED' });
  assert.doesNotMatch(JSON.stringify(result), /secret|restore\.zip/);
  assert.equal((await h.handlers.confirmRestoreProject(null, { token: pending.token })).code, 'INVALID_RESTORE_TOKEN');
});
