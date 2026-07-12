const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  translatePage: (args) => ipcRenderer.invoke('translate-page', args),
  savePageTranslation: (args) => ipcRenderer.invoke('save-page-translation', args),
  loadPageTranslation: (args) => ipcRenderer.invoke('load-page-translation', args),
  saveMemory: (args) => ipcRenderer.invoke('save-memory', args),
  loadMemory: (args) => ipcRenderer.invoke('load-memory', args)
});
