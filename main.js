const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { readJsonWithRecovery, writeJsonAtomic } = require('./lib/atomic-json');
const { buildTranslationPrompt } = require('./lib/translation-prompt');
const { createWatermarkStore } = require('./lib/watermark-store');
const { sanitizeArchiveName, validateArchiveFiles, createArchiveBuffer } = require('./lib/facebook-archive');
const { createChapterQualityStore } = require('./lib/chapter-quality-store');
const { createInpaintSidecarManager } = require('./lib/inpaint-sidecar-manager');
const { planTranslationTiles, mergeTileResults } = require('./lib/translation-tiling');
const {
  buildProjectInventory,
  createProjectBackupBuffer,
  sanitizeZipFilename,
  inspectProjectBackup,
  restoreProjectBackup,
} = require('./lib/project-backup');
const { createProjectBackupIpcCoordinator } = require('./lib/project-backup-ipc');

let mainWin = null;
const inpaintSidecar = createInpaintSidecarManager({
  projectRoot: __dirname,
  onStatus: status => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('inpaint-status-changed', status);
    }
  },
});

// Resolve shared ScreenTranslator config path to reuse the API key
const SHARED_CONFIG_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'mirai-screenmind'
);
const SHARED_CONFIG_PATH = path.join(SHARED_CONFIG_DIR, 'config.json');

const PROJECTS_DIR = path.join(__dirname, 'projects');
const watermarkStore = createWatermarkStore(PROJECTS_DIR);
const chapterQualityStore = createChapterQualityStore(PROJECTS_DIR);

// Ensure projects directory exists
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function loadSharedConfig() {
  return readJsonWithRecovery(SHARED_CONFIG_PATH, {});
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'Mee-a-rai Comic Translator',
    icon: path.join(__dirname, 'assets', 'icon.png'), // will compile in next phase
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Allow loading local files (file://) in <img> tags
    }
  });

  mainWin.loadFile('src/index.html');
}

app.whenReady().then(() => {
  createWindow();
  inpaintSidecar.ensureStarted();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => inpaintSidecar.shutdown());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC Handlers ----------

ipcMain.handle('get-inpaint-status', () => inpaintSidecar.getStatus());
ipcMain.handle('retry-inpaint-sidecar', () => inpaintSidecar.ensureStarted());

const projectBackupHandlers = createProjectBackupIpcCoordinator({
  projectsDir: PROJECTS_DIR,
  appVersion: app.getVersion(),
  tokenTtlMs: 5 * 60 * 1000,
  maxPendingTokens: 8,
  now: Date.now,
  createToken: () => crypto.randomBytes(32).toString('hex'),
  fingerprint: buffer => crypto.createHash('sha256').update(buffer).digest('hex'),
  readJson: readJsonWithRecovery,
  writeJson: writeJsonAtomic,
  logger: console,
  dialog: {
    showSaveDialog: options => dialog.showSaveDialog(mainWin, options),
    showOpenDialog: options => dialog.showOpenDialog(mainWin, options),
  },
  defaultBackupPath: filename => path.join(app.getPath('documents'), filename),
  fs,
  backup: {
    buildProjectInventory,
    createProjectBackupBuffer,
    sanitizeZipFilename,
    inspectProjectBackup,
    restoreProjectBackup,
  },
});
ipcMain.handle('backup-project', projectBackupHandlers.backupProject);
ipcMain.handle('inspect-project-backup', projectBackupHandlers.inspectProjectBackup);
ipcMain.handle('confirm-restore-project', projectBackupHandlers.confirmRestoreProject);

ipcMain.handle('select-folder', async () => {
  if (!mainWin || mainWin.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWin, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('select-watermark', async (_e, { project, chapter }) => {
  const result = await dialog.showOpenDialog(mainWin, {
    properties: ['openFile'],
    filters: [{ name: 'Watermark image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const saved = watermarkStore.importAsset(project, chapter, result.filePaths[0]);
  return { ...saved, fileUrl: `file:///${saved.absolutePath.replace(/\\/g, '/')}` };
});

ipcMain.handle('load-watermark', (_e, { project, chapter }) => {
  const saved = watermarkStore.load(project, chapter);
  return { ...saved, fileUrl: saved.exists ? `file:///${saved.absolutePath.replace(/\\/g, '/')}` : '' };
});

ipcMain.handle('save-watermark-settings', (_e, { project, chapter, settings }) =>
  watermarkStore.saveSettings(project, chapter, settings));

ipcMain.handle('remove-watermark', (_e, { project, chapter }) =>
  watermarkStore.remove(project, chapter));

ipcMain.handle('get-config', () => {
  const cfg = loadSharedConfig();
  
  let lastFolderPath = '';
  try {
    const lastProjectFile = path.join(PROJECTS_DIR, 'last_project.json');
    if (fs.existsSync(lastProjectFile)) {
      lastFolderPath = readJsonWithRecovery(lastProjectFile, {}).lastFolderPath || '';
    }
  } catch (err) {}

  return {
    apiKey: cfg.apiKey || '',
    hasKey: !!cfg.apiKey,
    apiKeyMasked: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}…` : '',
    lastFolderPath
  };
});

ipcMain.handle('read-folder', (_e, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return { error: 'โฟลเดอร์ไม่ถูกต้องหรือไม่มีอยู่จริง' };
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) return { error: 'เส้นทางนี้ไม่ใช่โฟลเดอร์' };

    const files = fs.readdirSync(folderPath);
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.jfif'];
    
    // Filter and sort image files alphanumerically
    const images = files
      .filter(file => validExtensions.includes(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(file => {
        const absolutePath = path.join(folderPath, file);
        return {
          name: file,
          absolutePath: absolutePath,
          fileUrl: `file:///${absolutePath.replace(/\\/g, '/')}`
        };
      });

    // Try to guess project and chapter name
    const folderName = path.basename(folderPath);
    let project = 'default';
    let chapter = '01';
    
    const match = folderName.match(/^([a-zA-Z0-9_\-]+)_([0-9\.\-]+)$/);
    if (match) {
      project = match[1];
      chapter = match[2];
    } else {
      project = folderName.replace(/[^a-zA-Z0-9_\-]/g, '');
    }

    try {
      const lastProjectFile = path.join(PROJECTS_DIR, 'last_project.json');
      writeJsonAtomic(lastProjectFile, { lastFolderPath: folderPath });
      
      const mapFile = path.join(PROJECTS_DIR, 'projects_map.json');
      let projectsMap = {};
      if (fs.existsSync(mapFile)) {
        try {
          projectsMap = readJsonWithRecovery(mapFile, {});
        } catch (e) {}
      }
      projectsMap[`${project}/${chapter}`] = folderPath;
      writeJsonAtomic(mapFile, projectsMap);
    } catch (err) {
      console.error('Error writing last_project.json or projects_map.json:', err);
    }

    return {
      folderName,
      project,
      chapter,
      images
    };
  } catch (err) {
    return { error: err.message };
  }
});

async function requestGeminiTranslation({ data, mimeType, glossary }) {
  const cfg = loadSharedConfig();
  const apiKey = cfg.apiKey;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า API Key — กรุณาไปบันทึก API Key ในโปรแกรม ScreenTranslator ก่อนครับ');
  }

  const prompt = buildTranslationPrompt(glossary);

  const models = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-2.5-pro'];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const body = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: data.toString('base64')
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = responseData?.error?.message || `HTTP ${res.status}`;
        if (/API key|invalid key/i.test(msg) || res.status === 403) {
          throw new Error(msg);
        }
        const e = new Error(msg);
        e.retryNextModel = true;
        throw e;
      }

      const outputText = (responseData.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('')
        .trim();

      try {
        return JSON.parse(outputText);
      } catch (err) {
        console.error('Failed to parse Gemini output as JSON:', outputText);
        throw new Error('Gemini ตอบกลับไม่ได้โครงสร้าง JSON ที่ถูกต้อง: ' + err.message);
      }
    } catch (err) {
      lastErr = err;
      if (!err.retryNextModel) throw err;
      console.warn(`Model ${model} failed, trying next... Error: ${err.message}`);
    }
  }
  throw lastErr;
}

// IPC Translation call
ipcMain.handle('translate-page', async (_e, { imagePath, glossary }) => {
  const sourceImage = nativeImage.createFromPath(imagePath);
  if (sourceImage.isEmpty()) {
    throw new Error('ไม่สามารถอ่านไฟล์ภาพสำหรับแปลได้');
  }

  const imageSize = sourceImage.getSize();
  const tiles = planTranslationTiles(imageSize.width, imageSize.height);
  const ext = path.extname(imagePath).toLowerCase();
  const originalMimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  if (tiles[0].isFullPage) {
    return requestGeminiTranslation({
      data: fs.readFileSync(imagePath),
      mimeType: originalMimeType,
      glossary,
    });
  }

  const tileEntries = [];
  for (const tile of tiles) {
    const croppedImage = sourceImage.crop({
      x: 0,
      y: tile.cropStart,
      width: tile.width,
      height: tile.height,
    });
    const usePng = ext === '.png';
    const result = await requestGeminiTranslation({
      data: usePng ? croppedImage.toPNG() : croppedImage.toJPEG(95),
      mimeType: usePng ? 'image/png' : 'image/jpeg',
      glossary,
    });
    tileEntries.push({ tile, result });
  }

  return mergeTileResults(tileEntries, imageSize.width, imageSize.height);
});

// Local project save/load handlers
ipcMain.handle('save-typeset-image', (_e, { project, chapter, pageName, dataUrl }) => {
  try {
    const OUTPUT_DIR = path.join(__dirname, 'output');
    const dir = path.join(OUTPUT_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const file = path.join(dir, pageName);
    fs.writeFileSync(file, buffer);
    return { success: true, absolutePath: file };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-facebook-archive', async (_e, { archiveName, files }) => {
  try {
    validateArchiveFiles(files);
    const result = await dialog.showSaveDialog(mainWin, {
      title: 'บันทึกภาพสำหรับ Facebook',
      defaultPath: sanitizeArchiveName(archiveName),
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    const output = await createArchiveBuffer(files);
    fs.writeFileSync(result.filePath, output);
    return { success: true, absolutePath: result.filePath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-page-translation', (_e, { project, chapter, pageName, translationData }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const file = path.join(dir, `${path.basename(pageName, path.extname(pageName))}.json`);
    writeJsonAtomic(file, translationData);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-page-translation', (_e, { project, chapter, pageName }) => {
  try {
    const file = path.join(PROJECTS_DIR, project, chapter, `${path.basename(pageName, path.extname(pageName))}.json`);
    if (fs.existsSync(file)) {
      return readJsonWithRecovery(file, null);
    }
    return null;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('load-chapter-quality-state', (_e, { project, chapter, pageNames }) => {
  try {
    return chapterQualityStore.load(project, chapter, pageNames);
  } catch (err) {
    return { error: err.message, schemaVersion: 1, excludedPages: [] };
  }
});

ipcMain.handle('save-chapter-quality-state', (_e, { project, chapter, pageNames, excludedPages }) => {
  try {
    return chapterQualityStore.save(project, chapter, pageNames, excludedPages);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-memory', (_e, { project, memoryData }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, 'memory.json');
    writeJsonAtomic(file, memoryData);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-memory', (_e, { project }) => {
  try {
    const file = path.join(PROJECTS_DIR, project, 'memory.json');
    if (fs.existsSync(file)) {
      return readJsonWithRecovery(file, {});
    }
  } catch (err) {}
  return {};
});

ipcMain.handle('save-custom-mask', (_e, { project, chapter, pageName, dataUrl }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(dir, `${baseName}_custom_mask.png`);

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(file, buffer);
    return { success: true, absolutePath: file };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-custom-mask', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(PROJECTS_DIR, project, chapter, `${baseName}_custom_mask.png`);
    if (fs.existsSync(file)) {
      return { exists: true, absolutePath: file };
    }
    return { exists: false };
  } catch (err) {
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('clear-custom-mask', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(PROJECTS_DIR, project, chapter, `${baseName}_custom_mask.png`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-custom-paint', (_e, { project, chapter, pageName, dataUrl }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(dir, `${baseName}_custom_paint.png`);

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(file, buffer);
    return { success: true, absolutePath: file };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-custom-paint', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(PROJECTS_DIR, project, chapter, `${baseName}_custom_paint.png`);
    if (fs.existsSync(file)) {
      return { exists: true, absolutePath: file };
    }
    return { exists: false };
  } catch (err) {
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('clear-custom-paint', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = path.join(PROJECTS_DIR, project, chapter, `${baseName}_custom_paint.png`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('list-projects', () => {
  try {
    const mapFile = path.join(PROJECTS_DIR, 'projects_map.json');
    if (fs.existsSync(mapFile)) {
      const projectsMap = readJsonWithRecovery(mapFile, {});
      const list = [];
      const projects = {};
      for (const [key, folderPath] of Object.entries(projectsMap)) {
        const parts = key.split('/');
        if (parts.length === 2) {
          const [pName, cName] = parts;
          if (!projects[pName]) projects[pName] = [];
          projects[pName].push({ chapter: cName, folderPath });
        }
      }
      
      for (const [name, chapters] of Object.entries(projects)) {
        chapters.sort((a, b) => a.chapter.localeCompare(b.chapter, undefined, { numeric: true }));
        list.push({ name, chapters });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    }
  } catch (err) {}
  return [];
});

ipcMain.handle('delete-project-mapping', (_e, { project, chapter }) => {
  try {
    const mapFile = path.join(PROJECTS_DIR, 'projects_map.json');
    if (fs.existsSync(mapFile)) {
      const projectsMap = readJsonWithRecovery(mapFile, {});
      delete projectsMap[`${project}/${chapter}`];
      writeJsonAtomic(mapFile, projectsMap);
      return { success: true };
    }
  } catch (err) {
    return { error: err.message };
  }
  return { success: false };
});

ipcMain.handle('rename-chapter', async (_e, { project, oldChapter, newChapter, folderPath }) => {
  try {
    const oldDir = path.join(PROJECTS_DIR, project, oldChapter);
    const newDir = path.join(PROJECTS_DIR, project, newChapter);
    
    if (fs.existsSync(oldDir)) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      const files = fs.readdirSync(oldDir);
      for (const file of files) {
        fs.renameSync(path.join(oldDir, file), path.join(newDir, file));
      }
      try {
        fs.rmdirSync(oldDir);
      } catch (e) {}
    }
    
    const mapFile = path.join(PROJECTS_DIR, 'projects_map.json');
    if (fs.existsSync(mapFile)) {
      const projectsMap = readJsonWithRecovery(mapFile, {});
      delete projectsMap[`${project}/${oldChapter}`];
      projectsMap[`${project}/${newChapter}`] = folderPath;
      writeJsonAtomic(mapFile, projectsMap);
    }
    
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// Save API Key to shared config (same location as ScreenTranslator)
ipcMain.handle('save-api-key', (_e, { apiKey }) => {
  try {
    if (!fs.existsSync(SHARED_CONFIG_DIR)) {
      fs.mkdirSync(SHARED_CONFIG_DIR, { recursive: true });
    }
    let cfg = {};
    if (fs.existsSync(SHARED_CONFIG_PATH)) {
      cfg = readJsonWithRecovery(SHARED_CONFIG_PATH, {});
    }
    cfg.apiKey = apiKey;
    writeJsonAtomic(SHARED_CONFIG_PATH, cfg);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// Save global app settings
ipcMain.handle('save-app-settings', (_e, settings) => {
  try {
    const file = path.join(PROJECTS_DIR, 'app_settings.json');
    writeJsonAtomic(file, settings);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// Load global app settings
ipcMain.handle('load-app-settings', () => {
  try {
    const file = path.join(PROJECTS_DIR, 'app_settings.json');
    if (fs.existsSync(file)) {
      return readJsonWithRecovery(file, {});
    }
  } catch (err) {}
  return {};
});

// Delete a single page's translation JSON file
ipcMain.handle('delete-page-translation', (_e, { project, chapter, pageName }) => {
  try {
    const file = path.join(PROJECTS_DIR, project, chapter, `${path.basename(pageName, path.extname(pageName))}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// List all saved translation JSON files for a project/chapter
ipcMain.handle('list-chapter-translations', (_e, { project, chapter }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.startsWith('memory') && f !== 'glossary.json')
      .map(f => {
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        let bubbleCount = 0;
        try {
          const data = readJsonWithRecovery(filePath, null);
          bubbleCount = Array.isArray(data) ? data.length : 0;
        } catch {}
        return {
          name: f.replace('.json', ''),           // page name without extension
          fileName: f,
          modifiedAt: stat.mtimeMs,
          bubbleCount
        };
      });
    // Sort by filename (natural order)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return files;
  } catch (err) {
    return [];
  }
});
