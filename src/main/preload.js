// preload.js — exposes a typed bridge to the renderer so that Electron
// IPC is reachable from browser code without enabling nodeIntegration.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mfs', {
  // Data
  loadBank:     (level) => ipcRenderer.invoke('mfs:loadBank', level),
  loadSpec:     (level) => ipcRenderer.invoke('mfs:loadSpec', level),
  loadHistory:  () => ipcRenderer.invoke('mfs:loadHistory'),
  saveAttempt:  (a) => ipcRenderer.invoke('mfs:saveAttempt', a),
  clearHistory: () => ipcRenderer.invoke('mfs:clearHistory'),
  loadProfile:  () => ipcRenderer.invoke('mfs:loadProfile'),
  saveProfile:  (p) => ipcRenderer.invoke('mfs:saveProfile', p),
  wipe:         () => ipcRenderer.invoke('mfs:wipe'),

  // Platform — used by the renderer to show the right title-bar controls.
  platform: process.platform,

  // Window control bridge — used by the Windows-style controls in the
  // renderer. On macOS the real traffic-light buttons handle these, so
  // the renderer hides the fake controls and never calls these methods.
  window: {
    minimize:       () => ipcRenderer.invoke('mfs:win:minimize'),
    close:          () => ipcRenderer.invoke('mfs:win:close'),
    toggleMaximize: () => ipcRenderer.invoke('mfs:win:toggleMaximize'),
    isMaximized:    () => ipcRenderer.invoke('mfs:win:isMaximized'),
    onMaximizedChanged: (cb) => {
      ipcRenderer.on('mfs:win:maxState', (_e, m) => cb(m));
    },
  },
});
