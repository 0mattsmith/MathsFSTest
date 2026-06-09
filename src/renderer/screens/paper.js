// paper.js — the on-screen Section A / Section B test runner.
// Single question per screen, footer drives prev/next/save, calculator
// pane opens for Section B, timer counts down per section.

import { h, makeCountdown, renderStem, dataTable, barChart } from './components.js';
import { buildPaper } from '../engine/paper-builder.js';
import { markPaper } from '../engine/marker.js';

export async function showPaper(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  // Load bank + spec
  let bank, spec;
  try {
    bank = await api.bridge.loadBank(state.test.level);
    spec = await api.bridge.loadSpec(state.test.level);
  } catch (err) {
    screen.appendChild(h('div', { class: 'paper-wrap' },
      h('div', { class: 'q-card' },
        h('h2', {}, 'Could not load paper'),
        h('p', {}, err.message),
        h('button', { class: 'orange-btn', onClick: () => api.go('home') }, 'Back to home'))));
    return;
  }
  state.bank = bank;
  state.spec = spec;
  const paper = buildPaper(spec, bank, state.test.seed);
  state.test.paper = paper;
  state.responses = state.responses || {};

  // Flatten questions across sections, marking section boundaries
  const sequence = [];
  for (const section of paper.sections) {
    for (const q of section.questions) sequence.push({ section, q });
  }

  // Section timing — one countdown per section, paused while user is on
  // the other section.
  const sectionTimers = {};
  for (const section of paper.sections) {
    sectionTimers[section.id] = { remaining: section.minutes * 60, started: false };
  }
  let currentTimer = null;

  let idx = 0;
  // Optionally skip forward if user already started this attempt.

  function startSectionTimer(section) {
    if (currentTimer) currentTimer.stop();
    const st = sectionTimers[section.id];
    currentTimer = makeCountdown(st.remaining, (txt, rem) => {
      st.remaining = rem;
      const cls = rem < 60 ? 'crit' : rem < 300 ? 'warn' : '';
      // Update footer timer
      api.setFooter({
        ...currentFooterOpts,
        timerText: txt + ' · ' + section.id,
        timerCls: cls,
        showTimer: true,
      });
    }, () => {
      // Section time up — auto-advance into the next section (or finish).
      alert(`Time's up for ${section.name}. Moving on.`);
      autoAdvanceToNextSection();
    });
    st.started = true;
  }

  function autoAdvanceToNextSection() {
    const cur = sequence[idx].section;
    const next = sequence.findIndex(s => s.section.id !== cur.id);
    if (next === -1) { finish(); return; }
    idx = next;
    render();
  }

  let currentFooterOpts = {};
  function render() {
    screen.innerHTML = '';
    const { section, q } = sequence[idx];

    // Start the timer for the active section if not yet started
    if (!sectionTimers[section.id].started || (currentTimer && currentTimer.getRemaining() !== sectionTimers[section.id].remaining)) {
      startSectionTimer(section);
    }

    // Header
    const header = h('div', { class: 'paper-header' },
      h('div', {},
        h('div', { class: 'ph-title' }, paper.title + ' — ' + paper.levelLabel),
        h('div', { class: 'ph-meta' }, paper.paperCode + ' · Seed ' + paper.seed + ' · Candidate: ' + (state.test.candidate || 'Anonymous'))),
      h('div', { class: 'ph-section' }, section.name + ' — ' + section.subname + ' (' + section.marks + ' marks)'));

    const wrap = h('div', { class: 'paper-wrap' }, header);

    const card = h('div', { class: 'q-card' });
    const markStr = String(q.marks);
    card.appendChild(h('span', { class: 'q-num' }, 'Q' + q._papNo));
    card.appendChild(h('span', { class: 'q-marks' + (q.marks === 1 ? ' one' : '') }, markStr));
    const stem = h('div', { class: 'q-stem-text' }, ...renderStem(q.stem));
    card.appendChild(stem);
    if (q.table) card.appendChild(dataTable(q.table));
    if (q.chart && q.chart.type === 'bar') card.appendChild(barChart(q.chart.labels, q.chart.values, { width: 420, height: 180 }));

    if (q.type === 'mcq') {
      const opts = h('div', { class: 'q-options' });
      const letters = ['A', 'B', 'C', 'D', 'E'];
      q.options.forEach((optTxt, i) => {
        const btn = h('button', {
          class: 'q-option' + (state.responses[q.id] === optTxt ? ' is-selected' : ''),
          onClick: () => {
            state.responses[q.id] = optTxt;
            // Update selection styling without full re-render
            Array.from(opts.children).forEach((c, j) => {
              c.classList.toggle('is-selected', j === i);
            });
          },
        },
          h('span', { class: 'opt-label' }, letters[i]),
          h('span', {}, ...renderStem(optTxt)));
        opts.appendChild(btn);
      });
      card.appendChild(opts);
    } else {
      const inputId = 'inp-' + q.id;
      const input = h('input', {
        id: inputId,
        type: 'text',
        placeholder: q.unit && q.unit.startsWith('£') ? '0.00' : 'Answer',
        value: state.responses[q.id] || '',
        onInput: (e) => { state.responses[q.id] = e.target.value; },
      });
      const row = h('div', { class: 'q-input-row' },
        q.type === 'input-money' ? h('span', { class: 'input-unit' }, '£') : null,
        input,
        q.unit && q.unit !== '£' ? h('span', { class: 'input-unit' }, q.unit) : null);
      card.appendChild(row);
      // Auto-focus the input
      queueMicrotask(() => input.focus());
    }

    wrap.appendChild(card);

    // Show "calculator" stub if Section B
    if (section.calc) {
      wrap.appendChild(h('div', { class: 'muted', style: { marginTop: '8px', textAlign: 'center' } },
        'You may use the calculator (toolbar button at the bottom-left).'));
    } else {
      wrap.appendChild(h('div', { class: 'muted', style: { marginTop: '8px', textAlign: 'center' } },
        'Non-calculator section: the calculator button is disabled.'));
    }

    screen.appendChild(wrap);

    currentFooterOpts = {
      counter: `Q ${idx + 1} of ${sequence.length}`,
      onPrev: idx > 0 ? () => { idx--; render(); } : null,
      onNext: () => {
        if (idx < sequence.length - 1) { idx++; render(); }
        else confirmFinish();
      },
      onSave: () => alert('Progress is saved automatically with every answer.'),
      onMarks: () => alert(`This question is worth ${q.marks} ${q.marks === 1 ? 'mark' : 'marks'}.`),
      onCalc: section.calc ? toggleCalculator : null,
      onFlag: () => {
        state.responses[q.id + '__flag'] = !state.responses[q.id + '__flag'];
        alert(state.responses[q.id + '__flag'] ? 'Flagged for review.' : 'Flag removed.');
      },
      disablePrev: idx === 0,
      disableNext: false,
      disableCalc: !section.calc,
      highlightNext: !!state.responses[q.id] || idx === sequence.length - 1,
      nextLabel: idx === sequence.length - 1 ? 'Finish ▶' : null,
      timerText: '00:00',
      showTimer: true,
    };
    api.setFooter(currentFooterOpts);
  }

  function confirmFinish() {
    const unanswered = sequence.filter(({ q }) => !state.responses[q.id]).length;
    const msg = unanswered > 0
      ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Finish anyway?`
      : 'Finish the paper now?';
    if (confirm(msg)) finish();
  }

  function finish() {
    if (currentTimer) currentTimer.stop();
    const marked = markPaper(paper, state.responses);
    state.attempt = {
      id: state.test.id,
      seed: state.test.seed,
      level: state.test.level,
      board: state.test.board,
      candidate: state.test.candidate,
      mode: state.test.mode || 'mock',
      startedAt: state.test.startedAt,
      finishedAt: new Date().toISOString(),
      paper: {
        levelLabel: paper.levelLabel,
        paperCode: paper.paperCode,
        sectionStats: paper.sections.map(s => ({
          id: s.id, marks: s.marks,
          score: marked.detailed.filter(d => d.section === s.id).reduce((a, b) => a + b.awarded, 0),
        })),
      },
      responses: state.responses,
      marked,
    };
    api.bridge.saveAttempt(state.attempt);

    // If this attempt was a class session (student joined via code),
    // also push a summary row into the teacher's session roster.
    if (state.test.sessionCode && state.test.mode === 'class') {
      api.bridge.addSessionResult(state.test.sessionCode, {
        candidate: state.test.candidate,
        score: marked.score,
        total: marked.total,
        percent: marked.percent,
        grade: marked.grade,
        seed: state.test.seed,
        attemptId: state.test.id,
        finishedAt: state.attempt.finishedAt,
      });
    }
    api.go('results');
  }

  function toggleCalculator() {
    const pane = document.getElementById('calc-pane');
    if (!pane) return;
    if (pane.classList.contains('hide')) showCalculator(pane);
    else pane.classList.add('hide');
  }

  // First render
  render();
}

// ---- Minimal on-screen calculator ------------------------------------
function showCalculator(pane) {
  pane.classList.remove('hide');
  pane.setAttribute('aria-hidden', 'false');
  const display = pane.querySelector('#calc-display');
  const keys = pane.querySelector('#calc-keys');
  if (keys.children.length) return;  // already wired
  let expr = '';
  function setDisp(v) { display.textContent = v || '0'; }
  function k(label, cls = '', val = label) {
    const b = document.createElement('button');
    b.className = 'calc-key ' + cls;
    b.textContent = label;
    b.addEventListener('click', () => {
      if (label === '=') {
        try {
          const safe = expr.replace(/[^0-9+\-*/.() ]/g, '');
          // eslint-disable-next-line no-eval
          const r = safe ? eval(safe) : 0;
          expr = String(r);
          setDisp(expr);
        } catch { setDisp('error'); expr = ''; }
      } else if (label === 'C') {
        expr = ''; setDisp('0');
      } else if (label === '⌫') {
        expr = expr.slice(0, -1); setDisp(expr);
      } else {
        expr += val; setDisp(expr);
      }
    });
    return b;
  }
  const layout = [
    ['C', 'clr'], ['⌫', ''], ['(', ''], [')', 'op'],
    ['7'], ['8'], ['9'], ['/', 'op', '/'],
    ['4'], ['5'], ['6'], ['*', 'op', '*'],
    ['1'], ['2'], ['3'], ['-', 'op', '-'],
    ['0'], ['.'], ['=', 'eq'], ['+', 'op', '+'],
  ];
  for (const row of layout) keys.appendChild(k(row[0], row[1] || '', row[2] != null ? row[2] : row[0]));
}
