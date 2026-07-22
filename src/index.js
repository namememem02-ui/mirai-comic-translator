window.addEventListener('error', (e) => {
  const errorMsg = `${e.message} at ${e.filename}:${e.lineno}:${e.colno}\nStack: ${e.error ? e.error.stack : ''}\n\n`;
  alert(`Renderer Error: ${errorMsg}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const errorMsg = `Unhandled Rejection: ${e.reason}\nStack: ${e.reason ? e.reason.stack : ''}\n\n`;
  alert(`Renderer Unhandled Rejection: ${errorMsg}`);
});

const meeARaiBrandController = window.MeeARaiBrand.initMeeARaiBrand(document);
window.addEventListener('beforeunload', () => meeARaiBrandController.destroy(), { once: true });

// UI Elements
const dropZone = document.getElementById('dropZone');
const folderInput = document.getElementById('folderInput');
const keyStatus = document.getElementById('keyStatus');
const inpaintStatus = document.getElementById('inpaintStatus');
const retryInpaintBtn = document.getElementById('retryInpaintBtn');
const projectInfo = document.getElementById('projectInfo');
const projName = document.getElementById('projName');
const projChapter = document.getElementById('projChapter');
const projChapterInput = document.getElementById('projChapter');
const refreshProjectsBtn = document.getElementById('refreshProjectsBtn');
const addBubbleTextBtn = document.getElementById('addBubbleTextBtn');
const thumbnailsList = document.getElementById('thumbnailsList');
const activePageTitle = document.getElementById('activePageTitle');
const translatePageBtn = document.getElementById('translatePageBtn');
const translateAllBtn = document.getElementById('translateAllBtn');
const previewToggleBtn = document.getElementById('previewToggleBtn');
const exportChapterBtn = document.getElementById('exportChapterBtn');
const chapterReviewBtn = document.getElementById('chapterReviewBtn');
const chapterFindReplaceBtn = document.getElementById('chapterFindReplaceBtn');
const viewportContainer = document.getElementById('viewportContainer');
const inlineTranslationEditor = document.getElementById('inlineTranslationEditor');
const inlineEditorStatus = document.getElementById('inlineEditorStatus');
const canvasWrapper = document.querySelector('.canvas-wrapper');
const activeImage = document.getElementById('activeImage');
const bubbleOverlay = document.getElementById('bubbleOverlay');
const placeholderView = document.getElementById('placeholderView');
const glossaryList = document.getElementById('glossaryList');
const addGlossaryBtn = document.getElementById('addGlossaryBtn');
const bubblesList = document.getElementById('bubblesList');
const canvasLoader = document.getElementById('canvasLoader');
const watermarkCanvas = document.getElementById('watermarkCanvas');
const watermarkToggleBtn = document.getElementById('watermarkToggleBtn');
const watermarkOptions = document.getElementById('watermarkOptions');
const selectWatermarkBtn = document.getElementById('selectWatermarkBtn');
const watermarkEnabled = document.getElementById('watermarkEnabled');
const watermarkOpacity = document.getElementById('watermarkOpacity');
const watermarkOpacityVal = document.getElementById('watermarkOpacityVal');
const watermarkSize = document.getElementById('watermarkSize');
const watermarkSizeVal = document.getElementById('watermarkSizeVal');
const removeWatermarkBtn = document.getElementById('removeWatermarkBtn');
const watermarkStatus = document.getElementById('watermarkStatus');
const chapterReviewOverlay = document.getElementById('chapterReviewOverlay');
const chapterReviewScroll = document.getElementById('chapterReviewScroll');
const chapterReviewColumn = document.getElementById('chapterReviewColumn');
const reviewPageSelector = document.getElementById('reviewPageSelector');
const chapterReviewCount = document.getElementById('chapterReviewCount');
const chapterReviewProgress = document.getElementById('chapterReviewProgress');
const chapterReviewProgressText = document.getElementById('chapterReviewProgressText');
const copyPreviousPageBtn = document.getElementById('copyPreviousPageBtn');
const copyPreviousPageDialog = document.getElementById('copyPreviousPageDialog');
const copyPreviousSourcePage = document.getElementById('copyPreviousSourcePage');
const copyPreviousCounts = document.getElementById('copyPreviousCounts');
const copyPreviousMode = document.getElementById('copyPreviousMode');
const copyPreviousWarning = document.getElementById('copyPreviousWarning');
const cancelCopyPreviousBtn = document.getElementById('cancelCopyPreviousBtn');
const confirmCopyPreviousBtn = document.getElementById('confirmCopyPreviousBtn');
const chapterFindReplaceDialog = document.getElementById('chapterFindReplaceDialog');
const findReplaceSearch = document.getElementById('findReplaceSearch');
const findReplaceReplacement = document.getElementById('findReplaceReplacement');
const findReplaceWholeWord = document.getElementById('findReplaceWholeWord');
const findReplaceRun = document.getElementById('findReplaceRun');
const findReplaceSelectAll = document.getElementById('findReplaceSelectAll');
const findReplaceSelectNone = document.getElementById('findReplaceSelectNone');
const findReplaceResults = document.getElementById('findReplaceResults');
const findReplaceSummary = document.getElementById('findReplaceSummary');
const findReplaceApply = document.getElementById('findReplaceApply');
const findReplaceUndo = document.getElementById('findReplaceUndo');
const findReplaceStatus = document.getElementById('findReplaceStatus');
const closeFindReplaceBtn = document.getElementById('closeFindReplaceBtn');
const backupProjectBtn = document.getElementById('backupProjectBtn');
const restoreProjectBtn = document.getElementById('restoreProjectBtn');
const projectBackupStatus = document.getElementById('projectBackupStatus');
const restoreProjectDialog = document.getElementById('restoreProjectDialog');
const restoreProjectSummary = document.getElementById('restoreProjectSummary');
const confirmRestoreProjectBtn = document.getElementById('confirmRestoreProjectBtn');
const cancelRestoreProjectBtn = document.getElementById('cancelRestoreProjectBtn');

// App State
let currentProject = '';
let currentChapter = '';
let images = [];
let activeIndex = -1;
let activePageTranslation = [];
let projectGlossary = {}; // { eng: thai }
const cleanedBgCache = {}; // { pageName: dataUrl }
const recentColors = ['#000000', '#ffffff', '#ef4444', '#f59e0b', '#3b82f6'];
const pageRenderGuard = window.RenderGuard.createRenderGuard();
let watermarkSettings = window.WatermarkGeometry.normalizeSettings({});
let watermarkImage = null;
let watermarkDrag = null;
let copyPreviousSourceBubbles = [];
let copyPreviousTargetIndex = -1;
let inlineEditorSession = null;
let findReplacePages = [];
let findReplaceMatches = [];
let findReplaceSelected = new Set();
let lastChapterReplaceUndo = null;
let pendingProjectRestoreToken = null;
const liveOverflowWarnings = new Map();
const liveOverflowContext = document.createElement('canvas').getContext('2d');

// App Settings (loaded from disk, applied globally)
let appSettings = {
  defaultFontSize: null,      // null = auto
  defaultFontFamily: 'Sarabun',
  defaultTextAlign: 'center',
  inpaintMode: 'full',        // 'full' | 'tight'
  uiScale: 115
};

// Undo / Redo stacks
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 30;

// Zoom state
let zoomLevel = 1.0;

// New DOM Element References (added in Phase 5)
const openSettingsBtn   = document.getElementById('openSettingsBtn');
const settingsDialog    = document.getElementById('settingsDialog');
const settingsTabs      = window.SettingsTabs.initSettingsTabs(settingsDialog);
const closeSettingsBtn  = document.getElementById('closeSettingsBtn');
const saveSettingsBtn   = document.getElementById('saveSettingsBtn');
const settingsSaveStatus     = document.getElementById('settingsSaveStatus');
const settingsApiKeyInput    = document.getElementById('settingsApiKeyInput');
const showApiKeyBtn          = document.getElementById('showApiKeyBtn');
const saveApiKeyBtn          = document.getElementById('saveApiKeyBtn');
const deleteApiKeyBtn        = document.getElementById('deleteApiKeyBtn');
const saveApiKeyStatus       = document.getElementById('saveApiKeyStatus');
const openGeminiApiKeyPageBtn = document.getElementById('openGeminiApiKeyPageBtn');
const openGeminiApiKeyPageStatus = document.getElementById('openGeminiApiKeyPageStatus');
const currentAppVersion = document.getElementById('currentAppVersion');
const checkForUpdatesBtn = document.getElementById('checkForUpdatesBtn');
const updateCheckStatus = document.getElementById('updateCheckStatus');
const updateReleaseNotes = document.getElementById('updateReleaseNotes');
const settingsFontSizeRange  = document.getElementById('settingsFontSizeRange');
const settingsFontSizeVal    = document.getElementById('settingsFontSizeVal');
const settingsFontSizeAuto   = document.getElementById('settingsFontSizeAuto');
const settingsFontFamily     = document.getElementById('settingsFontFamily');
const settingsInpaintMode    = document.getElementById('settingsInpaintMode');
const settingsUiScale        = document.getElementById('settingsUiScale');
const zoomInBtn              = document.getElementById('zoomInBtn');
const zoomOutBtn             = document.getElementById('zoomOutBtn');
const zoomResetBtn           = document.getElementById('zoomResetBtn');
const zoomLevelLabel         = document.getElementById('zoomLevelLabel');
const fitWidthBtn            = document.getElementById('fitWidthBtn');
const fitPageBtn             = document.getElementById('fitPageBtn');
const undoBtn                = document.getElementById('undoBtn');
const redoBtn                = document.getElementById('redoBtn');
const resetPageBtn           = document.getElementById('resetPageBtn');
const stopTranslateAllBtn    = document.getElementById('stopTranslateAllBtn');

async function refreshApiKeyStatus() {
  const config = await window.api.getConfig();
  const text = keyStatus.querySelector('.status-text');
  keyStatus.className = 'key-status';

  if (config.hasKey) {
    keyStatus.classList.add('connected');
    text.textContent = config.keyState === 'legacyUnsecured'
      ? `Gemini เชื่อมต่อแล้ว (${config.apiKeyMasked}) — รอ Windows เข้ารหัส`
      : `Gemini เชื่อมต่อแล้ว (${config.apiKeyMasked})`;
    settingsApiKeyInput.placeholder = `${config.apiKeyMasked} (กรอกใหม่เพื่อเปลี่ยน)`;
  } else {
    keyStatus.classList.add('disconnected');
    text.textContent = config.keyState === 'needsKey'
      ? 'ยังไม่ได้ตั้งค่า API Key'
      : 'ไม่สามารถอ่าน API Key ได้ กรุณากรอกใหม่';
    settingsApiKeyInput.placeholder = 'AIza...';
  }

  return config;
}

// 1. Initialize API Config + App Settings
async function initApp() {
  // Load app settings first
  const savedSettings = await window.api.loadAppSettings();
  if (savedSettings && typeof savedSettings === 'object') {
    Object.assign(appSettings, savedSettings);
  }
  appSettings.uiScale = window.UiScale.applyUiScale(document.documentElement, appSettings.uiScale);

  // Apply settings to the Settings Dialog UI
  applySettingsToDialog();

  const renderInpaintStatus = status => {
    const state = status?.state || 'unavailable';
    inpaintStatus.className = `key-status ${state === 'ready' ? 'connected' : state === 'starting' ? 'checking' : 'disconnected'}`;
    inpaintStatus.querySelector('.status-text').textContent = state === 'ready'
      ? 'AI รีทัชพร้อม'
      : state === 'starting' ? 'กำลังเปิด AI รีทัช...' : 'AI รีทัชไม่พร้อม';
    inpaintStatus.title = status?.message || 'สถานะระบบลบตัวอักษรต้นฉบับ';
    retryInpaintBtn.style.display = state === 'unavailable' ? 'inline-flex' : 'none';
  };
  renderInpaintStatus(await window.api.getInpaintStatus());
  window.api.onInpaintStatus(renderInpaintStatus);
  retryInpaintBtn.addEventListener('click', async event => {
    event.stopPropagation();
    retryInpaintBtn.disabled = true;
    renderInpaintStatus({ state: 'starting', message: 'กำลังลองเปิดใหม่' });
    renderInpaintStatus(await window.api.retryInpaintSidecar());
    retryInpaintBtn.disabled = false;
  });

  // Then load renderer-safe API key metadata.
  const cfg = await refreshApiKeyStatus();

  // Load Saved Projects List on startup
  updateSavedProjectsList();

  if (cfg.lastFolderPath) {
    loadFolder(cfg.lastFolderPath, true);
  }
}

initApp();

function formatProjectBackupBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = value;
  let unitIndex = -1;
  do {
    amount /= 1024;
    unitIndex += 1;
  } while (amount >= 1024 && unitIndex < units.length - 1);
  return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(amount)} ${units[unitIndex]}`;
}

function renderProjectRestoreSummary(summary) {
  const fields = [
    ['โครงการต้นฉบับ', summary.originalProjectName],
    ['รูปแบบไฟล์สำรอง', summary.backupVersion],
    ['เวอร์ชันแอป', summary.appVersion],
    ['เวอร์ชันโครงสร้าง', summary.schemaVersion],
    ['จำนวนตอน', summary.chapterCount],
    ['จำนวนภาพ', summary.imageCount],
    ['ขนาดข้อมูล', formatProjectBackupBytes(summary.totalUncompressedBytes)],
  ];
  const list = document.createElement('dl');
  fields.forEach(([label, value]) => {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = String(value);
    list.append(term, detail);
  });
  restoreProjectSummary.replaceChildren(list);
}

function isValidProjectBackupSummary(summary) {
  return summary && typeof summary === 'object'
    && typeof summary.originalProjectName === 'string' && summary.originalProjectName.length > 0
    && typeof summary.backupVersion === 'string' && summary.backupVersion.length > 0
    && typeof summary.appVersion === 'string'
    && Number.isSafeInteger(summary.schemaVersion)
    && Number.isSafeInteger(summary.chapterCount) && summary.chapterCount >= 0
    && Number.isSafeInteger(summary.imageCount) && summary.imageCount >= 0
    && Number.isSafeInteger(summary.totalUncompressedBytes) && summary.totalUncompressedBytes >= 0;
}

async function backupCurrentProject() {
  if (!currentProject) return;
  projectBackupStatus.textContent = '';
  backupProjectBtn.disabled = true;
  restoreProjectBtn.disabled = true;
  try {
    projectBackupStatus.textContent = 'กำลังสร้างไฟล์สำรองโครงการ…';
    const result = await window.api.backupProject({ project: currentProject });
    if (result?.canceled) return;
    if (!result || result.success !== true) {
      projectBackupStatus.textContent = 'ไม่สามารถสำรองโครงการได้ กรุณาลองอีกครั้ง';
      return;
    }
    projectBackupStatus.textContent = `สำรองโครงการ ${currentProject} เรียบร้อยแล้ว`;
  } catch (_) {
    projectBackupStatus.textContent = 'ไม่สามารถสำรองโครงการได้ กรุณาลองอีกครั้ง';
  } finally {
    backupProjectBtn.disabled = !currentProject;
    restoreProjectBtn.disabled = false;
  }
}

async function inspectBackupForRestore() {
  projectBackupStatus.textContent = '';
  pendingProjectRestoreToken = null;
  backupProjectBtn.disabled = true;
  restoreProjectBtn.disabled = true;
  try {
    projectBackupStatus.textContent = 'กำลังตรวจสอบไฟล์สำรอง…';
    const result = await window.api.inspectProjectBackup();
    if (result?.canceled) return;
    if (!result || typeof result.token !== 'string' || !result.token || !isValidProjectBackupSummary(result.summary)) {
      projectBackupStatus.textContent = result?.error
        ? 'ไม่สามารถตรวจสอบไฟล์สำรองได้ กรุณาลองอีกครั้ง'
        : 'ข้อมูลไฟล์สำรองไม่สมบูรณ์ กรุณาเลือกไฟล์ใหม่';
      return;
    }
    const summary = result.summary;
    pendingProjectRestoreToken = result.token;
    renderProjectRestoreSummary(summary);
    restoreProjectDialog.showModal();
  } catch (_) {
    pendingProjectRestoreToken = null;
    projectBackupStatus.textContent = 'ไม่สามารถตรวจสอบไฟล์สำรองได้ กรุณาลองอีกครั้ง';
  } finally {
    backupProjectBtn.disabled = !currentProject;
    restoreProjectBtn.disabled = false;
  }
}

async function confirmProjectRestore() {
  const token = pendingProjectRestoreToken;
  pendingProjectRestoreToken = null;
  if (!token) {
    projectBackupStatus.textContent = 'คำขอกู้คืนหมดอายุ กรุณาเลือกไฟล์สำรองใหม่';
    restoreProjectDialog.close();
    return;
  }
  confirmRestoreProjectBtn.disabled = true;
  cancelRestoreProjectBtn.disabled = true;
  try {
    projectBackupStatus.textContent = 'กำลังกู้คืนโครงการ…';
    const result = await window.api.confirmRestoreProject({ token });
    if (!result || result.success !== true || typeof result.project !== 'string' || !result.project) {
      restoreProjectDialog.close();
      projectBackupStatus.textContent = 'ไม่สามารถกู้คืนโครงการได้ กรุณาเลือกไฟล์สำรองใหม่';
      return;
    }
    restoreProjectDialog.close();
    projectBackupStatus.textContent = `กู้คืนเป็นสำเนาใหม่ “${result.project}” เรียบร้อยแล้ว`;
    updateSavedProjectsList();
  } catch (_) {
    restoreProjectDialog.close();
    projectBackupStatus.textContent = 'ไม่สามารถกู้คืนโครงการได้ กรุณาเลือกไฟล์สำรองใหม่';
  } finally {
    confirmRestoreProjectBtn.disabled = false;
    cancelRestoreProjectBtn.disabled = false;
  }
}

function invalidatePendingProjectRestore() {
  const token = pendingProjectRestoreToken;
  pendingProjectRestoreToken = null;
  if (token) {
    try {
      Promise.resolve(window.api.confirmRestoreProject({ token, cancel: true })).catch(() => {});
    } catch (_) {}
  }
}

function cancelProjectRestore() {
  invalidatePendingProjectRestore();
  if (restoreProjectDialog.open) restoreProjectDialog.close();
}

backupProjectBtn.addEventListener('click', backupCurrentProject);
restoreProjectBtn.addEventListener('click', inspectBackupForRestore);
confirmRestoreProjectBtn.addEventListener('click', confirmProjectRestore);
cancelRestoreProjectBtn.addEventListener('click', cancelProjectRestore);
restoreProjectDialog.addEventListener('cancel', event => {
  event.preventDefault();
  cancelProjectRestore();
});
restoreProjectDialog.addEventListener('close', () => {
  invalidatePendingProjectRestore();
});
restoreProjectDialog.addEventListener('click', event => {
  if (event.target === restoreProjectDialog) cancelProjectRestore();
});

// ==========================================================
// Phase 5: Settings Dialog
// ==========================================================

function applySettingsToDialog() {
  settingsUiScale.value = String(window.UiScale.normalizeUiScale(appSettings.uiScale));
  // Font Size
  if (appSettings.defaultFontSize) {
    settingsFontSizeAuto.checked = false;
    settingsFontSizeRange.disabled = false;
    settingsFontSizeRange.value = appSettings.defaultFontSize;
    settingsFontSizeVal.textContent = `${appSettings.defaultFontSize}px`;
  } else {
    settingsFontSizeAuto.checked = true;
    settingsFontSizeRange.disabled = true;
    settingsFontSizeVal.textContent = 'ออโต้';
  }
  // Font Family
  settingsFontFamily.value = appSettings.defaultFontFamily || 'Sarabun';
  // Inpaint Mode
  settingsInpaintMode.value = appSettings.inpaintMode || 'full';
  // Text Align buttons
  document.querySelectorAll('.align-btn').forEach(btn => {
    const isActive = btn.dataset.align === (appSettings.defaultTextAlign || 'center');
    btn.style.background = isActive ? '#3b82f6' : '#1e293b';
    btn.style.borderColor = isActive ? '#3b82f6' : '#334155';
    btn.style.color = isActive ? '#fff' : '#94a3b8';
  });
}

let savedUiScale = 115;
let settingsSaved = false;

async function refreshUpdateInfo() {
  try {
    const info = await window.api.getUpdateInfo();
    currentAppVersion.textContent = info.currentVersion;
    if (!info.configured) updateCheckStatus.textContent = 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อัปเดต';
  } catch {
    currentAppVersion.textContent = 'ไม่ทราบ';
  }
}

function renderUpdateResult(result) {
  updateReleaseNotes.hidden = true;
  updateReleaseNotes.textContent = '';
  switch (result?.status) {
    case 'not-configured':
      updateCheckStatus.textContent = 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อัปเดต';
      break;
    case 'current':
      updateCheckStatus.textContent = `✅ เป็นเวอร์ชันล่าสุดแล้ว (${result.currentVersion})`;
      break;
    case 'available':
      updateCheckStatus.textContent = `⬆️ พบเวอร์ชันใหม่ ${result.latestVersion}`;
      if (result.releaseNotes) {
        updateReleaseNotes.textContent = result.releaseNotes;
        updateReleaseNotes.hidden = false;
      }
      break;
    case 'error':
      updateCheckStatus.textContent = `❌ ${result.message}`;
      break;
    default:
      updateCheckStatus.textContent = 'ตรวจสอบอัปเดตไม่สำเร็จ';
  }
}

function applyUiScale(value) {
  appSettings.uiScale = window.UiScale.applyUiScale(document.documentElement, value);
  requestAnimationFrame(() => {
    if (activeIndex >= 0 && (viewMode === 'fit-width' || viewMode === 'fit-page')) applyViewMode(viewMode);
  });
}

function restoreSavedUiScale() {
  if (!settingsSaved) applyUiScale(savedUiScale);
}

openSettingsBtn.addEventListener('click', () => {
  savedUiScale = window.UiScale.normalizeUiScale(appSettings.uiScale);
  settingsSaved = false;
  applySettingsToDialog();
  settingsDialog.showModal();
  refreshUpdateInfo();
});

closeSettingsBtn.addEventListener('click', () => { restoreSavedUiScale(); settingsDialog.close(); });

// Click backdrop to close
settingsDialog.addEventListener('click', (e) => {
  if (e.target === settingsDialog) { restoreSavedUiScale(); settingsDialog.close(); }
});

settingsUiScale.addEventListener('change', () => applyUiScale(settingsUiScale.value));

// Show/hide API Key
showApiKeyBtn.addEventListener('click', () => {
  settingsApiKeyInput.type = settingsApiKeyInput.type === 'password' ? 'text' : 'password';
  showApiKeyBtn.textContent = settingsApiKeyInput.type === 'password' ? '👁️' : '🔒';
});

// Save API Key only
saveApiKeyBtn.addEventListener('click', async () => {
  const key = settingsApiKeyInput.value.trim();
  if (!key) {
    saveApiKeyStatus.textContent = '⚠️ กรุณากรอก API Key';
    saveApiKeyStatus.style.color = '#f59e0b';
    return;
  }
  saveApiKeyStatus.textContent = '💾 กำลังบันทึก...';
  settingsApiKeyInput.value = '';
  const res = await window.api.saveApiKey({ apiKey: key });
  if (res && res.success) {
    saveApiKeyStatus.textContent = '✅ บันทึก Key แล้ว';
    saveApiKeyStatus.style.color = '#10b981';
    await refreshApiKeyStatus();
  } else {
    saveApiKeyStatus.textContent = `❌ ${res?.error || 'บันทึกล้มเหลว'}`;
    saveApiKeyStatus.style.color = '#ef4444';
  }
  setTimeout(() => saveApiKeyStatus.textContent = '', 3000);
});

deleteApiKeyBtn.addEventListener('click', async () => {
  if (!window.confirm('ลบ Gemini API Key ที่บันทึกไว้หรือไม่?')) return;
  settingsApiKeyInput.value = '';
  saveApiKeyStatus.textContent = 'กำลังลบ API Key...';
  const res = await window.api.deleteApiKey();
  if (res && res.success) {
    saveApiKeyStatus.textContent = '✅ ลบ API Key แล้ว';
    saveApiKeyStatus.style.color = '#10b981';
    await refreshApiKeyStatus();
  } else {
    saveApiKeyStatus.textContent = `❌ ${res?.error || 'ลบ API Key ไม่สำเร็จ'}`;
    saveApiKeyStatus.style.color = '#ef4444';
  }
  setTimeout(() => saveApiKeyStatus.textContent = '', 3000);
});

openGeminiApiKeyPageBtn.addEventListener('click', async () => {
  openGeminiApiKeyPageBtn.disabled = true;
  openGeminiApiKeyPageStatus.textContent = 'กำลังเปิด Google AI Studio...';
  try {
    await window.api.openGeminiApiKeyPage();
    openGeminiApiKeyPageStatus.textContent = '';
  } catch {
    openGeminiApiKeyPageStatus.textContent = 'เปิดหน้า Google AI Studio ไม่สำเร็จ';
  } finally {
    openGeminiApiKeyPageBtn.disabled = false;
  }
});

checkForUpdatesBtn.addEventListener('click', async () => {
  checkForUpdatesBtn.disabled = true;
  checkForUpdatesBtn.textContent = 'กำลังตรวจสอบ...';
  updateCheckStatus.textContent = 'กำลังเชื่อมต่อเซิร์ฟเวอร์อัปเดต...';
  updateReleaseNotes.hidden = true;
  try {
    renderUpdateResult(await window.api.checkForUpdates());
  } catch {
    renderUpdateResult({ status: 'error', message: 'ตรวจสอบอัปเดตไม่สำเร็จ' });
  } finally {
    checkForUpdatesBtn.disabled = false;
    checkForUpdatesBtn.textContent = 'ตรวจสอบอัปเดต';
  }
});

// Font Size slider in settings
settingsFontSizeRange.addEventListener('input', (e) => {
  settingsFontSizeVal.textContent = `${e.target.value}px`;
});

settingsFontSizeAuto.addEventListener('change', (e) => {
  if (e.target.checked) {
    settingsFontSizeRange.disabled = true;
    settingsFontSizeVal.textContent = 'ออโต้';
  } else {
    settingsFontSizeRange.disabled = false;
    settingsFontSizeVal.textContent = `${settingsFontSizeRange.value}px`;
  }
});

// Alignment buttons in settings
document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.align-btn').forEach(b => {
      b.style.background = '#1e293b';
      b.style.borderColor = '#334155';
      b.style.color = '#94a3b8';
    });
    btn.style.background = '#3b82f6';
    btn.style.borderColor = '#3b82f6';
    btn.style.color = '#fff';
    appSettings.defaultTextAlign = btn.dataset.align;
  });
});

// Save all settings
saveSettingsBtn.addEventListener('click', async () => {
  appSettings.defaultFontSize = settingsFontSizeAuto.checked ? null : parseInt(settingsFontSizeRange.value);
  appSettings.defaultFontFamily = settingsFontFamily.value;
  appSettings.inpaintMode = settingsInpaintMode.value;
  appSettings.uiScale = window.UiScale.normalizeUiScale(settingsUiScale.value);
  // defaultTextAlign already set by align-btn click

  const res = await window.api.saveAppSettings(appSettings);
  if (res && res.success) {
    savedUiScale = appSettings.uiScale;
    settingsSaved = true;
    settingsSaveStatus.textContent = '✅ บันทึกแล้ว!';
    settingsSaveStatus.style.color = '#10b981';
    setTimeout(() => {
      settingsSaveStatus.textContent = '';
      settingsDialog.close();
    }, 1200);
  } else {
    settingsSaveStatus.textContent = '❌ บันทึกล้มเหลว';
    settingsSaveStatus.style.color = '#ef4444';
  }
});

// ==========================================================
// Phase 5: Undo / Redo
// ==========================================================

function pushUndoState() {
  if (activePageTranslation.length === 0 && undoStack.length === 0) return;
  undoStack.push(JSON.parse(JSON.stringify(activePageTranslation)));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
  undoBtn.style.opacity = undoStack.length === 0 ? '0.35' : '1';
  redoBtn.style.opacity = redoStack.length === 0 ? '0.35' : '1';
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.parse(JSON.stringify(activePageTranslation)));
  activePageTranslation = undoStack.pop();
  saveCurrentPageTranslation();
  renderPageTranslation();
  if (isPreviewMode) refreshTypesetView();
  updateUndoRedoBtns();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.parse(JSON.stringify(activePageTranslation)));
  activePageTranslation = redoStack.pop();
  saveCurrentPageTranslation();
  renderPageTranslation();
  if (isPreviewMode) refreshTypesetView();
  updateUndoRedoBtns();
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

// ==========================================================
// Inline translation editor (Thai preview only)
// ==========================================================

function getInlineDisplayText(bubble) {
  const activePage = images[activeIndex];
  if (inlineEditorSession
    && inlineEditorSession.pageIndex === activeIndex
    && inlineEditorSession.pageName === activePage?.name
    && inlineEditorSession.bubbleId === bubble?.bubble_id) {
    return inlineEditorSession.draft;
  }
  return bubble?.translated_text || '';
}

function hideInlineEditorSurface() {
  inlineTranslationEditor.hidden = true;
  inlineTranslationEditor.classList.remove('is-error', 'is-composing');
  inlineEditorStatus.textContent = '';
  inlineEditorStatus.hidden = true;
}

function cancelInlineEditor() {
  if (!inlineEditorSession) return;
  inlineEditorSession = null;
  hideInlineEditorSurface();
  if (isPreviewMode) refreshTypesetView();
}

function openInlineEditor(bubble) {
  const activePage = images[activeIndex];
  if (!isPreviewMode || !activePage || !bubble || bubble.hidden) return;
  if (inlineEditorSession) cancelInlineEditor();

  const text = bubble.translated_text || '';
  inlineEditorSession = {
    pageIndex: activeIndex,
    pageName: activePage.name,
    bubbleId: bubble.bubble_id,
    originalText: text,
    draft: text,
    composing: false
  };

  const style = window.InlineEditor.buildEditorStyle(bubble);
  Object.assign(inlineTranslationEditor.style, style);
  inlineEditorStatus.style.left = style.left;
  inlineEditorStatus.style.top = `calc(${style.top} + ${style.height} + 6px)`;
  const viewportWidth = Math.max(1, viewportContainer.getBoundingClientRect().width);
  const imageWidth = Math.max(1, activeImage.naturalWidth || viewportWidth);
  inlineTranslationEditor.style.fontSize = `${Math.max(12, Math.min(48, Number(bubble.font_size || 18) * viewportWidth / imageWidth))}px`;
  inlineTranslationEditor.value = text;
  inlineTranslationEditor.hidden = false;
  inlineTranslationEditor.classList.remove('is-error', 'is-composing');
  inlineEditorStatus.textContent = '';
  inlineEditorStatus.hidden = true;
  focusCard(bubble.bubble_id);
  requestAnimationFrame(() => {
    inlineTranslationEditor.focus();
    inlineTranslationEditor.select();
  });
}

async function confirmInlineEditor() {
  if (!inlineEditorSession) return;
  const session = inlineEditorSession;
  const activePage = images[activeIndex];
  const bubble = activePageTranslation.find(item => item.bubble_id === session.bubbleId);
  if (!activePage || activeIndex !== session.pageIndex || activePage.name !== session.pageName || !bubble) {
    cancelInlineEditor();
    return;
  }

  const originalText = bubble.translated_text || '';
  const undoLengthBeforeInline = undoStack.length;
  pushUndoState();
  bubble.translated_text = inlineEditorSession.draft;
  let saveResult;
  try {
    saveResult = await saveCurrentPageTranslation(inlineEditorSession.pageIndex, activePageTranslation);
  } catch (saveError) {
    saveResult = { error: saveError.message || String(saveError) };
  }

  if (saveResult !== true) {
    bubble.translated_text = originalText;
    undoStack.length = undoLengthBeforeInline;
    redoStack.length = 0;
    updateUndoRedoBtns();
    renderPageTranslation();
    if (isPreviewMode) refreshTypesetView();
    inlineEditorSession = session;
    inlineTranslationEditor.classList.add('is-error');
    inlineEditorStatus.textContent = 'บันทึกไม่สำเร็จ ข้อความเดิมยังไม่ถูกเปลี่ยน กรุณาลองอีกครั้ง';
    inlineEditorStatus.hidden = false;
    inlineTranslationEditor.focus();
    return;
  }

  inlineEditorSession = null;
  hideInlineEditorSurface();
  renderPageTranslation();
  if (isPreviewMode) refreshTypesetView();
}

inlineTranslationEditor.addEventListener('input', () => {
  if (!inlineEditorSession) return;
  inlineEditorSession.draft = inlineTranslationEditor.value;
  inlineTranslationEditor.classList.remove('is-error');
  inlineEditorStatus.textContent = '';
  inlineEditorStatus.hidden = true;
  refreshTypesetView();
});

inlineTranslationEditor.addEventListener('compositionstart', () => {
  if (!inlineEditorSession) return;
  inlineEditorSession.composing = true;
  inlineTranslationEditor.classList.add('is-composing');
});

inlineTranslationEditor.addEventListener('compositionend', () => {
  if (!inlineEditorSession) return;
  inlineEditorSession.composing = false;
  inlineTranslationEditor.classList.remove('is-composing');
});

inlineTranslationEditor.addEventListener('keydown', (event) => {
  const action = window.InlineEditor.normalizeInlineShortcut(
    event,
    Boolean(inlineEditorSession?.composing || event.isComposing)
  );
  if (action === 'confirm') {
    event.preventDefault();
    confirmInlineEditor();
  } else if (action === 'cancel') {
    event.preventDefault();
    cancelInlineEditor();
  }
});

viewportContainer.addEventListener('dblclick', (event) => {
  if (!isPreviewMode) return;
  if (event.target === inlineTranslationEditor) return;
  const bounds = viewportContainer.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;
  const x = ((event.clientX - bounds.left) / bounds.width) * 1000;
  const y = ((event.clientY - bounds.top) / bounds.height) * 1000;
  const bubble = window.InlineEditor.findBubbleAtPoint(activePageTranslation, x, y);
  if (!bubble) return;
  event.preventDefault();
  event.stopPropagation();
  openInlineEditor(bubble);
}, true);

document.addEventListener('pointerdown', (event) => {
  if (!inlineEditorSession || event.target === inlineTranslationEditor) return;
  cancelInlineEditor();
}, true);

// ==========================================================
// Copy translation from the immediately previous page
// ==========================================================

function renderCopyPreviousPreview() {
  const preview = window.CopyPreviousPage.buildCopyPreview({
    source: copyPreviousSourceBubbles,
    current: activePageTranslation,
    mode: copyPreviousMode.value
  });

  if (copyPreviousMode.value === 'full-bubble') {
    copyPreviousCounts.textContent = `เพิ่ม ${preview.appendedCount} กรอบต่อท้าย ${preview.currentCount} กรอบเดิม`;
  } else {
    copyPreviousCounts.textContent = `จับคู่ได้ ${preview.pairedCount} จากหน้าก่อน ${preview.sourceCount} กรอบ และหน้าปัจจุบัน ${preview.currentCount} กรอบ`;
  }

  const warnings = [];
  if (preview.sourceCount === 0) warnings.push('หน้าก่อนไม่มีคำแปลที่บันทึกไว้');
  if (preview.unmatchedSourceCount) warnings.push(`กรอบจากหน้าก่อนเหลือ ${preview.unmatchedSourceCount} กรอบ`);
  if (preview.unmatchedCurrentCount) warnings.push(`กรอบหน้าปัจจุบันเหลือ ${preview.unmatchedCurrentCount} กรอบ`);
  copyPreviousWarning.textContent = warnings.join(' • ');
  confirmCopyPreviousBtn.disabled = !preview.canConfirm;
}

copyPreviousPageBtn.addEventListener('click', async () => {
  cancelInlineEditor();
  if (activeIndex <= 0 || !images[activeIndex]) return;
  const copyRequestIndex = activeIndex;
  const copyTargetPage = images[copyRequestIndex];
  const copySourcePage = images[copyRequestIndex - 1];

  copyPreviousPageBtn.disabled = true;
  let loaded = [];
  let copyLoadMessage = '';
  try {
    loaded = await window.api.loadPageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: copySourcePage.name
    });
  } catch (loadError) {
    copyLoadMessage = `โหลดคำแปลหน้าก่อนไม่สำเร็จ: ${loadError.message || loadError}`;
  }
  if (activeIndex !== copyRequestIndex || images[activeIndex]?.name !== copyTargetPage.name) return;

  copyPreviousTargetIndex = copyRequestIndex;
  copyPreviousSourceBubbles = Array.isArray(loaded) ? loaded : [];
  copyPreviousMode.value = 'text';
  copyPreviousSourcePage.textContent = copySourcePage.name;
  renderCopyPreviousPreview();
  if (copyLoadMessage) copyPreviousWarning.textContent = copyLoadMessage;
  copyPreviousPageDialog.showModal();
  copyPreviousPageBtn.disabled = activeIndex <= 0;
});

copyPreviousMode.addEventListener('change', renderCopyPreviousPreview);
cancelCopyPreviousBtn.addEventListener('click', () => copyPreviousPageDialog.close());

confirmCopyPreviousBtn.addEventListener('click', async () => {
  const copyTargetIndex = copyPreviousTargetIndex;
  const copyTargetPage = images[copyTargetIndex];
  if (!copyTargetPage || copyTargetIndex !== activeIndex) {
    copyPreviousPageDialog.close();
    return;
  }

  const previousTranslation = JSON.parse(JSON.stringify(activePageTranslation));
  const undoLengthBeforeCopy = undoStack.length;
  const copyResult = window.CopyPreviousPage.copyPreviousPage({
    source: copyPreviousSourceBubbles,
    current: activePageTranslation,
    mode: copyPreviousMode.value
  });

  confirmCopyPreviousBtn.disabled = true;
  pushUndoState();
  activePageTranslation = copyResult;
  delete cleanedBgCache[copyTargetPage.name];
  let saveResult;
  try {
    saveResult = await saveCurrentPageTranslation(copyTargetIndex, copyResult);
  } catch (saveError) {
    saveResult = { error: saveError.message || String(saveError) };
  }

  if (saveResult !== true) {
    if (activeIndex === copyTargetIndex && images[activeIndex]?.name === copyTargetPage.name) {
      activePageTranslation = previousTranslation;
      undoStack.length = undoLengthBeforeCopy;
      redoStack.length = 0;
      updateUndoRedoBtns();
      renderPageTranslation();
      if (isPreviewMode) refreshTypesetView();
      copyPreviousWarning.textContent = 'บันทึกไม่สำเร็จ ข้อมูลเดิมถูกคืนกลับแล้ว กรุณาลองอีกครั้ง';
      confirmCopyPreviousBtn.disabled = false;
    }
    return;
  }

  if (activeIndex === copyTargetIndex && images[activeIndex]?.name === copyTargetPage.name) {
    renderPageTranslation();
    if (isPreviewMode) refreshTypesetView();
    copyPreviousPageDialog.close();
  }
});

// ==========================================================
// Phase 5: Viewport Zoom — Slider, 10%–1000%, proper scroll
// ==========================================================

// Base width captured when image first loads (the "fit" width at 100%)
let baseViewportWidth = 0;
let viewMode = 'fit-width';

function captureBaseWidth() {
  if (!activeImage.naturalWidth || !canvasWrapper) return;
  const availableWidth = Math.max(1, canvasWrapper.clientWidth - 32);
  baseViewportWidth = activeImage.naturalWidth * window.BubbleGeometry.calculateFitScale(
    activeImage.naturalWidth,
    activeImage.naturalHeight,
    availableWidth,
    Math.max(1, canvasWrapper.clientHeight - 32),
    'fit-width'
  );
}

function updateViewModeButtons() {
  fitWidthBtn.classList.toggle('active', viewMode === 'fit-width');
  fitPageBtn.classList.toggle('active', viewMode === 'fit-page');
}

function applyViewMode(mode) {
  if (!activeImage.naturalWidth || !activeImage.naturalHeight || !canvasWrapper) return;

  const availableWidth = Math.max(1, canvasWrapper.clientWidth - 32);
  const availableHeight = Math.max(1, canvasWrapper.clientHeight - 32);
  const scale = window.BubbleGeometry.calculateFitScale(
    activeImage.naturalWidth,
    activeImage.naturalHeight,
    availableWidth,
    availableHeight,
    mode
  );

  captureBaseWidth();
  viewMode = mode;
  viewportContainer.style.width = `${Math.round(activeImage.naturalWidth * scale)}px`;
  viewportContainer.style.transform = '';
  zoomLevel = baseViewportWidth > 0
    ? (activeImage.naturalWidth * scale) / baseViewportWidth
    : 1;
  zoomSlider.value = Math.max(10, Math.min(1000, Math.round(zoomLevel * 100)));
  zoomLevelLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
  updateViewModeButtons();
  requestAnimationFrame(updateSVGOverlayOnly);
}

function setZoom(level) {
  zoomLevel = Math.max(0.1, Math.min(10.0, level));
  viewMode = 'custom';
  updateViewModeButtons();

  if (baseViewportWidth > 0) {
    const targetW = Math.round(baseViewportWidth * zoomLevel);
    // Set explicit width on viewportContainer — image is width:100%, overlays are absolute 100%
    // This makes the whole stack (image + SVG + canvases) resize together
    viewportContainer.style.width = targetW + 'px';
    // Remove any stale CSS transform from the old approach
    viewportContainer.style.transform = '';
  }

  // Sync slider
  const slider = document.getElementById('zoomSlider');
  if (slider) slider.value = Math.round(zoomLevel * 100);

  zoomLevelLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
  requestAnimationFrame(updateSVGOverlayOnly);
}

// Zoom Slider
const zoomSlider = document.getElementById('zoomSlider');
if (zoomSlider) {
  zoomSlider.addEventListener('input', (e) => {
    setZoom(parseInt(e.target.value) / 100);
  });
}

// Reset button
zoomResetBtn.addEventListener('click', () => {
  applyViewMode('fit-width');
});

fitWidthBtn.addEventListener('click', () => applyViewMode('fit-width'));
fitPageBtn.addEventListener('click', () => applyViewMode('fit-page'));

// Ctrl + Scroll Wheel zoom
document.querySelector('.viewport-panel').addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  // If we haven't captured base width yet, do it now
  if (baseViewportWidth === 0) captureBaseWidth();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  setZoom(zoomLevel + delta);
}, { passive: false });

window.addEventListener('resize', () => {
  if (viewMode === 'fit-width' || viewMode === 'fit-page') {
    requestAnimationFrame(() => applyViewMode(viewMode));
  }
});

// ==========================================================
// Phase 5: Reset Page Translation
// ==========================================================

if (resetPageBtn) {
  resetPageBtn.addEventListener('click', async () => {
    cancelInlineEditor();
    const activePage = images[activeIndex];
    if (!activePage) return;
    if (!confirm(`ลบการแปลหน้า "${activePage.name}" ทิ้งทั้งหมดใช่หรือไม่?\nสามารถแปลหน้านี้ใหม่ได้ด้วยปุ่ม "แปลหน้านี้"`)) return;

    pushUndoState();
    await window.api.deletePageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: activePage.name
    });

    delete cleanedBgCache[activePage.name];
    activePageTranslation = [];

    // Update thumbnail status
    const items = thumbnailsList.querySelectorAll('.thumb-item');
    const activeItem = items[activeIndex];
    if (activeItem) {
      const status = activeItem.querySelector('.thumb-status');
      if (status) {
        status.className = 'thumb-status';
        status.innerHTML = '<span>⏳ ยังไม่ได้แปล</span>';
      }
    }

    renderPlaceholder();
    bubbleOverlay.innerHTML = '';
    if (isPreviewMode) {
      activeImage.src = activePage.fileUrl;
      const typesetCanvas = document.getElementById('typesetTextCanvas');
      if (typesetCanvas) {
        const ctx = typesetCanvas.getContext('2d');
        ctx.clearRect(0, 0, typesetCanvas.width, typesetCanvas.height);
      }
    }
    updateUndoRedoBtns();
  });
}

// ==========================================================
// Phase 5 Batch B: B3 — Search / Filter Bubbles
// ==========================================================

const bubblesSearchInput = document.getElementById('bubblesSearchInput');
const bubblesClearSearchBtn = document.getElementById('bubblesClearSearchBtn');
const bubbleIssueFilters = document.getElementById('bubbleIssueFilters');
const bubbleFilterPrevious = document.getElementById('bubbleFilterPrevious');
const bubbleFilterNext = document.getElementById('bubbleFilterNext');
const bubbleFilterResultCount = document.getElementById('bubbleFilterResultCount');
const bubbleFilterEmpty = document.getElementById('bubbleFilterEmpty');
let activeBubbleIssueFilter = 'all';

function applyBubbleListFilters() {
  const query = (bubblesSearchInput?.value || '').trim().toLowerCase();
  const cards = bubblesList.querySelectorAll('.bubble-editor-card');
  let visibleCount = 0;
  cards.forEach(card => {
    const id = card.getAttribute('data-id');
    const bubble = activePageTranslation.find(b => String(b.bubble_id) === id);
    if (!bubble) { card.hidden = true; return; }
    const warning = liveOverflowWarnings.get(bubble.bubble_id);
    const haystack = ((bubble.original_text || '') + ' ' + (bubble.translated_text || '')).toLowerCase();
    const visible = haystack.includes(query)
      && window.BubbleIssueFilter.matchesBubbleFilter(bubble, warning, activeBubbleIssueFilter);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  if (bubblesClearSearchBtn) bubblesClearSearchBtn.style.display = query ? 'block' : 'none';
  const badge = document.getElementById('bubblesCountBadge');
  if (badge) badge.textContent = `${visibleCount}/${activePageTranslation.length} บอลลูน`;
  bubbleFilterResultCount.textContent = `${visibleCount} ผลลัพธ์`;
  bubbleFilterEmpty.hidden = visibleCount > 0 || activePageTranslation.length === 0;
  bubbleFilterPrevious.disabled = visibleCount === 0;
  bubbleFilterNext.disabled = visibleCount === 0;
}

function refreshBubbleIssueFilters() {
  const counts = window.BubbleIssueFilter.countBubbleIssues(activePageTranslation, liveOverflowWarnings);
  bubbleIssueFilters.querySelectorAll('button[data-filter]').forEach(button => {
    const filter = button.dataset.filter;
    button.setAttribute('aria-pressed', String(filter === activeBubbleIssueFilter));
    const count = button.querySelector(`[data-filter-count="${filter}"]`);
    if (count) count.textContent = counts[filter] || 0;
  });
  applyBubbleListFilters();
}

function navigateBubbleFilterResult(direction) {
  const visibleIds = [...bubblesList.querySelectorAll('.bubble-editor-card:not([hidden])')]
    .map(card => Number(card.dataset.id));
  if (!visibleIds.length) return;
  const focusedCard = document.activeElement?.closest?.('.bubble-editor-card');
  const currentId = Number(focusedCard?.dataset.id);
  let currentIndex = visibleIds.indexOf(currentId);
  if (currentIndex < 0) currentIndex = direction > 0 ? -1 : 0;
  const nextIndex = (currentIndex + direction + visibleIds.length) % visibleIds.length;
  const bubbleId = visibleIds[nextIndex];
  highlightCard(bubbleId);
  focusCard(bubbleId);
  highlightOverlayRect(bubbleId);
}

if (bubblesSearchInput) {
  bubblesSearchInput.addEventListener('input', applyBubbleListFilters);
}
if (bubblesClearSearchBtn) {
  bubblesClearSearchBtn.addEventListener('click', () => {
    bubblesSearchInput.value = '';
    applyBubbleListFilters();
    bubblesSearchInput.focus();
  });
}
bubbleIssueFilters.addEventListener('click', event => {
  const button = event.target.closest('button[data-filter]');
  if (!button) return;
  activeBubbleIssueFilter = button.dataset.filter;
  refreshBubbleIssueFilters();
});
bubbleFilterPrevious.addEventListener('click', () => navigateBubbleFilterResult(-1));
bubbleFilterNext.addEventListener('click', () => navigateBubbleFilterResult(1));

// ==========================================================
// Phase 5 Batch B: B5 — Project Stats (page progress badge)
// ==========================================================

async function updateProjectStats() {
  if (!currentProject || !currentChapter || images.length === 0) return;

  let translatedCount = 0;
  for (const img of images) {
    const t = await window.api.loadPageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: img.name
    });
    if (t && t.length > 0) translatedCount++;
  }
  const total = images.length;
  const pct = Math.round((translatedCount / total) * 100);

  // Show in projectInfo header
  const projectInfoEl = document.getElementById('projectInfo');
  if (!projectInfoEl) return;

  let statsBadge = document.getElementById('projectStatsBadge');
  if (!statsBadge) {
    statsBadge = document.createElement('div');
    statsBadge.id = 'projectStatsBadge';
    statsBadge.style.cssText = 'font-size:11px; color:#94a3b8; margin:2px 12px 4px; display:flex; align-items:center; gap:6px;';
    projectInfoEl.after(statsBadge);
  }

  statsBadge.innerHTML = `
    <span style="color:#38bdf8; font-weight:600;">📊 แปลแล้ว ${translatedCount}/${total} หน้า</span>
    <div style="flex:1; height:4px; background:#1e293b; border-radius:2px; overflow:hidden;">
      <div style="width:${pct}%; height:100%; background:linear-gradient(90deg,#3b82f6,#10b981); border-radius:2px; transition:width 0.4s;"></div>
    </div>
    <span style="color:#64748b;">${pct}%</span>
  `;
}

// Collapsible Saved Projects UI Toggles
const savedProjectsHeader = document.getElementById('savedProjectsHeader');
const savedProjectsList = document.getElementById('savedProjectsList');
const savedProjectsToggleIcon = document.getElementById('savedProjectsToggleIcon');

savedProjectsHeader.addEventListener('click', () => {
  const isHidden = savedProjectsList.style.display === 'none';
  if (isHidden) {
    savedProjectsList.style.display = 'flex';
    savedProjectsToggleIcon.textContent = '▼';
  } else {
    savedProjectsList.style.display = 'none';
    savedProjectsToggleIcon.textContent = '▶';
  }
});

// Collapsible Active Chapter Thumbnails UI Toggles
const projectInfoToggle = document.getElementById('projectInfo');
const thumbnailsToggleIcon = document.getElementById('thumbnailsToggleIcon');

projectInfoToggle.addEventListener('click', () => {
  const isHidden = thumbnailsList.style.display === 'none';
  if (isHidden) {
    thumbnailsList.style.display = 'block';
    thumbnailsToggleIcon.textContent = '▼';
  } else {
    thumbnailsList.style.display = 'none';
    thumbnailsToggleIcon.textContent = '▶';
  }
});

// Editable chapter input event listeners
if (projChapterInput) {
  projChapterInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  projChapterInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      projChapterInput.blur();
    }
  });
  
  projChapterInput.addEventListener('blur', async () => {
    const newChap = projChapterInput.textContent.trim();
    if (!newChap || newChap === currentChapter) {
      projChapterInput.textContent = currentChapter;
      return;
    }
    
    if (!confirm(`คุณต้องการเปลี่ยนหมายเลขตอนจาก "${currentChapter}" เป็น "${newChap}" หรือไม่?\n(ระบบจะย้ายไฟล์คำแปลทรานสเลตและภาพวาดทั้งหมดของตอนนี้ไปอยู่ในตอนใหม่ให้โดยอัตโนมัติ)`)) {
      projChapterInput.textContent = currentChapter;
      return;
    }
    
    const savedList = await window.api.listProjects();
    let folderPath = '';
    const proj = savedList.find(p => p.name === currentProject);
    if (proj) {
      const chapObj = proj.chapters.find(c => c.chapter === currentChapter);
      if (chapObj) folderPath = chapObj.folderPath;
    }
    
    const res = await window.api.renameChapter({
      project: currentProject,
      oldChapter: currentChapter,
      newChapter: newChap,
      folderPath: folderPath
    });
    
    if (res.error) {
      alert(`เปลี่ยนชื่อตอนล้มเหลว: ${res.error}`);
      projChapterInput.textContent = currentChapter;
    } else {
      currentChapter = newChap;
      projChapterInput.textContent = newChap;
      
      updateSavedProjectsList();
      if (folderPath) {
        loadFolder(folderPath);
      }
    }
  });
}

// Helper to list saved projects and render them
async function updateSavedProjectsList() {
  const list = await window.api.listProjects();
  if (list.length === 0) {
    savedProjectsList.innerHTML = '<div style="padding: 4px 0; color: #64748b;">ไม่มีประวัติโครงการที่เคยเปิด</div>';
    return;
  }
  
  savedProjectsList.innerHTML = '';
  list.forEach(project => {
    const projDiv = document.createElement('div');
    projDiv.style.marginBottom = '6px';
    
    const projTitle = document.createElement('div');
    projTitle.style.fontWeight = '600';
    projTitle.style.color = '#f1f5f9';
    projTitle.style.cursor = 'default';
    projTitle.style.display = 'flex';
    projTitle.style.alignItems = 'center';
    projTitle.style.gap = '4px';
    projTitle.textContent = `📁 ${project.name}`;
    
    const chaptersContainer = document.createElement('div');
    chaptersContainer.style.paddingLeft = '14px';
    chaptersContainer.style.marginTop = '2px';
    chaptersContainer.style.display = 'flex';
    chaptersContainer.style.flexDirection = 'column';
    chaptersContainer.style.gap = '4px';
    
    project.chapters.forEach(chap => {
      const chapRow = document.createElement('div');
      chapRow.style.marginBottom = '4px';

      // Chapter header row
      const chapHeaderRow = document.createElement('div');
      chapHeaderRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:6px;';

      const chapLink = document.createElement('div');
      chapLink.style.cssText = 'cursor:pointer; color:#38bdf8; font-size:11px; flex:1; display:flex; align-items:center; gap:4px;';
      chapLink.innerHTML = `<span id="chapToggle_${project.name}_${chap.chapter}" style="font-size:9px; color:#64748b;">▶</span> ตอนที่ ${chap.chapter}`;

      // Sub-list panel (hidden initially)
      const subList = document.createElement('div');
      subList.style.cssText = 'display:none; padding:4px 0 2px 14px; margin-top:3px; border-left:2px solid #334155;';

      // Toggle expand / collapse
      let expanded = false;
      let subLoaded = false;

      const toggleExpand = async (e) => {
        e.stopPropagation();
        expanded = !expanded;
        const icon = document.getElementById(`chapToggle_${project.name}_${chap.chapter}`);
        if (icon) icon.textContent = expanded ? '▼' : '▶';

        if (expanded) {
          subList.style.display = 'block';
          if (!subLoaded) {
            subLoaded = true;
            subList.innerHTML = '<div style="color:#64748b; font-size:10px;">⏳ กำลังโหลด...</div>';
            const pages = await window.api.listChapterTranslations({
              project: project.name,
              chapter: chap.chapter
            });
            subList.innerHTML = '';

            if (pages.length === 0) {
              subList.innerHTML = '<div style="color:#64748b; font-size:10px;">ยังไม่มีหน้าที่แปลแล้ว</div>';
            } else {
              pages.forEach(pg => {
                const pgRow = document.createElement('div');
                pgRow.style.cssText = 'display:flex; align-items:center; gap:4px; padding:2px 0; cursor:pointer; border-radius:3px;';
                pgRow.title = `กดเพื่อเปิด ${pg.name} (${pg.bubbleCount} บอลลูน)`;

                const pgIcon = document.createElement('span');
                pgIcon.textContent = '✅';
                pgIcon.style.fontSize = '10px';

                const pgName = document.createElement('span');
                pgName.style.cssText = 'color:#a3e635; font-size:10px; flex:1;';
                pgName.textContent = pg.name;

                const pgCount = document.createElement('span');
                pgCount.style.cssText = 'color:#64748b; font-size:9px;';
                pgCount.textContent = `${pg.bubbleCount} 💬`;

                pgRow.appendChild(pgIcon);
                pgRow.appendChild(pgName);
                pgRow.appendChild(pgCount);

                pgRow.addEventListener('mouseenter', () => { pgRow.style.background = 'rgba(56,189,248,0.08)'; });
                pgRow.addEventListener('mouseleave', () => { pgRow.style.background = ''; });

                pgRow.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  // Load the chapter if not already open
                  await loadFolder(chap.folderPath);
                  // Wait for images to load, then jump to matching page
                  setTimeout(() => {
                    const idx = images.findIndex(img =>
                      img.name.replace(/\.[^.]+$/, '') === pg.name ||
                      img.name === pg.name
                    );
                    if (idx >= 0) selectPage(idx);
                  }, 400);
                });

                subList.appendChild(pgRow);
              });
            }
          }
        } else {
          subList.style.display = 'none';
        }
      };

      chapLink.addEventListener('click', toggleExpand);

      const deleteHistoryBtn = document.createElement('button');
      deleteHistoryBtn.style.cssText = 'background:none; border:none; color:#ef4444; font-size:10px; cursor:pointer; padding:0 2px;';
      deleteHistoryBtn.textContent = '✕';
      deleteHistoryBtn.title = 'ลบลิงก์โครงการนี้จากประวัติ';

      deleteHistoryBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`ต้องการลบโครงการ "${project.name}" ตอน "${chap.chapter}" ออกจากประวัติการเปิดใช่หรือไม่?`)) return;
        await window.api.deleteProjectMapping({ project: project.name, chapter: chap.chapter });
        updateSavedProjectsList();
      });

      chapHeaderRow.appendChild(chapLink);
      chapHeaderRow.appendChild(deleteHistoryBtn);
      chapRow.appendChild(chapHeaderRow);
      chapRow.appendChild(subList);
      chaptersContainer.appendChild(chapRow);
    });

    projDiv.appendChild(projTitle);
    projDiv.appendChild(chaptersContainer);
    savedProjectsList.appendChild(projDiv);

  });
}

// 2. Drag & Drop & Select Handlers
dropZone.addEventListener('click', async () => {
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    loadFolder(folderPath);
  }
});

// Prevent default drag behaviors globally to stop Chromium from navigating/opening files
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const folderPath = files[0].path;
    const authorization = await window.api.authorizeSourceFolder(folderPath);
    if (authorization?.authorized) loadFolder(authorization.folderPath || folderPath);
  }
});

// Helper to extract directory name from file path in case window helper is missing
window.pathDirName = (filePath) => {
  // Simple path parser for Windows / Unix paths
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx !== -1) return filePath.substring(0, idx);
  return filePath;
};

// 3. Load Folder logic
async function loadFolder(folderPath, isAutoLoad = false) {
  const res = await window.api.readFolder(folderPath);
  if (res.error) {
    if (!isAutoLoad) {
      alert(`ข้อผิดพลาด: ${res.error}`);
    }
    return;
  }

  currentProject = res.project;
  currentChapter = res.chapter;
  images = res.images;
  backupProjectBtn.disabled = false;
  lastChapterReplaceUndo = null;
  findReplaceUndo.disabled = true;
  invalidateChapterFindReplacePreview();

  // Refresh saved projects list
  updateSavedProjectsList();

  // Show Project Info
  projName.textContent = currentProject;
  projChapter.textContent = currentChapter;
  projectInfo.style.display = 'block';
  previewToggleBtn.disabled = false;
  exportChapterBtn.disabled = false;
  chapterReviewBtn.disabled = false;
  chapterFindReplaceBtn.disabled = false;

  // Load Glossary memory
  projectGlossary = await window.api.loadMemory({ project: currentProject });
  renderGlossary();
  await loadChapterWatermark();

  // Render Page list thumbnails
  renderThumbnails();

  // Load first page
  if (images.length > 0) {
    selectPage(0);
  }

  // Update project stats badge (async, non-blocking)
  updateProjectStats();
}

// 4. Render Thumbnails
function renderThumbnails() {
  thumbnailsList.innerHTML = '';
  images.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    if (idx === activeIndex) item.classList.add('active');

    const preview = document.createElement('img');
    preview.className = 'thumb-preview';
    preview.src = img.fileUrl;

    const details = document.createElement('div');
    details.className = 'thumb-details';

    const name = document.createElement('div');
    name.className = 'thumb-name';
    name.textContent = img.name;

    const status = document.createElement('div');
    status.className = 'thumb-status';
    status.innerHTML = '<span>⏳ ยังไม่ได้แปล</span>';

    // Check if this page already has a translation file saved
    window.api.loadPageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: img.name
    }).then((existing) => {
      if (existing) {
        status.className = 'thumb-status translated';
        status.innerHTML = '<span>✅ แปลเสร็จแล้ว</span>';
      }
    });

    details.appendChild(name);
    details.appendChild(status);
    item.appendChild(preview);
    item.appendChild(details);

    item.addEventListener('click', () => selectPage(idx));
    thumbnailsList.appendChild(item);
  });
}

function clearTransientPreviewLayers() {
  const typesetCanvas = document.getElementById('typesetTextCanvas');
  if (typesetCanvas) {
    const context = typesetCanvas.getContext('2d');
    context.clearRect(0, 0, typesetCanvas.width, typesetCanvas.height);
  }
  bubbleOverlay.innerHTML = '';
  bubblesList.innerHTML = '';
  canvasLoader.style.display = 'none';
  const watermarkContext = watermarkCanvas.getContext('2d');
  watermarkContext.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('ไม่สามารถโหลดรูปลายน้ำได้'));
    image.src = src;
  });
}

function syncWatermarkControls() {
  watermarkEnabled.checked = watermarkSettings.enabled;
  watermarkOpacity.value = Math.round(watermarkSettings.opacity * 100);
  watermarkOpacityVal.textContent = `${watermarkOpacity.value}%`;
  watermarkSize.value = Math.round(watermarkSettings.widthRatio * 100);
  watermarkSizeVal.textContent = `${watermarkSize.value}%`;
}

async function loadChapterWatermark() {
  watermarkImage = null;
  watermarkStatus.textContent = '';
  const result = await window.api.loadWatermark({ project: currentProject, chapter: currentChapter });
  watermarkSettings = window.WatermarkGeometry.normalizeSettings(result?.settings || {});
  if (result?.exists && result.fileUrl) {
    try {
      watermarkImage = await loadImageElement(result.fileUrl);
    } catch (err) {
      watermarkStatus.textContent = err.message;
    }
  }
  syncWatermarkControls();
  renderWatermarkPreview();
}

async function saveChapterWatermarkSettings() {
  if (!currentProject || !currentChapter) return;
  watermarkSettings = window.WatermarkGeometry.normalizeSettings(watermarkSettings);
  await window.api.saveWatermarkSettings({
    project: currentProject,
    chapter: currentChapter,
    settings: watermarkSettings,
  });
}

function getWatermarkRect(width, height) {
  if (!watermarkImage) return null;
  return window.WatermarkGeometry.calculateRect(
    watermarkSettings,
    width,
    height,
    watermarkImage.naturalWidth,
    watermarkImage.naturalHeight
  );
}

function drawWatermark(context, image, settings, width, height) {
  if (!image || !settings.enabled) return;
  const rect = window.WatermarkGeometry.calculateRect(
    settings, width, height, image.naturalWidth, image.naturalHeight
  );
  context.save();
  context.globalAlpha = settings.opacity;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function renderWatermarkPreview() {
  const width = activeImage.naturalWidth || 0;
  const height = activeImage.naturalHeight || 0;
  if (width > 0 && height > 0) {
    watermarkCanvas.width = width;
    watermarkCanvas.height = height;
  }
  const context = watermarkCanvas.getContext('2d');
  context.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
  if (!isPreviewMode || !watermarkSettings.enabled || !watermarkImage) return;
  drawWatermark(context, watermarkImage, watermarkSettings, watermarkCanvas.width, watermarkCanvas.height);
}

watermarkToggleBtn.addEventListener('click', () => {
  watermarkOptions.style.display = watermarkOptions.style.display === 'flex' ? 'none' : 'flex';
});

selectWatermarkBtn.addEventListener('click', async () => {
  if (!currentProject || !currentChapter) return;
  watermarkStatus.textContent = 'กำลังเลือกรูป...';
  try {
    const result = await window.api.selectWatermark({ project: currentProject, chapter: currentChapter });
    if (result?.canceled) { watermarkStatus.textContent = ''; return; }
    watermarkSettings = window.WatermarkGeometry.normalizeSettings(result.settings);
    watermarkImage = await loadImageElement(result.fileUrl);
    watermarkStatus.textContent = 'เลือกรูปแล้ว — ลากบนภาพเพื่อวางตำแหน่ง';
    syncWatermarkControls();
    renderWatermarkPreview();
  } catch (err) {
    watermarkStatus.textContent = err.message;
  }
});

watermarkEnabled.addEventListener('change', async () => {
  watermarkSettings.enabled = watermarkEnabled.checked && Boolean(watermarkImage);
  watermarkEnabled.checked = watermarkSettings.enabled;
  renderWatermarkPreview();
  await saveChapterWatermarkSettings();
});

watermarkOpacity.addEventListener('input', () => {
  watermarkSettings.opacity = Number(watermarkOpacity.value) / 100;
  watermarkOpacityVal.textContent = `${watermarkOpacity.value}%`;
  renderWatermarkPreview();
});
watermarkOpacity.addEventListener('change', saveChapterWatermarkSettings);

watermarkSize.addEventListener('input', () => {
  watermarkSettings.widthRatio = Number(watermarkSize.value) / 100;
  watermarkSizeVal.textContent = `${watermarkSize.value}%`;
  renderWatermarkPreview();
});
watermarkSize.addEventListener('change', saveChapterWatermarkSettings);

removeWatermarkBtn.addEventListener('click', async () => {
  if (!currentProject || !currentChapter) return;
  await window.api.removeWatermark({ project: currentProject, chapter: currentChapter });
  watermarkSettings = window.WatermarkGeometry.normalizeSettings({});
  watermarkImage = null;
  watermarkStatus.textContent = 'ลบลายน้ำแล้ว';
  syncWatermarkControls();
  renderWatermarkPreview();
});

viewportContainer.addEventListener('pointerdown', (event) => {
  if (!isPreviewMode || !watermarkSettings.enabled || !watermarkImage) return;
  const bounds = watermarkCanvas.getBoundingClientRect();
  const scaleX = watermarkCanvas.width / bounds.width;
  const scaleY = watermarkCanvas.height / bounds.height;
  const pointerX = (event.clientX - bounds.left) * scaleX;
  const pointerY = (event.clientY - bounds.top) * scaleY;
  const rect = getWatermarkRect(watermarkCanvas.width, watermarkCanvas.height);
  if (!rect || pointerX < rect.x || pointerX > rect.x + rect.width || pointerY < rect.y || pointerY > rect.y + rect.height) return;
  event.preventDefault();
  event.stopPropagation();
  watermarkDrag = { offsetX: pointerX - rect.x, offsetY: pointerY - rect.y, rect };
  viewportContainer.setPointerCapture(event.pointerId);
});

viewportContainer.addEventListener('pointermove', (event) => {
  if (!watermarkDrag) return;
  const bounds = watermarkCanvas.getBoundingClientRect();
  const pointerX = (event.clientX - bounds.left) * (watermarkCanvas.width / bounds.width) - watermarkDrag.offsetX;
  const pointerY = (event.clientY - bounds.top) * (watermarkCanvas.height / bounds.height) - watermarkDrag.offsetY;
  const position = window.WatermarkGeometry.dragToNormalized(
    pointerX, pointerY, watermarkDrag.rect.width, watermarkDrag.rect.height,
    watermarkCanvas.width, watermarkCanvas.height
  );
  watermarkSettings.x = position.x;
  watermarkSettings.y = position.y;
  renderWatermarkPreview();
});

viewportContainer.addEventListener('pointerup', async () => {
  if (!watermarkDrag) return;
  watermarkDrag = null;
  await saveChapterWatermarkSettings();
});
viewportContainer.addEventListener('pointercancel', () => { watermarkDrag = null; });

// 5. Select Active Page
async function selectPage(idx) {
  cancelInlineEditor();
  const activePage = images[idx];
  if (!activePage) return;
  if (copyPreviousPageDialog.open) copyPreviousPageDialog.close();
  const renderToken = pageRenderGuard.begin(activePage.name);
  activeIndex = idx;
  clearTransientPreviewLayers();
  
  // Highlight active thumbnail
  const items = thumbnailsList.querySelectorAll('.thumb-item');
  items.forEach((item, i) => {
    if (i === idx) item.classList.add('active');
    else item.classList.remove('active');
  });

  activePageTitle.textContent = activePage.name;

  // Load Existing Page Translation
  const existingTranslation = await window.api.loadPageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: activePage.name
  });
  if (!pageRenderGuard.isCurrent(renderToken)) return;

  if (existingTranslation) {
    activePageTranslation = existingTranslation;
    renderPageTranslation();
  } else {
    activePageTranslation = [];
    renderPlaceholder();
  }

  // Show studio toolbar and reset tool to select mode
  studioToolbar.style.display = 'flex';
  if (typeof switchTool === 'function') switchTool('select');

  // Load custom mask and paint layers when raw image is loaded
  activeImage.onload = async () => {
    if (!pageRenderGuard.isCurrent(renderToken)) return;
    if (activeImage.src.startsWith('data:')) return;

    applyViewMode('fit-width');
    
    brushMaskCanvas.width = activeImage.naturalWidth || 800;
    brushMaskCanvas.height = activeImage.naturalHeight || 1200;
    colorPaintCanvas.width = activeImage.naturalWidth || 800;
    colorPaintCanvas.height = activeImage.naturalHeight || 1200;
    
    const ctx = brushMaskCanvas.getContext('2d');
    ctx.clearRect(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
    
    const pctx = colorPaintCanvas.getContext('2d');
    pctx.clearRect(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
    
    try {
      const maskRes = await window.api.loadCustomMask({
        project: currentProject,
        chapter: currentChapter,
        pageName: activePage.name
      });
      if (!pageRenderGuard.isCurrent(renderToken)) return;
      if (maskRes && maskRes.exists) {
        const maskImg = new Image();
        maskImg.src = maskRes.fileUrl;
        maskImg.onload = () => {
          if (!pageRenderGuard.isCurrent(renderToken)) return;
          ctx.drawImage(maskImg, 0, 0);
        };
      }
    } catch (err) {
      console.warn('[⚠️] Failed to load custom mask:', err);
    }
    
    try {
      const paintRes = await window.api.loadCustomPaint({
        project: currentProject,
        chapter: currentChapter,
        pageName: activePage.name
      });
      if (!pageRenderGuard.isCurrent(renderToken)) return;
      if (paintRes && paintRes.exists) {
        const paintImg = new Image();
        paintImg.src = paintRes.fileUrl;
        paintImg.onload = () => {
          if (!pageRenderGuard.isCurrent(renderToken)) return;
          pctx.drawImage(paintImg, 0, 0);
        };
      }
    } catch (err) {
      console.warn('[⚠️] Failed to load custom paint layer:', err);
    }
  };

  // Render Image
  activeImage.src = activePage.fileUrl;
  placeholderView.style.display = 'none';
  viewportContainer.style.display = 'block';
  // Each page starts in fit-width mode; onload calculates its exact width.
  viewportContainer.style.width = '';
  viewportContainer.style.transform = '';
  zoomLevel = 1.0;
  viewMode = 'fit-width';
  updateViewModeButtons();
  const _zs = document.getElementById('zoomSlider');
  if (_zs) _zs.value = 100;
  zoomLevelLabel.textContent = '100%';

  translatePageBtn.disabled = false;
  translateAllBtn.disabled = false;
  previewToggleBtn.disabled = false;
  exportChapterBtn.disabled = false;
  chapterReviewBtn.disabled = false;
  chapterFindReplaceBtn.disabled = false;
  copyPreviousPageBtn.disabled = activeIndex <= 0;
  if (resetPageBtn) resetPageBtn.style.display = 'inline-flex';
  // Clear undo/redo stacks when switching page
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoBtns();
}

// 6. Render Page Translation & SVG Overlays
function applyLiveOverflowWarning(bubbleId) {
  const warning = liveOverflowWarnings.get(bubbleId);
  const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubbleId}"]`);
  const badge = bubblesList.querySelector(`.live-overflow-badge[data-id="${bubbleId}"]`);
  rect?.classList.remove('overflow-near', 'overflow-error');
  if (badge) badge.hidden = true;
  if (!warning || warning.status === 'safe') return;
  rect?.classList.add(warning.status === 'overflow' ? 'overflow-error' : 'overflow-near');
  if (badge) {
    badge.hidden = false;
    badge.classList.toggle('is-error', warning.status === 'overflow');
    badge.textContent = warning.status === 'overflow' ? 'ข้อความล้นกรอบ' : 'ข้อความใกล้ล้น';
  }
}

function updateLiveOverflowWarning(bubble) {
  if (bubble.hidden || !window.ExportQuality.validBox(bubble.box_2d)
    || !activeImage.naturalWidth || !activeImage.naturalHeight) {
    liveOverflowWarnings.delete(bubble.bubble_id);
    applyLiveOverflowWarning(bubble.bubble_id);
    refreshBubbleIssueFilters();
    return;
  }
  const [ymin, xmin, ymax, xmax] = bubble.box_2d;
  const boxWidth = ((xmax - xmin) / 1000) * activeImage.naturalWidth * 0.85;
  const boxHeight = ((ymax - ymin) / 1000) * activeImage.naturalHeight * 0.85;
  const fontSize = Number(bubble.font_size) || 6;
  liveOverflowContext.font = `bold ${fontSize}px '${bubble.font_family || 'Sarabun'}', 'Segoe UI', sans-serif`;
  const warning = window.TextOverflow.measureTextOverflow({
    text: bubble.translated_text, boxWidth, boxHeight, fontSize, lineHeight: fontSize * 1.25,
  }, window.TextOverflow.createCanvasAdapter(liveOverflowContext));
  liveOverflowWarnings.set(bubble.bubble_id, warning);
  applyLiveOverflowWarning(bubble.bubble_id);
  refreshBubbleIssueFilters();
}

function scanLiveOverflowWarnings() {
  liveOverflowWarnings.clear();
  activePageTranslation.forEach(updateLiveOverflowWarning);
}

function renderPageTranslation() {
  // Clear search filter when rendering a new page
  if (bubblesSearchInput && bubblesSearchInput.value) {
    bubblesSearchInput.value = '';
    if (bubblesClearSearchBtn) bubblesClearSearchBtn.style.display = 'none';
  }
  bubbleOverlay.innerHTML = '';
  bubblesList.innerHTML = '';
  liveOverflowWarnings.clear();

  if (activePageTranslation.length === 0) {
    renderPlaceholder();
    refreshBubbleIssueFilters();
    return;
  }

  activePageTranslation.forEach((bubble) => {
    // 1. Draw SVG Bounding Box Group with Resize Handle
    if (bubble.box_2d && bubble.box_2d.length === 4) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'bubble-group');
      g.setAttribute('data-id', bubble.bubble_id);
      if (bubble.rotate) {
        const cx = xmin + (xmax - xmin) / 2;
        const cy = (ymin + ymax) / 2;
        g.setAttribute('transform', `rotate(${bubble.rotate}, ${cx}, ${cy})`);
      }
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', xmin);
      rect.setAttribute('y', ymin);
      rect.setAttribute('width', xmax - xmin);
      rect.setAttribute('height', ymax - ymin);
      rect.setAttribute('class', 'bubble-rect');
      rect.setAttribute('data-id', bubble.bubble_id);
      if (bubble.hidden) {
        rect.style.fill = 'rgba(239, 68, 68, 0.05)';
        rect.style.stroke = '#ef4444';
        rect.style.strokeDasharray = '4,4';
      } else {
        rect.style.fill = 'rgba(168, 85, 247, 0.15)';
        rect.style.stroke = '#a855f7';
      }
      rect.style.strokeWidth = '2px';
      rect.style.cursor = 'move';
      
      rect.addEventListener('mouseenter', () => highlightCard(bubble.bubble_id));
      rect.addEventListener('mouseleave', () => unhighlightCard(bubble.bubble_id));
      rect.addEventListener('click', () => focusCard(bubble.bubble_id));

      g.appendChild(rect);

      // Keep the resize handle square on screen even though the SVG viewBox
      // is stretched independently on X/Y to match the page image.
      const overlayRect = bubbleOverlay.getBoundingClientRect();
      const handleSize = window.BubbleGeometry.screenPixelsToSvgUnits(16, overlayRect.width, overlayRect.height);
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      handle.setAttribute('x', xmax - handleSize.x);
      handle.setAttribute('y', ymax - handleSize.y);
      handle.setAttribute('width', handleSize.x);
      handle.setAttribute('height', handleSize.y);
      handle.setAttribute('rx', Math.min(handleSize.x, handleSize.y) * 0.18);
      handle.setAttribute('class', 'bubble-resize-handle');
      handle.setAttribute('data-id', bubble.bubble_id);
      handle.style.fill = bubble.hidden ? '#ef4444' : '#a855f7';
      handle.style.stroke = '#ffffff';
      handle.style.strokeWidth = '2px';
      handle.style.vectorEffect = 'non-scaling-stroke';
      handle.style.cursor = 'se-resize';
      handle.style.filter = 'drop-shadow(0 0 4px rgba(168,85,247,0.8))';

      g.appendChild(handle);
      bubbleOverlay.appendChild(g);
    }

    // 2. Draw Dialogue Editor Card
    const card = document.createElement('div');
    card.className = 'bubble-editor-card';
    card.setAttribute('data-id', bubble.bubble_id);

    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    
    const idLabel = document.createElement('span');
    idLabel.className = 'bubble-id-label';
    idLabel.textContent = `บอลลูน #${bubble.bubble_id}`;
    header.appendChild(idLabel);

    const overflowBadge = document.createElement('button');
    overflowBadge.className = 'live-overflow-badge';
    overflowBadge.dataset.id = bubble.bubble_id;
    overflowBadge.hidden = true;
    overflowBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      focusCard(bubble.bubble_id);
      highlightOverlayRect(bubble.bubble_id);
    });
    header.appendChild(overflowBadge);
    
    // Show/Hide toggle button
    const hideBtn = document.createElement('button');
    hideBtn.className = 'hide-bubble-btn';
    hideBtn.textContent = bubble.hidden ? '🙈' : '👁️';
    hideBtn.title = bubble.hidden ? 'แสดงข้อความ' : 'ซ่อนข้อความ';
    hideBtn.style.background = 'none';
    hideBtn.style.border = 'none';
    hideBtn.style.color = bubble.hidden ? '#ef4444' : '#10b981';
    hideBtn.style.cursor = 'pointer';
    hideBtn.style.fontSize = '14px';
    hideBtn.style.padding = '0';
    hideBtn.style.marginLeft = 'auto';
    
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pushUndoState();
      bubble.hidden = !bubble.hidden;
      saveCurrentPageTranslation();
      renderPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    // Delete balloon button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-bubble-card-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'ลบบอลลูนนี้ออกถาวร';
    deleteBtn.style.background = 'none';
    deleteBtn.style.border = 'none';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '14px';
    deleteBtn.style.padding = '0';
    deleteBtn.style.marginLeft = '8px';
    
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      cancelInlineEditor();
      if (!confirm(`คุณต้องการลบ บอลลูน #${bubble.bubble_id} นี้ถาวรใช่หรือไม่?`)) return;
      pushUndoState();
      const activePage = images[activeIndex];
      activePageTranslation = activePageTranslation.filter(b => b.bubble_id !== bubble.bubble_id);
      
      if (activePage) {
        delete cleanedBgCache[activePage.name];
      }
      
      await saveCurrentPageTranslation();
      renderPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    header.appendChild(hideBtn);
    header.appendChild(deleteBtn);

    const origText = document.createElement('div');
    origText.className = 'original-text-block';
    origText.textContent = bubble.original_text || '(ไม่มีอักษรตรวจพบ)';

    const transInput = document.createElement('textarea');
    transInput.className = 'translation-textarea';
    transInput.value = bubble.translated_text || '';
    
    // Auto-save on edit and update canvas preview in real-time
    transInput.addEventListener('input', (e) => {
      bubble.translated_text = e.target.value;
      updateLiveOverflowWarning(bubble);
      saveCurrentPageTranslation();
      if (isPreviewMode) {
        refreshTypesetView();
      }
    });

    transInput.addEventListener('focus', () => {
      pushUndoState(); // capture state before editing
      highlightOverlayRect(bubble.bubble_id);
      card.classList.add('active');
    });

    transInput.addEventListener('blur', () => {
      unhighlightOverlayRect(bubble.bubble_id);
      card.classList.remove('active');
    });


    // 1. Font Size Override controls row (Range Slider)
    const fontRow = document.createElement('div');
    fontRow.className = 'card-controls-row';
    fontRow.style.display = 'flex';
    fontRow.style.alignItems = 'center';
    fontRow.style.gap = '6px';
    fontRow.style.marginTop = '6px';
    
    const fontLabel = document.createElement('span');
    fontLabel.textContent = 'ขนาด:';
    fontLabel.style.fontSize = '12px';
    fontLabel.style.color = '#94a3b8';
    
    const sizeValLabel = document.createElement('span');
    sizeValLabel.style.fontSize = '11px';
    sizeValLabel.style.color = '#38bdf8';
    sizeValLabel.style.minWidth = '35px';
    sizeValLabel.textContent = bubble.font_size ? `${bubble.font_size}px` : 'ออโต้';
    
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '8';
    sizeSlider.max = '72';
    sizeSlider.value = bubble.font_size || '18';
    sizeSlider.style.flex = '1';
    sizeSlider.style.height = '4px';
    sizeSlider.style.cursor = 'pointer';
    if (!bubble.font_size) {
      sizeSlider.disabled = true;
      sizeSlider.style.opacity = '0.4';
    }
    
    const autoSizeLabel = document.createElement('label');
    autoSizeLabel.style.display = 'flex';
    autoSizeLabel.style.alignItems = 'center';
    autoSizeLabel.style.gap = '3px';
    autoSizeLabel.style.fontSize = '11px';
    autoSizeLabel.style.color = '#94a3b8';
    autoSizeLabel.style.cursor = 'pointer';
    
    const autoSizeCheck = document.createElement('input');
    autoSizeCheck.type = 'checkbox';
    autoSizeCheck.checked = !bubble.font_size;
    autoSizeCheck.style.cursor = 'pointer';
    
    autoSizeCheck.addEventListener('change', (e) => {
      if (e.target.checked) {
        delete bubble.font_size;
        sizeSlider.disabled = true;
        sizeSlider.style.opacity = '0.4';
        sizeValLabel.textContent = 'ออโต้';
      } else {
        bubble.font_size = 18;
        sizeSlider.disabled = false;
        sizeSlider.style.opacity = '1.0';
        sizeSlider.value = '18';
        sizeValLabel.textContent = '18px';
      }
      updateLiveOverflowWarning(bubble);
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    sizeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      bubble.font_size = val;
      sizeValLabel.textContent = `${val}px`;
      updateLiveOverflowWarning(bubble);
      saveCurrentPageTranslation();
      if (isPreviewMode) renderTypesetImage();
    });
    
    autoSizeLabel.appendChild(autoSizeCheck);
    autoSizeLabel.appendChild(document.createTextNode('ออโต้'));
    
    fontRow.appendChild(fontLabel);
    fontRow.appendChild(sizeSlider);
    fontRow.appendChild(sizeValLabel);
    fontRow.appendChild(autoSizeLabel);

    // 2. Text Color Swatches & Recent Colors row
    const colorRow = document.createElement('div');
    colorRow.className = 'card-controls-row';
    colorRow.style.display = 'flex';
    colorRow.style.alignItems = 'center';
    colorRow.style.gap = '6px';
    colorRow.style.marginTop = '6px';
    
    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'สีอักษร:';
    colorLabel.style.fontSize = '12px';
    colorLabel.style.color = '#94a3b8';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = bubble.text_color || '#000000';
    colorInput.style.width = '24px';
    colorInput.style.height = '20px';
    colorInput.style.padding = '0';
    colorInput.style.border = '1px solid #475569';
    colorInput.style.background = 'none';
    colorInput.style.borderRadius = '3px';
    colorInput.style.cursor = 'pointer';
    if (!bubble.text_color) {
      colorInput.style.opacity = '0.3';
    }
    
    const autoColorLabel = document.createElement('label');
    autoColorLabel.style.display = 'flex';
    autoColorLabel.style.alignItems = 'center';
    autoColorLabel.style.gap = '3px';
    autoColorLabel.style.fontSize = '11px';
    autoColorLabel.style.color = '#94a3b8';
    autoColorLabel.style.cursor = 'pointer';
    
    const autoColorCheck = document.createElement('input');
    autoColorCheck.type = 'checkbox';
    autoColorCheck.checked = !bubble.text_color;
    autoColorCheck.style.cursor = 'pointer';
    
    const recentColorsContainer = document.createElement('div');
    recentColorsContainer.style.display = 'flex';
    recentColorsContainer.style.gap = '4px';
    recentColorsContainer.style.marginLeft = '6px';
    
    function renderRecentSwatches() {
      recentColorsContainer.innerHTML = '';
      recentColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.style.width = '14px';
        swatch.style.height = '14px';
        swatch.style.borderRadius = '50%';
        swatch.style.background = color;
        swatch.style.border = '1px solid #475569';
        swatch.style.cursor = 'pointer';
        swatch.title = color;
        
        swatch.addEventListener('click', () => {
          bubble.text_color = color;
          autoColorCheck.checked = false;
          colorInput.style.opacity = '1.0';
          colorInput.value = color;
          saveCurrentPageTranslation();
          if (isPreviewMode) refreshTypesetView();
          renderRecentSwatches();
        });
        recentColorsContainer.appendChild(swatch);
      });
    }
    
    autoColorCheck.addEventListener('change', (e) => {
      if (e.target.checked) {
        delete bubble.text_color;
        colorInput.style.opacity = '0.3';
      } else {
        bubble.text_color = colorInput.value;
        colorInput.style.opacity = '1.0';
      }
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    colorInput.addEventListener('input', (e) => {
      const val = e.target.value;
      bubble.text_color = val;
      autoColorCheck.checked = false;
      colorInput.style.opacity = '1.0';
      
      if (!recentColors.includes(val)) {
        recentColors.unshift(val);
        if (recentColors.length > 8) {
          recentColors.pop();
        }
      }
      
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
      renderRecentSwatches();
    });
    
    // Text outline toggle checkbox
    const outlineLabel = document.createElement('label');
    outlineLabel.style.display = 'flex';
    outlineLabel.style.alignItems = 'center';
    outlineLabel.style.gap = '3px';
    outlineLabel.style.fontSize = '11px';
    outlineLabel.style.color = '#94a3b8';
    outlineLabel.style.cursor = 'pointer';
    outlineLabel.style.marginLeft = '12px';
    
    const outlineCheck = document.createElement('input');
    outlineCheck.type = 'checkbox';
    outlineCheck.checked = !!bubble.outline;
    outlineCheck.style.cursor = 'pointer';
    
    outlineCheck.addEventListener('change', (e) => {
      bubble.outline = e.target.checked;
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    outlineLabel.appendChild(outlineCheck);
    outlineLabel.appendChild(document.createTextNode('ขอบอักษร'));

    autoColorLabel.appendChild(autoColorCheck);
    autoColorLabel.appendChild(document.createTextNode('ออโต้'));
    
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorInput);
    colorRow.appendChild(autoColorLabel);
    colorRow.appendChild(recentColorsContainer);
    colorRow.appendChild(outlineLabel);
    
    renderRecentSwatches();

    // 3. Rotation Override controls row (Range Slider)
    const rotateRow = document.createElement('div');
    rotateRow.className = 'card-controls-row';
    rotateRow.style.display = 'flex';
    rotateRow.style.alignItems = 'center';
    rotateRow.style.gap = '6px';
    rotateRow.style.marginTop = '6px';
    
    const rotateLabel = document.createElement('span');
    rotateLabel.textContent = 'หมุนเอียง:';
    rotateLabel.style.fontSize = '12px';
    rotateLabel.style.color = '#94a3b8';
    
    const rotateValLabel = document.createElement('span');
    rotateValLabel.style.fontSize = '11px';
    rotateValLabel.style.color = '#38bdf8';
    rotateValLabel.style.minWidth = '35px';
    rotateValLabel.textContent = `${bubble.rotate || 0}°`;
    
    const rotateSlider = document.createElement('input');
    rotateSlider.type = 'range';
    rotateSlider.min = '-90';
    rotateSlider.max = '90';
    rotateSlider.value = bubble.rotate || '0';
    rotateSlider.style.flex = '1';
    rotateSlider.style.height = '4px';
    rotateSlider.style.cursor = 'pointer';
    
    rotateSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      bubble.rotate = val;
      rotateValLabel.textContent = `${val}°`;
      
      // Update SVG bounding box rotation in real-time
      const group = bubbleOverlay.querySelector(`.bubble-group[data-id="${bubble.bubble_id}"]`);
      if (group && bubble.box_2d) {
        const [ymin, xmin, ymax, xmax] = bubble.box_2d;
        const cx = xmin + (xmax - xmin) / 2;
        const cy_avg = (ymin + ymax) / 2;
        if (val !== 0) {
          group.setAttribute('transform', `rotate(${val}, ${cx}, ${cy_avg})`);
        } else {
          group.removeAttribute('transform');
        }
      }
      
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    
    rotateRow.appendChild(rotateLabel);
    rotateRow.appendChild(rotateSlider);
    rotateRow.appendChild(rotateValLabel);

    // 4. Font Family selector row
    const fontFamilyRow = document.createElement('div');
    fontFamilyRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:6px;';
    
    const fontFamilyLabel = document.createElement('span');
    fontFamilyLabel.textContent = 'ฟอนต์:';
    fontFamilyLabel.style.cssText = 'font-size:12px; color:#94a3b8; white-space:nowrap;';
    
    const fontFamilySelect = document.createElement('select');
    fontFamilySelect.style.cssText = 'flex:1; background:#1e293b; border:1px solid #334155; color:#f8fafc; border-radius:4px; padding:3px 6px; font-size:11px; cursor:pointer;';
    const fontOptions = [
      { value: 'Sarabun', label: 'Sarabun' },
      { value: 'Prompt',  label: 'Prompt' },
      { value: 'Kanit',   label: 'Kanit' },
      { value: 'Mitr',    label: 'Mitr' },
      { value: 'Noto Sans Thai', label: 'Noto Sans Thai' },
      { value: 'Segoe UI', label: 'Segoe UI (EN)' }
    ];
    fontOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if ((bubble.font_family || appSettings.defaultFontFamily || 'Sarabun') === opt.value) o.selected = true;
      fontFamilySelect.appendChild(o);
    });
    fontFamilySelect.addEventListener('change', (e) => {
      pushUndoState();
      bubble.font_family = e.target.value;
      updateLiveOverflowWarning(bubble);
      saveCurrentPageTranslation();
      if (isPreviewMode) refreshTypesetView();
    });
    fontFamilyRow.appendChild(fontFamilyLabel);
    fontFamilyRow.appendChild(fontFamilySelect);

    // 5. Text Alignment buttons row
    const alignRow = document.createElement('div');
    alignRow.style.cssText = 'display:flex; align-items:center; gap:4px; margin-top:6px;';
    
    const alignRowLabel = document.createElement('span');
    alignRowLabel.textContent = 'จัดข้อความ:';
    alignRowLabel.style.cssText = 'font-size:12px; color:#94a3b8; white-space:nowrap;';
    alignRow.appendChild(alignRowLabel);

    const currentAlign = bubble.text_align || appSettings.defaultTextAlign || 'center';
    const alignOptions = [
      { value: 'left',   label: '⬅', title: 'ชิดซ้าย' },
      { value: 'center', label: '≡',  title: 'กึ่งกลาง' },
      { value: 'right',  label: '⮕', title: 'ชิดขวา' }
    ];
    const alignBtns = [];
    alignOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.title = opt.title;
      const isActive = opt.value === currentAlign;
      btn.style.cssText = `flex:1; background:${isActive ? '#3b82f6' : '#1e293b'}; border:1px solid ${isActive ? '#3b82f6' : '#334155'}; color:${isActive ? '#fff' : '#94a3b8'}; border-radius:4px; padding:3px 0; font-size:13px; cursor:pointer;`;
      btn.addEventListener('click', () => {
        pushUndoState();
        bubble.text_align = opt.value;
        // Update button styles
        alignBtns.forEach((b, i) => {
          const active = alignOptions[i].value === opt.value;
          b.style.background = active ? '#3b82f6' : '#1e293b';
          b.style.borderColor = active ? '#3b82f6' : '#334155';
          b.style.color = active ? '#fff' : '#94a3b8';
        });
        saveCurrentPageTranslation();
        if (isPreviewMode) refreshTypesetView();
      });
      alignBtns.push(btn);
      alignRow.appendChild(btn);
    });

    card.appendChild(header);
    card.appendChild(origText);
    card.appendChild(transInput);
    card.appendChild(fontRow);
    card.appendChild(colorRow);
    card.appendChild(rotateRow);
    card.appendChild(fontFamilyRow);
    card.appendChild(alignRow);

    bubblesList.appendChild(card);
  });

  // Update badge count
  const badge = document.getElementById('bubblesCountBadge');
  if (badge) badge.textContent = `${activePageTranslation.length} บอลลูน`;
  scanLiveOverflowWarnings();
  refreshBubbleIssueFilters();
}


function updateSVGOverlayOnly() {
  activePageTranslation.forEach((bubble) => {
    const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubble.bubble_id}"]`);
    if (rect && bubble.box_2d) {
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      rect.setAttribute('x', xmin);
      rect.setAttribute('y', ymin);
      rect.setAttribute('width', xmax - xmin);
      rect.setAttribute('height', ymax - ymin);
      
      const handle = bubbleOverlay.querySelector(`.bubble-resize-handle[data-id="${bubble.bubble_id}"]`);
      const group = bubbleOverlay.querySelector(`.bubble-group[data-id="${bubble.bubble_id}"]`);
      if (handle) {
        const overlayRect = bubbleOverlay.getBoundingClientRect();
        const handleSize = window.BubbleGeometry.screenPixelsToSvgUnits(16, overlayRect.width, overlayRect.height);
        handle.setAttribute('x', xmax - handleSize.x);
        handle.setAttribute('y', ymax - handleSize.y);
        handle.setAttribute('width', handleSize.x);
        handle.setAttribute('height', handleSize.y);
        handle.setAttribute('rx', Math.min(handleSize.x, handleSize.y) * 0.18);
      }
      if (group) {
        if (bubble.rotate) {
          const cx = xmin + (xmax - xmin) / 2;
          const cy = (ymin + ymax) / 2;
          group.setAttribute('transform', `rotate(${bubble.rotate}, ${cx}, ${cy})`);
        } else {
          group.removeAttribute('transform');
        }
      }
    }

  });
}

function renderPlaceholder() {
  bubblesList.innerHTML = `
    <div class="no-bubbles-placeholder">
      <p>ยังไม่มีข้อมูลคำแปลหน้านี้</p>
      <p class="sub">กดปุ่มแปลภาษาด้านบนเพื่อเรียกใช้ Gemini</p>
    </div>
  `;
}

// 7. Interactive highlight sync between SVG overlay and editor cards
function highlightCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function unhighlightCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    card.classList.remove('active');
  }
}

function focusCard(bubbleId) {
  const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
  if (card) {
    const textEl = card.querySelector('textarea');
    if (textEl) textEl.focus();
  }
}

function highlightOverlayRect(bubbleId) {
  const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubbleId}"]`);
  if (rect) rect.classList.add('active');
}

function unhighlightOverlayRect(bubbleId) {
  const rect = bubbleOverlay.querySelector(`.bubble-rect[data-id="${bubbleId}"]`);
  if (rect) rect.classList.remove('active');
}

// 8. Save/Save-Loop Page Translations
async function saveCurrentPageTranslation(pageIndex = activeIndex, translationData = activePageTranslation) {
  if (pageIndex === -1 || !images[pageIndex]) return false;
  const activePage = images[pageIndex];
  
  const saveResult = await window.api.savePageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: activePage.name,
    translationData
  });
  if (saveResult !== true) return saveResult;

  // Re-verify and update translated checkmarks in explorer thumbnails
  const items = thumbnailsList.querySelectorAll('.thumb-item');
  const activeItem = items[pageIndex];
  if (activeItem) {
    const status = activeItem.querySelector('.thumb-status');
    status.className = 'thumb-status translated';
    status.innerHTML = '<span>✅ แปลเสร็จแล้ว</span>';
  }
  return true;
}

async function applyTranslationResult(result) {
  const normalized = window.TranslationResult.normalizeTranslationResult(result);
  const merged = window.TranslationResult.mergeDiscoveredNames(
    projectGlossary,
    normalized.discoveredNames
  );

  activePageTranslation = normalized.bubbles;
  if (Object.keys(merged.added).length > 0) {
    projectGlossary = merged.glossary;
    await window.api.saveMemory({ project: currentProject, memoryData: projectGlossary });
    renderGlossary();
  }
}

// 9. Translate Page via Gemini Call
translatePageBtn.addEventListener('click', async () => {
  cancelInlineEditor();
  if (activeIndex === -1 || !images[activeIndex]) return;
  const activePage = images[activeIndex];

  pushUndoState();
  translatePageBtn.disabled = true;
  translatePageBtn.textContent = '⏳ กำลังแปลหน้าการ์ตูน...';

  try {
    const result = await window.api.translatePage({
      imagePath: activePage.absolutePath,
      glossary: projectGlossary
    });

    await applyTranslationResult(result);
    
    // Invalidate cache since new translation might contain different bounding boxes/masks
    delete cleanedBgCache[activePage.name];
    
    // Save translation
    await saveCurrentPageTranslation();
    
    // Render results
    renderPageTranslation();
    updateProjectStats();
  } catch (err) {
    alert(`การแปลล้มเหลว: ${err.message}`);
  } finally {
    translatePageBtn.disabled = false;
    translatePageBtn.textContent = '⚡ แปลหน้านี้';
  }
});


let isTranslatingAll = false;
let cancelTranslateAll = false;

translateAllBtn.addEventListener('click', async () => {
  if (isTranslatingAll) return;
  isTranslatingAll = true;
  cancelTranslateAll = false;
  translatePageBtn.disabled = true;
  translateAllBtn.disabled = true;
  if (stopTranslateAllBtn) stopTranslateAllBtn.style.display = 'inline-flex';

  try {
    let translateCount = 0;
    for (let i = 0; i < images.length; i++) {
      if (cancelTranslateAll) break;
      const img = images[i];
      
      const existing = await window.api.loadPageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: img.name
      });
      
      if (existing) {
        continue;
      }
      
      translateCount++;
      translateAllBtn.textContent = `⏳ แปลหน้า ${i+1}/${images.length} (${img.name})...`;
      
      await selectPage(i);
      if (cancelTranslateAll) break;
      
      const result = await window.api.translatePage({
        imagePath: img.absolutePath,
        glossary: projectGlossary
      });
      
      await applyTranslationResult(result);
      
      // Invalidate cache for this page
      delete cleanedBgCache[img.name];
      
      await window.api.savePageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: img.name,
        translationData: activePageTranslation
      });
      
      renderPageTranslation();
      renderThumbnails();
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (cancelTranslateAll) {
      // silently stopped
    } else if (translateCount === 0) {
      alert('ทุกหน้าในโฟลเดอร์นี้แปลเสร็จสมบูรณ์อยู่แล้วครับ!');
    } else {
      alert('🎉 แปลภาษาการ์ตูนทุกหน้าเสร็จสมบูรณ์เรียบร้อยแล้วครับ!');
    }
  } catch (err) {
    if (!cancelTranslateAll) alert(`การแปลแบบกลุ่มล้มเหลวระหว่างดำเนินการ: ${err.message}`);
  } finally {
    isTranslatingAll = false;
    cancelTranslateAll = false;
    translatePageBtn.disabled = false;
    translateAllBtn.disabled = false;
    translateAllBtn.textContent = '⚡ แปลทุกหน้าอัตโนมัติ';
    if (stopTranslateAllBtn) stopTranslateAllBtn.style.display = 'none';
  }
});

if (stopTranslateAllBtn) {
  stopTranslateAllBtn.addEventListener('click', () => {
    cancelTranslateAll = true;
    stopTranslateAllBtn.textContent = '⏳ กำลังหยุด...';
    stopTranslateAllBtn.disabled = true;
  });
}

// 10. Glossary Editor Management
function renderGlossary() {
  glossaryList.innerHTML = '';
  Object.entries(projectGlossary).forEach(([eng, thai]) => {
    createGlossaryRow(eng, thai);
  });
}

function createGlossaryRow(eng = '', thai = '') {
  const row = document.createElement('div');
  row.className = 'glossary-row';

  const engInput = document.createElement('input');
  engInput.type = 'text';
  engInput.placeholder = 'En Word';
  engInput.value = eng;

  const thaiInput = document.createElement('input');
  thaiInput.type = 'text';
  thaiInput.placeholder = 'คำแปลไทย';
  thaiInput.value = thai;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-glossary-btn';
  deleteBtn.textContent = '✕';

  const saveGlossary = () => {
    // Re-build glossary map
    const newGlossary = {};
    const rows = glossaryList.querySelectorAll('.glossary-row');
    rows.forEach(r => {
      const inputs = r.querySelectorAll('input');
      const eVal = inputs[0].value.trim();
      const tVal = inputs[1].value.trim();
      if (eVal) newGlossary[eVal] = tVal;
    });

    projectGlossary = newGlossary;
    window.api.saveMemory({ project: currentProject, memoryData: projectGlossary });
  };

  engInput.addEventListener('change', saveGlossary);
  thaiInput.addEventListener('change', saveGlossary);
  deleteBtn.addEventListener('click', () => {
    row.remove();
    saveGlossary();
  });

  row.appendChild(engInput);
  row.appendChild(thaiInput);
  row.appendChild(deleteBtn);
  glossaryList.appendChild(row);
}

addGlossaryBtn.addEventListener('click', () => {
  createGlossaryRow();
});

// 11. Typeset Preview and Export Management
let isPreviewMode = false;
previewToggleBtn.addEventListener('click', () => {
  isPreviewMode = !isPreviewMode;
  if (!isPreviewMode) cancelInlineEditor();
  if (isPreviewMode) {
    previewToggleBtn.textContent = '👁️ ดูภาพต้นฉบับ';
    previewToggleBtn.classList.remove('btn-accent');
    previewToggleBtn.classList.add('btn-secondary');
  } else {
    previewToggleBtn.textContent = '👁️ ดูหน้าแปลไทย';
    previewToggleBtn.classList.remove('btn-secondary');
    previewToggleBtn.classList.add('btn-accent');
  }
  
  if (activeIndex !== -1) {
    selectPage(activeIndex);
  }
});

activeImage.addEventListener('load', () => {
  const renderToken = pageRenderGuard.current();
  if (!pageRenderGuard.isCurrent(renderToken)) return;
  if (activeImage.src.startsWith('data:')) {
    initBgSampler();
    renderTypesetTextLayer(renderToken);
    renderWatermarkPreview();
    return;
  }
  renderWatermarkPreview();
  if (isPreviewMode && activePageTranslation.length > 0) {
    renderTypesetImage(renderToken);
  }
});

let bgSamplerCanvas = null;

function initBgSampler() {
  bgSamplerCanvas = document.createElement('canvas');
  bgSamplerCanvas.width = activeImage.naturalWidth || 800;
  bgSamplerCanvas.height = activeImage.naturalHeight || 1200;
  const ctx = bgSamplerCanvas.getContext('2d');
  ctx.drawImage(activeImage, 0, 0);
}

function sampleImageBackgroundAt(x, y, w, h) {
  if (!bgSamplerCanvas) return '#ffffff';
  const ctx = bgSamplerCanvas.getContext('2d');
  return sampleBubbleBackground(ctx, x, y, w, h);
}

async function renderTypesetImage(renderToken = pageRenderGuard.current()) {
  if (!pageRenderGuard.isCurrent(renderToken)) return;
  canvasLoader.style.display = 'flex';
  const originalSrc = activeImage.src;
  const canvas = document.createElement('canvas');
  canvas.width = activeImage.naturalWidth;
  canvas.height = activeImage.naturalHeight;
  
  let cleanedImgElement = activeImage;
  let objectUrlToCleanup = null;
  const activePage = images[activeIndex];
  const cacheKey = activePage ? activePage.name : null;
  if (!activePage || cacheKey !== renderToken.pageKey) return;
  
  if (cacheKey && cleanedBgCache[cacheKey]) {
    // Cache HIT: Load clean background instantly
    const cleanImg = new Image();
    cleanImg.src = cleanedBgCache[cacheKey];
    await new Promise((resolve) => {
      cleanImg.onload = resolve;
      cleanImg.onerror = resolve;
    });
    if (!pageRenderGuard.isCurrent(renderToken)) return;
    cleanedImgElement = cleanImg;
  } else {
    // Cache MISS: Run PyTorch AI Inpainter and store in cache
    try {
      const inpaintedBlob = await runAIInpaint(originalSrc, activePageTranslation, canvas.width, canvas.height);
      if (!pageRenderGuard.isCurrent(renderToken)) return;
      objectUrlToCleanup = URL.createObjectURL(inpaintedBlob);
      
      const cleanImg = new Image();
      cleanImg.src = objectUrlToCleanup;
      await new Promise((resolve, reject) => {
        cleanImg.onload = resolve;
        cleanImg.onerror = reject;
      });
      if (!pageRenderGuard.isCurrent(renderToken)) {
        URL.revokeObjectURL(objectUrlToCleanup);
        return;
      }
      cleanedImgElement = cleanImg;
      
      // Store clean base64 image in memory cache
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(cleanedImgElement, 0, 0);
      if (cacheKey) {
        cleanedBgCache[cacheKey] = tempCanvas.toDataURL('image/jpeg', 0.95);
      }
    } catch (err) {
      if (!pageRenderGuard.isCurrent(renderToken)) return;
      console.warn('[⚠️] AI Inpainting unavailable. Keeping the original image:', err.message);
      initBgSampler();
      renderTypesetTextLayer(renderToken);
    }
  }

  if (!pageRenderGuard.isCurrent(renderToken)) return;
  
  // Never replace the source with a blocky automatic fallback when LaMa is unavailable.
  if (cleanedImgElement !== activeImage) {
    // Prefer loading from base64 cached background string
    if (cacheKey && cleanedBgCache[cacheKey]) {
      activeImage.src = cleanedBgCache[cacheKey];
    } else {
      activeImage.src = cleanedImgElement.src;
    }
  }
  
  if (objectUrlToCleanup) {
    // Defer revoking to allow browser to load the stream safely
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrlToCleanup);
      } catch (err) {}
    }, 1000);
  }
  
  if (pageRenderGuard.isCurrent(renderToken)) {
    canvasLoader.style.display = 'none';
  }
}

function renderTypesetTextLayer(renderToken = pageRenderGuard.current()) {
  if (!pageRenderGuard.isCurrent(renderToken)) return;
  const canvas = document.getElementById('typesetTextCanvas');
  if (!canvas) return;
  canvas.width = activeImage.naturalWidth || 800;
  canvas.height = activeImage.naturalHeight || 1200;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (activePageTranslation.length === 0) return;
  
  activePageTranslation.forEach((bubble) => {
    if (bubble.hidden) return;
    if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
    
    const [ymin, xmin, ymax, xmax] = bubble.box_2d;
    const x1 = (xmin / 1000) * canvas.width;
    const y1 = (ymin / 1000) * canvas.height;
    const x2 = (xmax / 1000) * canvas.width;
    const y2 = (ymax / 1000) * canvas.height;
    const w = x2 - x1;
    const h = y2 - y1;
    
    const bgColor = sampleImageBackgroundAt(x1, y1, w, h);
    
    const displayText = getInlineDisplayText(bubble);
    if (displayText) {
      drawTypesetText(ctx, displayText, x1, y1, w, h, bgColor, bubble.font_size, bubble.text_color, bubble.outline, bubble.rotate, bubble.font_family, bubble.text_align);
    }
  });
}

function refreshTypesetView() {
  if (activeImage.src.startsWith('data:')) {
    renderTypesetTextLayer();
  } else {
    renderTypesetImage();
  }
}

function sampleBubbleBackground(ctx, x, y, w, h) {
  try {
    const pixels = [
      ctx.getImageData(Math.max(0, Math.round(x + w * 0.15)), Math.max(0, Math.round(y + h * 0.15)), 1, 1).data,
      ctx.getImageData(Math.min(ctx.canvas.width - 1, Math.round(x + w * 0.85)), Math.max(0, Math.round(y + h * 0.15)), 1, 1).data,
      ctx.getImageData(Math.max(0, Math.round(x + w * 0.15)), Math.min(ctx.canvas.height - 1, Math.round(y + h * 0.85)), 1, 1).data,
      ctx.getImageData(Math.min(ctx.canvas.width - 1, Math.round(x + w * 0.85)), Math.min(ctx.canvas.height - 1, Math.round(y + h * 0.85)), 1, 1).data
    ];
    
    let r = 0, g = 0, b = 0;
    for (const p of pixels) {
      r += p[0];
      g += p[1];
      b += p[2];
    }
    r = Math.round(r / 4);
    g = Math.round(g / 4);
    b = Math.round(b / 4);
    
    if (r > 220 && g > 220 && b > 220) {
      return '#ffffff';
    }
    if (r < 35 && g < 35 && b < 35) {
      return '#000000';
    }
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  } catch (e) {
    return '#ffffff';
  }
}

function drawTypesetText(ctx, text, x, y, w, h, bgColor = '#ffffff', overrideFontSize = null, overrideTextColor = null, overrideOutline = false, overrideRotate = 0, overrideFontFamily = null, overrideTextAlign = null) {
  // Check contrast of background to choose black or white text
  let textColor = overrideTextColor || '#000000';
  if (!overrideTextColor && bgColor.startsWith('#')) {
    const r = parseInt(bgColor.slice(1, 3), 16) || 0;
    const g = parseInt(bgColor.slice(3, 5), 16) || 0;
    const b = parseInt(bgColor.slice(5, 7), 16) || 0;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    if (luminance < 130) textColor = '#ffffff';
  }

  const fontFamily = overrideFontFamily || 'Sarabun';
  const textAlign = overrideTextAlign || 'center';
  ctx.fillStyle = textColor;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  
  let fontSize;
  let lines = [];
  
  if (overrideFontSize) {
    fontSize = overrideFontSize;
    ctx.font = `bold ${fontSize}px '${fontFamily}', 'Segoe UI', sans-serif`;
    lines = wrapThaiText(ctx, text, w * 0.85);
  } else {
    fontSize = Math.max(14, Math.round(h * 0.18));
    if (fontSize > 40) fontSize = 40;
    
    while (fontSize >= 6) {
      ctx.font = `bold ${fontSize}px '${fontFamily}', 'Segoe UI', sans-serif`;
      lines = wrapThaiText(ctx, text, w * 0.85);
      const totalHeight = lines.length * (fontSize * 1.25);
      if (totalHeight <= h * 0.85) {
        break;
      }
      fontSize -= 1;
    }
  }
  
  const lineHeight = fontSize * 1.25;
  const startY = y + (h / 2) - ((lines.length - 1) * lineHeight / 2);
  
  // Calculate high-contrast outline color if outline is checked
  let outlineColor = '#ffffff';
  if (overrideOutline) {
    if (textColor.startsWith('#')) {
      const r = parseInt(textColor.slice(1, 3), 16) || 0;
      const g = parseInt(textColor.slice(3, 5), 16) || 0;
      const b = parseInt(textColor.slice(5, 7), 16) || 0;
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      if (luminance > 150) outlineColor = '#000000';
    } else {
      if (textColor === 'white' || textColor === '#ffffff') outlineColor = '#000000';
    }
  }
  
  const cx = x + (w / 2);
  const cy = y + (h / 2);
  const hasRotation = !!overrideRotate;
  
  if (hasRotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((overrideRotate * Math.PI) / 180);
  }
  
  const relativeStartY = -((lines.length - 1) * lineHeight / 2);
  
  // Determine horizontal anchor for each alignment
  // textAlign already set on ctx; we just need to pick lineX accordingly
  const getLineX = (align) => {
    if (hasRotation) {
      if (align === 'left')  return -(w * 0.425);
      if (align === 'right') return  (w * 0.425);
      return 0;
    } else {
      if (align === 'left')  return x + w * 0.075;
      if (align === 'right') return x + w * 0.925;
      return cx;
    }
  };
  const lineX = getLineX(textAlign);
  
  lines.forEach((line, idx) => {
    const lineY = hasRotation ? (relativeStartY + idx * lineHeight) : (startY + idx * lineHeight);
    
    if (overrideOutline) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.2));
      ctx.lineJoin = 'round';
      ctx.strokeText(line, lineX, lineY);
    }
    
    ctx.fillText(line, lineX, lineY);
  });
  
  if (hasRotation) {
    ctx.restore();
  }
}


function wrapThaiText(ctx, text, maxWidth) {
  // Use built-in Intl.Segmenter for grammatically correct Thai word breaking
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
  
  let lines = [];
  let currentLine = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const testLine = currentLine + segment;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = segment;
      } else {
        // If a single word segment exceeds maxWidth, split by grapheme clusters (never break combining characters)
        const graphemeSegmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
        const graphemes = Array.from(graphemeSegmenter.segment(segment)).map(g => g.segment);
        
        for (const grapheme of graphemes) {
          const testGraphemeLine = currentLine + grapheme;
          if (ctx.measureText(testGraphemeLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = grapheme;
          } else {
            currentLine = testGraphemeLine;
          }
        }
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function drawSmoothErase(ctx, x, y, w, h, bgColor) {
  ctx.save();
  const padding = Math.max(3, Math.min(8, w * 0.05, h * 0.05));
  const ex = x + padding;
  const ey = y + padding;
  const ew = w - padding * 2;
  const eh = h - padding * 2;
  
  if (ew <= 0 || eh <= 0) {
    ctx.restore();
    return;
  }
  
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(ex, ey, ew, eh, Math.min(ew, eh) * 0.25);
  ctx.fill();
  ctx.restore();
}

async function runAIInpaint(imgUrl, bubbles, canvasWidth, canvasHeight) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvasWidth;
  maskCanvas.height = canvasHeight;
  const mctx = maskCanvas.getContext('2d');
  
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, canvasWidth, canvasHeight);
  bubbles.forEach((bubble) => {
    // Skip manually added bubbles — no original text to erase
    if (bubble.manualAdd) return;
    if (!bubble.box_2d || bubble.box_2d.length !== 4) return;

    const [ymin, xmin, ymax, xmax] = bubble.box_2d;
    const x1 = (xmin / 1000) * canvasWidth;
    const y1 = (ymin / 1000) * canvasHeight;
    const x2 = (xmax / 1000) * canvasWidth;
    const y2 = (ymax / 1000) * canvasHeight;
    const w = x2 - x1;
    const h = y2 - y1;
    
    const maskRect = window.InpaintMaskGeometry.calculateMaskRect({
      x: x1,
      y: y1,
      width: w,
      height: h,
      imageWidth: canvasWidth,
      imageHeight: canvasHeight,
      mode: appSettings.inpaintMode
    });
    
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.roundRect(
      maskRect.x,
      maskRect.y,
      maskRect.width,
      maskRect.height,
      Math.min(maskRect.width, maskRect.height) * 0.15
    );
    mctx.fill();
  });

  
  // Combine manual brush strokes overlay
  const brushMaskCanvas = document.getElementById('brushMaskCanvas');
  if (brushMaskCanvas) {
    mctx.drawImage(brushMaskCanvas, 0, 0);
  }
  
  const originalBlob = await fetch(imgUrl).then(r => r.blob());
  const maskBlob = await new Promise(resolve => maskCanvas.toBlob(resolve, 'image/png'));
  
  const formData = new FormData();
  formData.append('image', originalBlob, 'image.jpg');
  formData.append('mask', maskBlob, 'mask.png');
  
  const res = await fetch('http://127.0.0.1:5000/inpaint', {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    throw new Error(`Inpaint server returned HTTP ${res.status}`);
  }
  
  return await res.blob();
}

// ==========================================================
// Chapter-wide find and replace
// ==========================================================

function updateFindReplaceSelectionSummary() {
  const selectedMatches = findReplaceMatches.filter(match =>
    findReplaceSelected.has(window.ChapterFindReplace.resultKey(match.pageIndex, match.bubbleId)));
  const selectedPages = new Set(selectedMatches.map(match => match.pageIndex)).size;
  findReplaceSummary.textContent = findReplaceMatches.length
    ? `เลือก ${selectedMatches.length} กล่อง จาก ${findReplaceMatches.length} กล่อง (${selectedPages} หน้า)`
    : 'ไม่พบข้อความที่ตรงกัน';
  findReplaceApply.disabled = selectedMatches.length === 0;
}

function invalidateChapterFindReplacePreview() {
  findReplacePages = [];
  findReplaceMatches = [];
  findReplaceSelected = new Set();
  findReplaceResults.innerHTML = '<div class="find-replace-empty">กด “ค้นหาทั้งตอน” เพื่อดูรายการก่อนแทนที่</div>';
  findReplaceSummary.textContent = 'ยังไม่ได้ค้นหา';
  findReplaceStatus.textContent = '';
  findReplaceApply.disabled = true;
}

function renderChapterFindReplaceResults() {
  findReplaceResults.innerHTML = '';
  if (!findReplaceMatches.length) {
    findReplaceResults.innerHTML = '<div class="find-replace-empty">ไม่พบข้อความที่ตรงกันในคำแปลของตอนนี้</div>';
    updateFindReplaceSelectionSummary();
    return;
  }

  const grouped = new Map();
  findReplaceMatches.forEach(match => {
    if (!grouped.has(match.pageIndex)) grouped.set(match.pageIndex, []);
    grouped.get(match.pageIndex).push(match);
  });

  grouped.forEach((matches, pageIndex) => {
    const page = document.createElement('section');
    page.className = 'find-replace-page';
    const heading = document.createElement('h3');
    heading.textContent = `หน้า ${pageIndex + 1} — ${matches[0].pageName}`;
    page.appendChild(heading);

    matches.forEach(match => {
      const key = window.ChapterFindReplace.resultKey(match.pageIndex, match.bubbleId);
      const row = document.createElement('article');
      row.className = 'find-replace-result';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = findReplaceSelected.has(key);
      checkbox.setAttribute('aria-label', `เลือกกล่อง ${match.bubbleId}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) findReplaceSelected.add(key);
        else findReplaceSelected.delete(key);
        updateFindReplaceSelectionSummary();
      });

      const comparison = document.createElement('div');
      comparison.className = 'find-replace-copy';
      const before = document.createElement('div');
      before.className = 'find-replace-before';
      before.textContent = match.before;
      const after = document.createElement('div');
      after.className = 'find-replace-after';
      after.textContent = match.after;
      comparison.append(before, after);

      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = `ไปแก้กล่องนี้ (${match.occurrenceCount} จุด)`;
      open.addEventListener('click', () => openFindReplaceResult(match.pageIndex, match.bubbleId));
      row.append(checkbox, comparison, open);
      page.appendChild(row);
    });
    findReplaceResults.appendChild(page);
  });
  updateFindReplaceSelectionSummary();
}

async function runChapterFindReplaceSearch() {
  const search = findReplaceSearch.value;
  if (!search.trim()) {
    findReplaceStatus.textContent = 'กรุณากรอกข้อความที่ต้องการค้นหา';
    findReplaceSearch.focus();
    return;
  }
  findReplaceRun.disabled = true;
  findReplaceApply.disabled = true;
  const pages = [];
  let failedPages = 0;
  for (let pageIndex = 0; pageIndex < images.length; pageIndex += 1) {
    findReplaceStatus.textContent = `กำลังค้นหา ${pageIndex + 1}/${images.length} หน้า…`;
    let bubbles = [];
    try {
      const loaded = await window.api.loadPageTranslation({
        project: currentProject, chapter: currentChapter, pageName: images[pageIndex].name,
      });
      bubbles = Array.isArray(loaded) ? loaded : [];
    } catch (error) {
      failedPages += 1;
    }
    pages.push({ pageIndex, pageName: images[pageIndex].name, bubbles });
  }
  findReplacePages = pages;
  findReplaceMatches = window.ChapterFindReplace.findChapterMatches(
    pages, search, findReplaceReplacement.value, findReplaceWholeWord.checked);
  findReplaceSelected = new Set(findReplaceMatches.map(match =>
    window.ChapterFindReplace.resultKey(match.pageIndex, match.bubbleId)));
  renderChapterFindReplaceResults();
  findReplaceStatus.textContent = failedPages
    ? `ค้นหาเสร็จ แต่เปิดข้อมูลไม่ได้ ${failedPages} หน้า (ข้ามหน้านั้นแล้ว)`
    : `ค้นหาเสร็จ ${images.length} หน้า`;
  findReplaceRun.disabled = false;
}

function saveFindReplacePage(pageIndex, translationData) {
  return window.api.savePageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: images[pageIndex].name,
    translationData,
  });
}

async function synchronizeFindReplacePages(indices) {
  const uniqueIndices = [...new Set(indices)];
  uniqueIndices.forEach(pageIndex => {
    if (!images[pageIndex]) return;
    delete cleanedBgCache[images[pageIndex].name];
    reviewCache.delete(pageIndex);
  });
  renderThumbnails();
  await updateProjectStats();
  if (uniqueIndices.includes(activeIndex)) await selectPage(activeIndex);
}

async function applyChapterFindReplace() {
  const selectedMatches = findReplaceMatches.filter(match =>
    findReplaceSelected.has(window.ChapterFindReplace.resultKey(match.pageIndex, match.bubbleId)));
  if (!selectedMatches.length) return;
  const pageCount = new Set(selectedMatches.map(match => match.pageIndex)).size;
  if (!confirm(`แทนที่ ${selectedMatches.length} กล่อง ใน ${pageCount} หน้า ใช่หรือไม่?`)) return;

  findReplaceApply.disabled = true;
  findReplaceRun.disabled = true;
  findReplaceStatus.textContent = 'กำลังบันทึกการแทนที่…';
  const updates = window.ChapterFindReplace.applySelectedMatches(
    findReplacePages, findReplaceMatches, findReplaceSelected);
  const originals = new Map([...updates.keys()].map(pageIndex => {
    const page = findReplacePages.find(item => item.pageIndex === pageIndex);
    return [pageIndex, JSON.parse(JSON.stringify(page?.bubbles || []))];
  }));
  const result = await window.ChapterFindReplace.saveReplacementBatch({
    originals, updates, savePage: saveFindReplacePage,
  });

  if (!result.ok) {
    const rollbackNote = result.rollbackErrors?.length
      ? `; ย้อนคืนไม่สำเร็จ ${result.rollbackErrors.length} หน้า`
      : '';
    findReplaceStatus.textContent = `บันทึกไม่สำเร็จ: ${result.error}${rollbackNote}`;
    findReplaceApply.disabled = false;
    findReplaceRun.disabled = false;
    await synchronizeFindReplacePages(result.changedIndices || []);
    return;
  }

  lastChapterReplaceUndo = result.undoRecord;
  findReplaceUndo.disabled = false;
  result.changedIndices.forEach(pageIndex => {
    const page = findReplacePages.find(item => item.pageIndex === pageIndex);
    if (page) page.bubbles = updates.get(pageIndex);
  });
  findReplaceStatus.textContent = `แทนที่สำเร็จ ${selectedMatches.length} กล่อง ใน ${pageCount} หน้า`;
  findReplaceSelected = new Set();
  updateFindReplaceSelectionSummary();
  findReplaceRun.disabled = false;
  await synchronizeFindReplacePages(result.changedIndices);
}

async function undoLastChapterReplace() {
  if (!lastChapterReplaceUndo) return;
  if (!confirm('ย้อนกลับการแทนที่ทั้งตอนครั้งล่าสุดใช่หรือไม่?')) return;
  findReplaceUndo.disabled = true;
  findReplaceStatus.textContent = 'กำลังย้อนกลับ…';
  const result = await window.ChapterFindReplace.undoReplacementBatch(
    lastChapterReplaceUndo, saveFindReplacePage);
  if (!result.ok) {
    findReplaceStatus.textContent = `ย้อนกลับไม่สำเร็จ: ${result.error}`;
    findReplaceUndo.disabled = false;
    await synchronizeFindReplacePages(result.restoredIndices || []);
    return;
  }
  const restoredIndices = result.restoredIndices;
  lastChapterReplaceUndo = null;
  findReplaceUndo.disabled = true;
  invalidateChapterFindReplacePreview();
  findReplaceStatus.textContent = `ย้อนกลับสำเร็จ ${restoredIndices.length} หน้า`;
  await synchronizeFindReplacePages(restoredIndices);
}

async function openFindReplaceResult(pageIndex, bubbleId) {
  chapterFindReplaceDialog.close();
  await selectPage(pageIndex);
  requestAnimationFrame(() => {
    highlightCard(bubbleId);
    focusCard(bubbleId);
    highlightOverlayRect(bubbleId);
  });
}

chapterFindReplaceBtn.addEventListener('click', () => {
  if (!images.length) return;
  if (chapterReviewOverlay.style.display === 'flex') closeChapterReview();
  chapterFindReplaceDialog.showModal();
  findReplaceSearch.focus();
});
closeFindReplaceBtn.addEventListener('click', () => chapterFindReplaceDialog.close());
findReplaceRun.addEventListener('click', runChapterFindReplaceSearch);
findReplaceSelectAll.addEventListener('click', () => {
  findReplaceSelected = new Set(findReplaceMatches.map(match =>
    window.ChapterFindReplace.resultKey(match.pageIndex, match.bubbleId)));
  renderChapterFindReplaceResults();
});
findReplaceSelectNone.addEventListener('click', () => {
  findReplaceSelected = new Set();
  renderChapterFindReplaceResults();
});
findReplaceApply.addEventListener('click', applyChapterFindReplace);
findReplaceUndo.addEventListener('click', undoLastChapterReplace);
[findReplaceSearch, findReplaceReplacement, findReplaceWholeWord].forEach(control =>
  control.addEventListener('input', invalidateChapterFindReplacePreview));

// ==========================================================
// Continuous Chapter Review
// ==========================================================

const reviewSession = window.ReviewController.createReviewSession();
let reviewQueue = null;
let reviewObserver = null;
let reviewToken = null;
let reviewSelected = new Set();
let reviewTranslations = new Map();
let reviewCache = new Map();
const reviewFinished = new Set();
const reviewPending = new Set();
let reviewSettings = window.ReviewController.normalizeReviewSettings({});

async function composeReviewPage(imgObj, translation) {
  const sourceImage = await loadImageElement(imgObj.fileUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth || 800;
  canvas.height = sourceImage.naturalHeight || 1200;
  const context = canvas.getContext('2d');
  let background = sourceImage;
  let tempUrl = null;

  if (translation?.length) {
    try {
      const blob = await runAIInpaint(imgObj.fileUrl, translation, canvas.width, canvas.height);
      tempUrl = URL.createObjectURL(blob);
      background = await loadImageElement(tempUrl);
    } catch (err) {
      background = sourceImage;
    }
  }
  context.drawImage(background, 0, 0);

  try {
    const paint = await window.api.loadCustomPaint({
      project: currentProject, chapter: currentChapter, pageName: imgObj.name,
    });
    if (paint?.exists) {
      const paintImage = await loadImageElement(paint.fileUrl);
      context.drawImage(paintImage, 0, 0);
    }
  } catch (err) {}

  if (translation?.length) {
    translation.forEach(bubble => {
      if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
      const [ymin, xmin, ymax, xmax] = bubble.box_2d;
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const width = ((xmax - xmin) / 1000) * canvas.width;
      const height = ((ymax - ymin) / 1000) * canvas.height;
      if (bubble.translated_text && !bubble.hidden) {
        drawTypesetText(
          context, bubble.translated_text, x, y, width, height,
          background === sourceImage ? sampleBubbleBackground(context, x, y, width, height) : '#ffffff',
          bubble.font_size, bubble.text_color, bubble.outline, bubble.rotate,
          bubble.font_family, bubble.text_align
        );
      }
    });
  }
  if (watermarkSettings.enabled && watermarkImage) {
    drawWatermark(context, watermarkImage, watermarkSettings, canvas.width, canvas.height);
  }
  if (tempUrl) URL.revokeObjectURL(tempUrl);
  return canvas;
}

function applyReviewDisplaySettings() {
  chapterReviewColumn.dataset.width = reviewSettings.width;
  chapterReviewColumn.classList.toggle('show-names', reviewSettings.showNames);
  chapterReviewColumn.querySelectorAll('.review-page').forEach(page =>
    page.classList.toggle('boundary', reviewSettings.showBoundaries));
  document.querySelectorAll('.review-width').forEach(button =>
    button.classList.toggle('active', button.dataset.width === reviewSettings.width));
}

function renderReviewSelector() {
  reviewPageSelector.innerHTML = '';
  images.forEach((image, index) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = reviewSelected.has(index);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) reviewSelected.add(index); else reviewSelected.delete(index);
      buildReviewPages();
    });
    label.append(checkbox, document.createTextNode(`${index + 1}. ${image.name}`));
    reviewPageSelector.appendChild(label);
  });
}

function updateReviewProgress() {
  const progress = window.ReviewController.getReviewProgress(
    [...reviewSelected], reviewCache, reviewFinished
  );
  chapterReviewProgress.max = Math.max(1, progress.max);
  chapterReviewProgress.value = progress.value;
  chapterReviewProgress.classList.toggle('complete', progress.complete && progress.max > 0);
  chapterReviewProgressText.textContent = progress.label;
}

function showCachedReviewPage(pageElement, index, dataUrl) {
  pageElement.querySelector('.review-source-preview')?.remove();
  pageElement.querySelector('.review-translated-preview')?.remove();
  pageElement.querySelector('.review-page-state')?.remove();
  const image = document.createElement('img');
  image.className = 'review-translated-preview';
  image.src = dataUrl;
  image.title = 'คลิกเพื่อกลับไปแก้หน้านี้';
  image.addEventListener('load', () => {
    if (image.naturalWidth && image.naturalHeight) {
      pageElement.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    }
  });
  image.addEventListener('click', () => openEditorPageFromReview(index));
  pageElement.appendChild(image);
  pageElement.dataset.status = 'done';
}

function encodeReviewPreview(canvas) {
  const size = window.ReviewController.calculateReviewPreviewSize(canvas.width, canvas.height);
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = size.width;
  previewCanvas.height = size.height;
  previewCanvas.getContext('2d').drawImage(canvas, 0, 0, size.width, size.height);
  const dataUrl = previewCanvas.toDataURL('image/jpeg', 0.92);
  previewCanvas.width = 1;
  previewCanvas.height = 1;
  return dataUrl;
}

function enqueueReviewPage(pageElement) {
  if (pageElement.dataset.status !== 'idle') return;
  const index = Number(pageElement.dataset.index);
  const cached = reviewCache.get(index);
  if (cached) {
    if (pageElement.dataset.visible === 'true') showCachedReviewPage(pageElement, index, cached);
    updateReviewProgress();
    return;
  }
  if (reviewPending.has(index)) return;
  reviewPending.add(index);
  pageElement.dataset.status = 'queued';
  const token = reviewToken;
  reviewQueue.add(async () => {
    if (!reviewSession.isCurrent(token)) return;
    const canvas = await composeReviewPage(images[index], reviewTranslations.get(index));
    const dataUrl = encodeReviewPreview(canvas);
    canvas.width = 1;
    canvas.height = 1;
    if (!reviewSession.isCurrent(token)) return;
    reviewCache.set(index, dataUrl);
    reviewPending.delete(index);
    const currentPage = chapterReviewColumn.querySelector(`.review-page[data-index="${index}"]`);
    if (currentPage?.dataset.visible === 'true') {
      showCachedReviewPage(currentPage, index, dataUrl);
    } else {
      if (currentPage) currentPage.dataset.status = 'idle';
    }
    updateReviewProgress();
  }).catch(err => {
    if (!reviewSession.isCurrent(token)) return;
    reviewPending.delete(index);
    reviewFinished.add(index);
    updateReviewProgress();
    const currentPage = chapterReviewColumn.querySelector(`.review-page[data-index="${index}"]`);
    if (!currentPage) return;
    currentPage.dataset.status = 'idle';
    const state = currentPage.querySelector('.review-page-state');
    state.innerHTML = '';
    const retry = document.createElement('button');
    retry.textContent = 'โหลดไม่สำเร็จ — ลองใหม่';
    retry.addEventListener('click', () => {
      reviewFinished.delete(index);
      updateReviewProgress();
      enqueueReviewPage(currentPage);
    });
    state.appendChild(retry);
  });
}

function enqueueSelectedReviewPages() {
  chapterReviewColumn.querySelectorAll('.review-page').forEach(page => enqueueReviewPage(page));
}

function buildReviewPages() {
  reviewObserver?.disconnect();
  chapterReviewColumn.innerHTML = '';
  const selectedIndices = [...reviewSelected].sort((a, b) => a - b);
  chapterReviewCount.textContent = `${selectedIndices.length} / ${images.length} หน้า`;
  updateReviewProgress();
  selectedIndices.forEach(index => {
    const page = document.createElement('section');
    page.className = 'review-page';
    page.dataset.index = index;
    page.dataset.status = 'idle';
    page.style.aspectRatio = '2 / 3';
    const name = document.createElement('span');
    name.className = 'review-page-name';
    name.textContent = images[index].name;
    name.addEventListener('click', () => openEditorPageFromReview(index));
    const sourcePreview = document.createElement('img');
    sourcePreview.className = 'review-source-preview';
    sourcePreview.addEventListener('load', () => {
      if (sourcePreview.naturalWidth && sourcePreview.naturalHeight) {
        page.style.aspectRatio = `${sourcePreview.naturalWidth} / ${sourcePreview.naturalHeight}`;
      }
    });
    sourcePreview.src = images[index].fileUrl;
    sourcePreview.title = 'กำลังเตรียมภาพแปล... คลิกเพื่อกลับไปแก้หน้านี้';
    sourcePreview.addEventListener('click', () => openEditorPageFromReview(index));
    const state = document.createElement('div');
    state.className = 'review-page-state';
    state.textContent = 'กำลังเตรียมภาพแปล...';
    page.append(name, sourcePreview, state);
    chapterReviewColumn.appendChild(page);
  });
  applyReviewDisplaySettings();
  reviewObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.dataset.visible = 'true';
        enqueueReviewPage(entry.target);
      } else {
        entry.target.dataset.visible = 'false';
      }
      if (!entry.isIntersecting && entry.target.dataset.status === 'done') {
        entry.target.querySelector('.review-translated-preview')?.remove();
        entry.target.dataset.status = 'idle';
        const state = document.createElement('div');
        state.className = 'review-page-state';
        state.textContent = 'เลื่อนกลับมาเพื่อโหลด';
        entry.target.appendChild(state);
      }
    });
  }, { root: chapterReviewScroll, rootMargin: '1200px 0px' });
  chapterReviewColumn.querySelectorAll('.review-page').forEach(page => reviewObserver.observe(page));
  renderReviewSelector();
  enqueueSelectedReviewPages();
}

async function openChapterReview() {
  if (!images.length) return;
  chapterReviewOverlay.style.display = 'flex';
  document.getElementById('chapterReviewTitle').textContent = `📖 ${currentProject} — ตอน ${currentChapter}`;
  const token = reviewSession.begin();
  reviewToken = token;
  reviewQueue = window.ReviewController.createTaskQueue(2);
  reviewSelected = new Set(images.map((_, index) => index));
  reviewCache = new Map();
  reviewFinished.clear();
  const translations = await window.ReviewController.loadReviewTranslations(images, image =>
    window.api.loadPageTranslation({
      project: currentProject, chapter: currentChapter, pageName: image.name,
    })
  );
  reviewTranslations = translations;
  if (!reviewSession.isCurrent(token)) return;
  buildReviewPages();
}

function closeChapterReview() {
  reviewSession.close();
  reviewObserver?.disconnect();
  reviewQueue?.clear();
  reviewObserver = null;
  reviewQueue = null;
  reviewCache.clear();
  reviewFinished.clear();
  reviewPending.clear();
  chapterReviewColumn.querySelectorAll('img').forEach(image => { image.src = ''; });
  chapterReviewColumn.innerHTML = '';
  chapterReviewOverlay.style.display = 'none';
}

async function openEditorPageFromReview(index) {
  closeChapterReview();
  if (!isPreviewMode) {
    isPreviewMode = true;
    previewToggleBtn.textContent = '👁️ ดูภาพต้นฉบับ';
    previewToggleBtn.classList.remove('btn-accent');
    previewToggleBtn.classList.add('btn-secondary');
  }
  await selectPage(index);
}

chapterReviewBtn.addEventListener('click', openChapterReview);
document.getElementById('closeChapterReviewBtn').addEventListener('click', closeChapterReview);
document.getElementById('reviewSelectAll').addEventListener('click', () => {
  reviewSelected = new Set(images.map((_, index) => index)); buildReviewPages();
});
document.getElementById('reviewSelectNone').addEventListener('click', () => {
  reviewSelected = new Set(); buildReviewPages();
});
document.getElementById('reviewSelectTranslated').addEventListener('click', () => {
  reviewSelected = new Set([...reviewTranslations.entries()].filter(([, value]) => value.length).map(([index]) => index));
  buildReviewPages();
});
document.querySelectorAll('.review-width').forEach(button => button.addEventListener('click', () => {
  reviewSettings.width = button.dataset.width; applyReviewDisplaySettings();
}));
document.getElementById('reviewShowNames').addEventListener('change', event => {
  reviewSettings.showNames = event.target.checked; applyReviewDisplaySettings();
});
document.getElementById('reviewShowBoundaries').addEventListener('change', event => {
  reviewSettings.showBoundaries = event.target.checked; applyReviewDisplaySettings();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && chapterReviewOverlay.style.display === 'flex') closeChapterReview();
});

// ==========================================================
// Export Modal System
// ==========================================================

const exportDialog      = document.getElementById('exportDialog');
const exportModeAllBtn  = document.getElementById('exportModeAllBtn');
const exportModeSelBtn  = document.getElementById('exportModeSelectBtn');
const exportPanelAll    = document.getElementById('exportPanelAll');
const exportPanelSel    = document.getElementById('exportPanelSelect');
const exportPageList    = document.getElementById('exportPageList');
const exportSelectedCnt = document.getElementById('exportSelectedCount');
const exportProgress    = document.getElementById('exportProgress');
const doExportBtn       = document.getElementById('doExportBtn');
const doExportBtnLabel  = document.getElementById('doExportBtnLabel');
const facebookExportBtn = document.getElementById('facebookExportBtn');
const facebookArchiveName = document.getElementById('facebookArchiveName');
const facebookMaxImages = document.getElementById('facebookMaxImages');
const qualityPanel = document.getElementById('qualityPanel');
const qualityProgress = document.getElementById('qualityProgress');
const qualitySummary = document.getElementById('qualitySummary');
const qualityIssueList = document.getElementById('qualityIssueList');
const qualityRescanBtn = document.getElementById('qualityRescanBtn');
const qualityContinueBtn = document.getElementById('qualityContinueBtn');
const exportWorkflowOptions = document.getElementById('exportWorkflowOptions');
const qualityFilterButtons = [...document.querySelectorAll('.quality-filters button')];

let exportMode = 'all'; // 'all' | 'select'
// Map pageName → { translated: bool }
let exportPageMeta = {};
let exportQualityReport = null;
let exportQualityFilter = 'all';
let qualityExcludedPages = new Set();

const exportQualityNavigation = window.ExportQualityController.create({
  selectPage,
  waitForPage: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  selectBubble: bubbleId => {
    const bubble = activePageTranslation.find(item => String(item.bubble_id) === String(bubbleId));
    if (!bubble) return false;
    focusCard(bubble.bubble_id);
    highlightCard(bubble.bubble_id);
    highlightOverlayRect(bubble.bubble_id);
    return true;
  },
  revealBubble: bubbleId => {
    const card = bubblesList.querySelector(`.bubble-editor-card[data-id="${bubbleId}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  notify: message => alert(message),
});

function qualityFilterMatches(result) {
  if (exportQualityFilter === 'all') return true;
  if (exportQualityFilter === 'pass') return result.status === 'pass' || result.status === 'excluded';
  return result.status === exportQualityFilter;
}

function renderExportQualityReport() {
  if (!exportQualityReport) return;
  const { summary, results } = exportQualityReport;
  qualitySummary.innerHTML = `
    <div><strong>${summary.errors}</strong><span>ข้อผิดพลาด</span></div>
    <div><strong>${summary.warnings}</strong><span>คำเตือน</span></div>
    <div><strong>${summary.passed}</strong><span>ผ่าน</span></div>
    <div><strong>${summary.excluded}</strong><span>ไม่ต้องแปล</span></div>`;
  qualityIssueList.innerHTML = '';
  const visible = results.filter(qualityFilterMatches);
  if (!visible.length) qualityIssueList.innerHTML = '<p class="quality-empty">ไม่พบรายการในตัวกรองนี้</p>';

  visible.forEach(result => {
    const row = document.createElement('article');
    row.className = `quality-page quality-${result.status}`;
    const heading = document.createElement('div');
    heading.className = 'quality-page-heading';
    const label = result.status === 'pass' ? 'ผ่าน' : result.status === 'excluded' ? 'ไม่ต้องแปล' : `${result.issues.length} รายการ`;
    heading.innerHTML = `<strong>หน้า ${result.pageIndex + 1}</strong><span title="${result.pageName}">${result.pageName}</span><em>${label}</em>`;
    row.appendChild(heading);
    result.issues.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `quality-issue quality-${item.severity}`;
      const detail = item.code === 'GLOSSARY_MISMATCH' ? ` — ควรใช้ “${item.details.expected}” แทน ${item.details.source}` : '';
      button.textContent = `${item.message}${item.bubbleId == null ? '' : ` (กล่อง #${item.bubbleId})`}${detail}`;
      button.addEventListener('click', async () => {
        exportDialog.close();
        await exportQualityNavigation.goToIssue({ ...item, pageIndex: result.pageIndex });
      });
      row.appendChild(button);
    });
    if (result.issues.some(item => item.code === 'PAGE_UNTRANSLATED') || result.status === 'excluded') {
      const exclusion = document.createElement('label');
      exclusion.className = 'quality-exclusion';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = qualityExcludedPages.has(result.pageName);
      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) qualityExcludedPages.add(result.pageName);
        else qualityExcludedPages.delete(result.pageName);
        await window.api.saveChapterQualityState({
          project: currentProject, chapter: currentChapter,
          pageNames: images.map(image => image.name), excludedPages: [...qualityExcludedPages],
        });
        await runExportQualityScan();
      });
      exclusion.append(checkbox, document.createTextNode(' หน้านี้ไม่ต้องแปล'));
      row.appendChild(exclusion);
    }
    qualityIssueList.appendChild(row);
  });
  const hasIssues = summary.errors + summary.warnings > 0;
  qualityContinueBtn.textContent = hasIssues ? 'ส่งออกต่อแม้มีคำเตือน' : 'ไปขั้นตอนส่งออก';
}

function measureBubbleOverflow(bubble, imageWidth, imageHeight, context) {
  const box = bubble.box_2d;
  if (!window.ExportQuality.validBox(box)) return false;
  const width = ((box[3] - box[1]) / 1000) * imageWidth * 0.85;
  const height = ((box[2] - box[0]) / 1000) * imageHeight * 0.85;
  const fontSize = Number(bubble.font_size) || 6;
  context.font = `bold ${fontSize}px '${bubble.font_family || 'Sarabun'}', 'Segoe UI', sans-serif`;
  return window.TextOverflow.isTextOverflowing({
    text: bubble.translated_text, boxWidth: width, boxHeight: height,
    fontSize, lineHeight: fontSize * 1.25,
  }, window.TextOverflow.createCanvasAdapter(context));
}

async function runExportQualityScan() {
  qualityRescanBtn.disabled = true;
  qualityContinueBtn.disabled = true;
  qualityIssueList.innerHTML = '<p class="quality-empty">กำลังตรวจคำแปลที่บันทึกไว้...</p>';
  const savedState = await window.api.loadChapterQualityState({
    project: currentProject, chapter: currentChapter, pageNames: images.map(image => image.name),
  });
  qualityExcludedPages = new Set(savedState?.excludedPages || []);
  const pages = [];
  const context = document.createElement('canvas').getContext('2d');
  for (let pageIndex = 0; pageIndex < images.length; pageIndex += 1) {
    const image = images[pageIndex];
    qualityProgress.textContent = `กำลังตรวจหน้า ${pageIndex + 1} / ${images.length}`;
    try {
      const translation = await window.api.loadPageTranslation({
        project: currentProject, chapter: currentChapter, pageName: image.name,
      });
      const source = await loadImageElement(image.fileUrl);
      pages.push(window.ExportQuality.inspectPage({
        pageName: image.name, pageIndex, translation, glossary: projectGlossary,
        excluded: qualityExcludedPages.has(image.name),
        measureOverflow: ({ bubble }) => measureBubbleOverflow(bubble, source.naturalWidth, source.naturalHeight, context),
      }));
    } catch (error) {
      pages.push({ pageName: image.name, pageIndex, status: 'warning', issues: [{
        code: 'INSPECTION_INCOMPLETE', severity: 'warning', bubbleId: null,
        message: `ตรวจหน้านี้ไม่สมบูรณ์: ${error.message}`, details: {},
      }] });
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  const summary = pages.reduce((value, result) => {
    if (result.status === 'error') value.errors += 1;
    else if (result.status === 'warning') value.warnings += 1;
    else if (result.status === 'excluded') value.excluded += 1;
    else value.passed += 1;
    return value;
  }, { errors: 0, warnings: 0, passed: 0, excluded: 0 });
  exportQualityReport = { results: pages, summary };
  qualityProgress.textContent = `ตรวจครบ ${images.length} หน้าแล้ว`;
  qualityRescanBtn.disabled = false;
  qualityContinueBtn.disabled = false;
  renderExportQualityReport();
}

// ------ Tab switch ------
function switchExportMode(mode) {
  exportMode = mode;
  if (mode === 'all') {
    exportModeAllBtn.style.background    = '#1e293b';
    exportModeAllBtn.style.borderBottom  = '2px solid #3b82f6';
    exportModeAllBtn.style.color         = '#f8fafc';
    exportModeAllBtn.style.fontWeight    = '600';
    exportModeSelBtn.style.background    = 'transparent';
    exportModeSelBtn.style.borderBottom  = '2px solid transparent';
    exportModeSelBtn.style.color         = '#64748b';
    exportModeSelBtn.style.fontWeight    = 'normal';
    exportPanelAll.style.display = 'block';
    exportPanelSel.style.display = 'none';
  } else {
    exportModeSelBtn.style.background    = '#1e293b';
    exportModeSelBtn.style.borderBottom  = '2px solid #3b82f6';
    exportModeSelBtn.style.color         = '#f8fafc';
    exportModeSelBtn.style.fontWeight    = '600';
    exportModeAllBtn.style.background    = 'transparent';
    exportModeAllBtn.style.borderBottom  = '2px solid transparent';
    exportModeAllBtn.style.color         = '#64748b';
    exportModeAllBtn.style.fontWeight    = 'normal';
    exportPanelAll.style.display = 'none';
    exportPanelSel.style.display = 'block';
  }
  updateExportButtonLabel();
}
exportModeAllBtn.addEventListener('click', () => switchExportMode('all'));
exportModeSelBtn.addEventListener('click', () => switchExportMode('select'));

// ------ Helpers ------
function getCheckedIndices() {
  return [...exportPageList.querySelectorAll('input[type=checkbox]:checked')]
    .map(cb => parseInt(cb.value));
}

function getExportIndices() {
  return exportMode === 'all' ? images.map((_, index) => index) : getCheckedIndices();
}

function setExportBusy(busy) {
  doExportBtn.disabled = busy;
  facebookExportBtn.disabled = busy;
  document.getElementById('cancelExportDialogBtn').disabled = busy;
  document.getElementById('closeExportDialogBtn').disabled = busy;
  doExportBtn.style.opacity = busy ? '0.55' : '1';
  facebookExportBtn.style.opacity = busy ? '0.55' : '1';
}

function updateExportButtonLabel() {
  if (exportMode === 'all') {
    doExportBtnLabel.textContent = `ส่งออกทั้งหมด (${images.length} หน้า)`;
  } else {
    const cnt = getCheckedIndices().length;
    doExportBtnLabel.textContent = cnt > 0
      ? `ส่งออก ${cnt} หน้าที่เลือก`
      : 'กรุณาเลือกหน้า';
    doExportBtn.disabled = cnt === 0;
    doExportBtn.style.opacity = cnt === 0 ? '0.5' : '1';
    exportSelectedCnt.textContent = `เลือกแล้ว ${cnt} / ${images.length} หน้า`;
  }
}

qualityFilterButtons.forEach(button => button.addEventListener('click', () => {
  exportQualityFilter = button.dataset.filter;
  qualityFilterButtons.forEach(item => item.classList.toggle('active', item === button));
  renderExportQualityReport();
}));
qualityRescanBtn.addEventListener('click', runExportQualityScan);
document.getElementById('qualityBackToEditBtn').addEventListener('click', () => exportDialog.close());
qualityContinueBtn.addEventListener('click', () => {
  qualityPanel.style.display = 'none';
  exportWorkflowOptions.style.display = 'block';
});

// ------ Open Modal ------
async function openExportDialog() {
  if (!currentProject || images.length === 0) {
    alert('กรุณาเปิดบทการ์ตูนก่อน');
    return;
  }

  exportProgress.textContent = '';
  facebookArchiveName.value = `${currentProject}-${currentChapter}-facebook`;
  doExportBtn.disabled = false;
  doExportBtn.style.opacity = '1';
  qualityPanel.style.display = 'block';
  exportWorkflowOptions.style.display = 'none';
  exportQualityFilter = 'all';
  qualityFilterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
  switchExportMode('all');

  // Subtitle
  document.getElementById('exportDialogSubtitle').textContent =
    `${currentProject} — ตอน ${currentChapter}  •  ${images.length} หน้า`;
  document.getElementById('exportAllPageCount').textContent =
    `${images.length} หน้า (รวมทั้งที่แปลแล้วและยังไม่แปล)`;

  // Build page checklist
  exportPageList.innerHTML = '<div style="padding:8px 12px; color:#64748b; font-size:11px;">⏳ กำลังตรวจสอบสถานะ...</div>';
  exportDialog.showModal();
  await runExportQualityScan();

  // Async: load translation status per page
  exportPageMeta = {};
  const metaChecks = images.map(async (img, idx) => {
    const t = await window.api.loadPageTranslation({
      project: currentProject,
      chapter: currentChapter,
      pageName: img.name
    });
    exportPageMeta[idx] = { translated: t && t.length > 0, bubbleCount: t ? t.length : 0 };
  });
  await Promise.all(metaChecks);

  // Build checklist rows
  exportPageList.innerHTML = '';
  images.forEach((img, idx) => {
    const meta = exportPageMeta[idx] || {};
    const row = document.createElement('label');
    row.style.cssText = `display:flex; align-items:center; gap:10px; padding:7px 12px; cursor:pointer; border-bottom:1px solid #1e293b; transition:background 0.12s;`;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(56,189,248,0.06)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = idx;
    cb.checked = true; // default all checked
    cb.style.cssText = 'width:15px; height:15px; accent-color:#3b82f6; cursor:pointer; flex-shrink:0;';
    cb.addEventListener('change', updateExportButtonLabel);

    const thumb = document.createElement('img');
    thumb.src = img.fileUrl;
    thumb.style.cssText = 'width:32px; height:40px; object-fit:cover; border-radius:3px; border:1px solid #334155; flex-shrink:0;';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';

    const nameLine = document.createElement('div');
    nameLine.style.cssText = 'font-size:12px; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
    nameLine.textContent = `หน้า ${idx + 1} — ${img.name}`;

    const statusLine = document.createElement('div');
    statusLine.style.cssText = 'font-size:10px; margin-top:2px;';
    if (meta.translated) {
      statusLine.innerHTML = `<span style="color:#10b981;">✅ แปลแล้ว</span> <span style="color:#64748b;">(${meta.bubbleCount} บอลลูน)</span>`;
    } else {
      statusLine.innerHTML = `<span style="color:#64748b;">⬜ ยังไม่แปล</span>`;
    }

    info.appendChild(nameLine);
    info.appendChild(statusLine);
    row.appendChild(cb);
    row.appendChild(thumb);
    row.appendChild(info);
    exportPageList.appendChild(row);
  });

  updateExportButtonLabel();
}

// Select helpers
document.getElementById('exportSelectAllBtn').addEventListener('click', () => {
  exportPageList.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = true; });
  updateExportButtonLabel();
});
document.getElementById('exportSelectNoneBtn').addEventListener('click', () => {
  exportPageList.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
  updateExportButtonLabel();
});
document.getElementById('exportSelectTranslatedBtn').addEventListener('click', () => {
  exportPageList.querySelectorAll('input[type=checkbox]').forEach(cb => {
    const idx = parseInt(cb.value);
    cb.checked = !!(exportPageMeta[idx] && exportPageMeta[idx].translated);
  });
  updateExportButtonLabel();
});

// Close buttons
document.getElementById('closeExportDialogBtn').addEventListener('click', () => exportDialog.close());
document.getElementById('cancelExportDialogBtn').addEventListener('click', () => exportDialog.close());

// ------ Open on button click ------
exportChapterBtn.addEventListener('click', openExportDialog);

// ------ Core Export Logic ------
async function composeExportPage(index) {
  const imgObj = images[index];
  if (!imgObj) throw new Error(`ไม่พบหน้าลำดับ ${index + 1}`);
  const translation = await window.api.loadPageTranslation({
    project: currentProject,
    chapter: currentChapter,
    pageName: imgObj.name
  });
  return composeReviewPage(imgObj, Array.isArray(translation) ? translation : []);
}

function sliceCanvasForFacebook(canvas, startSequence, rectangles) {
  const files = [];
  rectangles.forEach((rectangle, offset) => {
    const slice = document.createElement('canvas');
    slice.width = rectangle.width;
    slice.height = rectangle.height;
    slice.getContext('2d').drawImage(
      canvas,
      rectangle.x, rectangle.y, rectangle.width, rectangle.height,
      0, 0, rectangle.width, rectangle.height
    );
    files.push({
      name: window.FacebookExport.formatSliceName(startSequence + offset),
      dataUrl: slice.toDataURL('image/jpeg', 0.95)
    });
    slice.width = 0;
    slice.height = 0;
  });
  return files;
}

async function buildFacebookSlicePlan(indices, maximum) {
  const dimensions = [];
  for (const index of indices) {
    const source = await loadImageElement(images[index].fileUrl);
    dimensions.push({ index, width: source.naturalWidth, height: source.naturalHeight });
  }
  const counts = window.FacebookExport.allocateSliceCounts(dimensions.map(item => item.height), maximum);
  return dimensions.map((item, position) => ({
    index: item.index,
    rectangles: window.FacebookExport.getEqualSliceRects(item.width, item.height, counts[position])
  }));
}

async function runFacebookExport(indicesToExport) {
  if (!indicesToExport.length) {
    exportProgress.textContent = '⚠️ กรุณาเลือกหน้าอย่างน้อย 1 หน้า';
    return;
  }

  setExportBusy(true);
  try {
    exportProgress.textContent = '⏳ กำลังคำนวณจำนวนภาพ...';
    const slicePlan = await buildFacebookSlicePlan(indicesToExport, Number(facebookMaxImages.value));
    const estimatedCount = slicePlan.reduce((sum, item) => sum + item.rectangles.length, 0);
    const accepted = confirm(
      `จะได้ ${estimatedCount} ภาพ กระจายตามความยาวของแต่ละหน้า\n` +
      'การตัดแบบคงที่อาจตัดกลางข้อความหรือภาพ ต้องการทำต่อหรือไม่?'
    );
    if (!accepted) {
      exportProgress.textContent = 'ยกเลิกการส่งออก Facebook';
      return;
    }

    const archiveName = facebookArchiveName.value.trim();
    if (!archiveName) throw new Error('กรุณาตั้งชื่อไฟล์ ZIP ก่อนบันทึก');

    const files = [];
    let sequence = 1;
    for (let position = 0; position < indicesToExport.length; position++) {
      const index = slicePlan[position].index;
      const imgObj = images[index];
      exportProgress.textContent = `⏳ เตรียมหน้า ${position + 1}/${indicesToExport.length}: ${imgObj.name}`;
      try {
        const canvas = await composeExportPage(index);
        const pageFiles = sliceCanvasForFacebook(canvas, sequence, slicePlan[position].rectangles);
        files.push(...pageFiles);
        sequence += pageFiles.length;
        canvas.width = 0;
        canvas.height = 0;
        exportProgress.textContent = `⏳ สร้างแล้ว ${files.length}/${estimatedCount} ภาพ`;
      } catch (err) {
        throw new Error(`${imgObj.name}: ${err.message}`);
      }
    }

    exportProgress.textContent = `⏳ กำลังสร้าง ZIP ${files.length} ภาพ...`;
    const result = await window.api.saveFacebookArchive({ archiveName, files });
    if (result?.error) throw new Error(result.error);
    if (result?.canceled) {
      exportProgress.textContent = 'ยกเลิกการบันทึก ZIP';
      return;
    }
    exportProgress.textContent = `✅ บันทึก Facebook ZIP สำเร็จ ${files.length} ภาพ`;
    alert(`บันทึกสำเร็จ ${files.length} ภาพ\n${result.absolutePath}`);
  } catch (err) {
    exportProgress.textContent = `❌ ส่งออก Facebook ไม่สำเร็จ: ${err.message}`;
  } finally {
    setExportBusy(false);
    updateExportButtonLabel();
  }
}

async function runExport(indicesToExport) {
  doExportBtn.disabled = true;
  document.getElementById('cancelExportDialogBtn').disabled = true;
  document.getElementById('closeExportDialogBtn').disabled = true;

  let exportedCount = 0;
  try {
    for (let n = 0; n < indicesToExport.length; n++) {
      const i   = indicesToExport[n];
      const imgObj = images[i];
      exportProgress.textContent = `⏳ ส่งออกหน้า ${n + 1}/${indicesToExport.length}: ${imgObj.name}`;

      const translation = await window.api.loadPageTranslation({
        project: currentProject,
        chapter: currentChapter,
        pageName: imgObj.name
      });

      const img = new Image();
      img.src = imgObj.fileUrl;
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || 800;
      canvas.height = img.naturalHeight || 1200;
      const ctx = canvas.getContext('2d');

      let cleanedImg = img;
      let tempUrl    = null;

      if (translation && translation.length > 0) {
        try {
          const inpaintedBlob = await runAIInpaint(imgObj.fileUrl, translation, canvas.width, canvas.height);
          tempUrl = URL.createObjectURL(inpaintedBlob);
          const cleanImg = new Image();
          cleanImg.src = tempUrl;
          await new Promise((resolve, reject) => { cleanImg.onload = resolve; cleanImg.onerror = reject; });
          cleanedImg = cleanImg;
        } catch (err) {
          console.warn('[⚠️] AI Inpainting unavailable for export. Keeping the original image.', err.message);
          exportProgress.textContent = `คำเตือน: ${imgObj.name} ยังมีตัวอักษรต้นฉบับ เพราะ AI รีทัชไม่พร้อม`;
        }
      }

      ctx.drawImage(cleanedImg, 0, 0);

      // Custom paint layer
      try {
        const paintRes = await window.api.loadCustomPaint({
          project: currentProject, chapter: currentChapter, pageName: imgObj.name
        });
        if (paintRes && paintRes.exists) {
          const paintImg = new Image();
          paintImg.src = paintRes.fileUrl;
          await new Promise(resolve => { paintImg.onload = resolve; paintImg.onerror = resolve; });
          ctx.drawImage(paintImg, 0, 0);
        }
      } catch (err) {
        console.warn('[⚠️] Failed to load custom paint for export:', err);
      }

      if (tempUrl) URL.revokeObjectURL(tempUrl);

      if (translation && translation.length > 0) {
        translation.forEach(bubble => {
          if (!bubble.box_2d || bubble.box_2d.length !== 4) return;
          const [ymin, xmin, ymax, xmax] = bubble.box_2d;
          const x1 = (xmin / 1000) * canvas.width;
          const y1 = (ymin / 1000) * canvas.height;
          const w  = ((xmax - xmin) / 1000) * canvas.width;
          const h  = ((ymax - ymin) / 1000) * canvas.height;

          const bgColorForContrast = (cleanedImg === img)
            ? sampleBubbleBackground(ctx, x1, y1, w, h)
            : '#ffffff';

          if (bubble.translated_text && !bubble.hidden) {
            drawTypesetText(ctx, bubble.translated_text, x1, y1, w, h, bgColorForContrast,
              bubble.font_size, bubble.text_color, bubble.outline, bubble.rotate,
              bubble.font_family, bubble.text_align);
          }
        });
      }

      if (watermarkSettings.enabled && watermarkImage) {
        drawWatermark(ctx, watermarkImage, watermarkSettings, canvas.width, canvas.height);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const saveRes = await window.api.saveTypesetImage({
        project: currentProject, chapter: currentChapter,
        pageName: imgObj.name, dataUrl
      });
      if (saveRes.error) throw new Error(saveRes.error);
      exportedCount++;
    }

    exportProgress.textContent = `✅ ส่งออกสำเร็จ ${exportedCount} หน้า`;
    setTimeout(() => {
      exportDialog.close();
      alert(`🎉 ส่งออกสำเร็จ!\nบันทึก ${exportedCount} หน้า ที่:\noutput/${currentProject}/${currentChapter}/`);
    }, 800);

  } catch (err) {
    exportProgress.textContent = `❌ เกิดข้อผิดพลาด: ${err.message}`;
  } finally {
    doExportBtn.disabled = false;
    document.getElementById('cancelExportDialogBtn').disabled = false;
    document.getElementById('closeExportDialogBtn').disabled = false;
  }
}

// Do Export button
doExportBtn.addEventListener('click', () => {
  const indices = getExportIndices();

  if (indices.length === 0) {
    exportProgress.textContent = '⚠️ กรุณาเลือกหน้าอย่างน้อย 1 หน้า';
    return;
  }
  runExport(indices);
});

facebookExportBtn.addEventListener('click', () => runFacebookExport(getExportIndices()));


// ==========================================================
// Phase 3: Typesetting Studio Interactive Tools Implementation
// ==========================================================

let currentTool = 'select'; // 'select', 'add', 'brush', 'paint'
let isDragging = false;
let isResizing = false;
let isCreating = false;
let isPainting = false;
let isColorPainting = false;
let activeBubbleId = null;
let dragStartX = 0;
let dragStartY = 0;
let initialBox = null;

// Brush state
let brushSize = 20;
let lastBrushX = 0;
let lastBrushY = 0;

// Color Paint Brush state
let paintSize = 20;
let paintOpacity = 1.0;
let paintColor = '#ffffff';
let lastPaintX = 0;
let lastPaintY = 0;

// Grab DOM elements

const studioToolbar = document.getElementById('studioToolbar');
const toolSelectBtn = document.getElementById('toolSelectBtn');
const toolAddBtn = document.getElementById('toolAddBtn');
const toolBrushBtn = document.getElementById('toolBrushBtn');
const toolPaintBtn = document.getElementById('toolPaintBtn');

const brushOptions = document.getElementById('brushOptions');
const brushSizeRange = document.getElementById('brushSizeRange');
const brushSizeVal = document.getElementById('brushSizeVal');
const clearBrushBtn = document.getElementById('clearBrushBtn');
const brushMaskCanvas = document.getElementById('brushMaskCanvas');

const paintOptions = document.getElementById('paintOptions');
const paintColorInput = document.getElementById('paintColorInput');
const paintOpacityRange = document.getElementById('paintOpacityRange');
const paintOpacityVal = document.getElementById('paintOpacityVal');
const paintSizeRange = document.getElementById('paintSizeRange');
const paintSizeVal = document.getElementById('paintSizeVal');
const clearPaintBtn = document.getElementById('clearPaintBtn');
const colorPaintCanvas = document.getElementById('colorPaintCanvas');

// 1. Tool Switcher
function switchTool(tool) {
  cancelInlineEditor();
  currentTool = tool;
  
  // Highlight active buttons
  toolSelectBtn.className = (tool === 'select') ? 'btn btn-tool active' : 'btn btn-tool';
  toolAddBtn.className = (tool === 'add') ? 'btn btn-tool active' : 'btn btn-tool';
  toolBrushBtn.className = (tool === 'brush') ? 'btn btn-tool active' : 'btn btn-tool';
  toolPaintBtn.className = (tool === 'paint') ? 'btn btn-tool active' : 'btn btn-tool';
  
  // Apply styled color overrides to btn-tool dynamically
  const btns = [toolSelectBtn, toolAddBtn, toolBrushBtn, toolPaintBtn];
  btns.forEach(btn => {
    if (btn.className.includes('active')) {
      btn.style.background = '#3b82f6';
      btn.style.color = '#ffffff';
      btn.style.borderColor = '#3b82f6';
    } else {
      btn.style.background = '#1e293b';
      btn.style.color = '#94a3b8';
      btn.style.borderColor = '#334155';
    }
  });
  
  // Toggle Options & pointer events
  brushOptions.style.display = (tool === 'brush') ? 'flex' : 'none';
  paintOptions.style.display = (tool === 'paint') ? 'flex' : 'none';
  
  // Always display colorPaintCanvas so the user can see their background colors
  colorPaintCanvas.style.display = 'block';
  
  if (tool === 'brush') {
    brushMaskCanvas.style.display = 'block';
    brushMaskCanvas.style.pointerEvents = 'auto';
    colorPaintCanvas.style.pointerEvents = 'none';
    bubbleOverlay.style.pointerEvents = 'none';
  } else if (tool === 'paint') {
    brushMaskCanvas.style.display = 'none';
    brushMaskCanvas.style.pointerEvents = 'none';
    colorPaintCanvas.style.pointerEvents = 'auto';
    bubbleOverlay.style.pointerEvents = 'none';
  } else {
    brushMaskCanvas.style.display = 'none';
    brushMaskCanvas.style.pointerEvents = 'none';
    colorPaintCanvas.style.pointerEvents = 'none';
    bubbleOverlay.style.pointerEvents = 'auto';
  }
}

toolSelectBtn.addEventListener('click', () => switchTool('select'));
toolAddBtn.addEventListener('click', () => switchTool('add'));
toolBrushBtn.addEventListener('click', () => switchTool('brush'));
toolPaintBtn.addEventListener('click', () => switchTool('paint'));

if (refreshProjectsBtn) {
  refreshProjectsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateSavedProjectsList();
  });
}

if (addBubbleTextBtn) {
  addBubbleTextBtn.addEventListener('click', async () => {
    const activePage = images[activeIndex];
    if (!activePage) return;
    pushUndoState();
    
    const newId = activePageTranslation.length > 0
      ? Math.max(...activePageTranslation.map(b => b.bubble_id)) + 1
      : 1;
      
    activePageTranslation.push({
      bubble_id: newId,
      box_2d: [400, 400, 600, 600],
      original_text: '(เพิ่มข้อความแมนนวล)',
      translated_text: 'กรอกบทแปลใหม่ที่นี่',
      font_size: appSettings.defaultFontSize || 18,
      font_family: appSettings.defaultFontFamily || 'Sarabun',
      text_align: appSettings.defaultTextAlign || 'center',
      outline: true,
      manualAdd: true  // skip AI inpaint mask for manual bubbles
    });
    
    delete cleanedBgCache[activePage.name];
    await saveCurrentPageTranslation();
    renderPageTranslation();
    if (isPreviewMode) refreshTypesetView();
    
    setTimeout(() => {
      focusCard(newId);
    }, 100);
  });
}

brushSizeRange.addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value);
  brushSizeVal.textContent = brushSize;
});

paintSizeRange.addEventListener('input', (e) => {
  paintSize = parseInt(e.target.value);
  paintSizeVal.textContent = paintSize;
});

paintOpacityRange.addEventListener('input', (e) => {
  paintOpacity = parseFloat(e.target.value) / 100;
  paintOpacityVal.textContent = paintOpacity.toFixed(1);
});

paintColorInput.addEventListener('input', (e) => {
  paintColor = e.target.value;
});

const paintShapeSelect = document.getElementById('paintShapeSelect');
let paintShape = 'brush';
let paintSnapshot = null;

paintShapeSelect.addEventListener('change', (e) => {
  paintShape = e.target.value;
});

// Clear custom mask
clearBrushBtn.addEventListener('click', async () => {
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  const ctx = brushMaskCanvas.getContext('2d');
  ctx.clearRect(0, 0, brushMaskCanvas.width, brushMaskCanvas.height);
  
  try {
    await window.api.clearCustomMask({
      project: currentProject,
      chapter: currentChapter,
      pageName: activePage.name
    });
  } catch (err) {
    console.warn('[⚠️] Failed to clear mask from disk:', err);
  }
  
  delete cleanedBgCache[activePage.name];
  if (isPreviewMode) renderTypesetImage();
});

// Clear custom paint background
clearPaintBtn.addEventListener('click', async () => {
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  const ctx = colorPaintCanvas.getContext('2d');
  ctx.clearRect(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
  
  try {
    await window.api.clearCustomPaint({
      project: currentProject,
      chapter: currentChapter,
      pageName: activePage.name
    });
  } catch (err) {
    console.warn('[⚠️] Failed to clear paint from disk:', err);
  }
  
  delete cleanedBgCache[activePage.name];
  if (isPreviewMode) renderTypesetImage();
});

// 2. Coordinate normalizer
function getSVGCoords(e) {
  const rect = bubbleOverlay.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 1000;
  const y = ((e.clientY - rect.top) / rect.height) * 1000;
  return { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(1000, y)) };
}

// 3. Mouse Event Listeners for Select/Add Bubble modes
bubbleOverlay.addEventListener('mousedown', (e) => {
  cancelInlineEditor();
  if (watermarkDrag) { e.preventDefault(); return; }
  if (currentTool === 'brush') return;
  
  const target = e.target;
  const activePage = images[activeIndex];
  if (!activePage) return;

  if (currentTool === 'add') {
    isCreating = true;
    const coords = getSVGCoords(e);
    dragStartX = coords.x;
    dragStartY = coords.y;
    
    let tempRect = document.getElementById('tempAddRect');
    if (!tempRect) {
      tempRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tempRect.setAttribute('id', 'tempAddRect');
      tempRect.style.fill = 'rgba(168, 85, 247, 0.1)';
      tempRect.style.stroke = '#a855f7';
      tempRect.style.strokeWidth = '2px';
      tempRect.style.strokeDasharray = '4,4';
      bubbleOverlay.appendChild(tempRect);
    }
    tempRect.setAttribute('x', dragStartX);
    tempRect.setAttribute('y', dragStartY);
    tempRect.setAttribute('width', 0);
    tempRect.setAttribute('height', 0);
    tempRect.style.display = 'block';
    return;
  }
  
  if (target.classList.contains('bubble-resize-handle')) {
    e.preventDefault();
    isResizing = true;
    activeBubbleId = parseInt(target.getAttribute('data-id'));
    const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
    if (bubble) {
      initialBox = [...bubble.box_2d];
      const coords = getSVGCoords(e);
      dragStartX = coords.x;
      dragStartY = coords.y;
    }
    e.stopPropagation();
  } else if (target.classList.contains('bubble-rect')) {
    isDragging = true;
    activeBubbleId = parseInt(target.getAttribute('data-id'));
    const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
    if (bubble) {
      initialBox = [...bubble.box_2d];
      const coords = getSVGCoords(e);
      dragStartX = coords.x;
      dragStartY = coords.y;
    }
    e.stopPropagation();
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging && !isResizing && !isCreating) return;
  
  const coords = getSVGCoords(e);
  
  if (isCreating) {
    const tempRect = document.getElementById('tempAddRect');
    if (tempRect) {
      const x = Math.min(dragStartX, coords.x);
      const y = Math.min(dragStartY, coords.y);
      const w = Math.abs(coords.x - dragStartX);
      const h = Math.abs(coords.y - dragStartY);
      tempRect.setAttribute('x', x);
      tempRect.setAttribute('y', y);
      tempRect.setAttribute('width', w);
      tempRect.setAttribute('height', h);
    }
    return;
  }
  
  const dx = coords.x - dragStartX;
  const dy = coords.y - dragStartY;
  
  const bubble = activePageTranslation.find(b => b.bubble_id === activeBubbleId);
  if (!bubble || !initialBox) return;
  
  if (isDragging) {
    const [ymin, xmin, ymax, xmax] = initialBox;
    const w = xmax - xmin;
    const h = ymax - ymin;
    
    const newX = Math.max(0, Math.min(1000 - w, xmin + dx));
    const newY = Math.max(0, Math.min(1000 - h, ymin + dy));
    
    bubble.box_2d = [
      Math.round(newY),
      Math.round(newX),
      Math.round(newY + h),
      Math.round(newX + w)
    ];
    
    updateSVGOverlayOnly();
    updateLiveOverflowWarning(bubble);
    if (isPreviewMode) refreshTypesetView();
  } else if (isResizing) {
    const overlayRect = bubbleOverlay.getBoundingClientRect();
    const minimum = window.BubbleGeometry.screenPixelsToSvgUnits(
      16,
      overlayRect.width,
      overlayRect.height
    );
    bubble.box_2d = window.BubbleGeometry.resizeBoxFromSouthEast(
      initialBox,
      dx,
      dy,
      minimum.x,
      minimum.y
    );
    
    updateSVGOverlayOnly();
    updateLiveOverflowWarning(bubble);
    if (isPreviewMode) refreshTypesetView();
  }
});

window.addEventListener('mouseup', async () => {
  if (!isDragging && !isResizing && !isCreating) return;
  
  const activePage = images[activeIndex];
  if (!activePage) return;
  
  if (isCreating) {
    isCreating = false;
    const tempRect = document.getElementById('tempAddRect');
    if (tempRect) {
      tempRect.style.display = 'none';
      const x = parseFloat(tempRect.getAttribute('x'));
      const y = parseFloat(tempRect.getAttribute('y'));
      const w = parseFloat(tempRect.getAttribute('width'));
      const h = parseFloat(tempRect.getAttribute('height'));
      
      if (w > 15 && h > 15) {
        const ymin = Math.round(y);
        const xmin = Math.round(x);
        const ymax = Math.round(y + h);
        const xmax = Math.round(x + w);
        
        const newId = activePageTranslation.length > 0
          ? Math.max(...activePageTranslation.map(b => b.bubble_id)) + 1
          : 1;
          
        activePageTranslation.push({
          bubble_id: newId,
          box_2d: [ymin, xmin, ymax, xmax],
          original_text: '(สร้างกล่องแมนนวล)',
          translated_text: 'กรอกคำแปลบทสนทนาใหม่ตรงนี้',
          font_size: appSettings.defaultFontSize || undefined,
          font_family: appSettings.defaultFontFamily || 'Sarabun',
          text_align: appSettings.defaultTextAlign || 'center',
          manualAdd: true  // skip AI inpaint mask
        });
        
        delete cleanedBgCache[activePage.name];
        await saveCurrentPageTranslation();
        renderPageTranslation();
        if (isPreviewMode) refreshTypesetView();
        
        setTimeout(() => {
          focusCard(newId);
        }, 100);
      }
    }
    return;
  }
  
  isDragging = false;
  isResizing = false;
  activeBubbleId = null;
  initialBox = null;
  
  pushUndoState(); // save before committing drag/resize result
  delete cleanedBgCache[activePage.name];
  await saveCurrentPageTranslation();
  renderPageTranslation();
  if (isPreviewMode) refreshTypesetView();
});

// 4. Brush drawing event listeners on brushMaskCanvas
function getCanvasCoords(e) {
  const rect = brushMaskCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * brushMaskCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * brushMaskCanvas.height;
  return { x, y };
}

brushMaskCanvas.addEventListener('mousedown', (e) => {
  if (currentTool !== 'brush') return;
  isPainting = true;
  const coords = getCanvasCoords(e);
  lastBrushX = coords.x;
  lastBrushY = coords.y;
  
  drawBrushStroke(coords.x, coords.y);
});

brushMaskCanvas.addEventListener('mousemove', (e) => {
  if (currentTool !== 'brush' || !isPainting) return;
  const coords = getCanvasCoords(e);
  drawBrushStroke(coords.x, coords.y, true);
});

window.addEventListener('mouseup', async () => {
  if (isPainting) {
    isPainting = false;
    
    const activePage = images[activeIndex];
    if (activePage) {
      const dataUrl = brushMaskCanvas.toDataURL('image/png');
      try {
        await window.api.saveCustomMask({
          project: currentProject,
          chapter: currentChapter,
          pageName: activePage.name,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[⚠️] Failed to save custom mask:', err);
      }
      
      delete cleanedBgCache[activePage.name];
      if (isPreviewMode) renderTypesetImage();
    }
  }
});

function drawBrushStroke(x, y, isMove = false) {
  const ctx = brushMaskCanvas.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = brushSize;
  
  ctx.beginPath();
  if (isMove) {
    ctx.moveTo(lastBrushX, lastBrushY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  
  lastBrushX = x;
  lastBrushY = y;
}

// 5. Color Paint drawing event listeners on colorPaintCanvas
function getColorCanvasCoords(e) {
  const rect = colorPaintCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * colorPaintCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * colorPaintCanvas.height;
  return { x, y };
}

colorPaintCanvas.addEventListener('mousedown', (e) => {
  if (currentTool !== 'paint') return;
  isColorPainting = true;
  const coords = getColorCanvasCoords(e);
  lastPaintX = coords.x;
  lastPaintY = coords.y;
  
  const ctx = colorPaintCanvas.getContext('2d');
  // Capture canvas snapshot for non-trail preview drawing
  paintSnapshot = ctx.getImageData(0, 0, colorPaintCanvas.width, colorPaintCanvas.height);
  
  if (paintShape === 'brush') {
    drawColorPaintStroke(coords.x, coords.y);
  }
});

colorPaintCanvas.addEventListener('mousemove', (e) => {
  if (currentTool !== 'paint' || !isColorPainting) return;
  const coords = getColorCanvasCoords(e);
  
  if (paintShape === 'brush') {
    drawColorPaintStroke(coords.x, coords.y, true);
  } else {
    drawColorShapePreview(coords.x, coords.y);
  }
});

window.addEventListener('mouseup', async () => {
  if (isColorPainting) {
    isColorPainting = false;
    paintSnapshot = null;
    
    const activePage = images[activeIndex];
    if (activePage) {
      const dataUrl = colorPaintCanvas.toDataURL('image/png');
      try {
        await window.api.saveCustomPaint({
          project: currentProject,
          chapter: currentChapter,
          pageName: activePage.name,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.warn('[⚠️] Failed to save custom paint layer:', err);
      }
      
      delete cleanedBgCache[activePage.name];
      if (isPreviewMode) refreshTypesetView();
    }
  }
});

function drawColorShapePreview(x, y) {
  const ctx = colorPaintCanvas.getContext('2d');
  if (paintSnapshot) {
    ctx.putImageData(paintSnapshot, 0, 0);
  }
  
  ctx.fillStyle = paintColor;
  ctx.strokeStyle = paintColor;
  ctx.lineWidth = paintSize;
  ctx.globalAlpha = paintOpacity;
  
  const startX = lastPaintX;
  const startY = lastPaintY;
  
  const x1 = Math.min(startX, x);
  const y1 = Math.min(startY, y);
  const w = Math.abs(x - startX);
  const h = Math.abs(y - startY);
  
  ctx.beginPath();
  if (paintShape === 'rect') {
    ctx.fillRect(x1, y1, w, h);
  } else if (paintShape === 'oval') {
    const cx = startX + (x - startX) / 2;
    const cy = startY + (y - startY) / 2;
    const rx = Math.abs(x - startX) / 2;
    const ry = Math.abs(y - startY) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function drawColorPaintStroke(x, y, isMove = false) {
  const ctx = colorPaintCanvas.getContext('2d');
  ctx.strokeStyle = paintColor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = paintSize;
  ctx.globalAlpha = paintOpacity;
  
  ctx.beginPath();
  if (isMove) {
    ctx.moveTo(lastPaintX, lastPaintY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else {
    ctx.arc(x, y, paintSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = paintColor;
    ctx.fill();
  }
  
  ctx.globalAlpha = 1.0;
  
  lastPaintX = x;
  lastPaintY = y;
}
