import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('elqiraDesktop', {
  isElectron: true,
});
