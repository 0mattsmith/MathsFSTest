// template-expander.js — turns a parameterised question template into a
// concrete question by seeding the parameter RNG, picking values, and
// evaluating the stem/answer expressions.
//
// A template looks like:
//
//   {
//     "id":     "tpl-l1-add-3dig",
//     "kind":   "template",
//     "topic":  "n.fourop",
//     "strand": "number",
//     "calc":   false,
//     "marks":  2,
//     "type":   "input",
//     "params": [
//       { "name": "a", "type": "int", "min": 100, "max": 500 },
//       { "name": "b", "type": "int", "min": 50,  "max": 400 },
//       { "name": "name", "type": "pick", "from": ["Tom","Sara","Lila"] },
//       { "name": "total", "type": "expr", "expr": "a + b" }
//     ],
//     "stem":   "{{name}} works out {{a}} + {{b}}",
//     "answer": "{{total}}",
//     "unit":   "£"               // optional
//   }
//
// Variable substitution uses {{varname}} or {{expr}} (any safe arithmetic
// expression over the named params). The answer field is also a template
// — usually just {{expr}} but plain text is also allowed.
//
// `money:varname` is a special formatter that renders an integer in
// pence as £x.yy (matches the existing renderStem token convention).
//
// Determinism: feed the same RNG and you get the same expanded question.

import { makeRng, rngInt, pickOne } from '../screens/components.js';

// ---- Expression evaluator -------------------------------------------
// Template expressions live in our own JSON files, so we trust them
// roughly the way we trust any other piece of source. The evaluator
// allows the maths we actually need (Math.round, .toFixed, ternaries,
// modulo, array literals + indexing for picking from inline lists,
// string concatenation) but blocks the obvious dangerous escape hatches
// — globals, `require`, `eval`, the Function constructor, prototype
// chains, networking. That's enough to keep a typo in a template from
// turning into an exfiltration vector.
const BANNED = /\b(import|require|eval|Function|process|window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|constructor|prototype|__proto__|this)\b/;

function evalExpr(expr, env) {
  const s = String(expr).trim();
  if (BANNED.test(s)) {
    throw new Error('Disallowed token in expression: ' + s);
  }
  const names = Object.keys(env);
  const values = names.map(n => env[n]);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, '"use strict"; return (' + s + ')');
  return fn(...values);
}

// ---- Param picking ---------------------------------------------------
function pickParam(rng, env, p) {
  switch (p.type) {
    case 'int': {
      const step = p.step || 1;
      const lo = Math.ceil(p.min / step);
      const hi = Math.floor(p.max / step);
      return rngInt(rng, lo, hi) * step;
    }
    case 'pick':
      return pickOne(rng, p.from);
    case 'expr':
      return evalExpr(p.expr, env);
    default:
      throw new Error('Unknown param type: ' + p.type);
  }
}

// ---- Stem / answer substitution -------------------------------------
function substitute(text, env) {
  return String(text).replace(/\{\{([^}]+)\}\}/g, (_, raw) => {
    const expr = raw.trim();
    // money:varname → £x.yy from pence
    if (expr.startsWith('money:')) {
      const v = expr.slice(6).trim();
      const pence = env[v] != null ? Number(env[v]) : Number(evalExpr(v, env));
      return '£' + (pence / 100).toFixed(2);
    }
    // Plain variable
    if (env[expr] !== undefined) return String(env[expr]);
    // Computed expression
    try {
      const v = evalExpr(expr, env);
      // Tidy floats — strip trailing zeros after 6dp.
      if (typeof v === 'number' && !Number.isInteger(v)) {
        const r = Number(v.toFixed(6));
        return String(r);
      }
      return String(v);
    } catch {
      return '{{' + expr + '}}';
    }
  });
}

// ---- Expand a template into a concrete question ----------------------
export function expandTemplate(tpl, seed) {
  const rng = makeRng(seed + '|' + tpl.id);
  const env = {};
  for (const p of (tpl.params || [])) {
    env[p.name] = pickParam(rng, env, p);
  }
  const concrete = {
    id: tpl.id + '#' + seed.slice(0, 6),
    _tplId: tpl.id,
    topic: tpl.topic,
    strand: tpl.strand,
    calc: !!tpl.calc,
    marks: tpl.marks,
    type: tpl.type,
    stem: substitute(tpl.stem, env),
    answer: substitute(tpl.answer, env),
  };
  if (tpl.unit) concrete.unit = tpl.unit;
  if (tpl.tolerance != null) concrete.tolerance = tpl.tolerance;
  // MCQ options can also be templated.
  if (tpl.options) {
    concrete.options = tpl.options.map(o => substitute(o, env));
  }
  // For input-money types, normalise the answer to two decimals if it
  // ended up as a float.
  if (tpl.type === 'input-money') {
    const n = Number(concrete.answer);
    if (Number.isFinite(n)) concrete.answer = n.toFixed(2);
  }
  // Fraction answers can be requested via "fraction:NUM/DEN" — for now
  // we trust the template author to write them out correctly.
  return concrete;
}

// Helper: merge static + template pools into a unified question pool.
// Templates are expanded with the given seed so the resulting pool is
// fully concrete (every question has a real stem, answer, etc.).
export function combinePool(staticQuestions, templates, seed) {
  const out = staticQuestions.slice();
  for (const tpl of templates) {
    try {
      out.push(expandTemplate(tpl, seed));
    } catch (err) {
      console.warn('Failed to expand template', tpl.id, err.message);
    }
  }
  return out;
}
