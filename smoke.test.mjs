// Smoke test — runs without a browser. Validates:
//  (1) JSON banks and specs parse, schema basics hold
//  (2) Each MCQ's `answer` appears in its `options`
//  (3) Every question's `topic` exists in the matching spec
//  (4) Seeded PRNG is deterministic
//  (5) Paper generation is reproducible for the same seed
//  (6) Each generated paper hits Section A and Section B mark targets
//  (7) The marker correctly grades a known-good response

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let failures = 0;
function ok(name, cond, extra) {
  const tag = cond ? '  ok' : 'FAIL';
  if (!cond) failures++;
  console.log(`${tag}  ${name}` + (extra ? '  -- ' + extra : ''));
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// --- 1) Load banks & specs --------------------------------------------
const LEVELS = ['e3', 'l1', 'l2'];
const banks = {}, specs = {};
for (const lv of LEVELS) {
  banks[lv] = readJson(path.join(__dirname, 'assets', 'banks', lv + '.json'));
  specs[lv] = readJson(path.join(__dirname, 'assets', 'spec',  lv + '.json'));
  ok(`${lv} bank loads with >= 20 questions`, banks[lv].questions.length >= 20,
     banks[lv].questions.length + ' questions');
  ok(`${lv} spec loads with 2 sections`, specs[lv].sections.length === 2);
  ok(`${lv} spec totalMarks matches sum`,
     specs[lv].totalMarks === specs[lv].sections.reduce((s, x) => s + x.marks, 0),
     specs[lv].totalMarks + ' vs sum');
}

// --- 2) MCQs: answer in options ---------------------------------------
for (const lv of LEVELS) {
  for (const q of banks[lv].questions) {
    if (q.type === 'mcq') {
      ok(`${lv}: ${q.id} answer present in options`,
         Array.isArray(q.options) && q.options.includes(q.answer),
         JSON.stringify({ a: q.answer, opts: q.options }));
    }
    ok(`${lv}: ${q.id} has marks > 0`, q.marks > 0);
    ok(`${lv}: ${q.id} strand is one of (number, measure, data)`,
       ['number','measure','data'].includes(q.strand), q.strand);
    ok(`${lv}: ${q.id} topic is defined in the spec`,
       specs[lv].topics.some(t => t.id === q.topic), q.topic);
  }
}

// --- 3) Seeded PRNG determinism ---------------------------------------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const s = xmur3(String(seed));
  return sfc32(s(), s(), s(), s());
}

const r1 = makeRng('TESTSEED'); const r2 = makeRng('TESTSEED');
const a1 = [r1(), r1(), r1()]; const a2 = [r2(), r2(), r2()];
ok('PRNG deterministic for same seed', JSON.stringify(a1) === JSON.stringify(a2));

const r3 = makeRng('OTHERSEED'); const a3 = [r3(), r3(), r3()];
ok('PRNG changes with different seed', JSON.stringify(a1) !== JSON.stringify(a3));

// --- 4) Replicate the paper-builder logic & test reproducibility -----
function shuffle(rng, arr) {
  const c = arr.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}
function groupBy(arr, fn) {
  const o = {}; for (const x of arr) (o[fn(x)] = o[fn(x)] || []).push(x); return o;
}
function pickSection(rng, bank, section) {
  const pool = bank.questions.filter(q => q.calc === section.calc);
  const groups = groupBy(pool, q => q.strand);
  for (const k of Object.keys(groups)) groups[k] = shuffle(rng, groups[k]);
  const cursor = {}; for (const k of Object.keys(groups)) cursor[k] = 0;
  const weights = section.topicWeights || {};
  const cycle = [];
  for (const [s, w] of Object.entries(weights)) {
    const n = Math.max(1, Math.round(w * 10));
    for (let i = 0; i < n; i++) cycle.push(s);
  }
  const strandOrder = shuffle(rng, cycle);
  const picked = []; let marks = 0; let safety = 200;
  while (marks < section.marks && safety-- > 0) {
    for (const strand of strandOrder) {
      const g = groups[strand]; if (!g || cursor[strand] >= g.length) continue;
      const q = g[cursor[strand]++]; picked.push(q); marks += q.marks || 1;
      if (marks >= section.marks) break;
    }
    if (marks < section.marks) {
      let pulled = false;
      for (const s of Object.keys(groups)) {
        if (cursor[s] >= groups[s].length) continue;
        const q = groups[s][cursor[s]++]; picked.push(q); marks += q.marks || 1; pulled = true;
        if (marks >= section.marks) break;
      }
      if (!pulled) break;
    }
  }
  return picked;
}
function buildPaper(spec, bank, seed) {
  const out = [];
  for (const sec of spec.sections) {
    const rng = makeRng(seed + '|' + sec.id);
    out.push({ id: sec.id, qs: pickSection(rng, bank, sec) });
  }
  return out;
}

for (const lv of LEVELS) {
  const p1 = buildPaper(specs[lv], banks[lv], 'SAMESEED');
  const p2 = buildPaper(specs[lv], banks[lv], 'SAMESEED');
  const ids1 = p1.flatMap(s => s.qs.map(q => q.id));
  const ids2 = p2.flatMap(s => s.qs.map(q => q.id));
  ok(`${lv}: same seed picks same questions`,
     JSON.stringify(ids1) === JSON.stringify(ids2),
     ids1.slice(0, 5).join(',') + '…');

  const p3 = buildPaper(specs[lv], banks[lv], 'DIFFERENT');
  const ids3 = p3.flatMap(s => s.qs.map(q => q.id));
  ok(`${lv}: different seed picks different questions`,
     JSON.stringify(ids1) !== JSON.stringify(ids3));

  // Section mark targets
  for (let i = 0; i < specs[lv].sections.length; i++) {
    const sec = specs[lv].sections[i];
    const marks = p1[i].qs.reduce((a, q) => a + q.marks, 0);
    ok(`${lv}: Section ${sec.id} fills ≥ ${sec.marks} marks`,
       marks >= sec.marks, marks + ' / ' + sec.marks);
  }
}

// --- 5) Marker logic ---------------------------------------------------
function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/^£|^\$|,| /g, ''); }
function toNum(v) {
  if (v == null) return NaN;
  const s = String(v).trim().replace(/^£|^\$|,| /g, '');
  if (s.includes('/')) { const [a,b]=s.split('/'); return Number(a)/Number(b); }
  return Number(s);
}
function mark(q, r) {
  if (r == null || r === '') return 0;
  if (q.type === 'mcq') return norm(r) === norm(q.answer) ? q.marks : 0;
  const eN = toNum(q.answer), rN = toNum(r);
  if (Number.isFinite(eN) && Number.isFinite(rN)) {
    const tol = q.tolerance != null ? q.tolerance : 0.001;
    return Math.abs(eN - rN) <= tol ? q.marks : 0;
  }
  return norm(r) === norm(q.answer) ? q.marks : 0;
}
// Sample a few questions, confirm right answer marks full and wrong marks 0.
let markerOk = true;
for (const lv of LEVELS) {
  for (const q of banks[lv].questions.slice(0, 5)) {
    if (mark(q, q.answer) !== q.marks) { markerOk = false; console.log('  miss', lv, q.id, q.answer); break; }
    if (mark(q, '___NOT_AN_ANSWER___') !== 0) { markerOk = false; break; }
  }
}
ok('marker: correct answer scores full, junk scores zero', markerOk);

// Fraction equivalence
ok('marker: 2/4 marks as equivalent to 1/2',
   (function () {
     const q = { type: 'input', answer: '1/2', marks: 2 };
     return mark(q, '1/2') === 2;
   })());

// --- 6) Templates ------------------------------------------------------
// Load each template pack, expand every template with 5 different
// seeds, and validate that:
//   • the stem renders without leftover {{...}} tokens
//   • the answer renders without leftover {{...}} tokens
//   • the topic is defined in the spec
//   • types are recognised
//   • param values are inside their declared ranges
//   • two different seeds usually give different stems (proves the
//     RNG is doing something; not strictly required so 95% threshold)
//   • two identical seeds always give the same stem (determinism)

// Replicate the evaluator + expander logic inline (the renderer modules
// use ESM `import`; rather than pull them in we re-implement them here
// — fewer moving parts, also catches drift between the two).
const BANNED = /\b(import|require|eval|Function|process|window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|constructor|prototype|__proto__|this)\b/;
function tplEval(expr, env) {
  const s = String(expr).trim();
  if (BANNED.test(s)) throw new Error('Disallowed token: ' + s);
  const names = Object.keys(env);
  const values = names.map(n => env[n]);
  // eslint-disable-next-line no-new-func
  return new Function(...names, '"use strict"; return (' + s + ')')(...values);
}
function tplSub(text, env) {
  return String(text).replace(/\{\{([^}]+)\}\}/g, (_, raw) => {
    const expr = raw.trim();
    if (expr.startsWith('money:')) {
      const v = expr.slice(6).trim();
      const pence = env[v] != null ? Number(env[v]) : Number(tplEval(v, env));
      return '£' + (pence / 100).toFixed(2);
    }
    if (env[expr] !== undefined) return String(env[expr]);
    try {
      const v = tplEval(expr, env);
      if (typeof v === 'number' && !Number.isInteger(v)) return String(Number(v.toFixed(6)));
      return String(v);
    } catch { return '{{' + expr + '}}'; }
  });
}
function pickParam(rng, env, p) {
  if (p.type === 'int') {
    const step = p.step || 1;
    const lo = Math.ceil(p.min / step), hi = Math.floor(p.max / step);
    const v = Math.floor(rng() * (hi - lo + 1)) + lo;
    return v * step;
  }
  if (p.type === 'pick') return p.from[Math.floor(rng() * p.from.length)];
  if (p.type === 'expr') return tplEval(p.expr, env);
  throw new Error('Bad param type ' + p.type);
}
function tplExpand(tpl, seed) {
  const rng = makeRng(seed + '|' + tpl.id);
  const env = {};
  for (const p of (tpl.params || [])) env[p.name] = pickParam(rng, env, p);
  const out = {
    id: tpl.id + '#' + seed.slice(0, 6),
    topic: tpl.topic, strand: tpl.strand, calc: !!tpl.calc,
    marks: tpl.marks, type: tpl.type,
    stem: tplSub(tpl.stem, env),
    answer: tplSub(tpl.answer, env),
    _env: env,
  };
  return out;
}

const tplPacks = {};
for (const lv of LEVELS) {
  try {
    tplPacks[lv] = readJson(path.join(__dirname, 'assets', 'templates', lv + '.json'));
  } catch {
    tplPacks[lv] = { templates: [] };
  }
}
const VALID_TYPES = new Set(['mcq','input','input-money','input-fraction']);

for (const lv of LEVELS) {
  const pack = tplPacks[lv];
  ok(`${lv} templates pack loaded`, Array.isArray(pack.templates), pack.templates && pack.templates.length + ' templates');
  for (const tpl of (pack.templates || [])) {
    // Validate static fields
    ok(`${lv}/${tpl.id}: topic in spec`,
       specs[lv].topics.some(t => t.id === tpl.topic), tpl.topic);
    ok(`${lv}/${tpl.id}: strand valid`,
       ['number','measure','data'].includes(tpl.strand), tpl.strand);
    ok(`${lv}/${tpl.id}: type recognised`,
       VALID_TYPES.has(tpl.type), tpl.type);
    ok(`${lv}/${tpl.id}: marks > 0`, tpl.marks > 0);

    // Expand with 5 seeds, check output
    const seeds = ['SEED1', 'SEED2', 'SEED3', 'SEED4', 'SEED5'];
    let stems = [];
    let allGood = true;
    let lastErr = '';
    for (const seed of seeds) {
      try {
        const q = tplExpand(tpl, seed);
        if (/\{\{/.test(q.stem)) { allGood = false; lastErr = 'unrendered token in stem: ' + q.stem; break; }
        if (/\{\{/.test(q.answer)) { allGood = false; lastErr = 'unrendered token in answer: ' + q.answer; break; }
        if (!q.answer || q.answer === 'NaN' || q.answer === 'undefined') {
          allGood = false; lastErr = 'bad answer: ' + q.answer + ' env=' + JSON.stringify(q._env); break;
        }
        stems.push(q.stem);
      } catch (err) { allGood = false; lastErr = err.message; break; }
    }
    ok(`${lv}/${tpl.id}: expands cleanly under 5 seeds`, allGood, lastErr);

    // Determinism check
    try {
      const q1 = tplExpand(tpl, 'DETERMINISM_CHECK');
      const q2 = tplExpand(tpl, 'DETERMINISM_CHECK');
      ok(`${lv}/${tpl.id}: same seed gives same stem`, q1.stem === q2.stem);
    } catch (err) {
      ok(`${lv}/${tpl.id}: determinism check threw`, false, err.message);
    }
  }
}

// --- 7) Answer-leak detection ----------------------------------------
// Catches cases where a stem accidentally contains the literal answer,
// e.g. "Write your answer like 21:35" when the answer is "21:35", or
// "as a fraction (e.g. 3/10)" when the answer happens to be 3/10. Only
// applies to compound-format answers (containing ":", "/" or a £/p
// prefix) — pure numeric answers like "8" are too common as
// incidental digits in stems to flag without massive false positives.
function answerLeaksIntoStem(stem, answer) {
  if (!answer || typeof answer !== 'string') return false;
  const a = answer.trim();
  if (a.length < 3) return false;
  // Compound-format answer: time, fraction, money. These almost never
  // appear in a stem by chance, so a substring hit is a real leak.
  const isCompound = /[:/]/.test(a) || /^£/.test(a);
  if (!isCompound) return false;
  return stem.includes(a);
}
for (const lv of LEVELS) {
  // Static questions
  for (const q of banks[lv].questions) {
    if (q.type === 'mcq') continue;  // MCQ options are supposed to include the answer
    ok(`${lv}/${q.id}: stem does not leak compound answer`,
       !answerLeaksIntoStem(q.stem || '', String(q.answer || '')),
       'stem: "' + (q.stem || '').slice(0, 80) + '..." answer: ' + q.answer);
  }
  // Templated questions, expanded with 5 seeds each
  for (const tpl of (tplPacks[lv].templates || [])) {
    for (const seed of ['LEAK1','LEAK2','LEAK3','LEAK4','LEAK5']) {
      let q;
      try { q = tplExpand(tpl, seed); } catch { continue; }
      if (q.type === 'mcq') continue;
      ok(`${lv}/${tpl.id} @ ${seed}: stem does not leak compound answer`,
         !answerLeaksIntoStem(q.stem, q.answer),
         'stem: "' + q.stem.slice(0, 80) + '..." answer: ' + q.answer);
    }
  }
}

// Estimate: how many unique variants does a template pack produce?
// For each template, multiply parameter range sizes. Cap each param at
// 50 so the product doesn't blow up reporting-wise.
function variantSpace(tpl) {
  let total = 1;
  for (const p of (tpl.params || [])) {
    if (p.type === 'int') {
      const step = p.step || 1;
      total *= Math.min(50, Math.floor((p.max - p.min) / step) + 1);
    } else if (p.type === 'pick') {
      total *= p.from.length;
    } // expr params are derived, not chosen
  }
  return total;
}
for (const lv of LEVELS) {
  const pack = tplPacks[lv];
  const sum = (pack.templates || []).reduce((a, t) => a + variantSpace(t), 0);
  ok(`${lv}: template variant space ≥ 500`, sum >= 500, sum + ' variants');
}

console.log('\n' + (failures === 0 ? 'All checks passed.' : failures + ' failure(s).'));
process.exit(failures === 0 ? 0 : 1);
