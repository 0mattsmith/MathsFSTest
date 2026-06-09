// teacher.js — teacher creates a class session that hands out a single
// seeded paper (or game) to every student. Mode A (Host): the teacher
// device creates the session and shows a roster. Mode B (Student): the
// student enters the code on the home screen, sits the paper, and the
// result is logged into the session.
//
// Because v1 is browser-local (no server), this is most useful in a
// "classroom laptop wired to a projector" model — the teacher's browser
// hosts the session, students walk up and sit the test. The data shape
// is server-ready so a future drop-in backend would just need to
// replicate bridge.loadSessions/saveSession/addSessionResult.

import { h, randomSeed, newAttemptId } from './components.js';

function newCode() {
  // Short, friendly 6-char code (avoid ambiguous chars).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function showTeacher(api, state) {
  const screen = document.getElementById('screen');
  screen.innerHTML = '';

  // If we have an active session in state, show the host view; else show
  // a chooser between "Start a new session", "Continue an existing
  // session" and "Join a session as a student".
  const activeCode = state.activeSessionCode;
  const active = activeCode ? api.bridge.findSession(activeCode) : null;
  if (active) return renderHost(active);

  const sessions = api.bridge.loadSessions();
  const wrap = h('div', { class: 'paper-wrap' });
  wrap.appendChild(h('div', { class: 'crumb', onClick: () => api.go('home') }, '◂ Home'));
  wrap.appendChild(h('h1', { style: { color: '#003057' } }, 'Teacher session'));
  wrap.appendChild(h('p', { class: 'muted' },
    'Set up a paper for your class. Share the code with students — they enter it on the home screen ' +
    'to sit the same paper. Their scores log to the roster on this device.'));

  // Create a new session
  const lvSel = h('select', {},
    h('option', { value: 'e3' }, 'Entry Level 3'),
    h('option', { value: 'l1', selected: 'selected' }, 'Level 1'),
    h('option', { value: 'l2' }, 'Level 2'));
  lvSel.value = state.level || 'l1';
  const seedField = h('input', { type: 'text', value: randomSeed(), style: { fontFamily: 'Menlo,monospace' } });
  const titleField = h('input', { type: 'text', value: 'Class practice paper', placeholder: 'Session title' });

  const newCard = h('div', { class: 'teacher-card' },
    h('h2', { style: { color: '#003057', margin: '0 0 8px' } }, 'New session'),
    h('div', { class: 'col-2' },
      h('div', { class: 'field' }, h('label', {}, 'Title'), titleField),
      h('div', { class: 'field' }, h('label', {}, 'Level'), lvSel)),
    h('div', { class: 'field' }, h('label', {}, 'Seed (auto)'),
      h('div', { style: { display: 'flex', gap: '8px' } },
        seedField,
        h('button', { class: 'btn-mini', onClick: () => { seedField.value = randomSeed(); } }, 'New seed'))),
    h('button', { class: 'orange-btn', onClick: () => {
      const code = newCode();
      const session = {
        code, level: lvSel.value, seed: seedField.value.trim() || randomSeed(),
        title: titleField.value.trim() || 'Class practice paper',
        createdAt: new Date().toISOString(),
        results: [],
      };
      api.bridge.saveSession(session);
      state.activeSessionCode = code;
      api.go('teacher');
    } }, 'Create session ▶'));
  wrap.appendChild(newCard);

  // Past sessions
  if (sessions.length) {
    const past = h('div', { class: 'teacher-card', style: { marginTop: '16px' } },
      h('h3', { style: { margin: '0 0 8px', color: '#003057' } }, 'Recent sessions'));
    for (const s of sessions.slice(0, 10)) {
      past.appendChild(h('div', { class: 'history-row' },
        h('div', {},
          h('strong', {}, s.title), ' · ', s.code,
          h('div', { class: 'meta' },
            levelLabel(s.level) + ' · seed ' + s.seed + ' · ' +
            new Date(s.createdAt).toLocaleString() + ' · ' +
            (s.results || []).length + ' result' + ((s.results || []).length === 1 ? '' : 's'))),
        h('div', {},
          h('button', { class: 'btn-mini', onClick: () => {
            state.activeSessionCode = s.code; api.go('teacher');
          } }, 'Open'),
          h('button', { class: 'btn-mini danger', onClick: () => {
            if (confirm('Delete session ' + s.code + '?')) {
              api.bridge.deleteSession(s.code);
              api.go('teacher');
            }
          } }, 'Delete'))));
    }
    wrap.appendChild(past);
  }

  // Join existing as a student
  const joinCode = h('input', { type: 'text', placeholder: 'CODE', style: { fontFamily: 'Menlo,monospace', textTransform: 'uppercase', letterSpacing: '4px' } });
  const joinName = h('input', { type: 'text', placeholder: 'Your name', value: state.candidate || '' });
  const join = h('div', { class: 'teacher-card', style: { marginTop: '16px' } },
    h('h3', { style: { margin: '0 0 8px', color: '#003057' } }, 'Join as a student'),
    h('p', { class: 'muted' }, 'Paste the code from your teacher and enter your name to sit the same paper.'),
    h('div', { class: 'col-2' },
      h('div', { class: 'field' }, h('label', {}, 'Session code'), joinCode),
      h('div', { class: 'field' }, h('label', {}, 'Your name'), joinName)),
    h('button', { class: 'orange-btn', onClick: () => {
      const code = joinCode.value.trim().toUpperCase();
      if (!code) { alert('Enter the code your teacher gave you.'); return; }
      const s = api.bridge.findSession(code);
      if (!s) { alert('No session found for code ' + code + '. Check with your teacher.'); return; }
      const candidate = (joinName.value || '').trim() || 'Anonymous';
      state.candidate = candidate;
      api.bridge.saveProfile({ candidate, level: s.level });
      state.test = {
        id: newAttemptId(),
        seed: s.seed,
        level: s.level,
        board: 'edexcel',
        candidate,
        startedAt: new Date().toISOString(),
        mode: 'class',
        sessionCode: s.code,
      };
      state.responses = {};
      api.go('paper');
    } }, 'Join paper ▶'));
  wrap.appendChild(join);

  screen.appendChild(wrap);
  api.setFooter('hidden');

  // ----------------------------------------------------------------
  // Host view: show session code prominently + roster of results
  function renderHost(s) {
    screen.innerHTML = '';
    const host = h('div', { class: 'paper-wrap' });
    host.appendChild(h('div', { class: 'crumb', onClick: () => { state.activeSessionCode = null; api.go('teacher'); } },
      '◂ All sessions'));
    host.appendChild(h('h1', { style: { color: '#003057' } }, s.title));
    host.appendChild(h('p', { class: 'muted' },
      levelLabel(s.level) + ' · seed ' + s.seed + ' · created ' + new Date(s.createdAt).toLocaleString()));

    host.appendChild(h('div', { class: 'teacher-card' },
      h('div', { class: 'muted', style: { textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' } }, 'Class code'),
      h('div', { class: 'teacher-code' }, s.code),
      h('div', { class: 'muted', style: { textAlign: 'center' } },
        'Students enter this on the home screen → Teacher session → Join.')));

    const roster = (s.results || []);
    const card = h('div', { class: 'teacher-card', style: { marginTop: '14px' } },
      h('h3', { style: { color: '#003057', margin: '0 0 6px' } },
        'Roster (' + roster.length + ')'));
    if (roster.length) {
      const table = h('table', { class: 'teacher-roster' });
      table.appendChild(h('tr', {},
        h('th', {}, 'Name'),
        h('th', {}, 'Score'),
        h('th', {}, '%'),
        h('th', {}, 'Grade'),
        h('th', {}, 'Finished')));
      // sort by score desc
      const sorted = [...roster].sort((a, b) => b.percent - a.percent);
      for (const r of sorted) {
        table.appendChild(h('tr', {},
          h('td', {}, r.candidate),
          h('td', {}, r.score + '/' + r.total),
          h('td', {}, r.percent + '%'),
          h('td', {},
            h('span', { class: 'pill ' + (r.grade === 'PASS' ? 'ok' : 'bad') }, r.grade)),
          h('td', {}, new Date(r.finishedAt).toLocaleString())));
      }
      card.appendChild(table);
      // Aggregate stats
      const avg = Math.round(sorted.reduce((a, r) => a + r.percent, 0) / sorted.length);
      const passes = sorted.filter(r => r.grade === 'PASS').length;
      card.appendChild(h('div', { class: 'muted', style: { marginTop: '10px' } },
        'Class average: ' + avg + '% · ' + passes + ' of ' + sorted.length + ' passed.'));
    } else {
      card.appendChild(h('p', { class: 'muted' }, 'Waiting for students to finish their paper…'));
    }
    host.appendChild(card);

    // Action buttons
    host.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'orange-btn', onClick: () => {
        // Open the paper as the teacher (e.g. to project the questions)
        state.test = {
          id: newAttemptId(),
          seed: s.seed, level: s.level, board: 'edexcel',
          candidate: 'Teacher', mode: 'class-preview',
          startedAt: new Date().toISOString(),
          sessionCode: s.code,
        };
        state.responses = {};
        api.go('paper');
      } }, 'Open paper'),
      h('button', { class: 'btn-mini', onClick: () => {
        // Open print view for this paper
        state.test = {
          id: newAttemptId(), seed: s.seed, level: s.level, board: 'edexcel',
          candidate: '', mode: 'print', startedAt: new Date().toISOString(),
        };
        api.go('print');
      } }, '🖨 Print the paper'),
      h('button', { class: 'btn-mini', onClick: () => { api.go('teacher'); } }, 'Refresh roster')));

    screen.appendChild(host);
  }
}

function levelLabel(lv) { return ({ e3: 'Entry Level 3', l1: 'Level 1', l2: 'Level 2' }[lv] || lv); }
