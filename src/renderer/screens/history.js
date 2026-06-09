// history.js — list of past attempts with score, level, seed.

import { h } from './components.js';

export function showHistory(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  const history = api.bridge.loadHistory();

  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));
  wrap.appendChild(h('h1', { style: { color: '#003057' } }, 'Exam history'));
  wrap.appendChild(h('p', { class: 'muted', style: { marginBottom: '14px' } },
    history.length
      ? `${history.length} attempt${history.length === 1 ? '' : 's'} on this device.`
      : 'You haven\'t finished any papers yet.'));

  if (!history.length) {
    wrap.appendChild(h('button', { class: 'orange-btn', onClick: () => api.go('home') }, 'Take a paper'));
    screen.appendChild(wrap);
    api.setFooter('hidden');
    return;
  }

  for (const a of history) {
    const passed = a.marked.grade === 'PASS';
    const row = h('div', { class: 'history-row' },
      h('div', {},
        h('div', { style: { fontWeight: 600 } }, levelLabel(a.level) + ' · Seed ' + a.seed),
        h('div', { class: 'meta' },
          new Date(a.finishedAt).toLocaleString() + ' · ' + (a.candidate || 'Anonymous'))),
      h('div', { class: 'flex' },
        h('span', { class: 'pill ' + (passed ? 'ok' : 'bad') }, a.marked.score + '/' + a.marked.total),
        h('span', { class: 'pill section' }, a.marked.percent + '%'),
        h('span', { class: 'pill' }, a.marked.grade)),
      h('div', { class: 'history-actions' },
        h('button', { class: 'btn-mini', onClick: () => view(a) }, 'View'),
        h('button', { class: 'btn-mini', onClick: () => retake(a) }, 'Retake')));
    wrap.appendChild(row);
  }

  wrap.appendChild(h('div', { style: { marginTop: '16px' } },
    h('button', { class: 'btn-mini danger', onClick: () => {
      if (confirm('Delete all exam history?')) {
        api.bridge.clearHistory().then(() => api.go('history'));
      }
    } }, 'Clear all history')));

  screen.appendChild(wrap);
  api.setFooter('hidden');

  function view(a) {
    state.attempt = a;
    api.go('results');
  }
  function retake(a) {
    state.test = {
      id: 'att_' + Date.now(),
      seed: a.seed,
      level: a.level,
      board: a.board,
      candidate: a.candidate,
      startedAt: new Date().toISOString(),
      mode: 'mock',
    };
    state.responses = {};
    api.go('paper');
  }
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
