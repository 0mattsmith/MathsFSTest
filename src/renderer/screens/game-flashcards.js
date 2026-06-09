// game-flashcards.js — flip flashcards to reveal answers, then mark
// each card as "Got it" or "Revisit". Revisit pile gets re-asked.

import { h, shuffle, makeRng, randomSeed, renderStem } from './components.js';

export async function showFlashcards(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  let bank;
  try { bank = await api.bridge.loadBank(state.level); }
  catch (e) { screen.appendChild(h('p', {}, 'Could not load bank: ' + e.message)); return; }

  // Use a mix of all questions, light prefer non-calc + simpler ones.
  const rng = makeRng(randomSeed());
  let deck = shuffle(rng, bank.questions).slice(0, 25);
  let revisit = [];
  let idx = 0;
  let flipped = false;
  let knownCount = 0;
  let revisitCount = 0;

  const card = h('div', { class: 'fc-card' });
  const stats = h('div', { class: 'muted', style: { textAlign: 'center', marginTop: '6px' } });

  function pluck() {
    if (idx < deck.length) return deck[idx];
    // Move to revisit pile
    if (revisit.length) {
      deck = revisit;
      revisit = [];
      idx = 0;
      return deck[idx];
    }
    return null;
  }

  function renderFace() {
    card.className = 'fc-card' + (flipped ? ' is-back' : '');
    card.innerHTML = '';
    const q = pluck();
    if (!q) {
      card.innerHTML = '<div>All done — well played!</div>';
      return;
    }
    card._q = q;
    if (flipped) {
      const ans = h('div', {});
      ans.appendChild(h('div', { style: { fontSize: '14px', color: '#fff5e8', marginBottom: '6px' } }, 'Answer'));
      ans.appendChild(h('div', { style: { fontSize: '32px' } }, ...renderStem(String(q.answer))));
      if (q.workings) ans.appendChild(h('div', { style: { fontSize: '13px', marginTop: '14px', maxWidth: '380px', color: 'rgba(255,255,255,0.85)' } }, q.workings));
      card.appendChild(ans);
      card.appendChild(h('div', { class: 'fc-hint' }, 'Click card to flip back'));
    } else {
      card.appendChild(h('div', {}, ...renderStem(q.stem)));
      card.appendChild(h('div', { class: 'fc-hint' }, 'Click card to reveal answer'));
    }
    stats.textContent = `Known: ${knownCount} · Revisit: ${revisitCount} · Card ${idx + 1} of ${deck.length}`;
  }

  card.addEventListener('click', () => { flipped = !flipped; renderFace(); });

  const controls = h('div', { class: 'fc-controls' },
    h('button', { class: 'btn-mini', onClick: () => {
      revisit.push(card._q);
      revisitCount++;
      idx++;
      flipped = false;
      renderFace();
    } }, '↻ Revisit'),
    h('button', { class: 'orange-btn', onClick: () => {
      knownCount++;
      idx++;
      flipped = false;
      renderFace();
    } }, '✓ Got it'));

  const wrap = h('div', { class: 'paper-wrap' },
    h('div', { class: 'crumb', onClick: () => api.go('games') }, '◂ Games'),
    h('h1', { style: { color: '#003057', margin: '0 0 12px' } }, 'Flashcards — ' + levelLabel(state.level)),
    card, controls, stats);
  screen.appendChild(wrap);
  renderFace();
  api.setFooter('hidden');
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
