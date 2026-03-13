const { contextBridge, ipcRenderer } = require('electron');

// Expose any APIs you need in the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),
  onUpdaterStatus: (callback) => {
    const wrapped = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:status', wrapped);
    return () => ipcRenderer.removeListener('updater:status', wrapped);
  },
});
