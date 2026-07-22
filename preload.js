const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getInpaintStatus: () => ipcRenderer.invoke('get-inpaint-status'),
  retryInpaintSidecar: () => ipcRenderer.invoke('retry-inpaint-sidecar'),
  openGeminiApiKeyPage: () => ipcRenderer.invoke('open-gemini-api-key-page'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  backupProject: (args) => ipcRenderer.invoke('backup-project', args),
  inspectProjectBackup: () => ipcRenderer.invoke('inspect-project-backup'),
  confirmRestoreProject: (args) => ipcRenderer.invoke('confirm-restore-project', args),
  onInpaintStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('inpaint-status-changed', listener);
    return () => ipcRenderer.removeListener('inpaint-status-changed', listener);
  },
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  authorizeSourceFolder: (folderPath) => ipcRenderer.invoke('authorize-source-folder', folderPath),
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  translatePage: (args) => ipcRenderer.invoke('translate-page', args),
  saveTypesetImage: (args) => ipcRenderer.invoke('save-typeset-image', args),
  saveFacebookArchive: (args) => ipcRenderer.invoke('save-facebook-archive', args),
  savePageTranslation: (args) => ipcRenderer.invoke('save-page-translation', args),
  loadPageTranslation: (args) => ipcRenderer.invoke('load-page-translation', args),
  loadChapterQualityState: (args) => ipcRenderer.invoke('load-chapter-quality-state', args),
  saveChapterQualityState: (args) => ipcRenderer.invoke('save-chapter-quality-state', args),
  saveMemory: (args) => ipcRenderer.invoke('save-memory', args),
  loadMemory: (args) => ipcRenderer.invoke('load-memory', args),
  saveCustomMask: (args) => ipcRenderer.invoke('save-custom-mask', args),
  loadCustomMask: (args) => ipcRenderer.invoke('load-custom-mask', args),
  clearCustomMask: (args) => ipcRenderer.invoke('clear-custom-mask', args),
  saveCustomPaint: (args) => ipcRenderer.invoke('save-custom-paint', args),
  loadCustomPaint: (args) => ipcRenderer.invoke('load-custom-paint', args),
  clearCustomPaint: (args) => ipcRenderer.invoke('clear-custom-paint', args),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  deleteProjectMapping: (args) => ipcRenderer.invoke('delete-project-mapping', args),
  renameChapter: (args) => ipcRenderer.invoke('rename-chapter', args),
  saveApiKey: (args) => ipcRenderer.invoke('save-api-key', args),
  deleteApiKey: () => ipcRenderer.invoke('delete-api-key'),
  saveAppSettings: (args) => ipcRenderer.invoke('save-app-settings', args),
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),
  selectWatermark: (args) => ipcRenderer.invoke('select-watermark', args),
  loadWatermark: (args) => ipcRenderer.invoke('load-watermark', args),
  saveWatermarkSettings: (args) => ipcRenderer.invoke('save-watermark-settings', args),
  removeWatermark: (args) => ipcRenderer.invoke('remove-watermark', args),
  deletePageTranslation: (args) => ipcRenderer.invoke('delete-page-translation', args),
  listChapterTranslations: (args) => ipcRenderer.invoke('list-chapter-translations', args),
  getLamaComponentState: () => ipcRenderer.invoke('get-lama-component-state'),
  checkLamaComponents: () => ipcRenderer.invoke('check-lama-components'),
  installLamaComponent: (backend) => ipcRenderer.invoke('install-lama-component', backend),
  cancelLamaComponentDownload: () => ipcRenderer.invoke('cancel-lama-component-download'),
  repairLamaComponent: (backend) => ipcRenderer.invoke('repair-lama-component', backend),
  removeLamaComponent: (backend) => ipcRenderer.invoke('remove-lama-component', backend),
  saveLamaPreferences: (prefs) => ipcRenderer.invoke('save-lama-preferences', prefs),
  onLamaComponentState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lama-component-state-changed', listener);
    return () => ipcRenderer.removeListener('lama-component-state-changed', listener);
  }
});
