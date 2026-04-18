import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('elqiraDesktop', {
  isElectron: true,
  platform: process.platform,
  hasCustomTitleBar: process.platform === 'win32',
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizedChange: (listener) => {
    const wrappedListener = (_event, isMaximized) => listener(isMaximized);
    ipcRenderer.on('window:maximized-changed', wrappedListener);

    return () => {
      ipcRenderer.removeListener('window:maximized-changed', wrappedListener);
    };
  },
});
