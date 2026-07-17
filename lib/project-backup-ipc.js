const path = require('node:path');

const SAFE_ERRORS = Object.freeze({
  backup: { error: 'Project backup failed.', code: 'BACKUP_FAILED' },
  inspection: { error: 'Project backup could not be inspected.', code: 'INSPECTION_FAILED' },
  invalidToken: { error: 'Restore request is invalid or expired.', code: 'INVALID_RESTORE_TOKEN' },
  restore: { error: 'Project restore failed.', code: 'RESTORE_FAILED' },
});

function createProjectBackupIpcCoordinator(deps) {
  const pendingTokens = new Map();
  const mapFile = path.join(deps.projectsDir, 'projects_map.json');

  function logFailure(context, error) {
    try { deps.logger?.error(context, error); } catch (_) {}
  }

  function safeFailure(kind, error) {
    logFailure(`Project backup IPC ${kind} failure`, error);
    return { ...SAFE_ERRORS[kind] };
  }

  function clearExpired(now = deps.now()) {
    for (const [token, pending] of pendingTokens) {
      if (pending.expiresAt <= now) pendingTokens.delete(token);
    }
  }

  function clearAll() {
    pendingTokens.clear();
  }

  function storeToken(filePath, fingerprint) {
    clearExpired();
    while (pendingTokens.size >= deps.maxPendingTokens) {
      pendingTokens.delete(pendingTokens.keys().next().value);
    }
    const token = deps.createToken();
    pendingTokens.set(token, {
      filePath: path.resolve(filePath),
      fingerprint,
      expiresAt: deps.now() + deps.tokenTtlMs,
    });
    return token;
  }

  function promoteBackup(tempPath, destination) {
    if (!deps.fs.existsSync(destination)) {
      deps.fs.renameSync(tempPath, destination);
      return null;
    }
    const backupPath = `${destination}.${deps.createToken()}.bak`;
    let oldMoved = false;
    let newPromoted = false;
    try {
      deps.fs.renameSync(destination, backupPath);
      oldMoved = true;
      deps.fs.renameSync(tempPath, destination);
      newPromoted = true;
    } catch (error) {
      if (oldMoved && !newPromoted) {
        try { deps.fs.renameSync(backupPath, destination); } catch (rollbackError) {
          logFailure('Project backup destination rollback failure', rollbackError);
        }
      }
      throw error;
    }

    try {
      deps.fs.rmSync(backupPath, { force: true });
      return null;
    } catch (rmError) {
      try {
        if (typeof deps.fs.unlinkSync !== 'function') throw rmError;
        deps.fs.unlinkSync(backupPath);
        return null;
      } catch (unlinkError) {
        logFailure('Project backup destination backup cleanup failure', unlinkError);
        return { code: 'OLD_BACKUP_CLEANUP_FAILED' };
      }
    }
  }

  async function backupProject(_event, args) {
    let tempPath = null;
    try {
      const payload = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
      const project = payload.project;
      const projectMap = deps.readJson(mapFile, {});
      const prefix = `${project}/`;
      if (typeof project !== 'string' || !Object.keys(projectMap).some(key => key.startsWith(prefix))) {
        throw new Error('Project is not registered');
      }
      const result = await deps.dialog.showSaveDialog({
        defaultPath: deps.defaultBackupPath(deps.backup.sanitizeZipFilename(`${project}-backup`)),
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      const inventory = deps.backup.buildProjectInventory({
        project,
        projectsRoot: deps.projectsDir,
        projectMap,
        appVersion: deps.appVersion,
      });
      const archive = await deps.backup.createProjectBackupBuffer(inventory);
      tempPath = `${result.filePath}.${deps.createToken()}.tmp`;
      deps.fs.writeFileSync(tempPath, archive, { flag: 'wx' });
      const verified = deps.fs.readFileSync(tempPath);
      if (!Buffer.from(verified).equals(Buffer.from(archive))) throw new Error('Backup verification failed');
      const cleanupWarning = promoteBackup(tempPath, result.filePath);
      tempPath = null;
      const response = {
        success: true,
        filePath: result.filePath,
        summary: {
          project: inventory.manifest.originalProjectName,
          chapterCount: inventory.manifest.chapters.length,
          imageCount: inventory.manifest.totalImageCount,
          totalUncompressedBytes: inventory.manifest.totalUncompressedBytes,
        },
      };
      if (cleanupWarning) response.warnings = [cleanupWarning];
      return response;
    } catch (error) {
      return safeFailure('backup', error);
    } finally {
      if (tempPath) {
        try { deps.fs.rmSync(tempPath, { force: true }); } catch (cleanupError) {
          logFailure('Project backup temp cleanup failure', cleanupError);
        }
      }
    }
  }

  async function inspectProjectBackup() {
    clearExpired();
    try {
      const result = await deps.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        clearAll();
        return { canceled: true };
      }
      const filePath = path.resolve(result.filePaths[0]);
      const archive = deps.fs.readFileSync(filePath);
      const inspected = await deps.backup.inspectProjectBackup(archive);
      const token = storeToken(filePath, deps.fingerprint(archive));
      return { token, summary: inspected.summary };
    } catch (error) {
      clearAll();
      return safeFailure('inspection', error);
    }
  }

  async function confirmRestoreProject(_event, args) {
    const payload = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    const token = payload.token;
    clearExpired();
    const pending = typeof token === 'string' ? pendingTokens.get(token) : null;
    if (!pending) {
      clearAll();
      return { ...SAFE_ERRORS.invalidToken };
    }
    pendingTokens.delete(token);
    if (pending.expiresAt <= deps.now()) {
      clearAll();
      return { ...SAFE_ERRORS.invalidToken };
    }
    if (payload.cancel === true) return { canceled: true };
    try {
      const archive = deps.fs.readFileSync(pending.filePath);
      if (deps.fingerprint(archive) !== pending.fingerprint) throw new Error('Archive fingerprint mismatch');
      const inspected = await deps.backup.inspectProjectBackup(archive);
      const projectMap = deps.readJson(mapFile, {});
      const restored = await deps.backup.restoreProjectBackup({
        inspected,
        projectsRoot: deps.projectsDir,
        projectMap,
        writeProjectMap: nextMap => deps.writeJson(mapFile, nextMap),
      });
      clearAll();
      return { success: true, project: restored.project, chapterCount: inspected.manifest.chapters.length };
    } catch (error) {
      clearAll();
      return safeFailure('restore', error);
    }
  }

  return { backupProject, inspectProjectBackup, confirmRestoreProject };
}

module.exports = { createProjectBackupIpcCoordinator };
