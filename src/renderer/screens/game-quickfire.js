// game-quickfire.js — 60-second mental-maths drill.

import { h, shuffle, makeRng, randomSeed, renderStem, makeCountdown } from './components.js';
import { markQuestion } from '../engine/marker.js';

export async function showQuickfire(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  let bank;
  try { bank = await api.bridge.loadBank(state.level); }
  catch (e) { screen.appendChild(h('p', {}, 'Could not load bank: ' + e.message)); return; }

  // Use only short, non-calculator questions for quickfire.
  const pool = bank.questions.filter(q => !q.calc && q.marks <= 2);
  if (!pool.length) { screen.appendChild(h('p', {}, 'No questions for this level.')); return; }

  const rng = makeRng(randomSeed());
  const order = shuffle(rng, pool);
  let idx = 0, score = 0, streak = 0, bestStreak = 0;

  const stem = h('div', { class: 'qf-stem' });
  const input = h('input', { class: 'qf-input', type: 'text', autocomplete: 'off',
    onKeydown: (e) => { if (e.key === 'Enter') submit(); } });
  const fb = h('div', { class: 'qf-feedback' });
  const meta = h('div', { class: 'qf-meta' },
    h('div', {}, 'Score: ', h('strong', { id: 'qf-score' }, '0'),
                 '  ·  Streak: ', h('span', { class: 'qf-streak', id: 'qf-streak' }, '0')),
    h('div', {}, 'Time: ', h('strong', { id: 'qf-time' }, '60')));
  const board = h('div', { class: 'qf-board' }, meta, stem, input, fb,
    h('div', { style: { marginTop: '18px', fontSize: '12px', color: '#888' } },
      'Press Enter to submit. Wrong answers don\'t stop the timer.'));

  const wrap = h('div', { class: 'paper-wrap' },
    h('div', { class: 'crumb', onClick: () => api.go('games') }, '◂ Games'),
    h('h1', { style: { color: '#003057', margin: '0 0 8px' } }, 'Quickfire — ', levelLabel(state.level)),
    board);
  screen.appendChild(wrap);

  function next() {
    if (idx >= order.length) idx = 0;
    const q = order[idx++];
    stem.innerHTML = '';
    for (const node of renderStem(q.stem)) {
      if (typeof node === 'string') stem.appendChild(document.createTextNode(node));
      else stem.appendChild(node);
    }
    input.value = '';
    input.focus();
    board._q = q;
  }
  function submit() {
    const q = board._q;
    if (!q) return;
    const r = markQuestion(q, input.value);
    if (r.right) {
      score += q.marks;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      fb.textContent = '✓ Correct!';
      fb.className = 'qf-feedback right';
    } else {
      streak = 0;
      fb.textContent = '✗ Answer was ' + q.answer;
      fb.className = 'qf-feedback wrong';
    }
    document.getElementById('qf-score').textContent = String(score);
    document.getElementById('qf-streak').textContent = String(streak);
    setTimeout(() => { fb.textContent = ''; fb.className = 'qf-feedback'; next(); }, 700);
  }

  next();
  const timer = makeCountdown(60, (txt, rem) => {
    document.getElementById('qf-time').textContent = String(rem);
  }, () => {
    stem.textContent = '⏰ Time!';
    input.disabled = true;
    fb.textContent = `Final: ${score} points · Best streak: ${bestStreak}`;
    fb.className = 'qf-feedback';
    const playAgain = h('button', { class: 'orange-btn', onClick: () => api.go('quickfire') }, 'Play again');
    const back = h('button', { class: 'btn-mini', onClick: () => api.go('games') }, 'Back to games');
    board.appendChild(h('div', { style: { marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'center' } }, playAgain, back));
  });
  api.setFooter('hidden');
  // Cleanup on navigation
  screen._dispose = () => timer.stop();
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
