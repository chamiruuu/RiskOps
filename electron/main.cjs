const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;
let mainWindow;

const appIconPath =
  process.platform === "darwin"
    ? app.isPackaged
      ? path.join(process.resourcesPath, "icon.icns")
      : path.join(__dirname, "assets", "icon.icns")
    : path.join(
        __dirname,
        "assets",
        "icon.iconset",
        "icon-rounded-corners.ico",
      );

// Required on Windows so taskbar/pinned icon uses the app identity instead of Electron default.
if (process.platform === "win32") {
  app.setAppUserModelId("com.riskops.icdro");
}

function emitUpdaterStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("updater:status", {
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
    icon: process.platform === "darwin" ? undefined : appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false, // ✅ SEC-ELECTRON-001: Disable remoteModule
      sandbox: true, // ✅ SEC-ELECTRON-001: Run renderer in sandbox
    },
    titleBarStyle: "default",
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    const indexPath = path.join(__dirname, "../dist/index.html");

    // ✅ SEC-ELECTRON-001: Validate file exists before loading
    if (!fs.existsSync(indexPath)) {
      const errorMsg = `Critical error: Built application not found at ${indexPath}.\nPlease rebuild the application by running: npm run electron:build`;
      console.error(`❌ ${errorMsg}`);

      // Show error dialog
      dialog.showErrorBox("Application Build Error", errorMsg);

      // Exit cleanly
      mainWindow.close();
      app.quit();
      return;
    }

    mainWindow.loadFile(indexPath);
  }
}

function setupAutoUpdater() {
  if (updaterInitialized) {
    return;
  }

  updaterInitialized = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    emitUpdaterStatus({ type: "checking", message: "Checking for updates..." });
  });

  autoUpdater.on("error", (error) => {
    console.error(
      "Auto update error:",
      error == null ? "unknown" : error.message,
    );
    emitUpdaterStatus({
      type: "error",
      message: `Update check failed: ${error == null ? "unknown error" : error.message}`,
    });
  });

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
    emitUpdaterStatus({
      type: "available",
      version: info.version,
      message: `Update ${info.version} found. Downloading now...`,
    });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("No update available.");
    emitUpdaterStatus({
      type: "none",
      message: "You are on the latest version.",
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const percent = Number(progressObj?.percent || 0);
    emitUpdaterStatus({
      type: "downloading",
      percent,
      message: `Downloading update... ${percent.toFixed(1)}%`,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    emitUpdaterStatus({
      type: "downloaded",
      version: info.version,
      message: `Update ${info.version} is ready. Restart to install.`,
    });
  });

  // 1. Initial check when the app first opens
  autoUpdater.checkForUpdates().catch((error) => {
    const message = error == null ? "unknown error" : error.message;
    console.error("Auto update check failed:", message);
    emitUpdaterStatus({
      type: "error",
      message: `Update check failed: ${message}`,
    });
  });

  // 2. NEW: Continuous background check every 1 hour (3600000 milliseconds)
  // This ensures if you push an update while agents are working, they get it automatically.
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((error) => {
        // Fail silently in the background (e.g. if network drops temporarily)
        console.error(
          "Background update check failed silently:",
          error == null ? "unknown" : error.message,
        );
      });
    },
    60 * 60 * 1000,
  );
}

async function checkForUpdatesManually() {
  if (isDev) {
    emitUpdaterStatus({
      type: "none",
      message: "Manual update check is only available in packaged builds.",
    });
    return { ok: false, reason: "dev" };
  }

  if (!updaterInitialized) {
    setupAutoUpdater();
    return { ok: true, reason: "initialized" };
  }

  emitUpdaterStatus({ type: "checking", message: "Checking for updates..." });

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error == null ? "unknown error" : error.message;
    emitUpdaterStatus({
      type: "error",
      message: `Manual update check failed: ${message}`,
    });
    return { ok: false, reason: "error", message };
  }
}

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();

    ipcMain.handle("updater:check-now", async () => checkForUpdatesManually());
    ipcMain.handle("updater:restart-now", async () => {
      emitUpdaterStatus({
        type: "installing",
        message: "Restarting to install update...",
      });
      autoUpdater.quitAndInstall();
      return { ok: true };
    });

    if (!isDev) {
      setupAutoUpdater();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
