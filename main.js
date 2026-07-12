const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWin = null;

// Resolve shared ScreenTranslator config path to reuse the API key
const SHARED_CONFIG_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'mirai-screenmind'
);
const SHARED_CONFIG_PATH = path.join(SHARED_CONFIG_DIR, 'config.json');

const PROJECTS_DIR = path.join(__dirname, 'projects');

// Ensure projects directory exists
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function loadSharedConfig() {
  try {
    if (fs.existsSync(SHARED_CONFIG_PATH)) {
      const data = fs.readFileSync(SHARED_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading shared config:', err);
  }
  return {};
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'ComicTranslator — แปลการ์ตูนด้วย AI',
    icon: path.join(__dirname, 'assets', 'icon.png'), // will compile in next phase
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Allow loading local files (file://) in <img> tags
    }
  });

  mainWin.webContents.openDevTools();
  mainWin.loadFile('src/index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC Handlers ----------

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

ipcMain.handle('get-config', () => {
  const cfg = loadSharedConfig();
  return {
    apiKey: cfg.apiKey || '',
    hasKey: !!cfg.apiKey,
    apiKeyMasked: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}…` : ''
  };
});

ipcMain.handle('read-folder', (_e, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return { error: 'โฟลเดอร์ไม่ถูกต้องหรือไม่มีอยู่จริง' };
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) return { error: 'เส้นทางนี้ไม่ใช่โฟลเดอร์' };

    const files = fs.readdirSync(folderPath);
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
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

// Load image as base64 helper
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

// IPC Translation call
ipcMain.handle('translate-page', async (_e, { imagePath, glossary }) => {
  const cfg = loadSharedConfig();
  const apiKey = cfg.apiKey;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า API Key — กรุณาไปบันทึก API Key ในโปรแกรม ScreenTranslator ก่อนครับ');
  }

  // Load and encode image
  const base64Image = fileToBase64(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const model = 'gemini-1.5-pro'; // Use pro for high-fidelity translation
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Structure prompt using the memory/glossary if provided
  let glossaryText = '';
  if (glossary && Object.keys(glossary).length > 0) {
    glossaryText = `Follow this character and glossary naming memory exactly:\n${JSON.stringify(glossary, null, 2)}\n\n`;
  }

  const prompt = 
    `You are a professional manga/comic translator and layout analyst. ` +
    `Perform OCR on this comic page, detect all speech bubbles/text panels, and translate them from English into Thai.\n\n` +
    glossaryText +
    `Rules:\n` +
    `1. Keep characters' personalities, relationships, genders, and appropriate Thai pronouns consistent.\n` +
    `2. Identify the bounding boxes of each speech bubble/text panel. Return normalized 2D boxes [ymin, xmin, ymax, xmax] in the range 0 to 1000.\n` +
    `3. Output ONLY a valid JSON array, containing objects with keys: "bubble_id", "box_2d", "original_text", and "translated_text". Do not wrap in markdown tags like \`\`\`json.\n\n` +
    `Example Output format:\n` +
    `[\n` +
    `  {"bubble_id": 1, "box_2d": [100, 200, 250, 450], "original_text": "Hello", "translated_text": "สวัสดี"}\n` +
    `]`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }

  const outputText = (data.candidates?.[0]?.content?.parts || [])
    .map(p => p.text || '')
    .join('')
    .trim();

  try {
    return JSON.parse(outputText);
  } catch (err) {
    console.error('Failed to parse Gemini output as JSON:', outputText);
    throw new Error('Gemini ตอบกลับไม่ได้โครงสร้าง JSON ที่ถูกต้อง: ' + err.message);
  }
});

// Local project save/load handlers
ipcMain.handle('save-page-translation', (_e, { project, chapter, pageName, translationData }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project, chapter);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const file = path.join(dir, `${path.basename(pageName, path.extname(pageName))}.json`);
    fs.writeFileSync(file, JSON.stringify(translationData, null, 2), 'utf8');
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-page-translation', (_e, { project, chapter, pageName }) => {
  try {
    const file = path.join(PROJECTS_DIR, project, chapter, `${path.basename(pageName, path.extname(pageName))}.json`);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('save-memory', (_e, { project, memoryData }) => {
  try {
    const dir = path.join(PROJECTS_DIR, project);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, 'memory.json');
    fs.writeFileSync(file, JSON.stringify(memoryData, null, 2), 'utf8');
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('load-memory', (_e, { project }) => {
  try {
    const file = path.join(PROJECTS_DIR, project, 'memory.json');
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {}
  return {};
});
