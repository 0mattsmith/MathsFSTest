// Optional Electron shell. Most users will run the app in a browser
// (Chromebooks); this is here so teachers can package a desktop build
// if they want one. The renderer detects Electron at runtime via the
// presence of window.mfs (see bridge.js) and stays compatible either way.

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_NAME = 'Maths FS Practice';

// Set the app name BEFORE app.whenReady so the macOS app menu shows
// "Maths FS Practice" instead of "Electron". This needs to happen as
// early as possible.
app.setName(APP_NAME);

const isMac = process.platform === 'darwin';

function dataDir() { return path.join(app.getPath('userData'), 'mathsfs-data'); }

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readJsonOr(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
function writeJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

// ---- App data IPC ---------------------------------------------------
ipcMain.handle('mfs:loadBank', async (_e, level) => {
  const file = path.join(__dirname, '..', '..', 'assets', 'banks', level + '.json');
  return readJsonOr(file, { board: 'edexcel', level, questions: [] });
});
ipcMain.handle('mfs:loadSpec', async (_e, level) => {
  const file = path.join(__dirname, '..', '..', 'assets', 'spec', level + '.json');
  return readJsonOr(file, {});
});
ipcMain.handle('mfs:loadTemplates', async (_e, level) => {
  const file = path.join(__dirname, '..', '..', 'assets', 'templates', level + '.json');
  return readJsonOr(file, { templates: [] });
});
ipcMain.handle('mfs:loadHistory', async () => {
  ensureDir(dataDir());
  return readJsonOr(path.join(dataDir(), 'history.json'), []);
});
ipcMain.handle('mfs:saveAttempt', async (_e, attempt) => {
  ensureDir(dataDir());
  const f = path.join(dataDir(), 'history.json');
  const h = readJsonOr(f, []).filter(a => a.id !== attempt.id);
  h.unshift(attempt);
  writeJson(f, h.slice(0, 500));
  return true;
});
ipcMain.handle('mfs:clearHistory', async () => {
  ensureDir(dataDir());
  writeJson(path.join(dataDir(), 'history.json'), []);
  return true;
});
ipcMain.handle('mfs:loadProfile', async () => {
  ensureDir(dataDir());
  return readJsonOr(path.join(dataDir(), 'profile.json'), {});
});
ipcMain.handle('mfs:saveProfile', async (_e, p) => {
  ensureDir(dataDir());
  writeJson(path.join(dataDir(), 'profile.json'), p);
  return true;
});
ipcMain.handle('mfs:wipe', async () => {
  if (fs.existsSync(dataDir())) {
    for (const f of fs.readdirSync(dataDir())) fs.unlinkSync(path.join(dataDir(), f));
  }
  return true;
});

// ---- Window control IPC (used by the fake Windows controls in the
// renderer; on macOS the real traffic-light buttons handle these). ---
function focusedWin(e) {
  return BrowserWindow.fromWebContents(e.sender) || BrowserWindow.getFocusedWindow();
}
ipcMain.handle('mfs:win:minimize',       (e) => focusedWin(e)?.minimize());
ipcMain.handle('mfs:win:close',          (e) => focusedWin(e)?.close());
ipcMain.handle('mfs:win:toggleMaximize', (e) => {
  const w = focusedWin(e); if (!w) return false;
  if (w.isMaximized()) w.unmaximize(); else w.maximize();
  return w.isMaximized();
});
ipcMain.handle('mfs:win:isMaximized',    (e) => !!focusedWin(e)?.isMaximized());

function createWindow() {
  // On macOS we use `titleBarStyle: 'hiddenInset'` so the real
  // traffic-light buttons show in the top-left of the window — they
  // handle minimize, zoom (= toggle maximize), close AND macOS's
  // built-in "double-click titlebar to maximize" gesture for free.
  //
  // On Windows we keep the window frameless and the renderer draws its
  // own minimize/maximize/close strip on the right of the title bar.
  // (Real Windows-style chrome can't currently be themed to match the
  // "Test Player Preview" look, hence the in-renderer controls.)
  const winOpts = {
    width: 1280, height: 820,
    minWidth: 1024, minHeight: 700,
    title: APP_NAME,
    backgroundColor: '#fdfaf3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (isMac) {
    winOpts.titleBarStyle = 'hiddenInset';
    winOpts.trafficLightPosition = { x: 14, y: 11 };
  } else {
    winOpts.frame = false;
  }

  const win = new BrowserWindow(winOpts);
  win.loadFile(path.join(__dirname, '..', '..', 'index.html'));

  // Notify the renderer when maximize state changes so the fake max-button
  // glyph can swap between □ (will-maximize) and ❐ (will-restore) on Windows.
  const sendMax = (m) => { try { win.webContents.send('mfs:win:maxState', m); } catch {} };
  win.on('maximize',   () => sendMax(true));
  win.on('unmaximize', () => sendMax(false));
}

function buildMenu() {
  // Build a proper macOS menu (Edit menu enables Cmd-X/C/V/A inside
  // inputs; Window menu enables ⌘W close, etc.). On Windows we leave the
  // default to null since the renderer's own UI handles everything.
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  const tpl = [
    { label: APP_NAME, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' }, { role: 'close' },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => { buildMenu(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
