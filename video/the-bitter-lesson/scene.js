// The Bitter Lesson. The whole video is drawScene(ctx, t), a pure function of
// time in seconds: no state survives between frames, so render.py can render
// frames in any order and in parallel. Lyric and beat times come from timeline.js.
//
// The stage is a Go diagram that is also a chart: columns are years from 1952 to
// 2024 in steps of four, rows are decades of training compute on a log scale.
// The human side is drawn by hand (pencil rings, hand-written annotations), the
// machine side is perfect green discs. Green means compute and nothing else,
// also inside the lyrics.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", panel: "#0d0c0a", line: "#57534a", lineDim: "#2d2b26",
  paper: "#ece6d7", paperDim: "#8f897b", ink: "#090908", text: "#ececf0",
  green: "#b4f03c", hot: "#fbf7dc", ash: "#3d3b35",
};
const N = 19;

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

// ---------------------------------------------------------------- beats

// Two-bar anchors from timeline.js, eight beats between each pair; the first
// list is extended backwards to the song start and forwards to the band's stop.
const BEAT_T = (() => {
  const out = [];
  const add = (arr, pre, post) => {
    const p0 = (arr[1] - arr[0]) / 8, p1 = (arr[arr.length - 1] - arr[arr.length - 2]) / 8;
    for (let k = pre; k > 0; k--) if (arr[0] - k * p0 > 0) out.push(arr[0] - k * p0);
    for (let i = 0; i < arr.length - 1; i++) for (let k = 0; k < 8; k++) out.push(arr[i] + (arr[i + 1] - arr[i]) * k / 8);
    for (let k = 0; k <= post; k++) out.push(arr[arr.length - 1] + k * p1);
  };
  add(BEATS.a, 4, 4);
  add(BEATS.b, 0, 0);
  return out;
})();
function beatIndex(t) {
  let lo = 0, hi = BEAT_T.length - 1;
  if (t < BEAT_T[0]) return -1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (BEAT_T[m] <= t) lo = m; else hi = m - 1; }
  return lo;
}
const firstBeat = t0 => { const i = beatIndex(t0 - 1e-6); return i + 1; };
// 1 on the beat, decaying over 0.18 s
const beatPulse = t => { const i = beatIndex(t); return i < 0 ? 0 : Math.exp(-(t - BEAT_T[i]) / 0.09); };

// ---------------------------------------------------------------- lyrics

function parse(l) {
  const words = l.w.split(" ").map(x => { const k = x.lastIndexOf("@"); return { s: x.slice(0, k), t: +x.slice(k + 1) }; });
  return { ...l, words, t: words[0].t };
}
const L = {};
for (const k of ["v1", "pre", "chorus", "v2", "bridge", "v3", "outro"]) L[k] = TL[k].map(parse);
L.getUp = parse(TL.getUp);
const lineAt = (lines, t) => { let cur = null; for (const l of lines) if (t >= l.t) cur = l; return cur; };

// Words that name the machine side are set in the accent colour.
const MACHINE = new Set(["Moore's", "Law", "Compute", "COMPUTE", "Brute", "Force", "AlphaGo", "AlphaZero", "AlphaFold",
  "Alpha-", "WHATEVER", "TPUs", "Silizium", "Silicon", "Tensor-Cores", "Nanosekunden", "Parameter", "Gradients", "Scale"]);
const isMachine = s => MACHINE.has(s) || MACHINE.has(s.replace(/[,.!]+$/, ""));

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(Math.round(g), 0, 6)]}"`;

// Visible characters of word i: typed from its onset over at most 0.28 s.
function wordChars(line, i, t) {
  const w = line.words[i], next = i + 1 < line.words.length ? line.words[i + 1].t : line.e;
  const k = span(t, w.t, w.t + Math.max(0.05, Math.min(0.28, (next - w.t) * 0.85)));
  return Math.round(w.s.length * k);
}

// Lays the whole line out first, so a line being typed never moves or resizes.
// o: { x, cy, w, size, grade, align, lead, maxRows, color, alpha, bar, minSize }
function setLine(ctx, line, t, o) {
  if (!line || t < line.t) return;
  const align = o.align || "left", lead = o.lead || 1.08, maxRows = o.maxRows || 3;
  let size = o.size, rows;
  for (;;) {
    ctx.font = gradeFont(o.grade, size);
    const space = ctx.measureText(" ").width;
    rows = [[]];
    let x = 0;
    line.words.forEach((w, i) => {
      const ww = ctx.measureText(w.s).width;
      if (rows[rows.length - 1].length && x + space + ww > o.w) { rows.push([]); x = 0; }
      const row = rows[rows.length - 1];
      // "Alpha-WHATEVER": a word ending in a hyphen joins the next one
      if (row.length && !line.words[i - 1].s.endsWith("-")) x += space;
      row.push({ i, x, ww });
      x += ww;
    });
    rows.forEach(r => { r.width = r.length ? r[r.length - 1].x + r[r.length - 1].ww : 0; });
    if (rows.length <= maxRows || size <= (o.minSize || 40)) break;
    size *= 0.93;
  }
  const lh = size * lead, y0 = o.cy - (rows.length - 1) * lh / 2 + size * 0.32;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  if (o.bar) {
    const maxW = Math.max(...rows.map(r => r.width));
    const bx = align === "center" ? o.x - maxW / 2 : o.x;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(bx - size * 0.35, y0 - size * 0.95, maxW + size * 0.7, (rows.length - 1) * lh + size * 1.3);
  }
  ctx.font = gradeFont(o.grade, size);
  rows.forEach((r, ri) => {
    const rx = align === "center" ? o.x - r.width / 2 : o.x;
    for (const c of r) {
      const n = wordChars(line, c.i, t);
      if (n <= 0) continue;
      const s = line.words[c.i].s;
      ctx.fillStyle = isMachine(s) ? C.green : (o.color || C.paper);
      ctx.fillText(s.slice(0, n), rx + c.x, y0 + ri * lh);
    }
  });
  ctx.restore();
  return { size, rows: rows.length, y0, lh };
}

// one big word at a time, centred, on a bar
function bigWord(ctx, s, x, y, size, grade, k = 1) {
  ctx.save();
  ctx.font = gradeFont(grade, size);
  const ww = ctx.measureText(s).width;
  if (ww > W - 120) { size *= (W - 120) / ww; ctx.font = gradeFont(grade, size); }
  ctx.textAlign = "center";
  ctx.globalAlpha = k;
  ctx.fillStyle = isMachine(s) ? C.green : C.paper;
  ctx.fillText(s, x, y + size * 0.32);
  ctx.restore();
}

// ---------------------------------------------------------------- board

// cam: board point (li, lj) sits at screen (sx, sy), s pixels per cell
const cam = (sx, sy, s, li = 9, lj = 9) => ({ sx, sy, s, li, lj });
const BOOK = cam(1350, 540, 46);
const CENTER = cam(960, 452, 44);
const MID = cam(960, 540, 46);
const P = (c, i, j) => [c.sx + (i - c.li) * c.s, c.sy + (j - c.lj) * c.s];
const camLerp = (a, b, k) => cam(lerp(a.sx, b.sx, k), lerp(a.sy, b.sy, k), lerp(a.s, b.s, k), lerp(a.li, b.li, k), lerp(a.lj, b.lj, k));
const HOSHI = [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]];

// A hand-drawn line: a slight bow, drawn from its start up to prog.
function handLine(ctx, x0, y0, x1, y1, seed, prog = 1) {
  if (prog <= 0) return;
  const r = mulberry32(seed), bow = (r() - 0.5) * 3.2;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len * bow, ny = (x1 - x0) / len * bow;
  ctx.beginPath();
  const n = 12, m = Math.ceil(n * prog);
  for (let k = 0; k <= m; k++) {
    const u = Math.min(prog, k / n), b = 4 * u * (1 - u);
    const x = lerp(x0, x1, u) + nx * b, y = lerp(y0, y1, u) + ny * b;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

// o: { alpha, hand (0..1 drawing progress, staggered per line), panel, from (wiped left of x) }
function drawGrid(ctx, c, o = {}) {
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0) return;
  const hand = o.hand === undefined ? 1 : o.hand;
  const [x0, y0] = P(c, 0, 0), [x1, y1] = P(c, 18, 18);
  ctx.save();
  if (o.panel !== false) {
    ctx.globalAlpha = alpha * (o.panel === undefined ? 1 : o.panel) * clamp(hand * 3);
    ctx.fillStyle = C.panel;
    const pad = c.s * 0.9;
    ctx.fillRect(x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad);
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = o.color || C.line;
  ctx.lineWidth = Math.max(0.6, c.s / 34);
  for (let k = 0; k < N; k++) {
    // lines start one after another, alternating directions, like a ruled diagram
    const st = (k * 2) / (2 * N) * 0.75, pk = clamp((hand - st) / 0.25);
    const [ax, ay] = P(c, 0, k), [bx, by] = P(c, 18, k);
    handLine(ctx, ax, ay, bx, by, 300 + k, pk);
    const st2 = (k * 2 + 1) / (2 * N) * 0.75, pk2 = clamp((hand - st2) / 0.25);
    const [cx0, cy0] = P(c, k, 0), [cx1, cy1] = P(c, k, 18);
    handLine(ctx, cx0, cy0, cx1, cy1, 400 + k, pk2);
  }
  if (hand >= 0.95) {
    ctx.fillStyle = o.color || C.line;
    ctx.globalAlpha = alpha * clamp((hand - 0.95) * 20);
    for (const [i, j] of HOSHI) { const [x, y] = P(c, i, j); ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, c.s * 0.08), 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

// The human stone: a pencil circle, a little more than one turn, filled dark so
// it covers the grid like a real stone.
function handRing(ctx, x, y, r, seed, prog = 1, alpha = 1, color = C.paper, fill = C.ink) {
  if (prog <= 0 || alpha <= 0) return;
  const R = mulberry32(seed * 9973 + 17);
  const a1 = R() * 6.28, a2 = R() * 6.28, k1 = 0.035 + R() * 0.035, start = R() * 6.28;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (fill) {
    ctx.globalAlpha = alpha * clamp(prog * 2);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r * 0.97, 0, 7); ctx.fill();
    ctx.globalAlpha = alpha;
  }
  const turns = 1.12 * prog, n = Math.max(3, Math.ceil(40 * turns));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = start + turns * 2 * Math.PI * i / n;
    const rr = r * (1 + k1 * Math.sin(2 * a + a1) + 0.025 * Math.sin(3 * a + a2)) * (1 + 0.05 * i / n);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.1, r * 0.1); ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

// A captured human stone: the pencil circle breaks into arcs that fly apart.
function brokenRing(ctx, x, y, r, seed, k, color = C.paper) {
  if (k >= 1) return;
  const R = mulberry32(seed * 31 + 5);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.1, r * 0.1); ctx.lineCap = "round";
  ctx.globalAlpha = 1 - k;
  for (let a = 0; a < 4; a++) {
    const a0 = a * Math.PI / 2 + R() * 0.4, dir = a0 + Math.PI / 4;
    const d = outCubic(k) * r * (1.4 + R() * 1.6);
    ctx.beginPath();
    ctx.arc(x + Math.cos(dir) * d, y + Math.sin(dir) * d + inCubic(k) * r * 3, r, a0, a0 + Math.PI / 2 - 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function stones(ctx, pts, r, color, alpha = 1) {
  if (!pts.length || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();
  for (const [x, y, k] of pts) {
    const rr = r * (k === undefined ? 1 : k);
    if (rr <= 0.2) continue;
    ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 2 * Math.PI);
  }
  ctx.fill();
  ctx.restore();
}

const pop = (t, t0, d = 0.09) => t < t0 ? 0 : outCubic((t - t0) / d) * (1 + 0.18 * Math.sin(clamp((t - t0) / (d * 2.5)) * Math.PI));

// ---------------------------------------------------------------- the human's annotations

const RINGS = [[3, 3, 0.70], [15, 3, 1.12], [3, 15, 1.44], [15, 15, 2.24], [9, 15, 14.02]];
// Annotation texts are the human's handcrafted knowledge: Go proverbs and features.
const NOTES = [
  { i: 3, j: 3, dx: 0.7, dy: -1.25, text: "Ecke, Seite, Mitte", t: 2.24 },
  { i: 15, j: 15, dx: -6.2, dy: 2.55, text: "Freiheiten, Augen, Form", t: 7.06 },
  { i: 6, j: 11, dx: -0.4, dy: -2.9, text: "Einfluss wird Gebiet", t: 14.02 },
];
const LETTERS = [["a", 16, 12, 6.16], ["b", 12, 16, 6.7], ["c", 12, 12, 7.5]];

function noteFont(grade, s) { return gradeFont(grade, Math.round(s * 0.78)); }

// o: { alpha, grade, letters, arrow, region, notes, eraseX, color, fall }
function drawNotes(ctx, c, t, o) {
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0) return;
  ctx.save();
  if (o.eraseX !== undefined) { ctx.beginPath(); ctx.rect(o.eraseX, 0, W, H); ctx.clip(); }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = o.color || C.paper; ctx.fillStyle = o.color || C.paper;
  ctx.lineWidth = 1.6; ctx.lineCap = "round";
  // over a filled board the notes need a dark halo to stay legible

  const g = o.grade || 0, at = o.at || (x => x);
  if (o.letters !== false) {
    for (const [ch, i, j, t0] of LETTERS) {
      if (t < at(t0)) continue;
      const [x, y] = P(c, i, j);
      ctx.font = noteFont(g, c.s * 1.05); ctx.textAlign = "center";
      fallText(ctx, ch, x, y + c.s * 0.25, t, o.fall, i * 7 + j);
      ctx.textAlign = "left";
    }
  }
  if (o.region !== false) {
    // "optimieren": an arrow out of the lower stone; "theoretisieren": a dashed area of influence
    const ka = span(t, at(11.26), at(11.26) + 0.7);
    if (ka > 0) {
      const [ax, ay] = P(c, 3, 15), [bx, by] = P(c, 7, 12.4);
      ctx.beginPath();
      const n = Math.ceil(16 * ka);
      for (let k = 0; k <= n; k++) {
        const u = Math.min(ka, k / 16), x = lerp(ax, bx, u) + Math.sin(u * Math.PI) * c.s * 0.9, y = lerp(ay, by, u) + Math.sin(u * Math.PI) * c.s * 0.7;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x + c.s * 0.5, y - c.s * 0.4);
      }
      ctx.stroke();
      if (ka >= 1) {
        ctx.beginPath(); ctx.moveTo(bx - c.s * 0.45, by + c.s * 0.05); ctx.lineTo(bx, by); ctx.lineTo(bx - c.s * 0.05, by + c.s * 0.45); ctx.stroke();
      }
    }
    const kr = span(t, at(12.48), at(12.48) + 1.0);
    if (kr > 0) {
      const [cx, cy] = P(c, 6, 11);
      ctx.setLineDash([c.s * 0.18, c.s * 0.22]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.s * 3.3, c.s * 2.2, -0.3, -1.2, -1.2 + kr * 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (o.notes !== false) {
    for (const n of NOTES) {
      if (t < at(n.t)) continue;
      const [x, y] = P(c, n.i + n.dx, n.j + n.dy);
      ctx.font = noteFont(g, c.s);
      const full = n.text, k = span(t, at(n.t), at(n.t) + 0.6);
      if (o.halo && (o.fall === undefined || t < o.fall)) {
        ctx.save();
        ctx.shadowBlur = 0; ctx.fillStyle = "rgba(0,0,0,0.86)";
        ctx.fillRect(x - 10, y - c.s * 0.72, ctx.measureText(full).width + 20, c.s * 1.0);
        ctx.restore();
      }
      fallText(ctx, full.slice(0, Math.round(full.length * k)), x, y, t, o.fall, n.i * 3 + n.j);
    }
  }
  ctx.restore();
}

// Text whose glyphs drop away one by one after fall (a time), for "Brain Rot".
function fallText(ctx, s, x, y, t, fall, seed) {
  if (fall === undefined || t < fall) { ctx.fillText(s, x, y); return; }
  const r = mulberry32(seed * 101 + 3);
  const align = ctx.textAlign;
  let cx = align === "center" ? x - ctx.measureText(s).width / 2 : x;
  ctx.textAlign = "left";
  for (const ch of s) {
    const d = Math.max(0, t - fall - r() * 0.5);
    ctx.save();
    ctx.translate(cx, y + 2600 * d * d);
    ctx.rotate(d * (r() - 0.5) * 6);
    ctx.globalAlpha *= 1 - clamp(d * 1.4);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += ctx.measureText(ch).width;
  }
  ctx.textAlign = align;
}

// Chart reading of the board: years along the bottom, decades up the side.
function drawAxes(ctx, c, k) {
  if (k <= 0) return;
  const [x0, y1] = P(c, 0, 18), [x1] = P(c, 18, 18), [, y0] = P(c, 18, 0);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.font = '400 17px "Space Mono"'; ctx.fillStyle = C.paperDim;
  ctx.textAlign = "center";
  ctx.fillText("1952", x0, y1 + c.s * 0.9 + 14);
  ctx.fillText("2024", x1, y1 + c.s * 0.9 + 14);
  ctx.fillText("Jahr", (x0 + x1) / 2, y1 + c.s * 0.9 + 14);
  ctx.translate(x1 + c.s * 0.9 + 22, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText("Rechenaufwand, log", 0, 0);
  ctx.restore();
}

// The compute line: one decade per four years, a straight line on the log chart.
function drawMoore(ctx, c, k, width = 3, over = 1.6) {
  if (k <= 0) return;
  const [ax, ay] = P(c, 0, 18), [bx, by] = P(c, 18 + over, -over);
  ctx.save();
  ctx.strokeStyle = C.green; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, k), lerp(ay, by, k)); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- shared orders

const ALL = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) ALL.push([i, j]);
function shuffled(seed) {
  const r = mulberry32(seed), a = ALL.slice();
  for (let k = a.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [a[k], a[m]] = [a[m], a[k]]; }
  return a;
}
const RANDOM = shuffled(7), SELF = shuffled(23), DOUBLE = shuffled(41), UNDER = shuffled(11).filter(([i, j]) => i + j > 18);

// AlphaFold: a chain folded on the lattice, as in the 2D lattice protein model.
const FOLD = (() => {
  for (let seed = 1; seed < 500; seed++) {
    const r = mulberry32(seed), path = [[9, 9]], seen = new Set(["9,9"]);
    let ok = true;
    while (path.length < 64 && ok) {
      const [i, j] = path[path.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b])
        .filter(([a, b]) => a >= 3 && a <= 15 && b >= 3 && b <= 15 && !seen.has(a + "," + b));
      if (!opts.length) { ok = false; break; }
      // prefer compact moves: neighbours that touch the chain fold it
      opts.sort((p, q) => contacts(q, seen) - contacts(p, seen) + (r() - 0.5) * 2.2);
      const nx = opts[0]; path.push(nx); seen.add(nx[0] + "," + nx[1]);
    }
    if (ok) return path;
  }
  return [[9, 9]];
  function contacts([a, b], seen) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([x, y]) => seen.has((a + x) + "," + (b + y))).length; }
})();

// ---------------------------------------------------------------- texture

const GRAIN = typeof document === "undefined" ? [] : Array.from({ length: 6 }, (_, i) => {
  const c = document.createElement("canvas"); c.width = 480; c.height = 270;
  const g = c.getContext("2d"), img = g.createImageData(480, 270), r = mulberry32(1000 + i);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = r() * 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
});
const SCAN = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = 1; c.height = 3;
  const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, 2, 1, 1);
  return c;
})();

function texture(ctx, t, amount, frozen) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(GRAIN[frozen ? 0 : Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount * 2.2);
  ctx.fillStyle = ctx.createPattern(SCAN, "repeat"); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// "COMPUTE SCHLÄGT JEDEN MENSCHEN": one board per human, tiled. The tile is a
// full green board with one captured human stone in the middle, pre-rendered at
// four sizes so the pattern never aliases when it gets small.
const TILE_CELL = 48, TILE_PERIOD = 21;
const TILES = typeof document === "undefined" ? [] : (() => {
  const big = document.createElement("canvas"); big.width = big.height = TILE_CELL * TILE_PERIOD;
  const g = big.getContext("2d");
  g.fillStyle = C.void; g.fillRect(0, 0, big.width, big.height);
  const c = cam(big.width / 2, big.height / 2, TILE_CELL);
  drawGrid(g, c, { panel: 1 });
  stones(g, ALL.filter(([i, j]) => i !== 9 || j !== 9).map(([i, j]) => P(c, i, j)), TILE_CELL * 0.44, C.green);
  stones(g, [P(c, 9, 9)], TILE_CELL * 0.44, C.green);
  handRing(g, ...P(c, 9, 9), TILE_CELL * 0.46, 909, 1, 1, C.paper, null);
  const out = [big];
  for (const size of [252, 64, 16]) {
    const s = document.createElement("canvas"); s.width = s.height = size;
    const sg = s.getContext("2d"); sg.imageSmoothingQuality = "high";
    sg.drawImage(out[out.length - 1], 0, 0, size, size);
    out.push(s);
  }
  return out;
})();

function drawField(ctx, s) {
  const period = TILE_PERIOD * s;
  let tile = TILES[0];
  for (const c of TILES) if (c.width >= period) tile = c;
  const pat = ctx.createPattern(tile, "repeat");
  pat.setTransform(new DOMMatrix().translate(W / 2 - period / 2, H / 2 - period / 2).scale(period / tile.width));
  ctx.save();
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- verse 1 and pre-chorus

// The board as a page of a Go book: the diagram on the right, the commentary
// (the lyrics) on the left. The human annotates by hand; at "Moore's Law" the
// diagram turns out to be a chart, and the green line appears.
function sceneBook(ctx, t) {
  const c = BOOK;
  const shout = span(t, TL.shout[0][1] - 0.1, TL.shout[0][1]);
  const loud = audioAt(AUDIO_RMS, t);
  ctx.save();
  if (t > 22.0) {
    // a beat-locked shove once the band is loud
    const b = beatPulse(t) * 2.5 * span(t, 22, 23);
    ctx.translate(0, b);
  }
  drawGrid(ctx, c, { hand: span(t, 0.0, 1.1), alpha: 1 - 0.45 * shout });
  drawAxes(ctx, c, span(t, 16.6, 17.3) * (1 - 0.6 * shout));

  // annotations go grey at "umsonst"
  const vain = span(t, 20.30, 21.0);
  const notesCol = mix(C.paper, C.paperDim, vain);
  drawNotes(ctx, c, t, { alpha: (1 - 0.8 * shout), grade: vain * 2, color: notesCol });

  const ringR = c.s * 0.44;
  const greenK = span(t, 16.10, 18.0);
  // the diagonal of stones, one per beat from the pre-chorus on
  const b0 = firstBeat(22.2);
  const diag = [];
  for (let k = 0; k < N; k++) {
    const tk = BEAT_T[b0 + k];
    if (t >= tk) diag.push([...P(c, k, 18 - k), pop(t, tk)]);
  }
  // under the line, filled in random order while the name is shouted
  const under = [];
  const u0 = TL.shout[0][1], u1 = L.chorus[0].t - 0.15;
  const nUnder = Math.floor(UNDER.length * inCubic(span(t, u0, u1)) ** 0.6);
  for (let k = 0; k < nUnder; k++) {
    const [i, j] = UNDER[k];
    under.push([...P(c, i, j), pop(t, u0 + (u1 - u0) * Math.pow((k + 1) / UNDER.length, 1 / 1.8))]);
  }
  const ringAt = (i, j) => RINGS.some(([a, b]) => a === i && b === j);
  for (const [i, j, t0] of RINGS) {
    const [x, y] = P(c, i, j);
    // the diagonal reaches the stones on it, the shout covers the ones under it
    let gone = Infinity;
    if (i + j === 18) gone = BEAT_T[b0 + i];
    const prog = span(t, t0, t0 + 0.35);
    if (t < gone) handRing(ctx, x, y, ringR, i * 19 + j, prog, 1, mix(C.paper, C.paperDim, vain * 0.5));
    else brokenRing(ctx, x, y, ringR, i * 19 + j, span(t, gone, gone + 0.5));
  }
  stones(ctx, under.filter((p, k) => !ringAt(...UNDER[k])), c.s * 0.44, C.green, 1 - 0.35 * shout);
  stones(ctx, diag, c.s * 0.44, C.green, 1 - 0.35 * shout);
  drawMoore(ctx, c, greenK, 3);
  ctx.restore();

  // commentary column
  const col = { x: 110, w: 760, size: 84, maxRows: 3 };
  const v = lineAt(L.v1, t);
  if (t < L.pre[0].t && v) {
    const i = L.v1.indexOf(v);
    setLine(ctx, v, t, { ...col, cy: 560, grade: i < 3 ? 0 : 1, alpha: 1 - 0.5 * span(t, v.e + 0.6, v.e + 1.2) });
  }
  if (t >= L.pre[0].t) {
    const fade = 1 - shout;
    setLine(ctx, L.pre[0], t, { ...col, cy: 470, grade: 1, alpha: fade });
    setLine(ctx, L.pre[1], t, { ...col, cy: 650, grade: 2, alpha: fade });
  }
  if (t >= TL.shout[0][1]) {
    let cur = TL.shout[0];
    for (const s of TL.shout) if (t >= s[1]) cur = s;
    const held = cur === TL.shout[TL.shout.length - 1];
    const grow = held ? span(t, cur[1], TL.shoutEnd) : 0;
    const g = held ? 4 + grow : 4;
    bigWord(ctx, cur[0], W / 2, 560, 330 * (1 + 0.12 * grow) * (1 + 0.04 * beatPulse(t)), g);
  }
  return loud;
}

// ---------------------------------------------------------------- chorus

const RASTER_END = 36.2;
function chorusStones(ctx, c, t) {
  const r = c.s * 0.44;
  const pulse = 1 + 0.06 * beatPulse(t);
  const out = [];
  const rings = [[3, 3], [15, 15], [9, 15]];
  const isRing = (i, j) => rings.some(([a, b]) => a === i && b === j);
  let col = C.green, ringsAlive = t < L.chorus[1].words[2].t;

  if (t < 39.68) {
    // game one: what the shout left, then a raster over everything else
    const t0 = L.chorus[0].t;
    ALL.forEach(([i, j], n) => {
      const pre = i + j >= 18;
      const tn = pre ? 0 : lerp(t0, RASTER_END, n / ALL.length);
      if (isRing(i, j)) {
        const cap = L.chorus[1].words[2].t;
        if (t >= cap + 0.25) out.push([...P(c, i, j), pop(t, cap + 0.25) * pulse]);
        return;
      }
      if (t >= tn) out.push([...P(c, i, j), (pre ? 1 : pop(t, tn, 0.06)) * pulse]);
    });
  } else if (t < 41.80) {
    // cleared row by row from the bottom on the second title
    const k = span(t, 39.68, 40.0);
    for (const [i, j] of ALL) if ((18 - j) / 19 >= k) out.push([...P(c, i, j), pulse]);
  } else if (t < L.chorus[4].words[1].t) {
    // brute force: every point in random order, accelerating
    const n = Math.floor(ALL.length * Math.pow(span(t, 41.80, 43.58), 1.6));
    for (let k = 0; k < n; k++) {
      const [i, j] = RANDOM[k];
      const tk = 41.80 + 1.78 * Math.pow((k + 1) / ALL.length, 1 / 1.6);
      out.push([...P(c, i, j), pop(t, tk, 0.07) * (t > 44.36 ? 1 + 0.25 * Math.exp(-(t - 44.36) / 0.12) : pulse)]);
    }
  } else if (t < L.chorus[4].words[2].t) {
    // AlphaZero: from nothing, from the centre outwards
    const rad = 13 * outCubic(span(t, 45.10, 46.1));
    for (const [i, j] of ALL) {
      const d = Math.hypot(i - 9, j - 9);
      if (d <= rad) out.push([...P(c, i, j), clamp((rad - d) * 1.5) * pulse]);
    }
  } else if (t < L.chorus[5].t) {
    // AlphaFold: everything off the chain goes, the chain folds in
    const fade = 1 - span(t, 46.30, 46.55);
    if (fade > 0) for (const [i, j] of ALL) out.push([...P(c, i, j), fade]);
    const n = Math.floor(FOLD.length * outCubic(span(t, 46.30, 47.2)));
    ctx.save();
    ctx.strokeStyle = C.green; ctx.lineWidth = c.s * 0.16; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    FOLD.slice(0, n).forEach(([i, j], k) => { const [x, y] = P(c, i, j); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.restore();
    stones(ctx, FOLD.slice(0, n).map(([i, j]) => P(c, i, j)), r * 0.62, C.green);
  } else if (t < 54.0) {
    // all of us: a hand-drawn stone on every point, then a green wave over them
    const w0 = L.chorus[5].t, w1 = L.chorus[5].words[2].t;
    const wave = smooth(span(t, w1, 53.5));
    for (const [i, j] of ALL) {
      const d = (i + (18 - j)) / 36;
      const tn = lerp(w0, w1 - 0.2, ((i * 7 + j * 13) % 19) / 19 * 0.5 + d * 0.5);
      const [x, y] = P(c, i, j);
      const filled = d <= wave * 1.04 - 0.02;
      if (!filled) handRing(ctx, x, y, r * 0.86, i * 19 + j, span(t, tn, tn + 0.3), 1, C.paper);
      else {
        const tf = w1 + (53.5 - w1) * d;
        out.push([x, y, pop(t, tf, 0.1)]);
      }
    }
  } else {
    // burns out: a hot front from the centre, then ash that falls
    const burn0 = L.chorus[6].t, burnOut = L.chorus[6].words[5].t;
    const pts = { hot: [], green: [], ash: [] };
    for (const [i, j] of ALL) {
      const d = Math.hypot(i - 9, j - 9) / 12.8;
      const tb = lerp(burn0 + 0.2, burnOut, d);
      let [x, y] = P(c, i, j);
      const fall = Math.max(0, t - 56.9 - ((i * 5 + j * 11) % 17) * 0.025);
      y += 2200 * fall * fall; x += Math.sin(i * 3 + j) * 60 * fall;
      if (t < tb) pts.green.push([x, y]);
      else if (t < tb + 0.16) pts.hot.push([x, y, 1.08]);
      else pts.ash.push([x, y, 0.9]);
    }
    stones(ctx, pts.green, r, C.green);
    stones(ctx, pts.hot, r, C.hot);
    stones(ctx, pts.ash, r, C.ash);
    return;
  }
  stones(ctx, out, r, col);
  if (ringsAlive || t < L.chorus[1].words[2].t + 0.6) {
    const cap = L.chorus[1].words[2].t;
    for (const [i, j] of rings) {
      const [x, y] = P(c, i, j);
      if (t < cap) handRing(ctx, x, y, r, i * 19 + j, 1, 1);
      else brokenRing(ctx, x, y, r, i * 19 + j, span(t, cap, cap + 0.55));
    }
  }
}

function sceneChorus(ctx, t) {
  // the slam into the chorus pulls the page together: board to the centre
  const k = smooth(span(t, 32.95, 33.3));
  const back = smooth(span(t, 57.0, 57.7));
  let c = camLerp(camLerp(BOOK, CENTER, k), BOOK, back);
  const flux = audioAt(AUDIO_FLUX, t);
  const shake = flux > 0.75 ? (flux - 0.75) * 14 : 0;
  ctx.save();
  ctx.translate(Math.sin(t * 91) * shake, Math.cos(t * 77) * shake);
  const burn = span(t, L.chorus[6].t, 56.6);
  drawGrid(ctx, c, { alpha: 1 - 0.6 * burn, panel: 1 - burn });
  drawMoore(ctx, c, 1, 3);
  chorusStones(ctx, c, t);
  ctx.restore();

  const cl = lineAt(L.chorus, t);
  if (cl && t < 57.6) {
    const i = L.chorus.indexOf(cl);
    const fade = 1 - span(t, 57.0, 57.5);
    if (cl.title) {
      const outLine = i === 6;
      setLine(ctx, cl, t, {
        x: W / 2, cy: outLine ? 900 : 470, w: outLine ? 1760 : 1800, size: outLine ? 150 : 250, grade: outLine ? 5 : 3,
        align: "center", maxRows: outLine ? 2 : 1, bar: true, alpha: fade, minSize: 80,
      });
    } else {
      setLine(ctx, cl, t, { x: W / 2, cy: 958, w: 1760, size: 140, grade: 4, align: "center", maxRows: 1, bar: true, minSize: 80 });
    }
  }
}

// ---------------------------------------------------------------- verse 2

const KASPAROV = { i: 11, j: 3, year: "1997", col: 11.25 };
const LEE = { i: 16, j: 2, year: "2016", col: 16 };

function sceneVerse2(ctx, t) {
  const V = L.v2;
  const compute = V[4].t;
  if (t >= compute) return sceneCompute(ctx, t);
  const c = BOOK;
  const r = c.s * 0.44;
  // "tabula rasa": an eraser crosses the whole frame and takes the grid with it
  const tabula = V[2].words[2].t, rasa = V[2].words[3].t;
  const eraseX = lerp(-200, W + 200, smooth(span(t, tabula, rasa)));
  const unsre = V[3].t, expertise = V[3].words[1].t, obsolet = V[3].words[3].t;
  const redraw = t >= unsre;

  ctx.save();
  if (!redraw) { ctx.beginPath(); ctx.rect(eraseX, 0, W, H); ctx.clip(); }
  const tpu = V[1].words[3].t, self = V[2].t;
  const gridA = t >= V[1].words[2].t && t < self ? 1 - 0.75 * span(t, V[1].words[2].t, tpu) : 1;
  if (!redraw) {
    drawGrid(ctx, c, { alpha: gridA });
    drawAxes(ctx, c, 1);
    drawMoore(ctx, c, 1, 3);
  } else {
    drawGrid(ctx, c, { hand: span(t, unsre, unsre + 0.6) });
    drawAxes(ctx, c, span(t, unsre + 0.3, unsre + 0.8));
  }

  if (t < tpu) {
    // two great players at their years; each falls on "fiel"
    for (const [p, t0, tf] of [[KASPAROV, V[0].t, V[0].words[1].t], [LEE, V[0].words[2].t, V[0].words[4].t]]) {
      if (t < t0) continue;
      const [x, y] = P(c, p.i, p.j), [tx, ty] = P(c, p.col, 18);
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - span(t, tf, tf + 0.4));
      ctx.strokeStyle = C.paperDim; ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty + c.s * 0.6); ctx.lineTo(tx, y + r * 1.3); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '400 17px "Space Mono"'; ctx.fillStyle = C.paper; ctx.textAlign = "center";
      ctx.fillText(p.year, tx, ty + c.s * 0.9 + 14 + 22);
      ctx.restore();
      const d = Math.max(0, t - tf);
      ctx.save();
      ctx.translate(x + d * 140, y + 2600 * d * d); ctx.rotate(d * 3);
      handRing(ctx, 0, 0, r * 1.25, p.i * 19 + p.j, span(t, t0, t0 + 0.3), 1);
      ctx.restore();
    }
    // "Keine Theorie": the book's annotations come back once and are wiped
    const keine = V[1].t, theorie = V[1].words[1].t;
    if (t >= keine) {
      const wipe = lerp(BOOK.sx - 9 * c.s - 60, BOOK.sx + 9 * c.s + 400, smooth(span(t, theorie, theorie + 0.7)));
      drawNotes(ctx, c, t, { alpha: span(t, keine, keine + 0.15), eraseX: wipe, at: () => 0 });
      ctx.save();
      ctx.beginPath(); ctx.rect(wipe, 0, W, H); ctx.clip();
      for (const [i, j] of RINGS) handRing(ctx, ...P(c, i, j), r, i * 19 + j, 1, span(t, keine, keine + 0.15));
      ctx.restore();
      if (t < theorie + 0.7) {
        ctx.fillStyle = C.paper; ctx.globalAlpha = 0.85;
        ctx.fillRect(wipe - 3, P(c, 0, -1)[1], 3, c.s * 20);
        ctx.globalAlpha = 1;
      }
    }
  } else if (t < self) {
    // "nur TPUs": the board becomes a systolic array, data entering as a diagonal wavefront
    const n = 32, [x0, y0] = P(c, 0, 0), size = 18 * c.s, cell = size / n;
    const tt = t - tpu;
    ctx.fillStyle = C.green;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const front = tt * 34 - (a + b);
      const v = front < 0 ? 0 : Math.exp(-front / 9) * 0.85 + 0.12 * (front > 0);
      if (v <= 0.02) continue;
      ctx.globalAlpha = v * span(tt, 0, 0.1);
      const s = cell * (0.35 + 0.4 * Math.exp(-Math.abs(front) / 3));
      ctx.fillRect(x0 + a * cell + (cell - s) / 2, y0 + b * cell + (cell - s) / 2, s, s);
    }
    ctx.globalAlpha = 1;
  } else if (!redraw) {
    // self-play: the machine plays both colours, faster and faster
    const tt = t - self;
    const n = Math.min(ALL.length, Math.floor(Math.pow(tt / 2.0, 1.5) * 150));
    const solid = [], hollow = [];
    for (let k = 0; k < n; k++) {
      const [i, j] = SELF[k];
      const tk = self + 2.0 * Math.pow((k + 1) / 150, 1 / 1.5);
      (k % 2 ? hollow : solid).push([...P(c, i, j), pop(t, tk, 0.06)]);
    }
    stones(ctx, solid, r, C.green);
    ctx.save();
    ctx.strokeStyle = C.green; ctx.lineWidth = 3;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    for (const [x, y, k] of hollow) { ctx.moveTo(x + r * 0.88 * k, y); ctx.arc(x, y, r * 0.88 * k, 0, 7); }
    ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    // "Unsre Expertise": the book returns, then decays and is struck through
    const decay = span(t, obsolet, obsolet + 0.7);
    drawNotes(ctx, c, t, { alpha: span(t, expertise, expertise + 0.3), grade: 6 * decay, at: () => 0, color: mix(C.paper, C.paperDim, decay) });
    for (const [i, j] of RINGS) handRing(ctx, ...P(c, i, j), r, i * 19 + j, span(t, expertise, expertise + 0.35), 1 - 0.5 * decay);
    const strike = span(t, obsolet, obsolet + 0.16);
    if (strike > 0) {
      const [ax, ay] = P(c, -0.8, 18.8), [bx, by] = P(c, 18.8, -0.8);
      ctx.save();
      ctx.strokeStyle = C.green; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, strike), lerp(ay, by, strike)); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  if (!redraw && t > tabula && t < rasa + 0.1) {
    ctx.fillStyle = C.paper; ctx.globalAlpha = 0.9; ctx.fillRect(eraseX - 4, 0, 4, H); ctx.globalAlpha = 1;
  }

  const v = lineAt(V, t);
  if (v) {
    const i = V.indexOf(v);
    setLine(ctx, v, t, { x: 110, cy: 560, w: 760, size: 92, grade: 3 + (i > 1 ? 1 : 0), maxRows: 3 });
  }
}

// COMPUTE fills the board in one beat; SCHLÄGT, JEDEN, MENSCHEN pull back until
// every human is one board among boards.
function sceneCompute(ctx, t) {
  const V = L.v2[4];
  const [w0, w1, w2, w3] = V.words.map(w => w.t);
  const c = camLerp(BOOK, MID, smooth(span(t, w0, w0 + 0.3)));
  const k = t < w1 ? 0 : t < w2 ? 0.55 * smooth(span(t, w1, w1 + 0.5)) : t < w3 ? lerp(0.55, 1.0, smooth(span(t, w2, w2 + 0.5)))
    : 1.0 + 1.25 * inCubic(span(t, w3, 75.5)) + 0.25 * span(t, w3, 75.5);
  const s = c.s * Math.pow(TILE_PERIOD, -k);
  const fade = 1 - smooth(span(t, 75.3, 76.4));
  ctx.save();
  ctx.globalAlpha = fade;
  if (t >= w1) drawField(ctx, s);
  if (s > 14) {
    const cc = cam(c.sx, c.sy, s);
    if (t >= w1) { ctx.fillStyle = C.void; const [x0, y0] = P(cc, -1.5, -1.5); ctx.fillRect(x0, y0, 21 * s, 21 * s); }
    drawGrid(ctx, cc, {});
    const pts = [];
    ALL.forEach(([i, j], n) => {
      const tn = lerp(w0, w0 + 0.42, n / ALL.length);
      if (t >= tn) pts.push([...P(cc, i, j), pop(t, tn, 0.06)]);
    });
    stones(ctx, pts, s * 0.44, C.green);
    handRing(ctx, ...P(cc, 9, 9), s * 0.46, 909, 1, 1, C.paper, null);
  }
  ctx.restore();
  // what remains when the field goes: a single intersection
  const cross = span(t, 75.6, 76.4);
  if (cross > 0) {
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.globalAlpha = cross;
    ctx.beginPath(); ctx.moveTo(W / 2 - 60, 520); ctx.lineTo(W / 2 + 60, 520); ctx.moveTo(W / 2, 460); ctx.lineTo(W / 2, 580); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  let cur = 0;
  V.words.forEach((w, i) => { if (t >= w.t) cur = i; });
  if (t < 75.6) {
    const word = V.words[cur].s, held = cur === 3 ? span(t, w3, 75.5) : 0;
    const size = 250 * (1 + 0.1 * held);
    ctx.save();
    ctx.font = gradeFont(5, size);
    const ww = Math.min(W - 120, ctx.measureText(word).width);
    ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.globalAlpha = 1 - span(t, 75.0, 75.6);
    ctx.fillRect(W / 2 - ww / 2 - 60, 540 - size * 0.75, ww + 120, size * 1.3);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 1 - span(t, 75.0, 75.6);
    bigWord(ctx, word, W / 2, 540, size, 5 + held);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- bridge

const BR = { y: 520, hx: 760, mx: 1160, r: 38 };
const ELEMENTS = [
  { x: BR.hx, z: "6", sym: "C", mass: "12,011" },
  { x: BR.mx, z: "14", sym: "Si", mass: "28,085" },
];
// log seconds, from a nanosecond to a few thousand years
const RULER = { x0: 140, x1: 1780, lo: -9, hi: 11 };
const rulerX = e => lerp(RULER.x0, RULER.x1, (e - RULER.lo) / (RULER.hi - RULER.lo));
// tensor-core tiles grow outward from the green stone, row by row around the line
const TILE_SLOTS = [[0, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1], [2, 0], [2, -1], [2, 1]];
const TICKS = [[-9, "ns"], [-6, "µs"], [-3, "ms"], [0, "s"], [4.94, "Tag"], [7.5, "Jahr"], [9.5, "Jahrhundert"]];

function sceneBridge(ctx, t) {
  const B = L.bridge;
  const tWir = B[0].t, tSil = B[0].words[2].t, tCarbon = B[1].t, tSilicon = B[1].words[2].t;
  const tFleisch = B[2].t, tTensor = B[2].words[2].t, tJh = B[3].t, tNano = B[3].words[2].t;
  const tUnd = B[4].t, tImmer = B[5].t;

  if (t >= tImmer) return sceneImmer(ctx, t);
  ctx.save();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
  // the intersection opens into one line of the board, later into the ruler
  const open = smooth(span(t, tWir - 0.2, tWir + 0.5));
  const ruler = smooth(span(t, tJh, tJh + 0.6)) * (1 - smooth(span(t, tUnd, tUnd + 0.4)));
  const half = lerp(60, 600, open);
  const lx0 = lerp(W / 2 - half, RULER.x0 - 40, ruler), lx1 = lerp(W / 2 + half, RULER.x1 + 40, ruler);
  if (t < tUnd + 0.2) {
    ctx.globalAlpha = 1 - span(t, tUnd, tUnd + 0.2);
    ctx.beginPath(); ctx.moveTo(lx0, BR.y); ctx.lineTo(lx1, BR.y); ctx.stroke();
    ctx.globalAlpha = (1 - open) * 1;
    ctx.beginPath(); ctx.moveTo(W / 2, BR.y - 60); ctx.lineTo(W / 2, BR.y + 60); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (ruler > 0) {
    ctx.save();
    ctx.globalAlpha = ruler;
    ctx.font = '400 18px "Space Mono"'; ctx.fillStyle = C.paperDim; ctx.textAlign = "center";
    for (let e = RULER.lo; e <= RULER.hi; e++) { const x = rulerX(e); ctx.beginPath(); ctx.moveTo(x, BR.y - 8); ctx.lineTo(x, BR.y + 8); ctx.stroke(); }
    for (const [e, label] of TICKS) ctx.fillText(label, rulerX(e), BR.y + 44);
    ctx.restore();
  }

  // the human stone: still at first, then carried along the ruler to the centuries
  let hx = BR.hx;
  hx = lerp(hx, rulerX(9.5), smooth(span(t, tJh, tJh + 0.9)));
  hx = lerp(hx, W / 2, smooth(span(t, tUnd - 0.1, tUnd + 0.35)));
  const capT = tUnd + (B[4].e - tUnd) * 0.95;
  const hr = lerp(BR.r, 64 * 0.44, smooth(span(t, tUnd - 0.1, tUnd + 0.35)));
  if (t < capT) handRing(ctx, hx, BR.y, hr, 76, span(t, tWir, tWir + 0.45), 1);
  else brokenRing(ctx, hx, BR.y, BR.r, 76, span(t, capT, capT + 0.6));

  // the machine side
  const tensor = span(t, tTensor, tTensor + 0.1);
  if (t >= tSil && t < tFleisch + 0.3) stones(ctx, [[BR.mx, BR.y, pop(t, tSil, 0.12)]], BR.r, C.green, 1 - span(t, tTensor - 0.1, tTensor));
  if (t >= tTensor && t < tUnd) {
    // tensor cores: 4 x 4 tiles, one more on every beat
    const b0 = firstBeat(tTensor), nb = beatIndex(t) - b0 + 1;
    const nTiles = clamp(1 + nb, 1, 9);
    const toNano = smooth(span(t, tNano, tNano + 0.6));
    const pts = [];
    for (let k = 0; k < nTiles; k++) {
      const [ox, oy] = TILE_SLOTS[k], tx = BR.mx - 51 + ox * 170, ty = BR.y - 51 + oy * 170;
      const born = k === 0 ? tTensor : BEAT_T[b0 + k - 1];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        let x = tx + a * 34, y = ty + b * 34;
        // to "Nanosekunden" they all rush to the far left end of the ruler
        const nx = rulerX(-9) + ((a + b * 4 + k * 16) % 12 - 6) * 3, ny = BR.y - 26 - ((a * 3 + b + k) % 9) * 7;
        x = lerp(x, nx, toNano); y = lerp(y, ny, toNano);
        pts.push([x, y, pop(t, born, 0.1) * lerp(1, 0.35, toNano)]);
      }
    }
    stones(ctx, pts, 13, C.green, tensor * (1 - span(t, tUnd - 0.3, tUnd)));
  }
  // carbon over silicon: group 14, the same column of the periodic table
  ELEMENTS.forEach((e, k) => {
    const t0 = k ? tSilicon : tCarbon;
    const a = span(t, t0, t0 + 0.4) * (1 - span(t, tFleisch, tFleisch + 0.4));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = k ? C.green : C.paper; ctx.lineWidth = 1.5;
    const s = 230, x = e.x - s / 2, y = BR.y - s / 2;
    ctx.strokeRect(x, y, s, s);
    ctx.fillStyle = k ? C.green : C.paper;
    ctx.font = '400 22px "Space Mono"'; ctx.fillText(e.z, x + 16, y + 34);
    ctx.font = '700 40px "Space Mono"'; ctx.fillText(e.sym, x + 16, y + s - 20);
    ctx.font = '400 18px "Space Mono"'; ctx.textAlign = "right"; ctx.fillText(e.mass, x + s - 14, y + s - 22);
    ctx.restore();
  });
  // "Und Fleisch verliert": a small board, and its four liberties taken one by one
  if (t >= tUnd - 0.1) {
    const k = smooth(span(t, tUnd - 0.1, tUnd + 0.35));
    const c = cam(W / 2, BR.y, 64, 9, 9);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    for (let d = -3; d <= 3; d++) {
      ctx.beginPath(); ctx.moveTo(...P(c, 6, 9 + d)); ctx.lineTo(...P(c, 12, 9 + d)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(...P(c, 9 + d, 6)); ctx.lineTo(...P(c, 9 + d, 12)); ctx.stroke();
    }
    ctx.restore();
    const libs = [[9, 8], [10, 9], [9, 10], [8, 9]], times = [tUnd, B[4].words[1].t, B[4].words[2].t, B[4].words[2].t + 0.62];
    stones(ctx, libs.map(([i, j], n) => t >= times[n] ? [...P(c, i, j), pop(t, times[n], 0.1)] : null).filter(Boolean), 64 * 0.44, C.green);
  }
  ctx.restore();

  const l = lineAt(B, t);
  if (l) {
    const i = B.indexOf(l);
    const grade = [0, 0, 1, 2, 4][i];
    setLine(ctx, l, t, { x: W / 2, cy: 820, w: 1500, size: [76, 76, 84, 96, 120][i], grade, align: "center", maxRows: 1 });
  }
}

// "Immer. Und. Immer. Wieder": four hard cuts, four captures, the board greener each time
function sceneImmer(ctx, t) {
  const l = L.bridge[5];
  let cur = 0;
  l.words.forEach((w, i) => { if (t >= w.t) cur = i; });
  const t0 = l.words[cur].t;
  const c = cam(960, 540, 48);
  drawGrid(ctx, c, { panel: 0.8 });
  const r = c.s * 0.44;
  const spots = [[5, 6], [13, 12], [6, 13], [12, 5]];
  const [si, sj] = spots[cur];
  const libs = [[si, sj - 1], [si + 1, sj], [si, sj + 1], [si - 1, sj]];
  const filled = [];
  const density = [0.06, 0.18, 0.34, 0.55][cur];
  RANDOM.slice(0, Math.floor(ALL.length * density)).forEach(([i, j]) => {
    if (Math.abs(i - si) + Math.abs(j - sj) > 1) filled.push(P(c, i, j));
  });
  stones(ctx, filled, r, C.green, 0.55);
  stones(ctx, libs.map(([i, j]) => P(c, i, j)), r, C.green);
  brokenRing(ctx, ...P(c, si, sj), r, 80 + cur, span(t, t0 + 0.06, t0 + 0.5));
  const size = [160, 160, 180, 220][cur];
  const word = l.words[cur].s;
  ctx.save();
  ctx.font = gradeFont(3 + cur, size);
  const ww = ctx.measureText(word).width;
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(W / 2 - ww / 2 - 50, 900 - size * 0.75, ww + 100, size * 1.25);
  ctx.restore();
  bigWord(ctx, word, W / 2, 900, size, 3 + cur);
  const out = span(t, 94.6, 95.0);
  if (out > 0) { ctx.fillStyle = C.void; ctx.globalAlpha = out; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ---------------------------------------------------------------- verse 3

// Sisyphus: the board tilts into a loss landscape. A hill and a valley, in cells.
const HILL = { i: 11, j: 4 }, VALLEY = { i: 3, j: 10 };
const height = (i, j) => 5.2 * Math.exp(-((i - HILL.i) ** 2 + (j - HILL.j) ** 2) / 22) - 1.6 * Math.exp(-((i - VALLEY.i) ** 2 + (j - VALLEY.j) ** 2) / 14);

function project(c, i, j, z, tilt) {
  const X = (i - 9) * c.s, Y = (j - 9) * c.s, Z = z * c.s;
  const q = Y * Math.sin(tilt) + Z * Math.cos(tilt);
  const sc = 2400 / (2400 - q);
  return [c.sx + X * sc, c.sy + (Y * Math.cos(tilt) - Z * Math.sin(tilt)) * sc, sc];
}

// position of the stone between valley (0) and summit (1)
function sisyphusU(t) {
  const V = L.v3;
  const push = V[5].words[1].t, top = V[6].t, roll = V[6].words[2].t, again = V[6].words[3].t;
  if (t < push) return 0;
  if (t < top) return 0.9 * smooth(span(t, push, top)) ** 0.8;
  if (t < roll) return 0.9 + 0.08 * span(t, top, roll) + 0.01 * Math.sin(t * 40);
  if (t < again) {
    const k = span(t, roll, roll + 0.85);
    return k < 1 ? 0.98 * (1 - inCubic(k)) : 0.05 * Math.abs(Math.sin((t - roll - 0.85) * 9)) * Math.exp(-(t - roll - 0.85) * 4);
  }
  if (t < 113.7) return 0.82 * smooth(span(t, again, 113.7)) ** 0.8;
  return 0.82 * (1 - inCubic(span(t, 113.7, 114.45)));
}

function landscape(ctx, c, t, tilt, amp) {
  ctx.save();
  ctx.strokeStyle = mix(C.line, C.paperDim, 0.5); ctx.lineWidth = 1.4;
  for (let a = 0; a < N; a++) {
    for (const dir of [0, 1]) {
      ctx.beginPath();
      for (let b = 0; b <= 36; b++) {
        const u = b / 2, [i, j] = dir ? [a, u] : [u, a];
        const [x, y] = project(c, i, j, amp * height(i, j), tilt);
        b ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function gradients(ctx, c, t, tilt, amp, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = C.green; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.globalAlpha = k;
  for (let i = 1; i < N - 1; i += 2) for (let j = 1; j < N - 1; j += 2) {
    const gx = (height(i + 0.1, j) - height(i - 0.1, j)) / 0.2, gy = (height(i, j + 0.1) - height(i, j - 0.1)) / 0.2;
    const m = Math.hypot(gx, gy);
    if (m < 0.08) continue;
    const len = Math.min(1.1, m * 0.9) * k;
    const ei = i - gx / m * len, ej = j - gy / m * len;
    const [x0, y0] = project(c, i, j, amp * height(i, j), tilt), [x1, y1] = project(c, ei, ej, amp * height(ei, ej), tilt);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.5) * 7, y1 - Math.sin(ang - 0.5) * 7);
    ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang + 0.5) * 7, y1 - Math.sin(ang + 0.5) * 7);
    ctx.stroke();
  }
  ctx.restore();
}

const BORDER = [[2, 10], [8, 10], [8, 16], [2, 16]];

function sceneVerse3(ctx, t) {
  const V = L.v3;
  let c = BOOK;
  const r = c.s * 0.44;
  const tPar = V[0].t, tMen = V[1].t, tBrain = [V[2].words[1].t, V[3].words[1].t];
  const tOpt = V[4].t, tGren = V[4].words[2].t, tFall = V[4].words[5].t;
  const tSis = V[5].t, tGrad = V[5].words[2].t;
  const flatten = 1 - smooth(span(t, 114.5, 115.25));
  const tilt = 1.0 * smooth(span(t, tSis - 0.3, tSis + 0.6)) * flatten;
  const amp = smooth(span(t, tSis - 0.1, tSis + 0.9)) * flatten;

  if (t >= tSis - 0.3 && (tilt > 0.001 || amp > 0.001)) {
    c = cam(c.sx, lerp(c.sy, 470, tilt), c.s);
    landscape(ctx, c, t, tilt, amp);
    gradients(ctx, c, t, tilt, amp, span(t, tGrad, tGrad + 0.5) * (1 - span(t, 114.6, 115.3)));
    const u = sisyphusU(t);
    const i = lerp(VALLEY.i, HILL.i, u), j = lerp(VALLEY.j, HILL.j, u);
    const [x, y, sc] = project(c, i, j, amp * height(i, j), tilt);
    handRing(ctx, x, y - r * sc * 1.2 * Math.sin(tilt), r * sc * 1.45, 310, span(t, tSis, tSis + 0.4), 1);
    // the stone in the flat board before it tilts, so it never pops in
    return lineV3(ctx, t);
  }

  drawGrid(ctx, c, { hand: span(t, 95.0, 95.9) });
  drawAxes(ctx, c, span(t, 95.3, 95.9));
  drawMoore(ctx, c, span(t, 95.5, 96.1), 3);
  // "Parameter verdoppeln sich": 1, 2, 4, 8 ... one doubling per beat
  const b0 = firstBeat(tPar - 0.05);
  const bi = beatIndex(t) - b0;
  const n = t < BEAT_T[b0] ? 0 : Math.min(ALL.length, Math.pow(2, bi));
  const inside = (i, j) => i >= BORDER[0][0] && i <= BORDER[1][0] && j >= BORDER[0][1] && j <= BORDER[2][1];
  const cleared = t >= tGren && t < tFall;
  const refill = span(t, tFall, tFall + 0.45);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const [i, j] = DOUBLE[k];
    const born = BEAT_T[b0 + (k ? Math.floor(Math.log2(k)) + 1 : 0)];
    if (inside(i, j)) {
      if (cleared) continue;
      if (t >= tFall) {
        const edge = Math.min(i - BORDER[0][0], BORDER[1][0] - i, j - BORDER[0][1], BORDER[2][1] - j) / 3;
        if (refill < edge) continue;
        pts.push([...P(c, i, j), pop(t, tFall + edge * 0.45, 0.08)]);
        continue;
      }
    }
    pts.push([...P(c, i, j), pop(t, born, 0.08)]);
  }
  // the human's book is back, and decays a grade per beat while the board fills
  const decay = clamp((beatIndex(t) - firstBeat(tMen)) / 6, 0, 1) * (t >= tMen ? 1 : 0);
  const ringsA = 1 - span(t, tSis - 0.55, tSis - 0.3);
  for (const [i, j] of RINGS) handRing(ctx, ...P(c, i, j), r, i * 19 + j, span(t, 95.6, 96.0), ringsA * (1 - 0.4 * decay), mix(C.paper, C.paperDim, decay));
  stones(ctx, pts, r, C.green, 1 - span(t, tSis - 0.55, tSis - 0.3));
  if (t >= tMen - 0.2 && t < tOpt + 0.5) {
    drawNotes(ctx, c, t, {
      alpha: span(t, tMen - 0.2, tMen + 0.2), grade: 6 * decay, at: () => 0, fall: tBrain[0], halo: true,
      color: mix(C.paper, C.paperDim, decay * 0.6),
    });
  }
  // "Optimiere für Grenzen": a hand-drawn border around a territory, broken on "fallen"
  if (t >= tOpt && t < tFall + 0.8) {
    const k = span(t, tOpt, tGren + 0.3), brk = span(t, tFall, tFall + 0.7);
    ctx.save();
    ctx.strokeStyle = C.paper; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.globalAlpha = 1 - brk;
    BORDER.forEach(([i, j], e) => {
      const [i2, j2] = BORDER[(e + 1) % 4];
      const seg = clamp(k * 4 - e);
      if (seg <= 0) return;
      const [x0, y0] = P(c, i - 0.5 * (e === 0 || e === 3) + 0.5 * (e === 1 || e === 2), j - 0.5 * (e < 2) + 0.5 * (e >= 2));
      const [x1, y1] = P(c, i2 - 0.5 * ((e + 1) % 4 === 0 || (e + 1) % 4 === 3) + 0.5 * ((e + 1) % 4 === 1 || (e + 1) % 4 === 2), j2 - 0.5 * ((e + 1) % 4 < 2) + 0.5 * ((e + 1) % 4 >= 2));
      ctx.save();
      const dir = mulberry32(e + 5);
      ctx.translate(brk * (dir() - 0.5) * 240, brk * brk * 500);
      ctx.rotate(brk * (dir() - 0.5) * 0.6);
      handLine(ctx, x0, y0, x1, y1, 700 + e, seg);
      ctx.restore();
    });
    ctx.restore();
  }
  lineV3(ctx, t);
}

function lineV3(ctx, t) {
  const V = L.v3;
  const v = lineAt(V, t);
  if (!v || t > 115.3) return;
  const i = V.indexOf(v);
  const fade = i === 6 ? 1 - span(t, 114.6, 115.25) : 1;
  const grade = [4, 4, 5, 6, 5, 5, 6][i];
  if (v.echo) {
    // delay echoes: the same words again, later, lower and worse
    for (let e = 3; e >= 1; e--) {
      const lag = e * 0.14;
      const ev = { ...v, words: v.words.map(w => ({ ...w, t: w.t + lag })), t: v.t + lag };
      setLine(ctx, ev, t, { x: 110 + e * 22, cy: 560 + e * 70, w: 760, size: 120, grade: 6, maxRows: 1, alpha: 0.5 / e, color: C.paperDim });
    }
    setLine(ctx, v, t, { x: 110, cy: 560, w: 760, size: 120, grade, maxRows: 1 });
    return;
  }
  setLine(ctx, v, t, { x: 110, cy: 560, w: 760, size: 88, grade, maxRows: 3, alpha: fade });
}

// ---------------------------------------------------------------- outro

// The climb: the camera rides the head of the compute line up the chart, past
// the edge of the board, decade after decade. The human stone stays behind.
const CLIMB0 = 117.0, CLIMB_K = 0.16, CLIMB_V0 = 0.32;
const climbU = t => t < CLIMB0 ? 0 : CLIMB_V0 * (Math.exp(CLIMB_K * (t - CLIMB0)) - 1) / CLIMB_K;
// Off the board the line bends upward: the slope grows with every column,
// so the climb turns into a wall. lineJ is the row of the line at column i.
const lineJ = i => i <= 18 ? 18 - i : -(i - 18) - (i - 18) ** 2 / 50;
const HEAD_AT = [1180, 400];

function isHumanCut(t) {
  return L.outro.some(l => l.human && t >= l.t && t < l.e + 0.3);
}

function outroCam(t) {
  const flat = cam(BOOK.sx, BOOK.sy, BOOK.s, 9, 9);
  if (isHumanCut(t)) return cam(760, 430, 46, VALLEY.i, VALLEY.j);
  const u = climbU(t);
  const s = lerp(46, 26, smooth(span(t, CLIMB0, 125)));
  const head = cam(HEAD_AT[0], HEAD_AT[1], s, 18 + u, lineJ(18 + u));
  // then the camera lets go of the head and frames the whole curve, lagging a
  // little, so at the end the head shoots out of the top of the frame
  const hl = 18 + climbU(t - 0.7);
  const bw = hl + 4, bh = 22 - lineJ(hl);
  const sf = Math.min((W - 300) / bw, (H - 180) / bh);
  const frame = cam(W / 2 + 80, H / 2 + 10, sf, (hl - 3) / 2, (lineJ(hl) + 19) / 2);
  const follow = camLerp(flat, head, smooth(span(t, 115.9, CLIMB0 + 0.1)));
  const k = smooth(span(t, 124.6, 128.4));
  if (k <= 0) return follow;
  // interpolate the scale in log space, so the pull-back feels even
  const c = camLerp(follow, frame, k);
  c.s = Math.exp(lerp(Math.log(follow.s), Math.log(frame.s), k));
  return c;
}

function sceneOutro(ctx, t) {
  const c = outroCam(t);
  const u = climbU(t), hi = 18 + u;
  // visible lattice window
  const iMin = Math.floor(c.li - c.sx / c.s) - 1, iMax = Math.ceil(c.li + (W - c.sx) / c.s) + 1;
  const jMin = Math.floor(c.lj - c.sy / c.s) - 1, jMax = Math.ceil(c.lj + (H - c.sy) / c.s) + 1;
  const boardOnly = t < 116.2;
  // when the cells get small, the lattice thins out to every n-th line like a chart grid
  const step = c.s >= 12 ? 1 : c.s >= 2.5 ? 5 : 25;
  ctx.save();
  const inf = span(t, 116.2, CLIMB0 + 0.4);
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(0.6, Math.min(1.4, c.s / 34));
  if (!boardOnly) {
    ctx.globalAlpha = 0.25 + 0.75 * inf;
    ctx.beginPath();
    for (let i = Math.ceil(iMin / step) * step; i <= iMax; i += step) { const [x] = P(c, i, 0); ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let j = Math.ceil(jMin / step) * step; j <= jMax; j += step) { const [, y] = P(c, 0, j); ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (c.s >= 4) drawGrid(ctx, c, { alpha: 1, panel: 1 - inf });
  else {
    // the old board, now one small square in the corner of the chart
    const [x0, y0] = P(c, 0, 0), [x1, y1] = P(c, 18, 18);
    ctx.strokeStyle = C.paperDim; ctx.lineWidth = 1.2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }

  // everything under the line, up to its head, is filled: stones while they
  // are big enough to read, then one area
  const area = 1 - span(c.s, 7, 12);
  if (area < 1) {
    const pts = [];
    for (let i = Math.max(iMin, 0); i <= Math.min(iMax, Math.floor(hi)); i++) {
      for (let j = Math.max(jMin, Math.ceil(lineJ(i) - 1e-9)); j <= jMax; j++) {
        if (boardOnly && (i > 18 || j > 18)) continue;
        if (i > 18 || j < 0 || t >= CLIMB0) {
          // stones off the old board appear as the head passes
          const passT = i > 18 ? CLIMB0 + Math.log(1 + (i - 18) * CLIMB_K / CLIMB_V0) / CLIMB_K : CLIMB0;
          pts.push([...P(c, i, j), pop(t, passT + 0.05, 0.12)]);
        } else pts.push([...P(c, i, j), 1]);
      }
    }
    stones(ctx, pts, c.s * 0.44, C.green, (t < CLIMB0 ? 0.6 * span(t, 115.3, 116.6) + 0.4 * span(t, 116.6, CLIMB0) : 1) * (1 - area));
  }
  const curve = (from) => {
    ctx.moveTo(...P(c, from, lineJ(from)));
    const d = Math.max(0.5, 2 / c.s);
    for (let i = from + d; i < hi; i += d) ctx.lineTo(...P(c, i, lineJ(i)));
    ctx.lineTo(...P(c, hi, lineJ(hi)));
  };
  const iStart = Math.max(iMin - 2, -60);
  if (area > 0) {
    ctx.save();
    ctx.globalAlpha = area * 0.92; ctx.fillStyle = C.green;
    ctx.beginPath();
    curve(Math.max(iStart, 0));
    ctx.lineTo(...P(c, hi, jMax + 2)); ctx.lineTo(...P(c, Math.max(iStart, 0), jMax + 2));
    ctx.fill();
    ctx.restore();
  }
  const [hx, hy] = P(c, hi, lineJ(hi));
  ctx.strokeStyle = C.green; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); curve(iStart); ctx.stroke();
  if (t >= CLIMB0) {
    const hr = Math.max(c.s, 9);
    ctx.fillStyle = C.green;
    ctx.globalAlpha = 0.25 + 0.2 * beatPulse(t);
    ctx.beginPath(); ctx.arc(hx, hy, hr * 0.9, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(hx, hy, hr * 0.5, 0, 7); ctx.fill();
  }
  // the human stone left in the valley where Sisyphus let go of it; it keeps its
  // size while the chart shrinks around it
  handRing(ctx, ...P(c, VALLEY.i, VALLEY.j), Math.max(c.s * 0.44, 7), 310, 1, 1);

  // chart labels ride along: years along the bottom, decades up the left side
  ctx.font = '400 15px "Space Mono"'; ctx.fillStyle = C.paperDim;
  ctx.globalAlpha = 0.85 * span(t, 116.4, CLIMB0);
  ctx.textAlign = "center";
  const ei = Math.max(1, Math.ceil(64 / c.s)), ej = Math.max(1, Math.ceil(26 / c.s));
  const ni = [1, 2, 5, 10, 25, 50, 100].find(n => n >= ei) || 100, nj = [1, 2, 5, 10, 25, 50, 100].find(n => n >= ej) || 100;
  for (let i = Math.max(0, Math.ceil(iMin / ni) * ni); i <= iMax; i += ni) {
    const [x] = P(c, i, 0);
    ctx.fillText(String(1952 + 4 * i), x, H - 22);
  }
  ctx.textAlign = "left";
  for (let j = Math.floor(18 / nj) * nj; j >= jMin; j -= nj) {
    if (j > jMax) continue;
    const [, y] = P(c, 0, j);
    ctx.fillText("1e" + (24 - j), 18, y + 5);
  }
  ctx.restore();

  const l = lineAt(L.outro, t);
  if (l && t < l.e + 1.6) {
    const i = L.outro.indexOf(l);
    if (l.human) {
      if (isHumanCut(t)) setLine(ctx, l, t, { x: 110, cy: 900, w: 1200, size: 130, grade: i === 4 ? 5 : 6, maxRows: 1, bar: true });
    } else {
      const last = i === 7;
      // each repetition is set a grade worse; once the chart is framed the
      // empty sky above the curve is the slot
      const grade = last ? 6 : Math.min(6, 3 + Math.floor(i / 2));
      const top = t >= 128.4;
      setLine(ctx, l, t, {
        x: 110, cy: top ? (last ? 230 : 190) : 860, w: last ? 1150 : 1100, size: last ? 150 : 124, grade,
        maxRows: last ? 2 : 1, bar: true, alpha: 1 - span(t, l.e + 1.0, l.e + 1.6),
      });
    }
  }
}

// ---------------------------------------------------------------- the cut, and getting up

function sceneVoid(ctx, t) {
  // "over," alone in the thin tail, then "hu-" breaks off: hard cut
  if (t >= TL.over && t < TL.hu[1]) {
    const k = span(t, TL.over, TL.over + 0.3);
    ctx.save();
    ctx.font = gradeFont(6, 120);
    const a = "over,", b = " hu-";
    const full = ctx.measureText(a + b).width;
    ctx.fillStyle = C.paperDim;
    const x = W / 2 - full / 2;
    ctx.fillText(a.slice(0, Math.round(a.length * k)), x, 580);
    if (t >= TL.hu[0]) ctx.fillText(b.slice(0, Math.round(b.length * span(t, TL.hu[0], TL.hu[0] + 0.2))), x + ctx.measureText(a).width, 580);
    ctx.restore();
  }
  const g = L.getUp;
  if (t >= g.t) {
    handRing(ctx, W / 2, 540, 50 * 0.44, 999, span(t, g.t, g.t + 0.35), 1);
    setLine(ctx, g, t, { x: W / 2, cy: 760, w: 1400, size: 96, grade: 0, align: "center", maxRows: 1 });
  }
}

// After the cut the human gets up: the board is drawn again by hand, and the
// game is played on, stone against stone, on the beat.
const END_CAM = cam(960, 540, 50);
const MOVES = [
  [15, 3], [3, 15], [15, 15], [3, 3], [16, 9], [9, 16], [2, 9], [9, 2], [13, 13], [5, 13],
  [13, 5], [5, 5], [11, 9], [9, 11], [7, 9], [9, 7], [14, 11], [4, 11], [11, 14], [11, 4],
  [6, 16], [16, 6], [12, 16], [2, 6], [17, 13], [6, 2], [10, 13], [8, 13],
];
const TROTZDEM_AT = () => BEAT_T[BEAT_T.length - 1];

function sceneEnd(ctx, t) {
  const c = END_CAM, r = c.s * 0.44;
  const back = TL.bandBack;
  drawGrid(ctx, c, { hand: span(t, back, back + 1.7) });
  handRing(ctx, ...P(c, 9, 9), r, 999, 1, 1);
  // moves on the beat from the third bar on, green first; the human has the last word
  const bEnd = BEAT_T.length - 1;
  const b0 = bEnd - MOVES.length + 1;
  const green = [];
  MOVES.forEach(([i, j], k) => {
    const tk = BEAT_T[b0 + k];
    if (t < tk) return;
    const human = (MOVES.length - 1 - k) % 2 === 0;
    if (human) handRing(ctx, ...P(c, i, j), r, i * 19 + j + 500, span(t, tk, tk + 0.3), 1);
    else green.push([...P(c, i, j), pop(t, tk, 0.08)]);
  });
  stones(ctx, green, r, C.green);
  // the last handcrafted note, written into the silence
  const tw = TROTZDEM_AT();
  if (t >= tw) {
    const [li, lj] = MOVES[MOVES.length - 1];
    const [x, y] = P(c, li, lj);
    ctx.save();
    ctx.strokeStyle = C.paper; ctx.fillStyle = C.paper; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const k = span(t, tw + 0.15, tw + 1.1);
    handLine(ctx, x + r * 1.1, y + r * 0.9, x + c.s * 1.9, y + c.s * 1.6, 901, clamp(k * 3));
    ctx.font = noteFont(0, c.s * 1.5);
    const s = "trotzdem";
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.globalAlpha = clamp(k * 3);
    ctx.fillRect(x + c.s * 1.85, y + c.s * 1.85 - c.s * 1.1, ctx.measureText(s).width + c.s * 0.4, c.s * 1.45);
    ctx.restore();
    ctx.fillText(s.slice(0, Math.round(s.length * clamp(k * 1.4 - 0.3))), x + c.s * 2.05, y + c.s * 1.85);
    ctx.restore();
  }
  // the get-up line clears as the band comes back
  const g = L.getUp;
  setLine(ctx, g, t, { x: W / 2, cy: 760, w: 1400, size: 96, grade: 0, align: "center", maxRows: 1, alpha: 1 - span(t, back, back + 0.25) });
}

// ---------------------------------------------------------------- main

function grainAmount(t) {
  if (t < 22) return 0.05;
  if (t < 75.5) return 0.09;
  if (t < 84) return 0.04;
  if (t < 143.2) return 0.08;
  if (t < TL.bandBack) return 0.04;
  return 0.07;
}
// the stillest stretch: "Wir gegen Silizium" until "Carbon"
const isStill = t => (t >= 76.4 && t < 80.1) || (t >= TL.cut && t < TL.bandBack) || t >= TL.bandEnd;

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.lineCap = "butt"; ctx.setLineDash([]);
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < 32.95) sceneBook(ctx, t);
  else if (t < 57.8) sceneChorus(ctx, t);
  else if (t < 75.6) sceneVerse2(ctx, t);
  else if (t < L.bridge[0].t - 0.2) sceneCompute(ctx, t);
  else if (t < 95.0) sceneBridge(ctx, t);
  else if (t < 115.3) sceneVerse3(ctx, t);
  else if (t < TL.cut) sceneOutro(ctx, t);
  else if (t < TL.bandBack) sceneVoid(ctx, t);
  else sceneEnd(ctx, t);
  texture(ctx, t, grainAmount(t), isStill(t));
}
