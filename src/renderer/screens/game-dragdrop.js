// game-dragdrop.js — match equivalent fractions / decimals / percentages.
// Cards on the left are dragged onto slots on the right. Hard-coded
// matched groups per level so the game is solvable.

import { h, shuffle, makeRng, randomSeed } from './components.js';

const SETS = {
  e3: [
    { q: '½',   a: '0.5' },
    { q: '¼',   a: '0.25' },
    { q: '¾',   a: '0.75' },
    { q: '10',  a: 'Ten' },
    { q: '100', a: 'One hundred' },
    { q: '1 kg', a: '1000 g' },
  ],
  l1: [
    { q: '½',   a: '50%' },
    { q: '¼',   a: '25%' },
    { q: '¾',   a: '75%' },
    { q: '0.1', a: '10%' },
    { q: '⅕',   a: '20%' },
    { q: '1 m', a: '100 cm' },
    { q: '1 km', a: '1000 m' },
    { q: '60 min', a: '1 hour' },
  ],
  l2: [
    { q: '⅛',     a: '12.5%' },
    { q: '⅜',     a: '37.5%' },
    { q: '⅔',     a: '66.7% (1dp)' },
    { q: '5²',    a: '25' },
    { q: '2³',    a: '8' },
    { q: 'π × 2', a: '6.28 (2dp)' },
    { q: '1 inch', a: '2.54 cm' },
    { q: '1 mile', a: '1.6 km (approx)' },
  ],
};

export function showDragDrop(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  const set = SETS[state.level] || SETS.l1;
  const rng = makeRng(randomSeed());
  const lefts = shuffle(rng, set.map((p, i) => ({ ...p, _i: i })));
  const rights = shuffle(rng, set.map((p, i) => ({ ...p, _i: i })));

  // State: which slot holds which card. Card is identified by _i (matches answer).
  const placement = {};   // slotIndex → card._i

  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('games') }, '◂ Games'));
  wrap.appendChild(h('h1', { style: { color: '#003057', margin: '0 0 12px' } },
    'Match-up — ' + levelLabel(state.level)));
  wrap.appendChild(h('p', { class: 'muted', style: { marginBottom: '14px' } },
    'Drag each card on the left onto its matching value on the right.'));

  const leftCol = h('div', { class: 'dd-col' }, h('h4', {}, 'Cards'));
  const rightCol = h('div', { class: 'dd-col' }, h('h4', {}, 'Match here'));

  const cardEls = {};
  for (const card of lefts) {
    const c = h('div', { class: 'dd-card', draggable: 'true', dataset: { i: String(card._i) } }, card.q);
    c.addEventListener('dragstart', (e) => {
      c.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', String(card._i));
    });
    c.addEventListener('dragend', () => c.classList.remove('is-dragging'));
    cardEls[card._i] = c;
    leftCol.appendChild(c);
  }

  const slotEls = {};
  rights.forEach((right, slotIdx) => {
    const slot = h('div', { class: 'dd-slot' });
    slot.appendChild(h('div', { style: { padding: '4px 8px', fontWeight: '600', color: '#003057' } }, right.a));
    const drop = h('div', { class: 'dd-slot', style: { minHeight: '44px', flex: 1 } });
    const row = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } }, slot.firstChild, drop);
    const wrapper = h('div', { class: 'dd-slot has-card', style: { padding: 0, border: 0, background: 'transparent' } }, row);
    wrapper._right = right;
    wrapper._drop = drop;
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
      const i = parseInt(e.dataTransfer.getData('text/plain'), 10);
      placeCard(slotIdx, i);
    });
    slotEls[slotIdx] = wrapper;
    rightCol.appendChild(wrapper);
  });

  function placeCard(slotIdx, cardI) {
    // Remove cardI from anywhere it currently is
    for (const k of Object.keys(placement)) {
      if (placement[k] === cardI) {
        delete placement[k];
        const w = slotEls[k];
        if (w && w._drop) w._drop.innerHTML = '';
      }
    }
    placement[slotIdx] = cardI;
    const slot = slotEls[slotIdx];
    slot._drop.innerHTML = '';
    slot._drop.appendChild(cardEls[cardI]);
  }

  const checkBtn = h('button', { class: 'orange-btn', onClick: () => {
    let right = 0;
    for (const [slotIdx, cardI] of Object.entries(placement)) {
      const slot = slotEls[slotIdx];
      const isRight = slot._right._i === cardI;
      slot._drop.classList.toggle('right', isRight);
      slot._drop.classList.toggle('wrong', !isRight);
      if (isRight) right++;
    }
    const total = set.length;
    msg.textContent = `Matched ${right}/${total} correctly.`;
    msg.className = right === total ? 'qf-feedback right' : 'qf-feedback wrong';
  } }, 'Check');
  const resetBtn = h('button', { class: 'btn-mini', onClick: () => api.go('dragdrop') }, 'Shuffle again');
  const msg = h('div', { class: 'qf-feedback', style: { textAlign: 'center' } });

  wrap.appendChild(h('div', { class: 'dd-game' }, leftCol, rightCol));
  wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' } },
    checkBtn, resetBtn));
  wrap.appendChild(msg);

  screen.appendChild(wrap);
  api.setFooter('hidden');
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
