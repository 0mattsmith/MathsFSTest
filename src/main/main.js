// Optional Electron shell. Most users will run the app in a browser
// (Chromebooks); this is here so teachers can package a desktop build
// if they want one. The renderer detects Electron at runtime via the
// presence of window.mfs (see bridge.js) and stays compatible either way.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

function dataDir() { return path.join(app.getPath('userData'), 'mathsfs-data'); }

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readJsonOr(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
function writeJson(p, v) { fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

ipcMain.handle('mfs:loadBank', async (_e, level) => {
  const file = path.join(__dirname, '..', '..', 'assets', 'banks', level + '.json');
  return readJsonOr(file, { board: 'edexcel', level, questions: [] });
});
ipcMain.handle('mfs:loadSpec', async (_e, level) => {
  const file = path.join(__dirname, '..', '..', 'assets', 'spec', level + '.json');
  return readJsonOr(file, {});
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820,
    minWidth: 1024, minHeight: 700,
    frame: false,
    backgroundColor: '#fdfaf3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', '..', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
