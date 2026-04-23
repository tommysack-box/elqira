import { contextBridge, ipcRenderer } from 'electron';

const normalizedPlatform = process.platform;
const windowControlsMode = 'custom';

contextBridge.exposeInMainWorld('elqiraDesktop', {
  isElectron: true,
  platform: normalizedPlatform,
  hasCustomTitleBar: true,
  windowControlsMode,
  notifyAppReady: () => ipcRenderer.send('app:ready'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
  onWindowMaximizedChange: (listener) => {
    const wrappedListener = (_event, isMaximized) => listener(isMaximized);
    ipcRenderer.on('window:maximized-changed', wrappedListener);

    return () => {
      ipcRenderer.removeListener('window:maximized-changed', wrappedListener);
    };
  },
});
