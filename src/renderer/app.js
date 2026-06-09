// app.js — top-level router. Mirrors the structure of DigitalFSTest's app.js
// but with routes for the maths revision app.

import { bridge } from './bridge.js';
import { showHome } from './screens/home.js';
import { showPaper } from './screens/paper.js';
import { showResults } from './screens/results.js';
import { showHistory } from './screens/history.js';
import { showProgress } from './screens/progress.js';
import { showGamesHub } from './screens/games.js';
import { showQuickfire } from './screens/game-quickfire.js';
import { showFlashcards } from './screens/game-flashcards.js';
import { showDragDrop } from './screens/game-dragdrop.js';
import { showTopics } from './screens/topics.js';
import { showTeacher } from './screens/teacher.js';
import { showPrint } from './screens/print.js';

// Session state shared across screens
const state = {
  level: 'l1',
  board: 'edexcel',
  candidate: '',
  test: null,         // { id, seed, level, mode, paper }
  attempt: null,
  bank: null,
  spec: null,
};

const screenEl = document.getElementById('screen');
const footerbar = document.getElementById('footerbar');

const routes = {
  home: () => showHome(api, state),
  paper: () => showPaper(api, state),
  results: () => showResults(api, state),
  history: () => showHistory(api, state),
  progress: () => showProgress(api, state),
  games: () => showGamesHub(api, state),
  quickfire: () => showQuickfire(api, state),
  flashcards: () => showFlashcards(api, state),
  dragdrop: () => showDragDrop(api, state),
  topics: () => showTopics(api, state),
  teacher: () => showTeacher(api, state),
  print: () => showPrint(api, state),
};

const api = {
  go(routeName, payload) {
    screenEl.innerHTML = '';
    setFooterMode('hidden');
    // Always hide the calculator pane on a route change. Otherwise, if a
    // student submits a paper while the calc was open, it would stay on
    // top of the results screen with no way to dismiss it (the footer's
    // Calc button is only wired on Section B of the paper runner).
    hideCalculator();
    state.routePayload = payload || null;
    routes[routeName]();
  },
  state,
  bridge,
  setFooter(opts) { setFooterMode(opts); },
};

function hideCalculator() {
  const pane = document.getElementById('calc-pane');
  if (pane) pane.classList.add('hide');
}

function setFooterMode(opts) {
  if (opts === 'hidden') { footerbar.classList.add('hide'); return; }
  footerbar.classList.remove('hide');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const marksBtn = document.getElementById('btn-marks');
  const saveBtn = document.getElementById('btn-save');
  const calcBtn = document.getElementById('fb-calc');
  const flagBtn = document.getElementById('fb-flag');
  const counter = document.getElementById('page-counter');
  const timerEl = document.getElementById('timer');

  prevBtn.onclick = opts.onPrev || null;
  nextBtn.onclick = opts.onNext || null;
  marksBtn.onclick = opts.onMarks || null;
  saveBtn.onclick = opts.onSave || null;
  calcBtn.onclick = opts.onCalc || null;
  flagBtn.onclick = opts.onFlag || null;

  prevBtn.disabled = !!opts.disablePrev;
  nextBtn.disabled = !!opts.disableNext;
  marksBtn.disabled = !!opts.disableMarks;
  calcBtn.disabled = !!opts.disableCalc;

  if (opts.highlightNext) nextBtn.classList.add('is-active'); else nextBtn.classList.remove('is-active');
  if (opts.nextLabel) nextBtn.innerHTML = opts.nextLabel; else nextBtn.innerHTML = 'Next &#9654;';

  counter.textContent = opts.counter || '';
  if (opts.timerText !== undefined) {
    document.getElementById('timer-text').textContent = opts.timerText;
    timerEl.style.visibility = opts.showTimer === false ? 'hidden' : 'visible';
    timerEl.className = 'timer ' + (opts.timerCls || '');
  } else {
    timerEl.style.visibility = 'hidden';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Restore last candidate for convenience
  try {
    const p = bridge.loadProfile();
    if (p && p.candidate) state.candidate = p.candidate;
    if (p && p.level) state.level = p.level;
  } catch {}

  // Set board label
  const tbBoard = document.getElementById('tb-board-label');
  if (tbBoard) tbBoard.textContent = state.board === 'edexcel' ? 'Edexcel' : state.board;

  // Platform detection — drives which window controls to show.
  applyPlatformChrome();

  // Wire the calculator pane's close button. The pane is a global
  // element (not part of any one screen) so the listener is set up
  // once at boot.
  const calcClose = document.getElementById('calc-close');
  if (calcClose) calcClose.addEventListener('click', hideCalculator);

  // Register the PWA service worker so the app is installable + works
  // offline on Chromebooks. Only when we're served over http(s); in
  // Electron (file://) we skip this.
  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* non-fatal */ });
  }

  api.go('home');
});

// Platform-aware title-bar chrome.
//
// In Electron the preload exposes `window.mfs.platform`. On macOS we add
// `body.is-mac` so the real OS traffic lights are visible (drawn by
// `titleBarStyle: 'hiddenInset'`) and our fake Windows-style strip is
// hidden. On Windows we add `body.is-windows`, leave the fake strip
// visible and wire each button to its IPC handler. In a browser we add
// `body.is-browser` so neither set of fake controls shows.
//
// We also wire double-click on the title bar to toggle maximise — on
// macOS the OS gives us this for free, so we only need to do it
// explicitly on Windows.
function applyPlatformChrome() {
  const isElectron = !!(window.mfs && window.mfs.platform);
  const platform = isElectron ? window.mfs.platform : 'browser';
  document.body.classList.remove('is-mac', 'is-windows', 'is-browser');
  if (platform === 'darwin')      document.body.classList.add('is-mac');
  else if (platform === 'win32')  document.body.classList.add('is-windows');
  else                            document.body.classList.add('is-browser');

  // On Windows wire the fake min/max/close strip to the Electron IPC.
  if (platform === 'win32' && window.mfs && window.mfs.window) {
    const w = window.mfs.window;
    const min = document.querySelector('.tb-min');
    const max = document.querySelector('.tb-max');
    const cls = document.querySelector('.tb-close');
    if (min) min.addEventListener('click', () => w.minimize());
    if (max) max.addEventListener('click', () => w.toggleMaximize());
    if (cls) cls.addEventListener('click', () => w.close());

    // Swap the max glyph between □ (will-maximize) and ❐ (will-restore).
    function setMaxGlyph(isMax) {
      if (!max) return;
      max.innerHTML = isMax ? '&#10064;' : '&#9633;';
      max.title = isMax ? 'Restore' : 'Maximise';
    }
    w.isMaximized().then(setMaxGlyph).catch(() => {});
    w.onMaximizedChanged(setMaxGlyph);

    // Double-click anywhere on the title bar (except on the buttons)
    // toggles maximise — matches Windows convention.
    const bar = document.querySelector('.player-titlebar');
    if (bar) bar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tb-ctl')) return;
      w.toggleMaximize();
    });
  }
  // (No extra wiring needed for macOS — the OS traffic lights handle
  // minimise, zoom and close, and macOS already provides the
  // "double-click the title bar to maximise" gesture.)
}

window.__mfs = { state, api, bridge };
