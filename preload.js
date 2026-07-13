const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  translatePage: (args) => ipcRenderer.invoke('translate-page', args),
  saveTypesetImage: (args) => ipcRenderer.invoke('save-typeset-image', args),
  savePageTranslation: (args) => ipcRenderer.invoke('save-page-translation', args),
  loadPageTranslation: (args) => ipcRenderer.invoke('load-page-translation', args),
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
  renameChapter: (args) => ipcRenderer.invoke('rename-chapter', args)
});
