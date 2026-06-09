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
    state.routePayload = payload || null;
    routes[routeName]();
  },
  state,
  bridge,
  setFooter(opts) { setFooterMode(opts); },
};

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

  api.go('home');
});

window.__mfs = { state, api, bridge };
