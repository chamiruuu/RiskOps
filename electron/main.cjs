const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let mainWindow;

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

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart now to finish installing the update.',
    });

    if (result.response === 0) {
      emitUpdaterStatus({ type: 'installing', message: 'Restarting to install update...' });
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
  createWindow();

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
