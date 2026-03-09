const { contextBridge } = require('electron');

// Expose any APIs you need in the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
