const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let mainWindow;
let updaterInitialized = false;

// Required on Windows so taskbar/pinned icon uses the app identity instead of Electron default.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.riskops.icdro');
}

function emitUpdaterStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updater:status', {
    timestamp: Date.now(),
    ...status,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function setupAutoUpdater() {
  if (updaterInitialized) {
    return;
  }

  updaterInitialized = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  emitUpdaterStatus({ type: 'checking', message: 'Checking for updates...' });

  autoUpdater.on('checking-for-update', () => {
    emitUpdaterStatus({ type: 'checking', message: 'Checking for updates...' });
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto update error:', error == null ? 'unknown' : error.message);
    emitUpdaterStatus({
      type: 'error',
      message: `Update check failed: ${error == null ? 'unknown error' : error.message}`,
    });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    emitUpdaterStatus({
      type: 'available',
      version: info.version,
      message: `Update ${info.version} found. Downloading now...`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No update available.');
    emitUpdaterStatus({ type: 'none', message: 'You are on the latest version.' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Number(progressObj?.percent || 0);
    emitUpdaterStatus({
      type: 'downloading',
      percent,
      message: `Downloading update... ${percent.toFixed(1)}%`,
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    emitUpdaterStatus({
      type: 'downloaded',
      version: info.version,
      message: `Update ${info.version} is ready. Restart to install.`,
    });
  });

  autoUpdater.checkForUpdates();
}

async function checkForUpdatesManually() {
  if (isDev) {
    emitUpdaterStatus({ type: 'none', message: 'Manual update check is only available in packaged builds.' });
    return { ok: false, reason: 'dev' };
  }

  if (!updaterInitialized) {
    setupAutoUpdater();
    return { ok: true, reason: 'initialized' };
  }

  emitUpdaterStatus({ type: 'checking', message: 'Checking for updates...' });

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error == null ? 'unknown error' : error.message;
    emitUpdaterStatus({ type: 'error', message: `Manual update check failed: ${message}` });
    return { ok: false, reason: 'error', message };
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('updater:check-now', async () => checkForUpdatesManually());
  ipcMain.handle('updater:restart-now', async () => {
    emitUpdaterStatus({ type: 'installing', message: 'Restarting to install update...' });
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  if (!isDev) {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
