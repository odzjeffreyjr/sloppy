import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

const IS_DEV = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Sloppy',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fdf6ec',
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (IS_DEV) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const webBuildPath = path.join(process.resourcesPath, 'web', 'index.html');
    win.loadFile(webBuildPath);
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  if (!IS_DEV) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Auto-update not configured yet — silently ignore
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
