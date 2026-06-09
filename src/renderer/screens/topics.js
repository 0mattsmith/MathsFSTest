// topics.js — focused practice on one strand at a time. Lists every
// topic in the spec; clicking one shuffles all questions in that topic
// and shows them one at a time with immediate feedback.

import { h, renderStem, dataTable, barChart, shuffle, makeRng, randomSeed } from './components.js';
import { markQuestion } from '../engine/marker.js';

export async function showTopics(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  let spec, bank;
  try {
    spec = await api.bridge.loadSpec(state.level);
    bank = await api.bridge.loadBank(state.level);
  } catch (e) { screen.appendChild(h('p', {}, 'Failed to load: ' + e.message)); return; }

  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));
  wrap.appendChild(h('h1', { style: { color: '#003057', margin: '0 0 6px' } },
    'Topic revision — ' + spec.levelLabel));
  wrap.appendChild(h('p', { class: 'muted', style: { marginBottom: '14px' } },
    'Pick a topic to drill through questions on that area only.'));

  // Group topics by strand
  const byStrand = {};
  for (const t of spec.topics) (byStrand[t.strand] = byStrand[t.strand] || []).push(t);

  for (const [strand, topics] of Object.entries(byStrand)) {
    wrap.appendChild(h('h3', { class: 'section-h' }, strandLabel(strand)));
    const list = h('div', { class: 'topic-list' });
    for (const t of topics) {
      const count = bank.questions.filter(q => q.topic === t.id).length;
      list.appendChild(h('div', { class: 'topic-row', onClick: () => startTopic(t) },
        h('span', { class: 't-name' }, t.name),
        h('span', { class: 't-count' }, count + (count === 1 ? ' Q' : ' Qs'))));
    }
    wrap.appendChild(list);
  }
  screen.appendChild(wrap);
  api.setFooter('hidden');

  function startTopic(topic) {
    const qs = bank.questions.filter(q => q.topic === topic.id);
    if (!qs.length) { alert('No questions in this topic yet.'); return; }
    const rng = makeRng(randomSeed());
    const order = shuffle(rng, qs);
    let i = 0, right = 0;
    renderDrill();
    function renderDrill() {
      screen.innerHTML = '';
      const drill = h('div', { class: 'paper-wrap' });
      drill.appendChild(h('div', { class: 'crumb', onClick: () => api.go('topics') }, '◂ Topics'));
      drill.appendChild(h('h2', { style: { color: '#003057' } }, topic.name));
      drill.appendChild(h('div', { class: 'muted', style: { marginBottom: '10px' } },
        'Question ' + (i + 1) + ' of ' + order.length + ' · Correct so far: ' + right));

      const q = order[i];
      const card = h('div', { class: 'q-card' },
        h('div', { class: 'q-stem-text' }, ...renderStem(q.stem)));
      if (q.table) card.appendChild(dataTable(q.table));
      if (q.chart && q.chart.type === 'bar') card.appendChild(barChart(q.chart.labels, q.chart.values));

      let fbEl;
      if (q.type === 'mcq') {
        const opts = h('div', { class: 'q-options' });
        const letters = ['A', 'B', 'C', 'D'];
        q.options.forEach((optTxt, j) => {
          opts.appendChild(h('button', { class: 'q-option', onClick: () => onSubmit(optTxt) },
            h('span', { class: 'opt-label' }, letters[j]),
            h('span', {}, ...renderStem(optTxt))));
        });
        card.appendChild(opts);
      } else {
        const inp = h('input', { type: 'text', placeholder: 'Answer' });
        const btn = h('button', { class: 'orange-btn', onClick: () => onSubmit(inp.value) }, 'Submit');
        card.appendChild(h('div', { class: 'q-input-row' }, inp, btn));
        queueMicrotask(() => inp.focus());
      }
      fbEl = h('div', { class: 'qf-feedback' });
      card.appendChild(fbEl);
      drill.appendChild(card);
      screen.appendChild(drill);

      function onSubmit(val) {
        const m = markQuestion(q, val);
        if (m.right) { right++; fbEl.textContent = '✓ Correct'; fbEl.className = 'qf-feedback right'; }
        else { fbEl.textContent = '✗ Answer: ' + q.answer; fbEl.className = 'qf-feedback wrong'; }
        setTimeout(() => {
          i++;
          if (i >= order.length) {
            screen.innerHTML = '';
            const done = h('div', { class: 'paper-wrap' },
              h('h2', { style: { color: '#003057' } }, 'Topic finished'),
              h('p', {}, 'You got ' + right + ' out of ' + order.length + ' on ' + topic.name + '.'),
              h('div', { class: 'actions' },
                h('button', { class: 'orange-btn', onClick: () => api.go('topics') }, 'Back to topics'),
                h('button', { class: 'btn-mini', onClick: () => startTopic(topic) }, 'Try again')));
            screen.appendChild(done);
          } else renderDrill();
        }, 800);
      }
    }
  }
}

function strandLabel(s) { return ({ number: 'Number', measure: 'Measure / Shape / Space', data: 'Handling Data' }[s] || s); }
