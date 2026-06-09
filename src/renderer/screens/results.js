// results.js — score breakdown for the just-finished attempt.

import { h, renderStem } from './components.js';

export function showResults(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  const att = state.attempt;
  if (!att) {
    screen.appendChild(h('div', { class: 'paper-wrap' },
      h('div', { class: 'q-card' },
        h('h2', {}, 'No attempt to show'),
        h('button', { class: 'orange-btn', onClick: () => api.go('home') }, 'Home'))));
    return;
  }
  const m = att.marked;
  const passed = m.grade === 'PASS';

  const wrap = h('div', { class: 'results' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));

  // Score card
  const scoreCard = h('div', { class: 'score-card' },
    h('h2', { style: { margin: '0 0 8px', color: '#003057' } },
      'Result — ', att.paper.levelLabel),
    h('div', { class: 'score' }, m.score, ' / ', m.total,
      h('span', { class: 'grade ' + (passed ? 'pass' : 'fail') }, m.grade),
      h('span', { class: 'muted', style: { marginLeft: '12px', fontSize: '14px' } },
        ' · ', m.percent, '%')),
    h('div', { class: 'muted', style: { marginTop: '6px' } },
      'Pass mark: ', att.paper.sectionStats[0].marks + att.paper.sectionStats.slice(1).reduce((a, s) => a + s.marks, 0),
      ' total · Seed ', att.seed,
      ' · ', new Date(att.finishedAt).toLocaleString()));
  wrap.appendChild(scoreCard);

  // Section breakdown
  const sec = h('div', { class: 'score-card' },
    h('h3', {}, 'By section'));
  for (const s of att.paper.sectionStats) {
    const pct = s.marks ? Math.round(100 * s.score / s.marks) : 0;
    sec.appendChild(h('div', { class: 'topic-bar' },
      h('div', {}, 'Section ' + s.id),
      h('div', { class: 'bar-bg' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } })),
      h('div', { class: 'bar-pct' }, s.score + '/' + s.marks)));
  }
  wrap.appendChild(sec);

  // Topic / strand breakdown
  const topic = h('div', { class: 'score-card' },
    h('h3', {}, 'By strand'));
  for (const [strand, t] of Object.entries(m.topicTotals)) {
    const pct = t.total ? Math.round(100 * t.right / t.total) : 0;
    topic.appendChild(h('div', { class: 'topic-bar' },
      h('div', {}, strandLabel(strand)),
      h('div', { class: 'bar-bg' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } })),
      h('div', { class: 'bar-pct' }, t.right + '/' + t.total)));
  }
  wrap.appendChild(topic);

  // Question-by-question review
  const review = h('div', { class: 'score-card' },
    h('h3', {}, 'Question review'));
  const tbl = h('table');
  tbl.appendChild(h('tr',
    {},
    h('td', { style: { fontWeight: '600' } }, '#'),
    h('td', { style: { fontWeight: '600' } }, 'Your answer'),
    h('td', { style: { fontWeight: '600' } }, 'Correct'),
    h('td', { style: { fontWeight: '600', textAlign: 'right' } }, 'Marks')));
  for (const d of m.detailed) {
    tbl.appendChild(h('tr', {},
      h('td', {}, 'Q' + d.no + ' (' + d.section + ')'),
      h('td', { class: d.right ? 'ok' : 'bad' }, d.response == null || d.response === '' ? '—' : String(d.response)),
      h('td', {}, ...renderStem(String(d.expected))),
      h('td', { style: { textAlign: 'right' } }, d.awarded + '/' + d.marks)));
  }
  review.appendChild(tbl);
  wrap.appendChild(review);

  // Actions
  wrap.appendChild(h('div', { class: 'actions', style: { justifyContent: 'center', marginTop: '12px' } },
    h('button', { class: 'orange-btn', onClick: () => api.go('home') }, 'Home'),
    h('button', { class: 'btn-mini', onClick: () => api.go('history') }, 'History'),
    h('button', { class: 'btn-mini', onClick: () => api.go('progress') }, 'My progress'),
    h('button', { class: 'btn-mini', onClick: () => {
      // Retake with the same seed
      state.test = { ...att, id: 'att_' + Date.now(), startedAt: new Date().toISOString() };
      state.responses = {};
      api.go('paper');
    } }, 'Retake same paper')));

  screen.appendChild(wrap);
  api.setFooter('hidden');
}

function strandLabel(s) {
  return { number: 'Number', measure: 'Measure / Shape', data: 'Data / Statistics' }[s] || s;
}
