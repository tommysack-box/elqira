import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isSafeExternalUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getWindowChromeOptions() {
  if (process.platform === 'darwin') {
    return {
      frame: false,
    };
  }

  return {
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f7f9fb',
      symbolColor: '#464554',
      height: 56,
    },
  };
}

function createWindow() {
  const win = new BrowserWindow({
    show: true,
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#f7f9fb',
    ...getWindowChromeOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') {
      return { action: 'allow' };
    }

    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173';

  if (!app.isPackaged) {
    win.loadURL(devServerUrl);
    attachWindowStateEvents(win);
    return;
  }

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  attachWindowStateEvents(win);
}

function emitWindowState(window) {
  window.webContents.send('window:maximized-changed', window.isMaximized());
}

function attachWindowStateEvents(window) {
  window.on('maximize', () => emitWindowState(window));
  window.on('unmaximize', () => emitWindowState(window));
  window.on('enter-full-screen', () => emitWindowState(window));
  window.on('leave-full-screen', () => emitWindowState(window));
}

ipcMain.handle('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;

  if (window.isMaximized()) {
    window.unmaximize();
    return false;
  }

  window.maximize();
  return true;
});

ipcMain.handle('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (!isSafeExternalUrl(url)) return false;
  await shell.openExternal(url);
  return true;
});

app.whenReady().then(() => {
  createWindow();

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
