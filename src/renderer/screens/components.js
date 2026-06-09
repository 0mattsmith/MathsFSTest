// Shared helpers: seeded PRNG, DOM factory, timer, formatters.
// Replicates the patterns from DigitalFSTest's components.js so that
// behaviour is identical across the two apps.

// ---- Seeded PRNG (sfc32 seeded by xmur3) -----------------------------
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

export function makeRng(seedStr) {
  const seed = xmur3(String(seedStr));
  return sfc32(seed(), seed(), seed(), seed());
}

export function pickN(rng, arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
export function shuffle(rng, arr) {
  const c = arr.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}
export function pickOne(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function rngInt(rng, lo, hi) { return Math.floor(rng() * (hi - lo + 1)) + lo; }

// ---- DOM helper ------------------------------------------------------
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    } else {
      el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    if (typeof kid === 'string' || typeof kid === 'number') {
      el.appendChild(document.createTextNode(String(kid)));
    } else {
      el.appendChild(kid);
    }
  }
  return el;
}

// ---- Countdown / timer -----------------------------------------------
export function makeCountdown(seconds, onTick, onDone) {
  let remaining = seconds;
  let handle = setInterval(tick, 1000);
  function tick() {
    remaining -= 1;
    if (onTick) onTick(formatTime(remaining), remaining);
    if (remaining <= 0) { clearInterval(handle); handle = null; if (onDone) onDone(); }
  }
  if (onTick) onTick(formatTime(remaining), remaining);
  return {
    stop() { if (handle) clearInterval(handle); handle = null; },
    pause() { if (handle) { clearInterval(handle); handle = null; } },
    resume() { if (!handle) handle = setInterval(tick, 1000); },
    getRemaining() { return remaining; },
  };
}
export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(mm)}:${pad(ss)}`;
}

// ---- Seed / id helpers ----------------------------------------------
export function newAttemptId() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const tail = Math.random().toString(36).slice(2, 6);
  return `att_${stamp}_${tail}`;
}
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeed(len = 8) {
  let s = '';
  for (let i = 0; i < len; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}

// ---- Fraction / number formatting -----------------------------------
export function frac(num, den) {
  return h('span', { class: 'frac' },
    h('span', { class: 'top' }, String(num)),
    h('span', { class: 'bot' }, String(den)));
}
export function money(p) {
  // p is in pence — render as £x.yy
  const pounds = Math.abs(p) / 100;
  const txt = (p < 0 ? '-' : '') + '£' + pounds.toFixed(2);
  return txt;
}
export function gbp(amount) {
  return '£' + Number(amount).toFixed(2);
}

// Render stem text into a fragment supporting some lightweight tokens:
//   ${frac:1/4}    → ¼ rendered as a stacked fraction
//   ${money:250}   → £2.50
//   ${pound}       → £
//   ${times}       → ×
//   ${div}         → ÷
//   ${sq}          → ²
//   ${cu}          → ³
//   ${pi}          → π
//   ${deg}         → °
// Returns an array of nodes/strings suitable for h()'s rest args.
export function renderStem(text) {
  const TOKEN = /\$\{([^}]+)\}/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[1];
    if (t.startsWith('frac:')) {
      const [n, d] = t.slice(5).split('/');
      out.push(frac(n, d));
    } else if (t.startsWith('money:')) {
      out.push(money(parseInt(t.slice(6), 10)));
    } else if (t === 'pound')   out.push('£');
    else if (t === 'times')     out.push('×');
    else if (t === 'div')       out.push('÷');
    else if (t === 'sq')        out.push('²');
    else if (t === 'cu')        out.push('³');
    else if (t === 'pi')        out.push('π');
    else if (t === 'deg')       out.push('°');
    else if (t === 'pm')        out.push('±');
    else if (t === 'br')        out.push(h('br'));
    else                        out.push('${' + t + '}');
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Render a simple data table from rows of arrays. First row optionally treated as headers.
export function dataTable(rows, opts = {}) {
  const tbl = h('table', { class: 'q-table' });
  if (opts.headers !== false) {
    const thead = h('tr');
    for (const c of rows[0]) thead.appendChild(h('th', {}, String(c)));
    tbl.appendChild(thead);
    rows = rows.slice(1);
  }
  for (const r of rows) {
    const tr = h('tr');
    for (const c of r) tr.appendChild(h('td', {}, String(c)));
    tbl.appendChild(tr);
  }
  return tbl;
}

// Tiny SVG bar chart used inline in stems.
export function barChart(labels, values, opts = {}) {
  const w = opts.width || 360, hgt = opts.height || 160;
  const pad = { l: 30, b: 24, t: 8, r: 8 };
  const maxV = Math.max(...values, 1);
  const bw = (w - pad.l - pad.r) / values.length;
  const svg = `<svg class="q-chart" viewBox="0 0 ${w} ${hgt}" xmlns="http://www.w3.org/2000/svg">
    ${[0, 0.25, 0.5, 0.75, 1].map(t => {
      const y = pad.t + (hgt - pad.t - pad.b) * (1 - t);
      return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/>
              <text x="${pad.l - 4}" y="${y + 3}" font-size="9" text-anchor="end" font-family="Arial">${Math.round(maxV * t)}</text>`;
    }).join('')}
    ${values.map((v, i) => {
      const x = pad.l + i * bw + 4;
      const bwi = bw - 8;
      const bh = (hgt - pad.t - pad.b) * (v / maxV);
      const y = (hgt - pad.b) - bh;
      return `<rect x="${x}" y="${y}" width="${bwi}" height="${bh}" fill="#f0801f" stroke="#c66108"/>
              <text x="${x + bwi/2}" y="${hgt - pad.b + 12}" font-size="9.5" text-anchor="middle" font-family="Arial">${labels[i]}</text>`;
    }).join('')}
    <line x1="${pad.l}" x2="${w - pad.r}" y1="${hgt - pad.b}" y2="${hgt - pad.b}" stroke="#000"/>
    <line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${hgt - pad.b}" stroke="#000"/>
  </svg>`;
  return h('div', { html: svg }).firstChild;
}
