// games.js — hub of revision games.

import { h } from './components.js';

export function showGamesHub(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));
  wrap.appendChild(h('h1', { style: { color: '#003057', margin: '0 0 16px' } }, 'Revision games'));
  wrap.appendChild(h('p', { class: 'muted', style: { marginBottom: '20px' } },
    'Quick warm-ups. Each game uses the question bank for your selected level (' +
    levelLabel(state.level) + '). Switch level from the home screen.'));

  function tile(emoji, title, desc, route) {
    return h('div', { class: 'game-tile', onClick: () => api.go(route) },
      h('div', { class: 'gt-icon' }, emoji),
      h('h4', {}, title),
      h('p', {}, desc));
  }

  wrap.appendChild(h('div', { class: 'hub-grid' },
    tile('⚡', 'Quickfire', '60-second mental maths drill. Answer as many as you can.', 'quickfire'),
    tile('🃏', 'Flashcards', 'Flip cards to reveal answers. Mark each as known or to revisit.', 'flashcards'),
    tile('🧩', 'Match-up', 'Drag questions onto their answers. Best for fractions, decimals, percentages.', 'dragdrop')));

  screen.appendChild(wrap);
  api.setFooter('hidden');
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
