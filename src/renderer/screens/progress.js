// progress.js — per-student dashboard summarising history into headline
// stats and per-strand strengths/weaknesses.

import { h } from './components.js';

export function showProgress(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  const history = api.bridge.loadHistory();

  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));
  wrap.appendChild(h('h1', { style: { color: '#003057', margin: '0 0 16px' } }, 'My progress'));

  if (!history.length) {
    wrap.appendChild(h('p', {}, 'No attempts yet. Sit a mock paper or play a game to start logging progress.'));
    screen.appendChild(wrap);
    api.setFooter('hidden');
    return;
  }

  // Headline numbers
  const attempts = history.length;
  const passes = history.filter(a => a.marked.grade === 'PASS').length;
  const bestPct = Math.max(...history.map(a => a.marked.percent));
  const avgPct = Math.round(history.reduce((s, a) => s + a.marked.percent, 0) / attempts);

  wrap.appendChild(h('div', { class: 'dash-grid' },
    statTile(attempts, 'Papers sat'),
    statTile(passes, 'Passes'),
    statTile(bestPct + '%', 'Best score'),
    statTile(avgPct + '%', 'Average %')));

  // By level
  const byLevel = {};
  for (const a of history) (byLevel[a.level] = byLevel[a.level] || []).push(a);
  const byLevelCard = h('div', { class: 'score-card' }, h('h3', {}, 'By level'));
  for (const [lv, atts] of Object.entries(byLevel)) {
    const avg = Math.round(atts.reduce((s, a) => s + a.marked.percent, 0) / atts.length);
    byLevelCard.appendChild(h('div', { class: 'topic-bar' },
      h('div', {}, levelLabel(lv)),
      h('div', { class: 'bar-bg' }, h('div', { class: 'bar-fill', style: { width: avg + '%' } })),
      h('div', { class: 'bar-pct' }, avg + '% · ' + atts.length + ' attempt' + (atts.length === 1 ? '' : 's'))));
  }
  wrap.appendChild(byLevelCard);

  // Strand strengths/weaknesses
  const strandRoll = {};
  for (const a of history) {
    for (const [strand, t] of Object.entries(a.marked.topicTotals)) {
      const r = strandRoll[strand] = strandRoll[strand] || { right: 0, total: 0 };
      r.right += t.right;
      r.total += t.total;
    }
  }
  const strandCard = h('div', { class: 'score-card' }, h('h3', {}, 'Strand strengths'));
  for (const [s, r] of Object.entries(strandRoll)) {
    const pct = r.total ? Math.round(100 * r.right / r.total) : 0;
    strandCard.appendChild(h('div', { class: 'topic-bar' },
      h('div', {}, strandLabel(s)),
      h('div', { class: 'bar-bg' }, h('div', { class: 'bar-fill', style: { width: pct + '%' } })),
      h('div', { class: 'bar-pct' }, r.right + '/' + r.total)));
  }
  wrap.appendChild(strandCard);

  // Topic detail — the topics where the student is weakest
  const topicRoll = {};
  for (const a of history) {
    for (const d of a.marked.detailed) {
      const k = a.level + '|' + d.topic;
      const r = topicRoll[k] = topicRoll[k] || { topic: d.topic, level: a.level, right: 0, total: 0 };
      r.right += d.awarded;
      r.total += d.marks;
    }
  }
  const weaks = Object.values(topicRoll)
    .filter(r => r.total >= 2)
    .map(r => ({ ...r, pct: r.total ? r.right / r.total : 0 }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6);

  if (weaks.length) {
    const weakCard = h('div', { class: 'score-card' }, h('h3', {}, 'Focus on these topics next'));
    for (const w of weaks) {
      const pct = Math.round(w.pct * 100);
      weakCard.appendChild(h('div', { class: 'topic-bar' },
        h('div', {}, levelLabel(w.level) + ' · ' + w.topic),
        h('div', { class: 'bar-bg' }, h('div', { class: 'bar-fill', style: { width: pct + '%', background: '#b81f1f' } })),
        h('div', { class: 'bar-pct' }, w.right + '/' + w.total)));
    }
    weakCard.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'orange-btn', onClick: () => api.go('topics') }, 'Open topic revision')));
    wrap.appendChild(weakCard);
  }

  screen.appendChild(wrap);
  api.setFooter('hidden');
}

function statTile(num, lbl) {
  return h('div', { class: 'dash-stat' },
    h('div', { class: 'ds-num' }, String(num)),
    h('div', { class: 'ds-lbl' }, lbl));
}
function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
function strandLabel(s) { return ({ number: 'Number', measure: 'Measure / Shape', data: 'Data / Statistics' }[s] || s); }
