import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('sloppy', {
  platform: process.platform,
  isElectron: true,
});
