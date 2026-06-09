// bridge.js — compatibility layer between browser-only and Electron modes.
// In browser mode (Chromebooks): use fetch + localStorage.
// In Electron mode: window.mfs exposed by preload.js will be used.
//
// Every screen calls bridge functions only, so adding new backends is a
// matter of swapping this file.

const STORAGE = window.localStorage;
const KEY_HISTORY  = 'mathsfs.v1.history';
const KEY_PROFILE  = 'mathsfs.v1.profile';
const KEY_SESSIONS = 'mathsfs.v1.sessions';   // teacher class-code sessions
const KEY_BANKS    = 'mathsfs.v1.bankCache';

// In Electron the preload exposes window.mfs. Detect once.
const ELECTRON = !!(window.mfs && typeof window.mfs.loadBank === 'function');

async function fetchJson(p) {
  const r = await fetch(p, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load ' + p + ': ' + r.status);
  return r.json();
}

export const bridge = {
  isElectron: ELECTRON,

  async loadBank(level) {
    if (ELECTRON) return window.mfs.loadBank(level);
    const cache = JSON.parse(STORAGE.getItem(KEY_BANKS) || '{}');
    if (cache[level]) return cache[level];
    const data = await fetchJson(`assets/banks/${level}.json`);
    cache[level] = data;
    STORAGE.setItem(KEY_BANKS, JSON.stringify(cache));
    return data;
  },

  async loadSpec(level) {
    if (ELECTRON) return window.mfs.loadSpec(level);
    return fetchJson(`assets/spec/${level}.json`);
  },

  // ---- History (per-attempt log) -------------------------------------
  loadHistory() {
    if (ELECTRON) return window.mfs.loadHistory();
    return JSON.parse(STORAGE.getItem(KEY_HISTORY) || '[]');
  },
  saveAttempt(attempt) {
    if (ELECTRON) return window.mfs.saveAttempt(attempt);
    const h = JSON.parse(STORAGE.getItem(KEY_HISTORY) || '[]');
    // remove any existing entry with this id (idempotent)
    const filtered = h.filter(a => a.id !== attempt.id);
    filtered.unshift(attempt);
    STORAGE.setItem(KEY_HISTORY, JSON.stringify(filtered.slice(0, 500)));
    return Promise.resolve(true);
  },
  clearHistory() {
    if (ELECTRON) return window.mfs.clearHistory();
    STORAGE.removeItem(KEY_HISTORY);
    return Promise.resolve(true);
  },

  // ---- Profile (last-known candidate name etc.) ----------------------
  loadProfile() {
    if (ELECTRON) return window.mfs.loadProfile();
    return JSON.parse(STORAGE.getItem(KEY_PROFILE) || '{}');
  },
  saveProfile(p) {
    if (ELECTRON) return window.mfs.saveProfile(p);
    STORAGE.setItem(KEY_PROFILE, JSON.stringify(p));
    return Promise.resolve(true);
  },

  // ---- Teacher class-code sessions ----------------------------------
  // A "session" is a teacher-issued task package students join via a 6-char
  // code. The session lives in localStorage so that one teacher device can
  // host a session for many students in the same browser (e.g. classroom
  // laptop wired to a projector). Truly multi-device aggregation would
  // need a server — out of scope for v1; the model is designed so it
  // could be plugged in later.
  loadSessions() {
    return JSON.parse(STORAGE.getItem(KEY_SESSIONS) || '[]');
  },
  saveSession(s) {
    const all = this.loadSessions();
    const filtered = all.filter(x => x.code !== s.code);
    filtered.unshift(s);
    STORAGE.setItem(KEY_SESSIONS, JSON.stringify(filtered.slice(0, 50)));
    return s;
  },
  findSession(code) {
    return this.loadSessions().find(s => s.code === code.toUpperCase());
  },
  addSessionResult(code, result) {
    const all = this.loadSessions();
    const idx = all.findIndex(s => s.code === code.toUpperCase());
    if (idx === -1) return null;
    all[idx].results = all[idx].results || [];
    all[idx].results.push(result);
    STORAGE.setItem(KEY_SESSIONS, JSON.stringify(all));
    return all[idx];
  },
  deleteSession(code) {
    const all = this.loadSessions().filter(s => s.code !== code.toUpperCase());
    STORAGE.setItem(KEY_SESSIONS, JSON.stringify(all));
  },

  // Reset everything (home screen has a danger button)
  wipe() {
    if (ELECTRON) return window.mfs.wipe();
    STORAGE.removeItem(KEY_HISTORY);
    STORAGE.removeItem(KEY_PROFILE);
    STORAGE.removeItem(KEY_SESSIONS);
    STORAGE.removeItem(KEY_BANKS);
    return Promise.resolve(true);
  },
};
