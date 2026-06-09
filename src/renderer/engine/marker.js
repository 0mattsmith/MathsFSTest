// marker.js — checks a candidate's answers against the question bank.
// Marking is intentionally lenient (the real Edexcel marking is positive,
// awarding marks for what the student demonstrated). For MCQ we look for
// exact match; for input we normalise whitespace, currency symbols and
// trailing zeros, and accept within tolerance for numeric answers.

function norm(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase()
    .replace(/^£|^\$/g, '')          // strip leading currency
    .replace(/,/g, '')                // strip thousands sep
    .replace(/\s+/g, '');             // strip whitespace
}

function toNumber(v) {
  if (v == null) return NaN;
  const s = String(v).trim().replace(/^£|^\$|,| /g, '');
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const an = Number(a), bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn) && bn !== 0) return an / bn;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function simplifyFrac(s) {
  // 'a/b' → 'A/B' simplified
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*(-?\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  if (b === 0) return null;
  const g = gcd(Math.abs(a), Math.abs(b));
  return `${a / g}/${b / g}`;
}
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

export function markQuestion(question, response) {
  if (response == null || response === '') return { right: false, awarded: 0, expected: question.answer };
  const expected = String(question.answer);

  if (question.type === 'mcq') {
    const right = norm(response) === norm(expected);
    return { right, awarded: right ? question.marks : 0, expected };
  }

  // Fraction check: if the expected answer is a fraction, accept any
  // equivalent fraction.
  const eFrac = simplifyFrac(expected);
  const rFrac = simplifyFrac(response);
  if (eFrac && rFrac && eFrac === rFrac) {
    return { right: true, awarded: question.marks, expected };
  }

  // Numeric comparison with optional tolerance.
  const eN = toNumber(expected);
  const rN = toNumber(response);
  if (Number.isFinite(eN) && Number.isFinite(rN)) {
    const tol = question.tolerance != null ? question.tolerance : 0.001;
    if (Math.abs(eN - rN) <= tol) {
      return { right: true, awarded: question.marks, expected };
    }
    // Close-but-not-exact partial credit: half marks within 5% (helpful for
    // method-mark style scoring on multi-mark questions).
    if (question.marks > 1 && eN !== 0 && Math.abs(eN - rN) / Math.abs(eN) <= 0.05) {
      return { right: false, awarded: Math.floor(question.marks / 2), expected };
    }
    return { right: false, awarded: 0, expected };
  }

  // Fall back to normalised string match.
  const right = norm(response) === norm(expected);
  return { right, awarded: right ? question.marks : 0, expected };
}

export function markPaper(paper, responses) {
  let score = 0, total = 0;
  const topicTotals = {};   // strand → { right, total }
  const detailed = [];
  for (const section of paper.sections) {
    for (const q of section.questions) {
      total += q.marks;
      const resp = responses[q.id];
      const result = markQuestion(q, resp);
      score += result.awarded;
      const t = topicTotals[q.strand] = topicTotals[q.strand] || { right: 0, total: 0 };
      t.right += result.awarded;
      t.total += q.marks;
      detailed.push({ id: q.id, section: section.id, no: q._papNo, strand: q.strand,
                      topic: q.topic, response: resp, ...result, marks: q.marks });
    }
  }
  return { score, total, percent: total ? Math.round(100 * score / total) : 0,
           topicTotals, detailed,
           grade: score >= paper.passMark ? 'PASS' : 'FAIL',
           passMark: paper.passMark };
}
