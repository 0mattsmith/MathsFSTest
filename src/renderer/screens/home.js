// Home screen — candidate enters name, picks level, picks a mode
// (full mock, just MCQs, topic revision), then jumps to the right screen.

import { h, randomSeed, newAttemptId } from './components.js';

export function showHome(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  let level = state.level || 'l1';
  let seed = randomSeed();

  const nameInput = h('input', {
    type: 'text', placeholder: 'Your name', value: state.candidate || '',
    onInput: (e) => { state.candidate = e.target.value; },
  });
  const seedField = h('input', {
    type: 'text', value: seed, style: { fontFamily: 'Menlo,monospace' },
  });
  const newSeedBtn = h('button', { class: 'btn-mini',
    onClick: () => { seedField.value = randomSeed(); } }, 'New seed');

  function makeLevelCard(lv, badge, title, desc, marks, time) {
    const card = h('div', { class: 'card' + (level === lv ? ' is-selected' : ''),
      onClick: () => selectLevel(lv) },
      h('span', { class: `level-badge ${lv}` }, badge),
      h('h3', {}, title),
      h('p', {}, desc),
      h('div', { class: 'muted' }, `${marks} marks · ${time}`));
    card.dataset.lv = lv;
    return card;
  }
  const e3Card = makeLevelCard('e3', 'Entry Level 3', 'Entry Level 3',
    'Whole numbers to 1000, simple fractions and decimals, time, money, simple data.',
    '30', '75 min');
  const l1Card = makeLevelCard('l1', 'Level 1', 'Level 1',
    'BIDMAS, percentages, perimeter/area, mean/median/mode, simple probability.',
    '65', '105 min');
  const l2Card = makeLevelCard('l2', 'Level 2', 'Level 2',
    'Reverse %, ratio/proportion, compound shapes, scatter graphs, frequency tables.',
    '65', '105 min');

  function selectLevel(lv) {
    level = lv;
    state.level = lv;
    [e3Card, l1Card, l2Card].forEach(c => c.classList.toggle('is-selected', c.dataset.lv === lv));
  }

  // Hub tiles
  function tile(icon, name, desc, route) {
    return h('div', { class: 'hub-tile', onClick: () => doRoute(route) },
      h('div', { class: 'ht-icon' }, icon),
      h('h4', {}, name),
      h('p', {}, desc));
  }

  function doRoute(r) {
    saveProfile();
    if (r === 'paper') {
      // Build a brand-new test (full mock) and head into the paper runner.
      state.test = {
        id: newAttemptId(),
        seed: (seedField.value || '').trim() || randomSeed(),
        level,
        board: state.board,
        candidate: (state.candidate || '').trim() || 'Anonymous',
        startedAt: new Date().toISOString(),
        mode: 'mock',
      };
    }
    if (r === 'print') {
      state.test = {
        id: newAttemptId(),
        seed: (seedField.value || '').trim() || randomSeed(),
        level, board: state.board, mode: 'print',
        candidate: (state.candidate || '').trim() || '',
        startedAt: new Date().toISOString(),
      };
    }
    api.go(r);
  }

  function saveProfile() {
    api.bridge.saveProfile({ candidate: state.candidate, level });
  }

  const home = h('div', { class: 'home' },
    h('h1', {}, 'Maths FS Revision'),
    h('div', { class: 'sub' },
      'Practice Pearson Edexcel Functional Skills Mathematics. Sit a seeded mock paper, ' +
      'use the revision games, or work through one topic at a time. Designed for ' +
      'Chromebooks — runs in any modern browser, no install required.'),

    h('div', { class: 'field' },
      h('label', {}, 'Your name'),
      nameInput),

    h('h3', { class: 'section-h' }, '1. Choose level'),
    h('div', { class: 'card-row-3' }, e3Card, l1Card, l2Card),

    h('h3', { class: 'section-h' }, '2. Choose what to do'),
    h('div', { class: 'hub-grid' },
      tile('▶', 'Mock test', 'Full Edexcel-style paper, Section A + Section B, timed.', 'paper'),
      tile('🖨', 'Print a paper', 'Generate a paper and print it in Edexcel layout.', 'print'),
      tile('🎯', 'Revision games', 'Quickfire timed quiz, flashcards, drag-drop matching.', 'games'),
      tile('📚', 'Topic revision', 'Focused practice on one strand: number, measure, data.', 'topics'),
      tile('📈', 'My progress', 'Score history, topic strengths, time spent.', 'progress'),
      tile('🧑‍🏫', 'Teacher session', 'Create a class code so every student sits the same paper.', 'teacher')),

    h('h3', { class: 'section-h' }, '3. (Optional) Seed for mock papers'),
    h('div', { class: 'field' },
      h('label', {}, 'Type a seed for a reproducible paper, or leave blank for random.'),
      h('div', { style: { display: 'flex', gap: '8px' } }, seedField, newSeedBtn)),

    h('div', { class: 'actions' },
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn-mini', onClick: () => api.go('history') }, 'View history'),
      h('button', { class: 'btn-mini danger', onClick: confirmWipe }, 'Reset progress')),

    h('div', { class: 'muted', style: { marginTop: '18px', textAlign: 'center' } },
      'Pearson Edexcel paper layouts replicated for revision use. ' +
      'Not affiliated with Pearson. ' +
      (api.bridge.isElectron ? 'Desktop build.' : 'Browser build.'))
  );

  function confirmWipe() {
    if (!confirm('Reset ALL local progress (history, profile, sessions)?')) return;
    api.bridge.wipe().then(() => api.go('home'));
  }

  screen.appendChild(home);
  api.setFooter('hidden');
}
