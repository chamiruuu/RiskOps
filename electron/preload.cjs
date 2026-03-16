const { contextBridge, ipcRenderer } = require('electron');

// ✅ DESKTOP-ELECTRON-001: Rate limiting for security
const updateCheckLimiter = {
  lastCheck: 0,
  minIntervalMs: 60000, // Only allow one check per minute
};

const isUpdateCheckAllowed = () => {
  const now = Date.now();
  if (now - updateCheckLimiter.lastCheck < updateCheckLimiter.minIntervalMs) {
    return false;
  }
  updateCheckLimiter.lastCheck = now;
  return true;
};

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  // ✅ Add rate limiting to prevent abuse
  checkForUpdates: async () => {
    if (!isUpdateCheckAllowed()) {
      console.warn('Update check rate limited');
      return { ok: false, reason: 'rate_limited' };
    }
    return ipcRenderer.invoke('updater:check-now');
  },

  restartToInstallUpdate: () => {
    // Only allow if an update was actually downloaded
    return ipcRenderer.invoke('updater:restart-now');
  },

  onUpdaterStatus: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('Invalid callback for onUpdaterStatus');
      return () => {};
    }
    
    const wrapped = (_event, payload) => {
      // Validate payload structure
      if (payload && typeof payload === 'object') {
        callback(payload);
      }
    };

    ipcRenderer.on('updater:status', wrapped);
    
    // Return a cleanup function
    return () => ipcRenderer.removeListener('updater:status', wrapped);
  },
});
