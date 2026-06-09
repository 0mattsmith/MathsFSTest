// paper-builder.js — assembles a Section A + Section B paper from a bank
// using a seeded RNG. Same seed reproduces the same paper exactly.
//
// Strategy:
//   For each section:
//     1. Pull questions whose `calc` flag matches the section.
//     2. Group by strand (number / measure / data) and shuffle each group.
//     3. Iteratively pick from each group in proportion to the spec's
//        topicWeights until we have at least sectionMarks total marks
//        (Edexcel-style: roughly 25%/75% A/B split, hit the section mark
//        target rather than a fixed count).
//     4. Re-shuffle the picked list to set the running order.

import { makeRng, shuffle, pickOne } from '../screens/components.js';

function groupBy(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    (out[k] = out[k] || []).push(x);
  }
  return out;
}

function pickSection(rng, bank, section) {
  // Pool: only questions matching the calc flag.
  const pool = bank.questions.filter(q => q.calc === section.calc);

  // Group by strand.
  const groups = groupBy(pool, q => q.strand);
  // Shuffle each group with this rng so the same seed is reproducible.
  for (const k of Object.keys(groups)) groups[k] = shuffle(rng, groups[k]);

  // Cursor per strand: how many have been taken.
  const cursor = {};
  for (const k of Object.keys(groups)) cursor[k] = 0;

  // Build weighted strand order so the picker visits strands in proportion
  // to the section's topicWeights (e.g. 0.7/0.2/0.1 → ~7N, 2M, 1D per cycle).
  const weights = section.topicWeights || {};
  const cycle = [];
  // Round weights to 10ths.
  for (const [strand, w] of Object.entries(weights)) {
    const n = Math.max(1, Math.round(w * 10));
    for (let i = 0; i < n; i++) cycle.push(strand);
  }
  // Shuffle the cycle once so the same seed gives a fixed strand order.
  const strandOrder = shuffle(rng, cycle);

  const picked = [];
  let marks = 0;
  let safety = 200;
  const target = section.marks;
  while (marks < target && safety-- > 0) {
    for (const strand of strandOrder) {
      const grp = groups[strand];
      if (!grp || cursor[strand] >= grp.length) continue;
      const q = grp[cursor[strand]++];
      picked.push(q);
      marks += q.marks || 1;
      if (marks >= target) break;
    }
    // If we couldn't fill the target from preferred strands, fall back to
    // anything available.
    if (marks < target) {
      let pulled = false;
      for (const strand of Object.keys(groups)) {
        const grp = groups[strand];
        if (cursor[strand] >= grp.length) continue;
        const q = grp[cursor[strand]++];
        picked.push(q);
        marks += q.marks || 1;
        pulled = true;
        if (marks >= target) break;
      }
      if (!pulled) break;  // pool exhausted
    }
  }

  // Final running order: don't shuffle again — keep the strand-cycle order
  // so adjacent questions don't all come from the same topic. Number the
  // questions within the section.
  return picked.map((q, i) => ({ ...q, _no: i + 1 }));
}

export function buildPaper(spec, bank, seed) {
  const baseRng = makeRng(seed + '|' + spec.level + '|paper');
  const sections = [];
  let runningNo = 0;
  for (const section of spec.sections) {
    // Sub-seed per section so changing section A doesn't shift section B.
    const sRng = makeRng(seed + '|' + section.id);
    const items = pickSection(sRng, bank, section);
    // Renumber as overall paper question numbers.
    const renumbered = items.map(q => {
      runningNo += 1;
      return { ...q, _papNo: runningNo };
    });
    sections.push({
      id: section.id,
      name: section.name,
      subname: section.subname,
      calc: section.calc,
      minutes: section.minutes,
      marks: section.marks,
      questions: renumbered,
    });
  }
  // Touch baseRng so analyzers know it's used (harmless).
  baseRng();
  return {
    seed,
    level: spec.level,
    board: bank.board || spec.board,
    paperCode: spec.paperCode,
    title: spec.title,
    levelLabel: spec.levelLabel,
    totalMarks: spec.totalMarks,
    passMark: spec.passMark,
    instructions: spec.instructions,
    information: spec.information,
    sections,
  };
}
