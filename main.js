const { app, BrowserWindow, ipcMain, dialog, nativeImage, safeStorage, protocol, net, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('node:url');
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
const { createSecureApiKeyStore } = require('./lib/secure-api-key-store');
const { resolveWithin, validatePathSegment, deriveProjectChapter } = require('./lib/safe-paths');
const { createSourceFolderRegistry } = require('./lib/source-folder-registry');
const { createLocalAssetProtocol } = require('./lib/local-asset-protocol');
const { createUpdateChecker } = require('./lib/update-checker');

protocol.registerSchemesAsPrivileged([
  { scheme: 'mirai-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWin = null;
const GEMINI_API_KEY_URL = 'https://aistudio.google.com/apikey';
const UPDATE_MANIFEST_URL = process.env.MEE_A_RAI_COMIC_UPDATE_URL || 'https://raw.githubusercontent.com/namememem02-ui/mirai-comic-translator/master/app-version.json';
const updateChecker = createUpdateChecker({
  currentVersion: app.getVersion(),
  manifestUrl: UPDATE_MANIFEST_URL,
  fetchImpl: globalThis.fetch,
});
const inpaintSidecar = createInpaintSidecarManager({
  projectRoot: __dirname,
  onStatus: status => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('inpaint-status-changed', status);
    }
    if (status && status.state === 'ready') {
      getLamaManager().initialize().catch(() => {});
    }
  },
});

const { execFile, spawn } = require('child_process');
const { createLamaMachineDetector } = require('./lib/lama-machine-detector');
const { createLamaComponentInstaller } = require('./lib/lama-component-installer');
const { createLamaComponentManager } = require('./lib/lama-component-manager');

function validateBackend(backend) {
  if (backend !== 'cpu' && backend !== 'nvidia') {
    throw new Error('รองรับเฉพาะ backend "cpu" หรือ "nvidia" เท่านั้น');
  }
  return backend;
}

let lamaManager = null;
function getLamaManager() {
  if (!lamaManager) {
    const userDataPath = app.getPath('userData');
    const root = path.join(userDataPath, 'components', 'lama');

    const detector = createLamaMachineDetector({
      execFile,
      platform: process.platform,
      arch: process.arch,
      freeDisk: async (dirPath) => {
        try {
          const stats = fs.statfsSync ? fs.statfsSync(dirPath || userDataPath) : null;
          return stats ? stats.bavail * stats.bsize : 10 * 1024 * 1024 * 1024;
        } catch {
          return 10 * 1024 * 1024 * 1024;
        }
      },
    });

    const installer = createLamaComponentInstaller({
      fs: fs.promises,
      path,
      fetch: globalThis.fetch,
      probe: async () => true,
    });

    const settingsFile = path.join(STORAGE_ROOT, 'lama_settings.json');
    const settingsStore = {
      async load() {
        if (fs.existsSync(settingsFile)) {
          return readJsonWithRecovery(settingsFile, {});
        }
        return {};
      },
      async save(settings) {
        writeJsonAtomic(settingsFile, settings);
      },
    };

    const manifestFile = path.join(__dirname, 'lama-components.json');
    const manifestLoader = {
      async load() {
        if (fs.existsSync(manifestFile)) {
          return readJsonWithRecovery(manifestFile, null);
        }
        return {
          schema: 1,
          packages: [
            {
              backend: 'cpu',
              version: '1.0.0',
              url: 'https://github.com/namememem02-ui/mirai-comic-translator/releases/download/v0.1.0/lama-cpu.zip',
              bytes: 350000000,
              sha256: '0'.repeat(64),
              minAppVersion: '0.1.0',
              archive: 'zip',
            },
            {
              backend: 'nvidia',
              version: '1.0.0',
              url: 'https://github.com/namememem02-ui/mirai-comic-translator/releases/download/v0.1.0/lama-cpu.zip',
              bytes: 350000000,
              sha256: '0'.repeat(64),
              minAppVersion: '0.1.0',
              minDriver: '522.06',
              archive: 'zip',
            },
          ],
        };
      },
    };

    lamaManager = createLamaComponentManager({
      root,
      detector,
      installer,
      manifestLoader,
      settingsStore,
      sidecar: inpaintSidecar,
    });

    lamaManager.subscribe((state) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('lama-component-state-changed', state);
      }
    });
  }
  return lamaManager;
}

// Resolve shared ScreenTranslator config path to reuse the API key
const SHARED_CONFIG_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'mirai-screenmind'
);
const SHARED_CONFIG_PATH = path.join(SHARED_CONFIG_DIR, 'config.json');
const apiKeyStore = createSecureApiKeyStore({
  configPath: SHARED_CONFIG_PATH,
  safeStorage,
  readJson: readJsonWithRecovery,
  writeJson: writeJsonAtomic,
});

const STORAGE_ROOT = (typeof app !== 'undefined' && app.isPackaged)
  ? app.getPath('userData')
  : __dirname;

const PROJECTS_DIR = path.join(STORAGE_ROOT, 'projects');
const OUTPUT_DIR = path.join(STORAGE_ROOT, 'output');
const watermarkStore = createWatermarkStore(PROJECTS_DIR);
const chapterQualityStore = createChapterQualityStore(PROJECTS_DIR);

// Ensure projects and output directories exist
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function logDebug(message) {
  try {
    const logFile = path.join(PROJECTS_DIR, 'debug_log.txt');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
  } catch (err) {
    console.error('Debug log write failed:', err);
  }
}

function loadTrustedSourceRoots() {
  const roots = [];
  for (const fileName of ['projects_map.json', 'last_project.json']) {
    try {
      const value = readJsonWithRecovery(resolveWithin(PROJECTS_DIR, fileName), {});
      const candidates = fileName === 'projects_map.json' ? Object.values(value) : [value.lastFolderPath];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && path.isAbsolute(candidate) && fs.existsSync(candidate)) roots.push(candidate);
      }
    } catch {}
  }
  return roots;
}

const sourceFolders = createSourceFolderRegistry({ initialRoots: loadTrustedSourceRoots() });
const assetProtocol = createLocalAssetProtocol({
  path,
  allowedRoots: () => [PROJECTS_DIR, OUTPUT_DIR, ...sourceFolders.listRoots()],
});

function managedFile(root, ...segments) {
  return resolveWithin(root, ...segments.map((segment) => validatePathSegment(segment)));
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
      webSecurity: true
    }
  });

  // Redirect renderer logs to main process stdout
  mainWin.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  mainWin.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWin.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const appEntryUrl = pathToFileURL(path.join(__dirname, 'src', 'index.html')).toString();
  mainWin.webContents.on('will-navigate', (event, destinationUrl) => {
    if (destinationUrl !== appEntryUrl) event.preventDefault();
  });

  mainWin.loadFile('src/index.html');
}

app.whenReady().then(() => {
  protocol.handle('mirai-asset', request => {
    try {
      const assetPath = assetProtocol.resolveRequestUrl(request.url);
      return net.fetch(pathToFileURL(assetPath).toString());
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  });
  createWindow();
  inpaintSidecar.ensureStarted().then(() => {
    getLamaManager().initialize().catch(() => {});
  }).catch(() => {});
  getLamaManager().initialize().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  inpaintSidecar.shutdown();
  if (lamaManager) lamaManager.shutdown();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC Handlers ----------

ipcMain.handle('get-lama-component-state', () => getLamaManager().getState());
ipcMain.handle('check-lama-components', async () => getLamaManager().check());
ipcMain.handle('install-lama-component', async (_e, backend) => getLamaManager().install(validateBackend(backend)));
ipcMain.handle('cancel-lama-component-download', async () => getLamaManager().cancel());
ipcMain.handle('repair-lama-component', async (_e, backend) => getLamaManager().repair(validateBackend(backend)));
ipcMain.handle('remove-lama-component', async (_e, backend) => getLamaManager().remove(validateBackend(backend)));
ipcMain.handle('save-lama-preferences', async (_e, prefs) => getLamaManager().setPreferences(prefs));

ipcMain.handle('get-inpaint-status', () => inpaintSidecar.getStatus());
ipcMain.handle('retry-inpaint-sidecar', () => inpaintSidecar.ensureStarted());
const { createUpdateInstaller } = require('./lib/update-installer');

ipcMain.handle('open-gemini-api-key-page', async () => {
  await shell.openExternal(GEMINI_API_KEY_URL);
  return { success: true };
});
ipcMain.handle('open-external-url', async (_e, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false };
});
ipcMain.handle('get-update-info', () => ({
  currentVersion: app.getVersion(),
  configured: Boolean(UPDATE_MANIFEST_URL),
}));
ipcMain.handle('check-for-updates', () => updateChecker.check());
ipcMain.handle('download-and-install-update', async (event, downloadUrl) => {
  try {
    const installer = createUpdateInstaller({
      tempDir: app.getPath('temp'),
      spawnImpl: spawn,
      quitApp: () => app.quit(),
    });
    return await installer.downloadAndInstall({
      downloadUrl,
      onProgress: (progress) => {
        if (event && event.sender) {
          event.sender.send('update-download-progress', progress);
        }
      },
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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
  return sourceFolders.authorize(result.filePaths[0]);
});

ipcMain.handle('authorize-source-folder', async (_event, folderPath) => {
  try {
    const resolved = path.resolve(folderPath);
    if (!path.isAbsolute(folderPath) || !fs.statSync(resolved).isDirectory()) return { authorized: false };
    if (sourceFolders.isAuthorized(resolved)) return { authorized: true, folderPath: resolved };
    const result = await dialog.showMessageBox(mainWin, {
      type: 'question', buttons: ['อนุญาต', 'ยกเลิก'], defaultId: 0, cancelId: 1,
      title: 'อนุญาตโฟลเดอร์รูปภาพ', message: 'อนุญาตให้ ComicTranslator อ่านรูปจากโฟลเดอร์นี้หรือไม่?',
      detail: resolved,
    });
    if (result.response !== 0) return { authorized: false };
    return { authorized: true, folderPath: sourceFolders.authorize(resolved) };
  } catch {
    return { authorized: false };
  }
});

ipcMain.handle('select-watermark', async (_e, { project, chapter }) => {
  const result = await dialog.showOpenDialog(mainWin, {
    properties: ['openFile'],
    filters: [{ name: 'Watermark image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const saved = watermarkStore.importAsset(project, chapter, result.filePaths[0]);
  return { ...saved, fileUrl: assetProtocol.urlForPath(saved.absolutePath) };
});

ipcMain.handle('load-watermark', (_e, { project, chapter }) => {
  const saved = watermarkStore.load(project, chapter);
  return { ...saved, fileUrl: saved.exists ? assetProtocol.urlForPath(saved.absolutePath) : '' };
});

ipcMain.handle('save-watermark-settings', (_e, { project, chapter, settings }) =>
  watermarkStore.saveSettings(project, chapter, settings));

ipcMain.handle('remove-watermark', (_e, { project, chapter }) =>
  watermarkStore.remove(project, chapter));

ipcMain.handle('get-config', () => {
  let lastFolderPath = '';
  try {
    const lastProjectFile = path.join(PROJECTS_DIR, 'last_project.json');
    if (fs.existsSync(lastProjectFile)) {
      lastFolderPath = readJsonWithRecovery(lastProjectFile, {}).lastFolderPath || '';
    }
  } catch (err) {}

  return {
    ...apiKeyStore.getMetadata(),
    lastFolderPath
  };
});

ipcMain.handle('read-folder', (_e, folderPath) => {
  try {
    if (!sourceFolders.isAuthorized(folderPath)) return { error: 'ยังไม่ได้อนุญาตโฟลเดอร์นี้' };
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
          fileUrl: assetProtocol.urlForPath(absolutePath)
        };
      });

    // Try to guess project and chapter name
    const folderName = path.basename(folderPath);
    const { project, chapter } = deriveProjectChapter(folderName);

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

function safeParseJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch (initialErr) {
    let cleaned = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {
      let openBrackets = 0;
      let openBraces = 0;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < cleaned.length; i += 1) {
        const ch = cleaned[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === '{') openBraces += 1;
          else if (ch === '}') openBraces -= 1;
          else if (ch === '[') openBrackets += 1;
          else if (ch === ']') openBrackets -= 1;
        }
      }

      let repaired = cleaned;
      if (inString) repaired += '"';
      repaired = repaired.replace(/,\s*$/, '');
      while (openBrackets > 0) { repaired += ']'; openBrackets -= 1; }
      while (openBraces > 0) { repaired += '}'; openBraces -= 1; }
      repaired = repaired.replace(/,\s*([}\]])/g, '$1');

      try {
        return JSON.parse(repaired);
      } catch {
        const bubbles = [];
        const regex = /\{\s*"bubble_id"\s*:\s*(\d+)\s*,\s*"box_2d"\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]\s*,\s*"original_text"\s*:\s*"([^"]*)"\s*,\s*"translated_text"\s*:\s*"([^"]*)"\s*\}/g;
        let match;
        while ((match = regex.exec(rawText)) !== null) {
          bubbles.push({
            bubble_id: parseInt(match[1], 10),
            box_2d: [parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10), parseInt(match[5], 10)],
            original_text: match[6],
            translated_text: match[7]
          });
        }
        if (bubbles.length > 0) {
          return { bubbles };
        }
        throw initialErr;
      }
    }
  }
}

function buildCropTranslationPrompt(glossary = {}) {
  let glossaryText = '';
  if (glossary && Object.keys(glossary).length > 0) {
    glossaryText = `Follow this character and glossary naming memory exactly:\n${JSON.stringify(glossary, null, 2)}\n\n`;
  }
  return `You are a professional manga/comic translator. ` +
    `Perform OCR on this cropped image of a single speech bubble or narration panel, and translate the text into Thai.\n\n` +
    glossaryText +
    `Output ONLY a valid JSON object with the following keys:\n` +
    `- "original_text": the exact OCR'd text found in the image.\n` +
    `- "translated_text": the translation in Thai.\n\n` +
    `Do not include any explanation or markdown formatting outside the JSON.`;
}

async function requestGeminiCropTranslation({ data, mimeType, glossary }) {
  const apiKey = apiKeyStore.getKey();
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า API Key — กรุณาเปิดการตั้งค่าและกรอก Gemini API Key');
  }

  const prompt = buildCropTranslationPrompt(glossary);
  const models = ['gemini-flash-lite-latest'];
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
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              original_text: { type: "STRING" },
              translated_text: { type: "STRING" }
            },
            required: ["original_text", "translated_text"]
          },
          maxOutputTokens: 2048
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
        if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg) || res.status === 429) {
          const matchSec = msg.match(/retry in ([\d\.]+)s/i);
          const waitTime = matchSec ? Math.ceil(parseFloat(matchSec[1])) : 30;
          throw new Error(`โควตา Gemini API ฟรีเต็มชั่วคราว (Rate Limit 15 คำขอ/นาที)\nกรุณาพักรอประมาณ ${waitTime} วินาที แล้วลองกดแปลอีกครั้งครับ`);
        }
        if (/API key|invalid key/i.test(msg) || res.status === 403) {
          throw new Error(msg);
        }
        const e = new Error(msg);
        e.retryNextModel = true;
        throw e;
      }

      const finishReason = responseData.candidates?.[0]?.finishReason || '';
      const outputText = (responseData.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('')
        .trim();

      if (!outputText) {
        throw new Error(`Gemini ตอบกลับว่างเปล่า (${finishReason || 'empty response'}) — ลองใหม่`);
      }

      const result = JSON.parse(outputText);
      if (!result.original_text || !result.translated_text) {
        throw new Error('โครงสร้างข้อมูลตอบกลับของ Gemini ไม่ถูกต้อง');
      }

      return result;
    } catch (err) {
      lastErr = err;
      if (!err.retryNextModel) break;
    }
  }
  throw lastErr;
}

async function requestGeminiTranslation({ data, mimeType, glossary }) {
  const apiKey = apiKeyStore.getKey();
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า API Key — กรุณาเปิดการตั้งค่าและกรอก Gemini API Key');
  }

  const prompt = buildTranslationPrompt(glossary, true);

  const models = ['gemini-flash-lite-latest'];
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
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              bubbles: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    bubble_id: { type: "INTEGER" },
                    box_2d: {
                      type: "ARRAY",
                      items: { type: "INTEGER" }
                    },
                    original_text: { type: "STRING" },
                    translated_text: { type: "STRING" }
                  },
                  required: ["bubble_id", "box_2d", "original_text", "translated_text"]
                }
              },
              discovered_names: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    original: { type: "STRING" },
                    translation: { type: "STRING" }
                  },
                  required: ["original", "translation"]
                }
              }
            },
            required: ["bubbles", "discovered_names"]
          },
          maxOutputTokens: 8192
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
        if (/quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg) || res.status === 429) {
          const matchSec = msg.match(/retry in ([\d\.]+)s/i);
          const waitTime = matchSec ? Math.ceil(parseFloat(matchSec[1])) : 30;
          throw new Error(`โควตา Gemini API ฟรีเต็มชั่วคราว (Rate Limit 15 คำขอ/นาที)\nกรุณาพักรอประมาณ ${waitTime} วินาที แล้วลองกดแปลอีกครั้งครับ`);
        }
        if (/API key|invalid key/i.test(msg) || res.status === 403) {
          throw new Error(msg);
        }
        const e = new Error(msg);
        e.retryNextModel = true;
        throw e;
      }

      const finishReason = responseData.candidates?.[0]?.finishReason || '';
      const outputText = (responseData.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('')
        .trim();

      if (!outputText) {
        const reason = finishReason || 'empty response';
        console.error('Gemini returned empty output. finishReason:', reason, 'full response:', JSON.stringify(responseData).slice(0, 500));
        const e = new Error(`Gemini ตอบกลับว่างเปล่า (${reason}) — ลองกดแปลอีกครั้ง`);
        e.retryNextModel = true;
        throw e;
      }

      try {
        const parsed = safeParseJson(outputText);
        if (parsed === null) {
          const e = new Error('Gemini ตอบกลับว่างเปล่า — ลองกดแปลอีกครั้ง');
          e.retryNextModel = true;
          throw e;
        }

        // Convert discovered_names array format back to flat object mapping for frontend compatibility
        if (parsed && Array.isArray(parsed.discovered_names)) {
          const namesObj = {};
          parsed.discovered_names.forEach(item => {
            if (item && typeof item.original === 'string' && typeof item.translation === 'string') {
              namesObj[item.original] = item.translation;
            }
          });
          parsed.discovered_names = namesObj;
        }

        return parsed;
      } catch (err) {
        if (err.retryNextModel) throw err;
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

ipcMain.handle('translate-page', async (_e, { imagePath, glossary }) => {
  logDebug(`translate-page start: imagePath=${imagePath}, glossary=${JSON.stringify(glossary)}`);
  try {
    if (!sourceFolders.isAuthorized(imagePath)) throw new Error('ไม่ได้รับอนุญาตให้อ่านไฟล์ภาพนี้');
    const sourceImage = nativeImage.createFromPath(imagePath);
    if (sourceImage.isEmpty()) {
      throw new Error('ไม่สามารถอ่านไฟล์ภาพสำหรับแปลได้');
    }

    const imageSize = sourceImage.getSize();
    const tiles = planTranslationTiles(imageSize.width, imageSize.height);
    const ext = path.extname(imagePath).toLowerCase();
    const originalMimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    let finalResult;
    if (tiles[0].isFullPage) {
      finalResult = await requestGeminiTranslation({
        data: fs.readFileSync(imagePath),
        mimeType: originalMimeType,
        glossary,
      });
    } else {
      const tileEntries = [];
      for (const tile of tiles) {
        const croppedImage = sourceImage.crop({
          x: 0,
          y: tile.cropStart,
          width: tile.width,
          height: tile.height,
        });
        const result = await requestGeminiTranslation({
          data: ext === '.png' ? croppedImage.toPNG() : croppedImage.toJPEG(100),
          mimeType: originalMimeType,
          glossary,
        });
        tileEntries.push({ tile, result });
      }
      finalResult = mergeTileResults(tileEntries, imageSize.width, imageSize.height);
    }
    
    logDebug(`translate-page success: discovered_names=${JSON.stringify(finalResult?.discovered_names)}`);
    return finalResult;
  } catch (err) {
    logDebug(`translate-page error: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('translate-crop', async (_e, { imagePath, box_2d, glossary }) => {
  logDebug(`translate-crop start: imagePath=${imagePath}, box_2d=${JSON.stringify(box_2d)}, glossary=${JSON.stringify(glossary)}`);
  try {
    if (!sourceFolders.isAuthorized(imagePath)) throw new Error('ไม่ได้รับอนุญาตให้อ่านไฟล์ภาพนี้');
    const sourceImage = nativeImage.createFromPath(imagePath);
    if (sourceImage.isEmpty()) {
      throw new Error('ไม่สามารถอ่านไฟล์ภาพสำหรับแปลได้');
    }

    const imageSize = sourceImage.getSize();
    const [ymin, xmin, ymax, xmax] = box_2d;

    // Convert normalized coordinates (0 to 1000) to actual pixels
    const pxXmin = Math.floor((xmin / 1000) * imageSize.width);
    const pxYmin = Math.floor((ymin / 1000) * imageSize.height);
    const pxXmax = Math.ceil((xmax / 1000) * imageSize.width);
    const pxYmax = Math.ceil((ymax / 1000) * imageSize.height);

    let pxWidth = pxXmax - pxXmin;
    let pxHeight = pxYmax - pxYmin;

    // Add a 10% safety margin (padding) around the cropped area to give Gemini visual context
    const paddingX = Math.round(pxWidth * 0.1);
    const paddingY = Math.round(pxHeight * 0.1);

    const cropX = Math.max(0, pxXmin - paddingX);
    const cropY = Math.max(0, pxYmin - paddingY);
    const cropWidth = Math.min(imageSize.width - cropX, pxWidth + 2 * paddingX);
    const cropHeight = Math.min(imageSize.height - cropY, pxHeight + 2 * paddingY);

    if (cropWidth <= 0 || cropHeight <= 0) {
      throw new Error('ขนาดพิกัดของกรอบไม่ถูกต้อง');
    }

    const croppedImage = sourceImage.crop({
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    });

    const ext = path.extname(imagePath).toLowerCase();
    const originalMimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const croppedBuffer = ext === '.png' ? croppedImage.toPNG() : croppedImage.toJPEG(100);

    const result = await requestGeminiCropTranslation({
      data: croppedBuffer,
      mimeType: originalMimeType,
      glossary,
    });

    logDebug(`translate-crop success: original_text=${result.original_text}, translated_text=${result.translated_text}`);
    return result;
  } catch (err) {
    logDebug(`translate-crop error: ${err.message}`);
    throw err;
  }
});

// Local project save/load handlers
ipcMain.handle('save-typeset-image', (_e, { project, chapter, pageName, dataUrl }) => {
  try {
    const dir = resolveWithin(OUTPUT_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const file = resolveWithin(dir, pageName);
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
    const dir = resolveWithin(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const file = resolveWithin(dir, `${validatePathSegment(path.basename(pageName, path.extname(pageName)))}.json`);
    writeJsonAtomic(file, translationData);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-page-translation', (_e, { project, chapter, pageName }) => {
  try {
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(path.basename(pageName, path.extname(pageName)))}.json`);
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
  logDebug(`save-memory: project=${project}, data=${JSON.stringify(memoryData)}`);
  try {
    const dir = resolveWithin(PROJECTS_DIR, project);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = resolveWithin(dir, 'memory.json');
    writeJsonAtomic(file, memoryData);
    logDebug(`save-memory success: saved to ${file}`);
    return true;
  } catch (err) {
    logDebug(`save-memory error: ${err.message}`);
    return { error: err.message };
  }
});

ipcMain.handle('load-memory', (_e, { project }) => {
  logDebug(`load-memory: project=${project}`);
  try {
    const file = resolveWithin(PROJECTS_DIR, project, 'memory.json');
    if (fs.existsSync(file)) {
      const data = readJsonWithRecovery(file, {});
      logDebug(`load-memory success: loaded ${JSON.stringify(data)}`);
      return data;
    }
    logDebug(`load-memory: file not found at ${file}`);
  } catch (err) {
    logDebug(`load-memory error: ${err.message}`);
  }
  return {};
});

ipcMain.handle('save-custom-mask', (_e, { project, chapter, pageName, dataUrl }) => {
  try {
    const dir = resolveWithin(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const baseName = path.basename(pageName, path.extname(pageName));
    const file = resolveWithin(dir, `${validatePathSegment(baseName)}_custom_mask.png`);

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
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(baseName)}_custom_mask.png`);
    if (fs.existsSync(file)) {
      return { exists: true, absolutePath: file, fileUrl: assetProtocol.urlForPath(file) };
    }
    return { exists: false };
  } catch (err) {
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('clear-custom-mask', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(baseName)}_custom_mask.png`);
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
    const dir = resolveWithin(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const baseName = path.basename(pageName, path.extname(pageName));
    const file = resolveWithin(dir, `${validatePathSegment(baseName)}_custom_paint.png`);

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
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(baseName)}_custom_paint.png`);
    if (fs.existsSync(file)) {
      return { exists: true, absolutePath: file, fileUrl: assetProtocol.urlForPath(file) };
    }
    return { exists: false };
  } catch (err) {
    return { exists: false, error: err.message };
  }
});

ipcMain.handle('clear-custom-paint', (_e, { project, chapter, pageName }) => {
  try {
    const baseName = path.basename(pageName, path.extname(pageName));
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(baseName)}_custom_paint.png`);
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
    if (!sourceFolders.isAuthorized(folderPath)) throw new Error('ไม่ได้รับอนุญาตให้ใช้โฟลเดอร์ต้นทางนี้');
    const oldDir = resolveWithin(PROJECTS_DIR, project, oldChapter);
    const newDir = resolveWithin(PROJECTS_DIR, project, newChapter);
    
    if (fs.existsSync(oldDir)) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      const files = fs.readdirSync(oldDir);
      for (const file of files) {
        fs.renameSync(resolveWithin(oldDir, file), resolveWithin(newDir, file));
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
    return { success: true, ...apiKeyStore.saveKey(apiKey) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-api-key', () => {
  try {
    return { success: true, ...apiKeyStore.deleteKey() };
  } catch (err) {
    return { success: false, error: err.message };
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
    const file = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(path.basename(pageName, path.extname(pageName)))}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// Delete a page image file and its translation JSON file
ipcMain.handle('delete-page', (_e, { folderPath, project, chapter, pageName }) => {
  try {
    if (!sourceFolders.isAuthorized(folderPath)) {
      return { error: 'โฟลเดอร์นี้ไม่ได้รับอนุญาตให้เข้าถึง' };
    }
    
    // 1. Delete page image file
    const imgFile = resolveWithin(folderPath, pageName);
    if (fs.existsSync(imgFile)) {
      fs.unlinkSync(imgFile);
    }
    
    // 2. Delete translation JSON file
    const jsonFile = resolveWithin(PROJECTS_DIR, project, chapter, `${validatePathSegment(path.basename(pageName, path.extname(pageName)))}.json`);
    if (fs.existsSync(jsonFile)) {
      fs.unlinkSync(jsonFile);
    }
    
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// List all saved translation JSON files for a project/chapter
ipcMain.handle('list-chapter-translations', (_e, { project, chapter }) => {
  try {
    const dir = resolveWithin(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.startsWith('memory') && f !== 'glossary.json')
      .map(f => {
        const filePath = resolveWithin(dir, f);
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



ipcMain.handle('add-credit-page', async (_e, { project, chapter, folderPath }) => {
  try {
    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    
    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();
    
    // We want to copy it to the source folder as 'zz_credit' + extension
    // We also make sure the source folder exists and is authorized
    if (!sourceFolders.isAuthorized(folderPath)) {
      throw new Error('ไม่ได้รับอนุญาตให้เขียนไฟล์ลงโฟลเดอร์ต้นทางนี้');
    }
    
    const destPath = path.join(folderPath, `zz_credit${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    return { success: true, destPath };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('add-cover-page', async (_e, { project, chapter, folderPath }) => {
  try {
    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    
    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();
    
    if (!sourceFolders.isAuthorized(folderPath)) {
      throw new Error('ไม่ได้รับอนุญาตให้เขียนไฟล์ลงโฟลเดอร์ต้นทางนี้');
    }
    
    const destPath = path.join(folderPath, `00_cover${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    return { success: true, destPath };
  } catch (err) {
    return { error: err.message };
  }
});

