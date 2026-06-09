// preload.js — exposes a typed bridge to the renderer so that Electron
// IPC is reachable from browser code without enabling nodeIntegration.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mfs', {
  loadBank:     (level) => ipcRenderer.invoke('mfs:loadBank', level),
  loadSpec:     (level) => ipcRenderer.invoke('mfs:loadSpec', level),
  loadHistory:  () => ipcRenderer.invoke('mfs:loadHistory'),
  saveAttempt:  (a) => ipcRenderer.invoke('mfs:saveAttempt', a),
  clearHistory: () => ipcRenderer.invoke('mfs:clearHistory'),
  loadProfile:  () => ipcRenderer.invoke('mfs:loadProfile'),
  saveProfile:  (p) => ipcRenderer.invoke('mfs:saveProfile', p),
  wipe:         () => ipcRenderer.invoke('mfs:wipe'),
});
