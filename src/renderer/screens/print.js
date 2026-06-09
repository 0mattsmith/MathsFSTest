// print.js — produces the printable view of a seeded paper, laid out to
// look as close as possible to a real Pearson Edexcel Functional Skills
// Mathematics paper. Cover page + section straps + numbered questions +
// answer lines/boxes + page footer with total-marks box and "Turn over"
// indicator.

import { h, renderStem, dataTable, barChart, randomSeed } from './components.js';
import { buildPaper } from '../engine/paper-builder.js';

export async function showPrint(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  let bank, spec;
  try {
    bank = await api.bridge.loadBank(state.test.level);
    spec = await api.bridge.loadSpec(state.test.level);
  } catch (err) {
    screen.appendChild(h('div', { class: 'paper-wrap' },
      h('div', { class: 'q-card' },
        h('h2', {}, 'Could not load paper'),
        h('p', {}, err.message),
        h('button', { class: 'orange-btn', onClick: () => api.go('home') }, 'Home'))));
    return;
  }

  const paper = buildPaper(spec, bank, state.test.seed);

  // ---- On-screen toolbar (hidden when printing) -----------------------
  const seedSpan = h('span', { class: 'kbd' }, paper.seed);
  const newBtn = h('button', { onClick: () => { state.test.seed = randomSeed(); api.go('print'); } }, 'New random');
  const printBtn = h('button', { class: 'warn', onClick: () => window.print() }, '🖨 Print paper');
  const homeBtn = h('button', { onClick: () => api.go('home') }, '◂ Home');

  const toolbar = h('div', { class: 'print-toolbar' },
    h('span', { class: 'pt-title' }, paper.title + ' — ' + paper.levelLabel + ' (' + paper.paperCode + ')'),
    h('span', { style: { color: '#fff', fontSize: '12px' } }, 'Seed: '), seedSpan,
    newBtn, printBtn, homeBtn);
  screen.appendChild(toolbar);

  // ---- Cover page ----------------------------------------------------
  const cover = h('div', { class: 'print-paper' },
    h('div', { class: 'cover' },
      h('div', { class: 'pearson-bar' },
        h('div', { class: 'brand' }, 'Pearson Edexcel'),
        h('div', { class: 'qualification' }, 'Functional Skills'),
        h('div', { class: 'subject' }, 'Mathematics — ' + paper.levelLabel)),

      h('div', { class: 'cand-box' },
        h('div', { class: 'cand-row' },
          h('div', { class: 'lbl' }, 'Centre number'), h('div', { class: 'val' })),
        h('div', { class: 'cand-row' },
          h('div', { class: 'lbl' }, 'Candidate number'), h('div', { class: 'val' })),
        h('div', { class: 'cand-row' },
          h('div', { class: 'lbl' }, 'Surname'), h('div', { class: 'val' })),
        h('div', { class: 'cand-row' },
          h('div', { class: 'lbl' }, 'Other names'), h('div', { class: 'val' })),
        h('div', { class: 'cand-row' },
          h('div', { class: 'lbl' }, 'Candidate signature'), h('div', { class: 'val' }))),

      h('div', { class: 'paper-info' },
        h('div', { class: 'row' },
          h('div', {}, 'Paper reference'),
          h('div', {}, paper.paperCode)),
        h('div', { class: 'row' },
          h('div', {}, 'Time'),
          h('div', {}, totalMinutes(paper) + ' minutes')),
        h('div', { class: 'row' },
          h('div', {}, 'Seed (revision practice paper)'),
          h('div', {}, paper.seed))),

      h('div', { class: 'instructions' },
        h('h3', {}, 'Instructions'),
        h('ul', {}, ...paper.instructions.map(s => h('li', {}, s)))),

      h('div', { class: 'information' },
        h('h3', {}, 'Information'),
        h('ul', {}, ...paper.information.map(s => h('li', {}, s)))),

      h('div', { class: 'turn-over' }, 'Turn over')),

    h('div', { class: 'dnw-strip' }, 'DO NOT WRITE IN THIS AREA'),
    h('div', { class: 'page-foot' },
      h('div', {}, 'P 0 ' + paper.paperCode.replace(/\W/g, '') + ' 0 1'),
      h('div', { class: 'turn-over' })));
  screen.appendChild(cover);

  // ---- Each section as one or more pages -----------------------------
  for (let si = 0; si < paper.sections.length; si++) {
    const section = paper.sections[si];
    const isLast = si === paper.sections.length - 1;

    const page = h('div', { class: 'print-paper' });
    page.appendChild(h('div', { class: 'section-strap' },
      section.name + ' — ' + section.subname,
      h('span', { class: 'strap-note' }, 'You may ' + (section.calc ? '' : 'NOT ') + 'use a calculator.'),
      h('span', { class: 'strap-note', style: { float: 'right' } }, 'Suggested time: ' + section.minutes + ' minutes')));

    for (const q of section.questions) {
      const body = h('div', { class: 'pq-body' });
      body.appendChild(h('p', {}, ...renderStem(q.stem)));
      if (q.table) body.appendChild(dataTable(q.table));
      if (q.chart && q.chart.type === 'bar') body.appendChild(barChart(q.chart.labels, q.chart.values, { width: 380, height: 150 }));

      // Answer space: MCQ gets boxes, input gets lines or a box.
      if (q.type === 'mcq') {
        const letters = ['A', 'B', 'C', 'D', 'E'];
        const opts = h('div', { class: 'print-mcq-options' });
        q.options.forEach((optTxt, i) => {
          opts.appendChild(h('div', { class: 'opt' },
            h('span', { class: 'box' }),
            h('span', {}, letters[i] + '. '),
            h('span', {}, ...renderStem(optTxt))));
        });
        body.appendChild(opts);
        body.appendChild(h('div', { style: { marginTop: '4mm', fontSize: '9.5pt', fontFamily: 'Arial' } },
          'Put a tick (✓) in the box next to your answer.'));
      } else {
        // Working space + answer line
        body.appendChild(h('div', { style: { marginTop: '4mm', fontSize: '9.5pt', fontFamily: 'Arial' } }, 'Show your working:'));
        const lines = h('div', { class: 'ans-lines' });
        const lineCount = Math.max(2, q.marks * 2);
        for (let i = 0; i < lineCount; i++) lines.appendChild(h('div', { class: 'ans-line' }));
        body.appendChild(lines);
        body.appendChild(h('div', { class: 'answer-prompt' },
          'Answer: ' + (q.unit ? '(' + q.unit + ')' : '')));
        body.appendChild(h('div', { class: 'ans-lines' }, h('div', { class: 'ans-line' })));
      }

      page.appendChild(h('div', { class: 'print-q' },
        h('div', { class: 'pq-num' }, q._papNo + '.'),
        body,
        h('div', { class: 'pq-marks' + (q.marks === 1 ? ' one' : '') }, String(q.marks))));
    }

    page.appendChild(h('div', { class: 'dnw-strip' }, 'DO NOT WRITE IN THIS AREA'));
    page.appendChild(h('div', { class: 'page-foot' },
      h('div', {}, 'Section ' + section.id + ' total: '),
      h('div', { class: 'total-box' }, 'TOTAL ', h('span', { class: 'num' })),
      h('div', { class: 'turn-over' + (isLast ? ' last' : '') })));

    screen.appendChild(page);
  }

  // ---- Mark scheme appended for teacher use --------------------------
  const ms = h('div', { class: 'print-paper' });
  ms.appendChild(h('div', { class: 'section-strap' }, 'Mark Scheme',
    h('span', { class: 'strap-note' }, 'For teacher use — detach before issuing.')));
  const msBody = h('div', { style: { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10.5pt' } });
  for (const section of paper.sections) {
    msBody.appendChild(h('h3', { style: { color: '#000', margin: '6mm 0 2mm' } },
      'Section ' + section.id + ' — ' + section.subname + ' (' + section.marks + ' marks)'));
    const t = h('table', { style: { borderCollapse: 'collapse', width: '100%' } });
    t.appendChild(h('tr', {},
      h('th', { style: { border: '1px solid #000', padding: '1.5mm 3mm', textAlign: 'left', background: '#eee' } }, 'Q'),
      h('th', { style: { border: '1px solid #000', padding: '1.5mm 3mm', textAlign: 'left', background: '#eee' } }, 'Answer'),
      h('th', { style: { border: '1px solid #000', padding: '1.5mm 3mm', textAlign: 'left', background: '#eee' } }, 'Topic'),
      h('th', { style: { border: '1px solid #000', padding: '1.5mm 3mm', textAlign: 'right', background: '#eee' } }, 'Marks')));
    for (const q of section.questions) {
      t.appendChild(h('tr', {},
        h('td', { style: { border: '1px solid #000', padding: '1.5mm 3mm' } }, String(q._papNo)),
        h('td', { style: { border: '1px solid #000', padding: '1.5mm 3mm' } }, ...renderStem(String(q.answer))),
        h('td', { style: { border: '1px solid #000', padding: '1.5mm 3mm', fontSize: '9pt' } }, q.topic),
        h('td', { style: { border: '1px solid #000', padding: '1.5mm 3mm', textAlign: 'right' } }, String(q.marks))));
    }
    msBody.appendChild(t);
  }
  ms.appendChild(msBody);
  ms.appendChild(h('div', { class: 'page-foot' },
    h('div', {}, 'Pass mark: ' + paper.passMark + '/' + paper.totalMarks),
    h('div', { class: 'turn-over last' })));
  screen.appendChild(ms);

  api.setFooter('hidden');
}

function totalMinutes(paper) {
  return paper.sections.reduce((a, s) => a + s.minutes, 0);
}
