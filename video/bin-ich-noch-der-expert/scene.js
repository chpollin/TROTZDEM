// Bin ich noch der Expert? The whole video is drawScene(ctx, t), a pure
// function of time in seconds: no state survives between frames, so render.py
// can render frames in any order and in parallel. Lyric times and the beat grid
// come from timeline.js.
//
// The stage is the block diagram of a feedback control loop whose controller is
// a human, drawn as a technical schematic. Blue is the machine and nothing
// else: a block it has taken over, and every signal that has passed through
// such a block on its way round the loop.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", grid: "#1b1b21", wire: "#a2a2ab", wireDim: "#3a3a42", text: "#8a8a93",
  textHi: "#ececf0", ink: "#06060c",
  acc: "#5468ff",
};

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
const span = (t, a, b) => clamp((t - a) / (b - a));
// motion in whole steps, like a sprite: the schematic never glides
const stepped = (k, n = 8) => Math.floor(clamp(k) * n + 1e-9) / n;
const mod = (a, n) => ((a % n) + n) % n;

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;
function audioMean(arr, a, b) {
  let s = 0, n = 0;
  for (let i = Math.round(a * AUDIO_RATE); i < Math.round(b * AUDIO_RATE); i++) { s += arr[clamp(i, 0, arr.length - 1)] || 0; n++; }
  return n ? s / n / 99 : 0;
}

// ---------------------------------------------------------------- time

const WORDS = new Map();
function words(l) {
  let ws = WORDS.get(l);
  if (!ws) {
    ws = [...l.w.matchAll(/\s*(.+?)@(\d+(?:\.\d+)?)/g)].map(m => ({ s: m[1], t: +m[2] }));
    WORDS.set(l, ws);
  }
  return ws;
}
const wt = (l, i) => words(l)[i < 0 ? words(l).length + i : i].t;
const first = l => wt(l, 0);

function beatPos(t, sub = 1) {
  const g = t < GRID_B.first ? GRID_A : GRID_B;
  return (t - g.first) / g.period * sub;
}
// a hop per beat (or per sub-beat): quick move, then rest until the next beat
function hopPos(t, sub = 1, snap = 0.3) {
  const p = beatPos(t, sub), i = Math.floor(p);
  return i + outCubic((p - i) / snap);
}

const V1 = TL.v1, PRE = TL.pre, K1 = TL.chorus1, V2 = TL.v2, BR = TL.bridge, K2 = TL.chorus2, OUT = TL.outro;
const T_TOOL = wt(V1[0], 4), T_NACHT_WORD = wt(V1[0], 8);
const T_JAHRE = wt(V1[1], 2), T_GEMACHT = wt(V1[1], 7);
const T_FAEHIG = wt(V1[2], 6);
const T_VATER = wt(V1[3], 4), T_KIND = wt(V1[3], 8);
const T_CHATBOT = wt(PRE[0], 6), T_FEHLER = wt(PRE[1], 6);
const T_PLOT = first(PRE[2]) - 0.5;
const CH1 = first(K1[0]), CH1_END = first(V2[0]) - 1.6;
const T_AUGM = wt(K1[1], 3), T_ZUKUNFT = wt(K1[3], 2), T_GESEHEN = wt(K1[3], 4);
const T_VERSTEHT = wt(K1[5], 3), T_WOHIN = wt(K1[7], 3);
const T_SIE = first(V2[0]);
const T_CASS = first(V2[1]), T_RUH = wt(V2[1], 5);
const T_WELLE = wt(V2[2], 3), T_BRECHEN = wt(V2[2], 8);
const T_DISK = wt(V2[3], 2);
const BR_IN = V2[3].e;
const T_WIR = wt(BR[1], 5), T_FLIP1 = wt(BR[2], 4), T_FLIP2 = wt(BR[3], 3);
const T_WENN = first(BR[4]), T_UND = first(BR[5]), T_BEGINNT = wt(BR[5], 3);
const CH2 = first(K2[0]);
const T_UEBER = wt(K2[1], 1), T_HAENDEN = wt(K2[1], 2);
const T_MENSCH = wt(K2[3], 2), T_VERTEID = wt(K2[3], 5);
const T_ALLEIN = first(K2[5]), T_ANFANG = wt(K2[7], 1), T_ENDE = wt(K2[7], 4), T_ICHV = wt(K2[7], 5), T_VERSTEHS = wt(K2[7], 6);
const T_PLUS = 133.36;  // the onset under the cry
const T_OUT = first(OUT[0]);
// the outro: one block leaves the loop on the last word of every whispered line
const FALL = { welt: wt(OUT[0], -1) + 0.3, eye: wt(OUT[1], -1) + 0.2, hand: wt(OUT[2], -1), sum: wt(OUT[3], -1) };
const LETTER_FALL = [wt(OUT[4], -1), wt(OUT[3], -1) + 0.4, wt(OUT[2], -1) + 0.4];  // I, C, H
const LAST = first(TL.last), AUG = TL.aug;

// ---------------------------------------------------------------- geometry

// World coordinates equal screen coordinates under the resting camera. The
// loop lives in the upper two thirds; the lyric slot below it stays clean.
const BL = {
  ich: { x: 440, y: 235, w: 260, h: 130 },
  hand: { x: 860, y: 235, w: 260, h: 130 },
  welt: { x: 1280, y: 235, w: 260, h: 130 },
  eye: { x: 860, y: 565, w: 260, h: 110 },
};
const SUM = { x: 300, y: 300, r: 30 };
const FY = 300, BYY = 620, SIE_X = 1760;
const FULL = [[300, 300], [440, 300], [700, 300], [860, 300], [1120, 300], [1280, 300], [1540, 300], [1660, 300], [1660, 620], [1120, 620], [860, 620], [300, 620], [300, 330]];
// "Ich bin noch im Loop": at first the loop is only a short wire round the self
const SMALL = [[400, 300], [440, 300], [700, 300], [740, 300], [740, 300], [740, 300], [740, 300], [740, 300], [740, 440], [740, 440], [740, 440], [400, 440], [400, 300]];
const INTERIOR = { x: 330, y: 372, w: 1300, h: 186 };
const SLOT = { x: 120, w: 1680, y1: 905, y2a: 862, y2b: 952 };

function makePath(pts) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l); L += l;
  }
  return { pts, seg, L };
}
function pointOn(P, s) {
  s = clamp(s, 0, P.L);
  for (let i = 0; i < P.seg.length; i++) {
    if (s <= P.seg[i] || i === P.seg.length - 1) {
      const k = P.seg[i] ? clamp(s / P.seg[i]) : 0, a = P.pts[i], b = P.pts[i + 1];
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    }
    s -= P.seg[i];
  }
  return P.pts[P.pts.length - 1];
}
const inRect = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
// Arc ranges where the path runs inside a block. Pulses vanish inside and leave
// in the colour of the block they passed.
function rangesOf(P, rects) {
  const out = []; let cur = null;
  for (let s = 0; s <= P.L + 3; s += 3) {
    const [x, y] = pointOn(P, Math.min(s, P.L));
    const hit = rects.find(o => o.r && inRect(x, y, o.r));
    const key = hit ? hit.key : null;
    if (key !== (cur ? cur.key : null)) {
      if (cur) { cur.s1 = s; out.push(cur); }
      cur = key ? { key, s0: s } : null;
    }
  }
  if (cur) { cur.s1 = P.L + 1; out.push(cur); }
  return out;
}
const loopRects = () => [
  { key: "sum", r: { x: SUM.x - SUM.r, y: SUM.y - SUM.r, w: 2 * SUM.r, h: 2 * SUM.r } },
  ...Object.keys(BL).map(k => ({ key: k, r: BL[k] })),
];
const LOOP = makePath(FULL);
const LOOP_R = rangesOf(LOOP, loopRects());
// arc length of the loop at a corner point
const arcTo = i => LOOP.seg.slice(0, i).reduce((a, b) => a + b, 0);
const S_FEEDBACK = arcTo(7);
const GAP_X = 600, S_CUT = arcTo(10) + (FULL[10][0] - GAP_X - 30);

// pulses: o = { n, sub, hops (per lap), dir, colorOf(key) -> colour or null, base, size, alpha, skip(s) }
function drawPulses(ctx, P, R, t, o) {
  const dir = o.dir || 1, size = o.size || 14;
  const p = beatPos(t, o.sub), fr = p - Math.floor(p);
  const hp = hopPos(t, o.sub) * dir;
  const order = dir > 0 ? R : [...R].reverse();
  for (let i = 0; i < o.n; i++) {
    const s = mod(hp * P.L / o.hops + i * P.L / o.n + (o.offset || 0), P.L);
    if (R.some(r => s >= r.s0 && s < r.s1)) continue;
    if (o.skip && o.skip(s)) continue;
    // colour of the last coloured block passed in the direction of travel
    let col = null;
    const passed = order.filter(r => dir > 0 ? r.s1 <= s : r.s0 >= s);
    const seq = [...passed.reverse(), ...[...order].reverse()];
    for (const r of seq) { col = o.colorOf(r.key); if (col) break; }
    col = col || o.base;
    const moving = fr < 0.3;
    for (let k = moving ? 3 : 0; k >= 0; k--) {
      const ss = s - dir * k * 9;
      if (ss < 0 || ss > P.L || R.some(r => ss >= r.s0 && ss < r.s1)) continue;
      const [x, y] = pointOn(P, ss);
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (k ? 0.5 / k : 1);
      ctx.fillStyle = col;
      const sz = k ? size - 4 : size;
      ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- drawing kit

const MONO = (size, bold) => `${bold ? 700 : 400} ${size}px "Space Mono"`;
const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(g, 0, 6)]}"`;

function poly(ctx, pts, color, width = 2, upto = Infinity) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "miter"; ctx.lineCap = "butt";
  ctx.beginPath();
  let left = upto;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
    const k = l ? Math.min(1, left / l) : 1;
    ctx.lineTo(lerp(ax, bx, k), lerp(ay, by, k));
    left -= l;
  }
  ctx.stroke();
}
function arrow(ctx, x, y, ang, color, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -7); ctx.lineTo(-14, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function dashedRect(ctx, r, color, width = 1.5, dash = [10, 8], phase = 0) {
  ctx.save();
  ctx.setLineDash(dash); ctx.lineDashOffset = phase;
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w), Math.round(r.h));
  ctx.restore();
}
function text(ctx, s, x, y, font, color, align = "left") {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(s, x, y);
  ctx.textAlign = "left";
}
// "e^+sT": the part after ^ is set as a superscript
function formula(ctx, s, x, y, size, color, align = "center") {
  const [base, sup] = s.split("^");
  ctx.font = MONO(size); const wb = ctx.measureText(base).width;
  ctx.font = MONO(Math.round(size * 0.72)); const ws = sup ? ctx.measureText(sup).width : 0;
  const x0 = align === "center" ? x - (wb + ws) / 2 : x;
  text(ctx, base, x0, y, MONO(size), color);
  if (sup) text(ctx, sup, x0 + wb, y - size * 0.42, MONO(Math.round(size * 0.72)), color);
}

const GLYPHS = "∂∑∫λσ01ΔΩ≈∇⊗ψ¬∞";
// Captions nobody else can read any more: they change on every eighth.
function scramble(s, t, seed, on) {
  if (!on) return s;
  const r = mulberry32(seed * 7919 + Math.floor(beatPos(t, 2)));
  return [...s].map(ch => ch === " " ? " " : GLYPHS[Math.floor(r() * GLYPHS.length)]).join("");
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
// Machine share as an ordered dither: share 0 is the empty human block, 1 is
// solid blue, in between the blue enters from the right, the side of the tool.
function dither(ctx, r, share, cell = 6, jitter = 0, seed = 0) {
  if (share <= 0) return;
  ctx.fillStyle = C.acc;
  const nx = Math.floor(r.w / cell), ny = Math.floor(r.h / cell);
  const rnd = mulberry32(seed);
  for (let i = 0; i < nx; i++) {
    const s = share * 2 - (1 - i / (nx - 1));
    for (let j = 0; j < ny; j++) {
      const th = BAYER[(j % 4) * 4 + (i % 4)] + (jitter ? (rnd() - 0.5) * jitter : 0);
      if (th < s) ctx.fillRect(r.x + i * cell, r.y + j * cell, cell, cell);
    }
  }
}

// b: { r, name, role, tf, mode: "hum" | "neu" | "mac", fill (0..1), share, dashed, alpha, nameSize, pins }
function drawBlock(ctx, b) {
  const { r } = b;
  ctx.save();
  ctx.globalAlpha = b.alpha === undefined ? 1 : b.alpha;
  ctx.fillStyle = C.void; ctx.fillRect(r.x, r.y, r.w, r.h);
  const fill = stepped(b.fill || 0, 10);
  if (b.share) dither(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, b.share, 6, b.jitter || 0, b.seed || 0);
  if (fill > 0) { ctx.fillStyle = C.acc; ctx.fillRect(r.x, r.y, r.w * fill, r.h); }
  const edge = fill >= 1 ? C.acc : b.mode === "hum" ? C.textHi : b.mode === "mac" ? C.acc : C.wire;
  if (b.dashed) dashedRect(ctx, r, edge, 2, [8, 7]);
  else { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.strokeRect(Math.round(r.x) + 1, Math.round(r.y) + 1, Math.round(r.w) - 2, Math.round(r.h) - 2); }
  if (b.pins) {
    ctx.fillStyle = C.acc;
    for (let i = 0; i < b.pins; i++) {
      const top = i % 2 === 0, k = Math.floor(i / 2);
      const x = r.x + 26 + k * 42;
      ctx.fillRect(x, top ? r.y - 18 : r.y + r.h, 8, 18);
    }
  }
  const size = b.nameSize || 34;
  const cy = r.y + r.h / 2 + (b.tf ? -4 : size * 0.35);
  if (b.name) {
    const nameColor = b.mode === "neu" ? C.wire : C.textHi;
    ctx.font = MONO(size, true); ctx.textAlign = "center";
    if (b.share) { ctx.lineWidth = 8; ctx.strokeStyle = C.void; ctx.strokeText(b.name, r.x + r.w / 2, cy); }
    ctx.fillStyle = nameColor; ctx.fillText(b.name, r.x + r.w / 2, cy);
    if (fill > 0) {
      // the part of the name over the blue is printed in ink
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w * fill, r.h); ctx.clip();
      ctx.fillStyle = C.ink; ctx.fillText(b.name, r.x + r.w / 2, cy);
      ctx.restore();
    }
    ctx.textAlign = "left";
  }
  if (b.tf) {
    ctx.save();
    formula(ctx, b.tf, r.x + r.w / 2, cy + 34, 19, fill >= 1 ? C.ink : b.mode === "neu" ? C.text : C.text);
    ctx.restore();
  }
  if (b.role) text(ctx, b.role, r.x, r.y - (b.pins ? 26 : 9), MONO(17), C.text);
  ctx.restore();
}

// 5 x 7 pixel letters for what the band shouts back and for the scream
const PIX = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  Ö: ["01010", "01110", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};
// cells of a pixel word as [col, row]; width in columns
function pixCells(word) {
  const cells = []; let col = 0;
  for (const ch of word) {
    const g = PIX[ch];
    g.forEach((row, j) => [...row].forEach((b, i) => { if (b === "1") cells.push([col + i, j]); }));
    col += g[0].length + 1;
  }
  return { cells, cols: col - 1 };
}

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
const BUF = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
})();

function texture(ctx, t, amount, frozen) {
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

// ---------------------------------------------------------------- lyrics

// every line that is set in the slot, in order, with its damage grade
const SLOT_LINES = (() => {
  const out = [];
  TL.intro.forEach((l, i) => out.push({ l, g: i === 3 ? 4 : 3 }));
  V1.forEach(l => out.push({ l, g: 2 }));
  PRE.forEach(l => out.push({ l, g: 1 }));
  K1.forEach((l, i) => { if (i % 2) out.push({ l, g: 1 }); });
  V2.forEach(l => out.push({ l, g: 2 }));
  BR.forEach(l => out.push({ l, g: 3 }));
  K2.forEach((l, i) => { if (i % 2) out.push({ l, g: 2 }); });
  OUT.forEach((l, i) => out.push({ l, g: Math.min(6, 3 + i) }));
  return out.sort((a, b) => first(a.l) - first(b.l));
})();

function slotAt(t) {
  let i = -1;
  for (let j = 0; j < SLOT_LINES.length; j++) if (first(SLOT_LINES[j].l) <= t) i = j;
  if (i < 0) return null;
  const cur = SLOT_LINES[i], next = SLOT_LINES[i + 1];
  const end = Math.min(next ? first(next.l) : Infinity, cur.l.e + 1.1);
  if (t >= end) return null;
  // a line never crosses into the next section's first downbeat
  if (BR.includes(cur.l) && t >= CH2) return null;
  return { ...cur, alpha: next && first(next.l) <= cur.l.e + 1.1 ? 1 : 1 - span(t, cur.l.e + 0.7, cur.l.e + 1.1) };
}

// words revealed letter by letter, each within its own sung span
function revealed(ws, i, t) {
  const w = ws[i];
  if (t < w.t) return "";
  const d = Math.min(0.2, (ws[i + 1] ? ws[i + 1].t : w.t + 0.4) - w.t);
  return w.s.slice(0, Math.ceil(w.s.length * span(t, w.t, w.t + Math.max(0.04, d)) - 1e-9) || 1);
}

// lays out the whole line first, so a line being typed never moves or resizes
function drawSlot(ctx, l, t, grade, o = {}) {
  const ws = words(l);
  let size = o.size || 84;
  const maxW = o.maxW || SLOT.w;
  const layout = sz => {
    ctx.font = gradeFont(grade, sz);
    const sp = ctx.measureText(" ").width;
    const pos = []; let row = 0, x = 0;
    ws.forEach(w => {
      const wd = ctx.measureText(w.s).width;
      if (x > 0 && x + wd > maxW) { row++; x = 0; }
      pos.push({ row, x }); x += wd + sp;
    });
    return pos;
  };
  let pos = layout(size);
  if (pos[pos.length - 1].row > 0) { size = Math.min(size, 76); pos = layout(size); }
  const rows = pos[pos.length - 1].row + 1;
  const ys = o.ys || (rows === 1 ? [SLOT.y1] : [SLOT.y2a, SLOT.y2b, SLOT.y2b + 90]);
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.font = gradeFont(grade, size);
  let quote = false;
  ws.forEach((w, i) => {
    if (w.s.startsWith("„")) quote = true;
    const s = revealed(ws, i, t);
    ctx.fillStyle = quote ? C.text : (o.color || C.textHi);
    if (s) ctx.fillText(s, (o.x || SLOT.x) + pos[i].x, ys[pos[i].row]);
    if (w.s.endsWith("“")) quote = false;
  });
  ctx.restore();
}

// The chorus title sits inside the loop. With every repetition more of its
// letters are set by the machine: Space Mono in blue instead of Redaction.
const TITLE_ORDER = (() => {
  const idx = [...Array(18).keys()].filter(i => "EXPERT IN THE LOOP"[i] !== " ");
  const r = mulberry32(5150);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
})();
const TITLES = [K1[0], K1[2], K1[4], K1[6], K2[0], K2[2], K2[4], K2[6]];

function drawTitle(ctx, k, t, alpha, cx, base, maxW) {
  const l = TITLES[k], ws = words(l);
  const full = ws.map(w => w.s).join(" ");
  const mac = new Set(TITLE_ORDER.slice(0, Math.round(15 * k / 7)));
  const fontOf = (i, sz) => mac.has(i) ? MONO(sz, true) : gradeFont(1, sz);
  const widthAt = sz => [...full].reduce((a, ch, i) => { ctx.font = fontOf(i, sz); return a + ctx.measureText(ch).width; }, 0);
  let size = 132;
  size = Math.min(size, size * maxW / widthAt(size));
  let x = cx - widthAt(size) / 2, ci = 0;
  ctx.save(); ctx.globalAlpha = alpha;
  ws.forEach((w, wi) => {
    const shown = revealed(ws, wi, t).length;
    [...w.s].forEach((ch, j) => {
      ctx.font = fontOf(ci, size);
      if (j < shown) { ctx.fillStyle = mac.has(ci) ? C.acc : C.textHi; ctx.fillText(ch, x, base); }
      x += ctx.measureText(ch).width; ci++;
    });
    ctx.font = fontOf(ci, size); x += ctx.measureText(" ").width; ci++;
  });
  ctx.restore();
}
function titleAt(t) {
  for (let k = TITLES.length - 1; k >= 0; k--) {
    if (t >= first(TITLES[k])) {
      const end = k === 3 ? CH1_END : k === 7 ? 132.8 : first(TITLES[k + 1]);
      return t < end ? { k, alpha: 1 - span(t, end - 0.4, end) * (k === 3 || k === 7 ? 1 : 0) } : null;
    }
  }
  return null;
}

// shouted words, stamped in pixels and dropping out cell by cell
function drawStamp(ctx, s, t) {
  const a = t - s.t;
  if (a < 0 || t > s.e) return;
  const { cells, cols } = pixCells(s.q);
  const cell = 36, x0 = Math.round((W - cols * cell) / 2), y0 = 340;
  // swept away column by column, the black plate under it with them
  const sweep = cols * span(a, 0.45, s.e - s.t);
  const c0 = Math.floor(sweep);
  ctx.fillStyle = C.void;
  if (c0 < cols) ctx.fillRect(x0 + c0 * cell - 30, y0 - 30, (cols - c0) * cell + 60, 7 * cell + 56);
  ctx.fillStyle = s.c === "acc" ? C.acc : C.textHi;
  for (const [i, j] of cells) {
    if (a < (i / cols) * 0.08 || i < c0) continue;
    ctx.fillRect(x0 + i * cell, y0 + j * cell, cell - 4, cell - 4);
  }
}

// ---------------------------------------------------------------- camera

const applyCam = (ctx, c) => { ctx.translate(W / 2, H / 2); ctx.scale(c.s, c.s); ctx.translate(-c.x, -c.y); };
function drawGrid(ctx, cam, alpha) {
  if (alpha <= 0) return;
  const x0 = cam.x - W / 2 / cam.s, x1 = cam.x + W / 2 / cam.s, y0 = cam.y - H / 2 / cam.s, y1 = cam.y + H / 2 / cam.s;
  ctx.fillStyle = C.grid; ctx.globalAlpha = alpha;
  for (let x = Math.floor(x0 / 40) * 40; x <= x1; x += 40)
    for (let y = Math.floor(y0 / 40) * 40; y <= y1; y += 40) ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the loop

// The band's entry builds the schematic on its hits, one element per onset.
const BUILD_KEYS = ["grid", "sum", "in", "hand", "welt", "out", "eye", "branch", "sig", "roles", "tfs", "bound"];
const BUILD_T = (() => {
  const out = {}; let last = TL.bandIn + 0.5, i = 0;
  for (const o of AUDIO_ONSETS) {
    if (i >= BUILD_KEYS.length) break;
    if (o >= last + 0.6 && o < 21.5) { out[BUILD_KEYS[i++]] = o; last = o; }
  }
  while (i < BUILD_KEYS.length) out[BUILD_KEYS[i++]] = 21.5;
  return out;
})();
// appears with a short flicker on its hit
function vis(key, t) {
  const a = BUILD_T[key];
  if (t < a) return 0;
  if (t > a + 0.12) return 1;
  return Math.floor((t - a) / 0.04) % 2 ? 0.25 : 1;
}

// the dashed boundary of what counts as "ich"
const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const union = (...rs) => {
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
  return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
};
const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const BOUND = [
  [0, pad(BL.ich, 32)],
  [T_NACHT_WORD, pad(union(BL.ich, BL.hand), 32)],
  [T_GESEHEN, pad(union(BL.ich, BL.hand, BL.eye), 32)],
  [CH2 - 0.01, { x: 236, y: 186, w: 1478, h: 524 }],
];
function boundAt(t) {
  let r = BOUND[0][1];
  for (let i = 1; i < BOUND.length; i++) r = lerpRect(r, BOUND[i][1], stepped(span(t, BOUND[i][0], BOUND[i][0] + 0.4), 6));
  return r;
}

// how much of the controller the machine holds
function ichShare(t) {
  if (t < T_AUGM) return 0;
  if (t < CH2) return lerp(0, 0.28, stepped(span(t, T_AUGM, T_AUGM + 0.6), 4)) + 0.08 * stepped(span(t, T_SIE, T_SIE + 4), 4);
  return lerp(0.55, 1.02, stepped(span(t, T_MENSCH, T_VERTEID + 0.6), 12));
}

function loopCam(t) {
  if (t < TL.bandIn) return { x: 570, y: 372, s: 1.5 };
  if (t < T_PLOT) {
    const k = smooth(span(t, TL.bandIn, TL.bandIn + 1.6));
    return { x: lerp(570, 960, k), y: lerp(372, 540, k), s: lerp(1.5, 1, k) };
  }
  if (t < CH1) {
    // down to the plot under the schematic, then out along the curve
    const k = smooth(span(t, T_PLOT, T_PLOT + 0.55)), z = smooth(span(t, first(TL.kurve), first(TL.kurve) + 0.9));
    const rise = smooth(span(t, first(TL.kurve) + 0.9, CH1));
    return { x: lerp(lerp(960, 990, k), 1050, z), y: lerp(lerp(540, 1200, k), 700, z) - 90 * rise, s: lerp(1, 0.78, z) };
  }
  // a small push on every "EXPERT"
  const ti = titleAt(t);
  const push = ti ? 0.03 * (1 - outCubic(span(t, first(TITLES[ti.k]), first(TITLES[ti.k]) + 0.7))) : 0;
  return { x: 960, y: 540, s: 1 + push };
}

function blockState(key, t) {
  const r = BL[key];
  const sc = t >= T_VERSTEHT && t < BR_IN || t >= T_VERSTEHS && t < T_PLUS + 0.2;
  if (key === "ich") {
    const share = ichShare(t);
    const pins = t >= T_FAEHIG && t < BR_IN || t >= CH2 && t < T_OUT ? Math.min(12, 1 + Math.floor((t - T_FAEHIG) / 0.2)) : 0;
    // fully taken, the controller prints its name in ink like every other machine block
    return { r, name: "ICH", role: scramble("Regler", t, 1, sc), tf: scramble("G_R(s)", t, 2, sc), mode: "hum", share: share >= 1 ? 0 : share, fill: share >= 1 ? 1 : 0, pins, seed: 3 };
  }
  if (key === "hand") {
    const tool = t >= T_TOOL;
    return {
      r, name: tool ? scramble("WERKZEUG", t, 4, sc) : "HÄNDE", role: t >= T_UEBER ? null : scramble("Stellglied", t, 5, sc),
      tf: tool ? scramble(t < T_GEMACHT ? "T = 3 a" : "T = 8 h", t, 6, sc) : "G_H(s)",
      mode: tool ? "mac" : "hum", fill: tool ? span(t, T_TOOL, T_TOOL + 0.35) : 0,
    };
  }
  if (key === "welt") {
    const cry = span(t, T_PLUS, T_PLUS + 0.4);
    return { r, name: scramble("WELT", t, 7, sc && t < T_PLUS), role: scramble("Strecke", t, 8, sc), tf: scramble("K/(1+sT)", t, 9, sc), mode: cry > 0 ? "mac" : "neu", fill: cry };
  }
  const prog = t >= T_ZUKUNFT;
  return {
    r, name: prog ? scramble("PROGNOSE", t, 10, sc) : "AUGEN", role: scramble("Messglied", t, 11, sc),
    tf: prog ? scramble("e^+sT", t, 12, sc) : "G_M(s)", mode: prog ? "mac" : "hum", fill: prog ? span(t, T_ZUKUNFT, T_ZUKUNFT + 0.35) : 0,
  };
}
const blockColor = (key, t) => {
  if (key === "sum") return null;
  const b = blockState(key, t);
  if (key === "ich") return mix(C.textHi, C.acc, stepped(b.share, 4));
  return b.mode === "mac" || (b.fill || 0) >= 1 ? C.acc : b.mode === "hum" ? C.textHi : null;
};

// a block that leaves the loop in the outro: drops with gravity, in whole pixels
function fallOffset(key, t) {
  const tf = FALL[key];
  if (!tf || t < tf) return null;
  const a = t - tf, r = mulberry32(key.length * 97);
  return { dx: Math.round((r() - 0.5) * 120 * a), dy: Math.round(900 * a * a), rot: (r() - 0.5) * 0.9 * a };
}

function sceneLoop(ctx, t) {
  const cam = loopCam(t);
  const intro = t < 22.5;
  const v = k => intro ? vis(k, t) : 1;
  const ex = stepped(span(t, TL.bandIn, TL.bandIn + 0.5), 6);
  const pts = ex >= 1 ? FULL : FULL.map((p, i) => [lerp(SMALL[i][0], p[0], ex), lerp(SMALL[i][1], p[1], ex)]);
  const P = ex >= 1 ? LOOP : makePath(pts);
  const R = ex >= 1 ? LOOP_R : rangesOf(P, [{ key: "ich", r: BL.ich }]);
  const allein = t >= T_ALLEIN && t < first(TITLES[7]);
  const dimAll = allein ? 0.22 : 1;
  const open = t >= T_OUT;
  const gapX = GAP_X;

  ctx.save();
  applyCam(ctx, cam);
  drawGrid(ctx, cam, v("grid") * (t < T_OUT ? 1 : 1 - span(t, 150, 156)));
  // once the camera is down at the plot, the schematic above is left out
  if (t >= T_PLOT + 0.6 && t < CH1) {
    drawPlot(ctx, t);
    ctx.restore();
    const sl = slotAt(t);
    if (sl && t < first(TL.kurve)) drawSlot(ctx, sl.l, t, sl.g, { alpha: sl.alpha });
    return;
  }

  // wires of the loop
  const loopDrawn = t < TL.bandIn ? span(t, wt(TL.intro[1], 3), wt(TL.intro[1], 4) + 0.6) * P.L : Infinity;
  const cry = span(t, T_PLUS, T_PLUS + 0.25) * (1 - span(t, 143.9, T_OUT + 0.3));
  const vox = audioAt(AUDIO_VOX, t);
  ctx.globalAlpha = dimAll;
  if (t >= wt(TL.intro[1], 3)) {
    if (open) {
      // the feedback wire is cut and its ends spring apart
      const g = stepped(span(t, T_OUT, T_OUT + 0.3), 4);
      const iGap = 11;
      // the cut ends hang down
      poly(ctx, [...pts.slice(0, iGap), [gapX + 30 + 40 * g, BYY], [gapX + 30 + 40 * g + 30 * g, BYY + 70 * g]], C.wire);
      poly(ctx, [[gapX - 30 - 40 * g - 20 * g, BYY + 90 * g], [gapX - 30 - 40 * g, BYY], ...pts.slice(iGap)], C.wire);
    } else poly(ctx, pts, cry > 0 ? C.acc : C.wire, 2 + cry * (2 + 10 * vox), loopDrawn);
    if (ex < 1 && loopDrawn >= P.L) arrow(ctx, 440, FY, 0, C.wire);
  }
  ctx.globalAlpha = 1;
  // allein: only the way back through the eyes stays lit
  if (allein) poly(ctx, FULL.slice(7), C.wire, 2);

  if (ex >= 1) {
    ctx.globalAlpha = dimAll;
    const arrows = [[440, FY, 0, "ich"], [860, FY, 0, "hand"], [1280, FY, 0, "welt"], [1120, BYY, Math.PI, "eye"]];
    for (const [x, y, a, k] of arrows) if (v(k === "ich" ? "sum" : k) && !fallOffset(k, t)) arrow(ctx, x, y, a, cry > 0 ? C.acc : C.wire);
    if (v("sum")) {
      const fo = fallOffset("sum", t);
      ctx.save();
      if (fo) { ctx.translate(fo.dx, fo.dy); }
      arrow(ctx, SUM.x, SUM.y + SUM.r, -Math.PI / 2, cry > 0 ? C.acc : C.wire);
      ctx.fillStyle = C.void; ctx.beginPath(); ctx.arc(SUM.x, SUM.y, SUM.r, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = cry > 0 ? C.acc : C.wire; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, "Σ", SUM.x, SUM.y + 9, MONO(26, true), cry > 0 ? C.acc : C.wire, "center");
      text(ctx, "+", SUM.x - 44, SUM.y - 12, MONO(22), C.wire, "center");
      // positive feedback: the minus at the summing point turns into a plus
      const plus = t >= T_PLUS && t < T_OUT + 2;
      text(ctx, plus ? "+" : "−", plus ? SUM.x - 34 : SUM.x - 22, SUM.y + (plus ? 80 : 56), MONO(plus ? 64 : 22, plus), plus ? C.acc : C.wire, "center");
      ctx.restore();
    }
    if (v("in")) {
      const lbl = t >= T_ANFANG && t < T_ICHV ? "ANFANG" : "w";
      poly(ctx, [[110, FY], [270, FY]], C.wire);
      arrow(ctx, 270, FY, 0, C.wire);
      if (!(t >= T_ICHV && t < 132.8)) text(ctx, lbl, 100, FY + 8, MONO(lbl === "w" ? 24 : 20), lbl === "w" ? C.wire : C.textHi, "right");
    }
    if (v("out")) {
      const lost = t >= T_WOHIN && t < BR_IN;
      const outEnd = lost ? lerp(1840, 2100, stepped(span(t, T_WOHIN, T_WOHIN + 0.5), 5)) : 1840;
      poly(ctx, [[1660, FY], [outEnd, FY]], C.wire);
      arrow(ctx, outEnd, FY, 0, C.wire);
      const lbl = lost ? "?" : t >= T_ENDE && t < T_ICHV ? "ENDE" : "y";
      if (!(t >= T_ICHV && t < 132.8)) text(ctx, lbl, lost ? 1800 : 1852, FY + (lost ? -18 : 8), MONO(lbl === "ENDE" ? 20 : 24), lbl === "y" ? C.wire : C.textHi, lost ? "center" : "left");
    }
    if (v("branch")) { ctx.fillStyle = C.wire; ctx.fillRect(1660 - 5, FY - 5, 10, 10); }
    if (v("sig")) {
      const sc = t >= T_VERSTEHT && t < BR_IN || t >= T_VERSTEHS && t < T_PLUS;
      [["e", 372], ["u", 780], ["m", 1200], ["y", 1600]].forEach(([s, x], i) => text(ctx, scramble(s, t, 20 + i, sc), x, FY - 14, MONO(20), C.text, "center"));
      text(ctx, scramble("y_m", t, 30, sc), 580, BYY - 14, MONO(20), C.text, "center");
    }
    ctx.globalAlpha = 1;
  }

  // "Der sich selbst augmentiert hat": a loop from the controller onto itself
  const self = t >= T_AUGM && t < BR_IN || t >= CH2 && t < T_OUT;
  if (self) {
    // between the pins, clear of the role label
    const sp = [[662, 235], [662, 168], [572, 168], [572, 235]];
    const k = t < BR_IN ? span(t, T_AUGM, T_AUGM + 0.5) : 1;
    ctx.globalAlpha = dimAll;
    poly(ctx, sp, C.acc, 2, k * 224);
    if (k >= 1) arrow(ctx, 572, 233, Math.PI / 2, C.acc);
    ctx.globalAlpha = 1;
  }

  // the tool's box closes round the self on "Kind"
  if (t >= T_VATER && t < CH1) {
    if (t < T_KIND) {
      // "Vater": the self's boundary holds the tool
    } else {
      const k = stepped(span(t, T_KIND, T_KIND + 0.35), 6);
      const r = lerpRect(pad(BL.hand, 12), pad(union(BL.ich, BL.hand), 44), k);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h);
      text(ctx, "WERKZEUG", r.x + r.w - 4, r.y - 12, MONO(17), C.acc, "right");
    }
  }

  // blocks
  for (const key of ["ich", "hand", "welt", "eye"]) {
    if (key !== "ich" && !v(key)) continue;
    if (key === "ich" && t < first(TL.intro[0])) continue;
    const b = blockState(key, t);
    if (!v("roles")) b.role = null;
    if (!v("tfs")) b.tf = null;
    b.alpha = (key === "ich" && t < first(TL.intro[0]) + 0.5 ? stepped(span(t, first(TL.intro[0]), first(TL.intro[0]) + 0.4), 4) : 1)
      * (allein && key !== "eye" ? 0.22 : 1) * (intro && key !== "ich" ? vis(key, t) : 1);
    if (key === "ich" && t >= T_OUT) {
      // the self loses its name letter by letter
      const n = LETTER_FALL.filter(x => t < x).length;
      b.name = "ICH".slice(0, n);
    }
    const fo = fallOffset(key, t);
    ctx.save();
    if (fo) {
      const cx = b.r.x + b.r.w / 2, cy = b.r.y + b.r.h / 2;
      ctx.translate(cx + fo.dx, cy + fo.dy); ctx.rotate(fo.rot); ctx.translate(-cx, -cy);
    }
    drawBlock(ctx, b);
    ctx.restore();
    // the letters of the name fall after the blocks
    if (key === "ich" && t >= T_OUT) {
      ["I", "C", "H"].forEach((ch, i) => {
        const tf = LETTER_FALL[i];
        if (t < tf) return;
        const a = t - tf;
        ctx.font = MONO(34, true); const wFull = ctx.measureText("ICH").width;
        const x = b.r.x + b.r.w / 2 - wFull / 2 + i * wFull / 3;
        text(ctx, ch, x, b.r.y + b.r.h / 2 + 4 + Math.round(900 * a * a), MONO(34, true), C.textHi);
      });
    }
  }

  // "übermenschliche Hände": the tool multiplies, fed by a fan of wires
  if (t >= T_UEBER && t < FALL.hand) {
    const n = Math.min(5, Math.floor(span(t, T_UEBER, T_HAENDEN + 0.2) * 5.999) + 1);
    ctx.globalAlpha = dimAll;
    for (let k = 1; k <= n; k++) {
      const y = BL.hand.y - k * 34, ym = y + 13;
      poly(ctx, [[790, FY], [790, ym], [860, ym]], C.acc, 2);
      poly(ctx, [[1120, ym], [1200, ym], [1200, FY]], C.acc, 2);
      ctx.fillStyle = C.acc; ctx.fillRect(860, y, 260, 26);
      text(ctx, "WERKZEUG", 990, y + 20, MONO(17, true), C.ink, "center");
    }
    ctx.globalAlpha = 1;
  }

  // the tool's time constant, written large in the empty loop
  if (t >= T_JAHRE && t < first(V1[2]) + 0.3) {
    const a = 1 - span(t, first(V1[2]), first(V1[2]) + 0.3);
    ctx.save(); ctx.globalAlpha = a;
    const x = INTERIOR.x + 300, y = INTERIOR.y + 130;
    text(ctx, "T = 3 a", x, y, MONO(96), C.text);
    if (t >= T_GEMACHT) {
      ctx.fillStyle = C.textHi; ctx.fillRect(x - 10, y - 32, lerp(0, 480, stepped(span(t, T_GEMACHT, T_GEMACHT + 0.25), 5)), 6);
      if (t >= T_GEMACHT + 0.25) text(ctx, "8 h", x + 560, y, MONO(96, true), C.acc);
    }
    ctx.restore();
  }

  // reviewers' marks on the tool
  if (t >= T_CHATBOT && t < CH1) {
    ctx.strokeStyle = C.text; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(BL.hand.x + 40, BL.hand.y + 57); ctx.lineTo(BL.hand.x + BL.hand.w - 40, BL.hand.y + 57); ctx.stroke();
    text(ctx, "CHATBOT", BL.hand.x + BL.hand.w / 2, BL.hand.y - 44, MONO(22, true), C.text, "center");
  }
  if (t >= T_FEHLER && t < CH1) text(ctx, "± FEHLER", BL.hand.x + BL.hand.w + 10, BL.hand.y + BL.hand.h + 30, MONO(19), C.text);

  // the boundary of the self
  if (v("bound") && t < BR_IN || t >= CH2 && t < 156) {
    const r = boundAt(t);
    const vater = t >= T_VATER && t < T_KIND ? 1 : 0;
    if (open) {
      // dashes drop away one by one
      const r2 = mulberry32(77), dashes = [];
      const per = 2 * (r.w + r.h), n = Math.floor(per / 18);
      for (let i = 0; i < n; i++) {
        const gone = T_OUT + r2() * 11;
        if (t > gone + 1.2) continue;
        const s = i * 18;
        let x, y, hz;
        if (s < r.w) { x = r.x + s; y = r.y; hz = 1; } else if (s < r.w + r.h) { x = r.x + r.w; y = r.y + s - r.w; hz = 0; }
        else if (s < 2 * r.w + r.h) { x = r.x + r.w - (s - r.w - r.h); y = r.y + r.h; hz = 1; } else { x = r.x; y = r.y + r.h - (s - 2 * r.w - r.h); hz = 0; }
        const a = Math.max(0, t - gone);
        dashes.push([x, y + 900 * a * a, hz]);
      }
      ctx.fillStyle = C.textHi;
      for (const [x, y, hz] of dashes) ctx.fillRect(Math.round(x), Math.round(y), hz ? 10 : 2, hz ? 2 : 10);
    } else dashedRect(ctx, r, C.textHi, 1.5 + vater * 1.5, [10, 8]);
    if (!open || t < T_OUT + 2) text(ctx, "ich", r.x, r.y + r.h + 24, MONO(18), C.textHi);
  }

  // pulses: one round per bar in the verse, eighths in the chorus
  if (t >= wt(TL.intro[1], 4) + 0.6) {
    let n = 1, sub = 1, hops = 8;
    if (t >= TL.bandIn) { n = 2; hops = 16; }
    if (t >= first(V1[0])) { n = 3; }
    if (t >= first(PRE[0])) { n = 4; }
    if (t >= CH1) { n = 8; sub = 2; hops = 24; }
    if (t >= T_SIE) { n = 6; sub = 2; hops = 20; }
    if (t >= CH2) { n = 10; sub = 2; hops = 24; }
    if (open) { n = 6; sub = 1; hops = 14; }
    const quiet = t >= 76.0 && t < T_SIE - 0.1;
    if (!quiet && cry <= 0) {
      drawPulses(ctx, P, R, t, {
        n, sub, hops, colorOf: k => blockColor(k, t), base: C.textHi, alpha: 1,
        skip: s => (allein && s < S_FEEDBACK) || (open && s > S_CUT),
      });
      // in the open loop every signal that reaches the cut falls out
      if (open) {
        const hp = hopPos(t, sub);
        for (let i = 0; i < n; i++) {
          const s = mod(hp * LOOP.L / hops + i * LOOP.L / n, LOOP.L);
          if (s <= S_CUT) continue;
          const a = (s - S_CUT) / (LOOP.L / hops / GRID_A.period);
          ctx.fillStyle = C.acc;
          ctx.fillRect(Math.round(gapX + 25 - a * 60), Math.round(BYY - 5 + 900 * a * a), 10, 10);
        }
      }
    }
    if (self && !allein) {
      const SP = makePath([[617, 235], [662, 235], [662, 168], [572, 168], [572, 235], [617, 235]]);
      drawPulses(ctx, SP, [{ key: "ich", s0: 0, s1: 1 }], t, { n: 1, sub: 1, hops: 6, colorOf: () => C.acc, base: C.acc });
    }
  }

  // the positive feedback rings outward from the loop, one ring per eighth
  if (cry > 0 || (t >= T_PLUS && t < T_OUT + 0.6)) {
    const p = beatPos(t, 2), fade = 1 - span(t, T_OUT - 0.3, T_OUT + 0.6);
    for (let k = 0; k < 7; k++) {
      const age = (p - Math.floor(p) + k) * GRID_A.period / 2;
      const sc = 1 + age * 0.32;
      const al = (1 - age / 2.6) * fade;
      if (al <= 0) continue;
      ctx.save(); ctx.globalAlpha = al * 0.8;
      ctx.translate(980, 460); ctx.scale(sc, sc); ctx.translate(-980, -460);
      poly(ctx, FULL, C.acc, 2 / sc);
      ctx.restore();
    }
  }

  // others, outside the loop: a wire to them that ends in the ground
  if (t >= T_SIE && t < BR_IN) {
    const k = stepped(span(t, T_SIE, T_SIE + 0.5), 5);
    const closed = t >= TL.shouts[2].t && t < TL.shouts[2].t + 0.9;
    const sie = { x: 1640, y: 40, w: 240, h: 84 };
    ctx.globalAlpha = k;
    poly(ctx, [[SIE_X, FY], [SIE_X, 236]], C.wire);
    poly(ctx, [[SIE_X, 176], [SIE_X, sie.y + sie.h]], C.wire);
    ctx.fillStyle = C.wire; ctx.fillRect(SIE_X - 4, 232, 8, 8); ctx.fillRect(SIE_X - 4, 172, 8, 8);
    // the switch: open, except while he shouts
    poly(ctx, [[SIE_X, 236], closed ? [SIE_X, 178] : [SIE_X + 40, 190]], C.textHi, 2);
    poly(ctx, [[SIE_X, 236], [SIE_X - 50, 236], [SIE_X - 50, 252]], C.wire);
    [[24, 252], [16, 259], [8, 266]].forEach(([hw, y]) => { ctx.fillStyle = C.wire; ctx.fillRect(SIE_X - 50 - hw / 2, y, hw, 2); });
    drawBlock(ctx, { r: sie, name: "SIE", mode: "neu", alpha: k, nameSize: 28 });
    if (t >= T_DISK && t < BR_IN) {
      const say = Math.floor(beatPos(t, 2)) % 2 ? "„ja“" : "„nein“";
      text(ctx, say, sie.x + sie.w / 2, sie.y + sie.h + 30, MONO(19), C.text, "center");
    }
    // what he sends them goes to ground
    const p = beatPos(t, 2), fr = p - Math.floor(p);
    const SP = closed ? makePath([[SIE_X, FY], [SIE_X, sie.y + sie.h]]) : makePath([[SIE_X, FY], [SIE_X, 236], [SIE_X - 50, 236], [SIE_X - 50, 252]]);
    const [x, y] = pointOn(SP, outCubic(fr / 0.6) * SP.L);
    if (fr < 0.65) { ctx.fillStyle = C.acc; ctx.fillRect(Math.round(x - 5), Math.round(y - 5), 10, 10); }
    ctx.globalAlpha = 1;
  }

  // Cassandra: the forecast only he sees, then the wave itself, which breaks
  if (t >= T_CASS && t < BR_IN + 0.5) {
    const wave = x => { const u = (x - 360) / 1240; return 465 - (10 + 78 * u * u) * Math.sin(2 * Math.PI * u * 5.5); };
    const fore = span(t, T_CASS, T_RUH + 0.2), fade = 1 - span(t, BR_IN - 0.2, BR_IN + 0.5);
    ctx.save(); ctx.globalAlpha = 0.85 * fade;
    ctx.setLineDash([6, 8]); ctx.strokeStyle = C.acc; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 360; x <= 360 + 1240 * fore; x += 4) x === 360 ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x));
    ctx.stroke(); ctx.setLineDash([]);
    const real = span(t, T_WELLE, T_BRECHEN);
    const breakX = 1360;
    if (real > 0) {
      ctx.strokeStyle = C.textHi; ctx.lineWidth = 3; ctx.beginPath();
      const xe = 360 + 1240 * real;
      for (let x = 360; x <= Math.min(xe, t >= T_BRECHEN ? breakX : xe); x += 3) x === 360 ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x));
      ctx.stroke();
    }
    if (t >= T_BRECHEN) {
      const a = t - T_BRECHEN, r = mulberry32(31);
      ctx.fillStyle = C.textHi;
      for (let x = breakX; x <= 1600; x += 6) {
        const vx = (r() - 0.3) * 160, vy = -r() * 220;
        ctx.fillRect(Math.round(x + vx * a), Math.round(wave(x) + vy * a + 700 * a * a), 4, 4);
      }
    }
    ctx.restore();
  }

  // every "EXPERT" sends a surge once round the loop
  const ti = titleAt(t);
  if (ti && !open && cry <= 0) {
    const t0 = first(TITLES[ti.k]), k = span(t, t0, t0 + 0.8);
    if (k > 0 && k < 1) {
      const head = outCubic(k) * LOOP.L, tail = Math.max(0, head - 520);
      const seg = [];
      for (let s2 = tail; s2 <= head; s2 += 10) seg.push(pointOn(LOOP, s2));
      if (seg.length > 1) { ctx.globalAlpha = dimAll; poly(ctx, seg, C.acc, 6); ctx.globalAlpha = 1; }
    }
  }

  // the chorus title inside the loop
  if (ti) drawTitle(ctx, ti.k, t, ti.alpha * dimAll, INTERIOR.x + INTERIOR.w / 2 + 10, INTERIOR.y + 142, INTERIOR.w - 140);

  // the pre-chorus plot hangs under the schematic
  if (t >= T_PLOT && t < CH1) drawPlot(ctx, t);

  // "Ich versteh's nicht mehr": the words that marked beginning and end drift round the loop
  if (t >= T_ICHV && t < 132.8) {
    const hp = hopPos(t, 2);
    [["ANFANG", 0], ["ENDE", 0.5]].forEach(([s, off]) => {
      const [x, y] = pointOn(LOOP, mod(hp * LOOP.L / 16 + off * LOOP.L, LOOP.L));
      text(ctx, scramble(s, t, 40 + s.length, t >= T_VERSTEHS), x, y - 14, MONO(20), C.textHi, "center");
    });
  }
  ctx.restore();

  // screen space: shouts and the slot
  for (const s of TL.shouts) drawStamp(ctx, s, t);
  const sl = slotAt(t);
  if (sl && !(t >= first(TL.kurve) && t < CH1)) drawSlot(ctx, sl.l, t, sl.g, { alpha: sl.alpha });
}

// ---------------------------------------------------------------- the curve

// The output y over time. They read it on their own scale, which hides the
// growth; on "ICH BIN DIE KURVE" the scale gives way and he becomes the curve.
const PLOT = { x0: 220, x1: 1760, y0: 1420, top: 840 };
const curveY = (u, A) => PLOT.y0 - A * (Math.exp(3 * u) - 1);
function drawPlot(ctx, t) {
  const K = TL.kurve, tk = first(K);
  const sehen = wt(PRE[2], 1), wollen = wt(PRE[3], 1), kurve2 = wt(PRE[3], 4);
  ctx.save();
  ctx.globalAlpha = stepped(span(t, T_PLOT, T_PLOT + 0.4), 4);
  // axes
  poly(ctx, [[PLOT.x0, PLOT.top - 30], [PLOT.x0, PLOT.y0], [PLOT.x1 + 40, PLOT.y0]], C.wire, 2);
  arrow(ctx, PLOT.x1 + 40, PLOT.y0, 0, C.wire);
  if (t < tk) arrow(ctx, PLOT.x0, PLOT.top - 30, -Math.PI / 2, C.wire);
  text(ctx, "t", PLOT.x1 + 34, PLOT.y0 + 38, MONO(22), C.wire);
  text(ctx, "y", PLOT.x0 - 30, PLOT.top - 20, MONO(22), C.wire, "center");
  for (let i = 1; i <= 10; i++) { ctx.fillStyle = C.wire; ctx.fillRect(PLOT.x0 + i * 154 - 1, PLOT.y0, 2, 10); }
  const grow = stepped(span(t, tk, tk + 0.9), 9);
  const A = lerp(30, 73, grow);
  // their ceiling, lowered on "wollen", broken on "ICH"
  const lid = t < wollen ? PLOT.top : lerp(PLOT.top, PLOT.y0 - 90, stepped(span(t, wollen, kurve2), 6));
  for (let i = 1; i <= 4; i++) {
    const yv = PLOT.y0 - i * (PLOT.y0 - PLOT.top) / 4;
    ctx.fillStyle = C.wire; ctx.fillRect(PLOT.x0 - 10, yv - 1, 10, 2);
    const lbl = t < tk ? String(i) : String(Math.round(Math.pow(10, i + grow * 3)));
    text(ctx, lbl, PLOT.x0 - 18, yv + 7, MONO(17), C.text, "right");
  }
  const umax = t < tk ? span(t, sehen, sehen + 1.0) : lerp(1, 1.16, span(t, tk + 0.9, CH1));
  const pts = [];
  for (let u = 0; u <= umax + 1e-9; u += 0.005) pts.push([PLOT.x0 + 1540 * u, curveY(u, A)]);
  if (pts.length > 1) {
    if (t < tk) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, lid, W * 2, 4000); ctx.clip();
      poly(ctx, pts, C.text, 3);
      ctx.restore();
      // above their lid the curve still exists, as a dotted ghost
      ctx.save(); ctx.beginPath(); ctx.rect(0, -4000, W * 2, lid + 4000); ctx.clip();
      ctx.setLineDash([2, 10]); poly(ctx, pts, C.wireDim, 2); ctx.setLineDash([]);
      ctx.restore();
      const yl = Math.round(lid);
      if (t >= wollen) {
        ctx.fillStyle = C.text; ctx.fillRect(PLOT.x0, yl - 1, 1540, 3);
        // clipped: what they see runs flat along the lid
        const uc = Math.log((PLOT.y0 - lid) / A + 1) / 3;
        if (uc < umax) poly(ctx, [[PLOT.x0 + 1540 * uc, yl], [PLOT.x0 + 1540 * umax, yl]], C.text, 3);
      }
    } else {
      // the lid breaks in two and falls
      const a = t - tk;
      ctx.fillStyle = C.text;
      if (a < 0.5) {
        ctx.save(); ctx.translate(PLOT.x0, PLOT.y0 - 90 + 2600 * a * a); ctx.rotate(0.5 * a); ctx.fillRect(0, -1, 700, 3); ctx.restore();
        ctx.save(); ctx.translate(PLOT.x0 + 1540, PLOT.y0 - 90 + 3000 * a * a); ctx.rotate(-0.6 * a); ctx.fillRect(-760, -1, 760, 3); ctx.restore();
      }
      poly(ctx, pts, C.acc, 5);
      drawCurveText(ctx, t, A);
    }
  }
  ctx.restore();
}
function drawCurveText(ctx, t, A) {
  const K = TL.kurve, ws = words(K);
  const full = ws.map(w => w.s).join(" ");
  const size = 150;
  ctx.font = gradeFont(0, size);
  // arc length table along the curve
  const N = 800, tab = [[0, PLOT.x0, curveY(0, A)]];
  for (let i = 1; i <= N; i++) {
    const u = 1.1 * i / N, x = PLOT.x0 + 1540 * u, y = curveY(u, A), p = tab[i - 1];
    tab.push([p[0] + Math.hypot(x - p[1], y - p[2]), x, y]);
  }
  const at = s => {
    let i = 1; while (i < N && tab[i][0] < s) i++;
    const a = tab[i - 1], b = tab[i], k = (s - a[0]) / (b[0] - a[0] || 1);
    return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), Math.atan2(b[2] - a[2], b[1] - a[1])];
  };
  let s = tab[Math.round(N * 0.33)][0];
  ws.forEach((w, wi) => {
    const shown = revealed(ws, wi, t).length;
    [...w.s + " "].forEach((ch, j) => {
      const cw = ctx.measureText(ch).width;
      if (j < shown) {
        const [x, y, ang] = at(s + cw / 2);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = C.textHi; ctx.textAlign = "center";
        ctx.fillText(ch, 0, -22);
        ctx.restore();
      }
      s += cw;
    });
  });
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- bridge

// "wer macht hier wen?": two blocks, two wires, and the direction of the
// signal is no longer decidable.
const BR_ICH = { x: 200, y: 200, w: 420, h: 360 }, BR_ES = { x: 1300, y: 200, w: 420, h: 360 };
// what goes over the wires: his work there, the machine's answer back
const PACKETS = [
  { s: "Promptotyping", t: wt(BR[0], 0), y: 300, back: false },
  { s: "Projektantrag", t: wt(BR[0], 1), y: 300, back: false },
  { s: "fertig bis morgen", t: wt(BR[0], 2), y: 460, back: true },
  { s: "kein Problem", t: wt(BR[1], 0), y: 460, back: true },
];
function sceneBridge(ctx, t) {
  const gather = stepped(span(t, BR_IN + 0.1, BR_IN + 1.3), 8);
  const close = stepped(span(t, T_WENN, T_UND), 10);
  const ich = { ...BR_ICH, x: BR_ICH.x + close * 340 }, es = { ...BR_ES, x: BR_ES.x - close * 340 };
  const merged = t >= T_UND;
  // the flips: arrows reverse on each "wen?"
  const dir = t >= T_FLIP1 && t < T_FLIP2 ? -1 : 1;
  const swap = stepped(span(t, T_FLIP2, T_FLIP2 + 0.3), 6);

  drawGrid(ctx, { x: 960, y: 540, s: 1 }, 1 - gather * 0.4);
  // the loop collapses: every block flies into the two
  if (gather < 1) {
    const from = { ich: BL.ich, hand: BL.hand, welt: BL.welt, eye: BL.eye };
    ["eye", "welt", "hand"].forEach((k, i) => {
      const g = stepped(span(t, BR_IN + 0.1 + i * 0.25, BR_IN + 0.6 + i * 0.25), 5);
      const b = blockState(k, BR_IN);
      b.r = lerpRect(from[k], es, g); b.role = null; b.tf = null; b.alpha = 1;
      if (k === "welt") { b.mode = "mac"; b.fill = 1; }
      if (k === "hand" || g < 1) drawBlock(ctx, b);
    });
    const b = blockState("ich", BR_IN);
    b.r = lerpRect(BL.ich, ich, gather); b.role = null; b.tf = null; b.pins = 0;
    drawBlock(ctx, b);
    ctx.globalAlpha = 1;
    return finishBridge(ctx, t);
  }
  const wires = span(t, BR_IN + 1.3, BR_IN + 2.0);
  if (!merged) {
    const xa = ich.x + ich.w, xb = es.x;
    if (xb - xa > 4) {
      poly(ctx, [[xa, 300], [lerp(xa, xb, wires), 300]], C.wire);
      poly(ctx, [[xb, 460], [lerp(xb, xa, wires), 460]], C.wire);
      if (wires >= 1) {
        const ar = (x0, x1, y) => dir > 0 ? arrow(ctx, x1, y, x1 > x0 ? 0 : Math.PI, C.wire) : arrow(ctx, x0, y, x1 > x0 ? Math.PI : 0, C.wire);
        ar(xa, xb, 300); ar(xb, xa, 460);
        const P = makePath([[ich.x + ich.w / 2, 300], [es.x + es.w / 2, 300], [es.x + es.w / 2, 460], [ich.x + ich.w / 2, 460], [ich.x + ich.w / 2, 300]]);
        const R = rangesOf(P, [{ key: "ich", r: ich }, { key: "es", r: es }]);
        drawPulses(ctx, P, R, t, { n: 4, sub: 1, hops: 6, dir, colorOf: k => k === "es" ? C.acc : C.textHi, base: C.textHi });
        for (const pk of PACKETS) {
          const k = span(t, pk.t, pk.t + 1.1);
          if (k <= 0 || k >= 1) continue;
          const x = pk.back ? lerp(xb, xa, outCubic(k)) : lerp(xa, xb, outCubic(k));
          ctx.font = MONO(22, true);
          const w = ctx.measureText(pk.s).width + 24;
          const bx = Math.round(pk.back ? x : x - w);
          ctx.save(); ctx.beginPath(); ctx.rect(xa, 0, xb - xa, H); ctx.clip();
          ctx.fillStyle = pk.back ? C.acc : C.textHi; ctx.fillRect(bx, pk.y - 20, Math.round(w), 40);
          text(ctx, pk.s, bx + 12, pk.y + 8, MONO(22, true), C.ink);
          ctx.restore();
        }
      }
    }
    const pre = Math.min(1, ichShare(BR_IN));
    drawBlock(ctx, { r: ich, mode: "hum", share: pre, seed: 3 });
    drawBlock(ctx, { r: es, mode: "mac", fill: 1 });
    if (t >= T_WIR && t < T_WENN) dashedRect(ctx, pad(union(ich, es), 26), C.textHi, 1.5);
    if (t >= T_WIR && t < T_WENN) text(ctx, "wir", ich.x - 26, ich.y - 38, MONO(18), C.textHi);
  } else {
    // "und wo es beginnt": one block, and the edge between the two is a dither
    const r = lerpRect(union(ich, es), { x: 120, y: 120, w: 1680, h: 620 }, stepped(span(t, T_BEGINNT, CH2 - 0.2), 12));
    ctx.fillStyle = C.void; ctx.fillRect(r.x, r.y, r.w, r.h);
    const seed = Math.floor(beatPos(t, 2));
    dither(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, 0.5, 8, 0.55 * span(t, T_BEGINNT, T_BEGINNT + 0.3), seed);
    ctx.strokeStyle = C.textHi; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, r.y + 1); ctx.lineTo(r.x + 1, r.y + 1); ctx.lineTo(r.x + 1, r.y + r.h - 1); ctx.lineTo(r.x + r.w / 2, r.y + r.h - 1); ctx.stroke();
    ctx.strokeStyle = C.acc;
    ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, r.y + 1); ctx.lineTo(r.x + r.w - 1, r.y + 1); ctx.lineTo(r.x + r.w - 1, r.y + r.h - 1); ctx.lineTo(r.x + r.w / 2, r.y + r.h - 1); ctx.stroke();
  }
  // labels, swapped on the second "wen?"
  const fade = merged ? 1 - span(t, T_BEGINNT, T_BEGINNT + 0.6) : 1;
  if (fade > 0) {
    const cI = [ich.x + ich.w / 2, 410], cE = [es.x + es.w / 2, 410];
    const pI = [lerp(cI[0], cE[0], swap), 410], pE = [lerp(cE[0], cI[0], swap), 410];
    ctx.save(); ctx.globalAlpha = fade;
    ctx.font = MONO(96, true); ctx.textAlign = "center";
    const onBlue = x => x > (merged ? union(ich, es).x + union(ich, es).w / 2 : es.x);
    ctx.fillStyle = onBlue(pI[0]) ? C.ink : C.textHi; ctx.fillText("ICH", pI[0], pI[1]);
    ctx.fillStyle = onBlue(pE[0]) ? C.ink : C.textHi; ctx.fillText("ES", pE[0], pE[1]);
    ctx.restore();
  }
  finishBridge(ctx, t);
}
function finishBridge(ctx, t) {
  const sl = slotAt(t);
  if (sl) drawSlot(ctx, sl.l, t, sl.g, { alpha: sl.alpha });
}

// ---------------------------------------------------------------- open loop

// With the feedback gone nothing holds the output: the trace of the band, the
// machine's signal, grows exponentially away from the empty block, while his
// own trace, the voice, lies flat on the axis.
const RAIL = 560;
function sceneRun(ctx, t) {
  const axisY = 790, x0 = 300;
  const half = GRID_A.period / 2;
  const kNow = Math.floor(beatPos(t, 2));
  const fr = beatPos(t, 2) - kNow;
  const step = lerp(46, 78, smooth(span(t, 167, 172)));
  const scroll = outCubic(fr / 0.3);
  // the last bars before the scream close in on the empty block
  // in whole steps on the beats, so the hatching never shimmers
  const b0 = Math.floor(beatPos(170.5)), b1 = Math.floor(beatPos(TL.scream.t));
  const push = smooth(clamp((Math.floor(beatPos(t)) - b0) / (b1 - b0)));
  const cam = { x: lerp(960, 760, push), y: lerp(540, 600, push), s: lerp(1, 1.3, push) };
  ctx.save(); applyCam(ctx, cam);
  drawGrid(ctx, cam, 0.7);
  const gain = ts => 230 * Math.exp((ts - TL.run) / 12);
  // the machine trace
  for (let k = kNow; k > kNow - 60; k--) {
    const ts = GRID_A.first + k * half;
    if (ts < TL.run - 0.4) break;
    const x = x0 + (kNow - k + scroll) * step;
    if (x > W + 10) break;
    // saturation: the trace flattens against the top rail instead of leaving the frame
    const h = Math.round(Math.min(RAIL, audioMean(AUDIO_RMS, ts, ts + half) * gain(ts)));
    ctx.fillStyle = C.acc; ctx.globalAlpha = h >= RAIL ? 1 : 0.7;
    for (let xx = Math.ceil(x / 6) * 6; xx < x + step; xx += 6) ctx.fillRect(xx, axisY - h, 2, h);
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.round(x), axisY - h - 2, Math.ceil(step), 4);
    const kn = k - 1, tn = GRID_A.first + kn * half;
    const hn = Math.round(Math.min(RAIL, audioMean(AUDIO_RMS, tn, tn + half) * gain(tn)));
    ctx.fillRect(Math.round(x + step) - 2, axisY - Math.max(h, hn) - 2, 4, Math.abs(h - hn) + 4);
  }
  // axis and time ticks
  poly(ctx, [[x0, axisY], [W, axisY]], C.wire, 2);
  for (let k = kNow; k > kNow - 60; k--) {
    const x = x0 + (kNow - k + scroll) * step;
    if (x > W) break;
    ctx.fillStyle = C.wire; ctx.fillRect(Math.round(x) - 1, axisY + 2, 2, k % 8 === 0 ? 16 : 7);
    if (k % 8 === 0) text(ctx, (GRID_A.first + k * half).toFixed(1), Math.round(x) + 6, axisY + 34, MONO(16), C.text);
  }
  // his trace: the voice
  ctx.fillStyle = C.textHi;
  for (let k = kNow; k > kNow - 60; k--) {
    const ts = GRID_A.first + k * half;
    const x = x0 + (kNow - k + scroll) * step;
    if (x > W) break;
    const h = Math.round(audioMean(AUDIO_VOX, ts, ts + half) * 260);
    ctx.fillRect(Math.round(x), axisY - h - 6, Math.ceil(step), 3);
  }
  text(ctx, "y", W - 60, 120, MONO(24), C.acc);
  ctx.setLineDash([4, 8]); poly(ctx, [[x0, axisY - RAIL - 2], [W + 400, axisY - RAIL - 2]], C.wireDim, 2); ctx.setLineDash([]);
  text(ctx, "y_max", x0 - 12, axisY - RAIL + 5, MONO(17), C.text, "right");
  // the empty self at the origin
  drawBlock(ctx, { r: { x: 110, y: axisY - 60, w: 190, h: 120 }, mode: "hum" });
  text(ctx, "ich", 110, axisY - 74, MONO(18), C.textHi);
  // the cut ends of the old loop
  poly(ctx, [[60, axisY], [110, axisY]], C.wireDim, 2);
  ctx.restore();
}

// ---------------------------------------------------------------- the scream

// One held "Iiich" in pixel letters; while the note holds, the machine takes
// cell after cell, from the right.
const ICH_PIX = pixCells("ICH");
const ICH_ORDER = (() => {
  const r = mulberry32(2026);
  return ICH_PIX.cells.map((c, i) => ({ i, key: (1 - c[0] / ICH_PIX.cols) * 0.75 + r() * 0.25 })).sort((a, b) => a.key - b.key).map(o => o.i);
})();
function sceneScream(ctx, t) {
  const S = TL.scream;
  if (t < TL.hole.t) {
    const cell = 96, x0 = (W - ICH_PIX.cols * cell) / 2, y0 = (H - 7 * cell) / 2 - 20;
    const taken = Math.floor(ICH_PIX.cells.length * smooth(span(t, S.t + 0.25, S.e)));
    const blue = new Set(ICH_ORDER.slice(0, taken));
    ICH_PIX.cells.forEach(([i, j], n) => {
      if (t < S.t + j * 0.025) return;  // drawn in row by row
      ctx.fillStyle = blue.has(n) ? C.acc : C.textHi;
      ctx.fillRect(x0 + i * cell, y0 + j * cell, cell - 8, cell - 8);
    });
    return;
  }
  // the band drops out: nothing but the last word of the self
  const b = TL.bin;
  if (t >= first(b)) {
    ctx.save();
    ctx.globalAlpha = 1 - span(t, b.e - 0.15, b.e);
    ctx.font = gradeFont(6, 120); ctx.textAlign = "center"; ctx.fillStyle = C.textHi;
    ctx.fillText(revealed(words(b), 0, t), W / 2, H / 2 + 40);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- bypass

// The band returns in a new tempo and the loop runs without him: a wire jumps
// over the empty controller, and the signal never enters it.
const BYPASS = [[300, 300], [370, 300], [370, 150], [780, 150], [780, 300], [860, 300], [1120, 300], [1280, 300], [1540, 300], [1660, 300], [1660, 620], [1120, 620], [860, 620], [300, 620], [300, 330]];
const BP = makePath(BYPASS);
const BP_R = rangesOf(BP, loopRects().filter(o => o.key !== "ich"));
const STILL = t => t >= LAST && t < AUG.e + 0.3;
const beatB = n => GRID_B.first + n * GRID_B.period;
// cuts on every second bar while the band is loud
const FRAMINGS = [
  [TL.bypass, { x: 960, y: 520, s: 1 }],
  [beatB(8), { x: 575, y: 250, s: 1.9 }],
  [beatB(16), { x: 1210, y: 330, s: 1.55 }],
  [beatB(24), { x: 760, y: 450, s: 1.3 }],
  [beatB(30), { x: 960, y: 520, s: 1 }],
];
function bypassCam(t) {
  let c = FRAMINGS[0][1];
  for (const [ft, f] of FRAMINGS) if (t >= ft) c = f;
  if (t >= beatB(30)) {
    // the long view, slowly pulling back, then settling on the empty block
    const k = smooth(span(t, beatB(30), LAST));
    // settled before he speaks, so the still moment is really still
    const s = smooth(span(t, LAST - 2.2, LAST - 0.2));
    return { x: lerp(960, 575, s), y: lerp(lerp(520, 500, k), 470, s), s: lerp(lerp(1, 0.94, k), 1.05, s) };
  }
  // slow drift inside each framing, so a framing is never a still
  const ft = ([...FRAMINGS].reverse().find(f => t >= f[0]) || FRAMINGS[0])[0];
  return { ...c, s: c.s * (1 + 0.02 * span(t, ft, ft + 3.6)) };
}
function sceneBypass(ctx, t) {
  const cam = bypassCam(t);
  const beat = n => beatB(n);
  const build = n => t >= beat(n) ? 1 : 0;
  const still = STILL(t);
  const calm = span(t, TL.calm, TL.calm + 3);
  const dimO = still ? 0.28 : 1;
  ctx.save();
  applyCam(ctx, cam);
  drawGrid(ctx, cam, 1);
  ctx.globalAlpha = dimO;
  // the old loop, reassembled on the beats
  poly(ctx, FULL.slice(3), C.acc, 2);
  poly(ctx, [[300, 620], [300, 330]], C.acc, 2);
  poly(ctx, [[300, 300], [370, 300]], C.acc, 2);
  poly(ctx, [[780, 300], [860, 300]], C.acc, 2);
  arrow(ctx, 860, FY, 0, C.acc); arrow(ctx, 1280, FY, 0, C.acc); arrow(ctx, 1120, BYY, Math.PI, C.acc); arrow(ctx, 300, 330, -Math.PI / 2, C.acc);
  ctx.fillStyle = C.void; ctx.beginPath(); ctx.arc(SUM.x, SUM.y, SUM.r, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, "Σ", SUM.x, SUM.y + 9, MONO(26, true), C.acc, "center");
  text(ctx, "+", SUM.x - 44, SUM.y - 12, MONO(22), C.acc, "center");
  text(ctx, "−", SUM.x - 22, SUM.y + 56, MONO(22), C.acc, "center");
  poly(ctx, [[110, FY], [270, FY]], C.acc); arrow(ctx, 270, FY, 0, C.acc);
  text(ctx, "w", 100, FY + 8, MONO(24), C.acc, "right");
  poly(ctx, [[1660, FY], [1840, FY]], C.acc); arrow(ctx, 1840, FY, 0, C.acc);
  text(ctx, "y", 1852, FY + 8, MONO(24), C.acc);
  if (build(1)) drawBlock(ctx, { r: BL.welt, name: "WELT", tf: "K/(1+sT)", mode: "mac", fill: 1 });
  if (build(2)) drawBlock(ctx, { r: BL.hand, name: "WERKZEUG", tf: "T = 8 h", mode: "mac", fill: 1 });
  if (build(3)) drawBlock(ctx, { r: BL.eye, name: "PROGNOSE", tf: "e^+sT", mode: "mac", fill: 1 });
  // the bypass over the head of the controller
  const bk = stepped(span(t, beat(4), beat(5)), 6);
  const augFill = span(t, first(AUG), AUG.e);
  if (bk > 0 && augFill < 1) poly(ctx, [[370, 300], [370, 150], [780, 150], [780, 300]], C.acc, 3, bk * 830);
  ctx.globalAlpha = 1;
  // the controller: an empty dashed block on two dead stubs
  const filled = augFill >= 1;
  ctx.globalAlpha = 1;
  poly(ctx, [[370, 300], [440, 300]], filled ? C.acc : C.wireDim, 2);
  poly(ctx, [[700, 300], [780, 300]], filled ? C.acc : C.wireDim, 2);
  // "aug-men-tiert": the block fills from the bottom, row by row, on the syllables
  const ws = words(AUG);
  const fillK = t < ws[0].t ? 0 : t < ws[1].t ? 0.4 * span(t, ws[0].t, ws[0].t + 1.2) : t < ws[2].t ? 0.4 + 0.2 * span(t, ws[1].t, ws[1].t + 0.8) : 0.6 + 0.4 * span(t, ws[2].t, AUG.e - 0.2);
  const r = BL.ich;
  ctx.fillStyle = C.void; ctx.fillRect(r.x, r.y, r.w, r.h);
  const rows = Math.floor(stepped(fillK, 13) * r.h / 10);
  ctx.fillStyle = C.acc;
  if (rows > 0) ctx.fillRect(r.x, r.y + r.h - rows * 10, r.w, rows * 10);
  if (filled) { ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
  else dashedRect(ctx, r, C.textHi, 2, [8, 7]);
  if (filled) text(ctx, "ICH", r.x + r.w / 2, r.y + r.h / 2 + 12, MONO(34, true), C.ink, "center");
  // pulses take the bypass; they freeze when he speaks
  if (t >= beat(5)) {
    const tp = still ? LAST : t;
    const n = t < TL.calm ? 12 : 8;
    ctx.globalAlpha = dimO;
    drawPulses(ctx, filled ? LOOP : BP, filled ? LOOP_R : BP_R, tp, { n, sub: 1, hops: lerp(16, 24, calm), colorOf: () => C.acc, base: C.acc });
    ctx.globalAlpha = 1;
  }
  // the machine settles the output perfectly: a step response in the loop
  const sr = span(t, beat(6), beat(26));
  if (sr > 0) {
    ctx.save(); ctx.globalAlpha = (still ? 0.25 : 0.9);
    const yS = 420, y0 = 540;
    ctx.setLineDash([4, 8]); poly(ctx, [[400, yS], [1580, yS]], C.wireDim, 2); ctx.setLineDash([]);
    const resp = u => 1 - Math.exp(-4.2 * u) * Math.cos(9 * u);
    const pts = [];
    for (let u = 0; u <= sr; u += 0.004) pts.push([400 + 1180 * u, y0 - (y0 - yS) * resp(u)]);
    if (pts.length > 1) poly(ctx, pts, C.acc, 3);
    ctx.restore();
  }
  ctx.restore();

  // the slot: his three words, then the machine's one
  if (t >= LAST) {
    drawSlot(ctx, TL.last, t, 0, { ys: [SLOT.y2a] });
    ctx.save(); ctx.font = MONO(84, true); ctx.fillStyle = C.acc;
    let s = "";
    ws.forEach((w, i) => { s += revealed(ws, i, t); });
    if (s) ctx.fillText(s.toLowerCase(), SLOT.x, SLOT.y2b + 4);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the last hit

// Everything has gone into the one block. It has no input and no output any
// more, only a wire from itself back to itself, and one white signal goes round.
function sceneFinal(ctx, t) {
  const a = t - TL.hit;
  drawGrid(ctx, { x: 960, y: 540, s: 1 }, 1);
  const rEnd = { x: 660, y: 330, w: 600, h: 260 };
  // on the hit the whole frame is the block, then it contracts to its size
  const r = lerpRect({ x: -40, y: -40, w: W + 80, h: H + 80 }, rEnd, stepped(span(a, 0.04, 0.3), 6));
  const settled = a >= 0.3;
  const P = makePath([[1260, 460], [1400, 460], [1400, 720], [520, 720], [520, 460], [660, 460]]);
  if (settled) {
    poly(ctx, P.pts, C.wire, 3);
    arrow(ctx, 660, 460, 0, C.wire, 1.3);
    // the boundary of the self now holds the block and its own loop, and nothing else
    const b = { x: 470, y: 280, w: 980, h: 490 };
    dashedRect(ctx, b, C.textHi, 1.5, [10, 8]);
    text(ctx, "ich", b.x, b.y + b.h + 26, MONO(20), C.textHi);
  }
  drawBlock(ctx, { r, name: settled ? "ICH" : "", mode: "mac", fill: 1, nameSize: 92 });
  // one signal, once round, until the sound is gone
  const k = span(t, TL.hit + 0.2, SCENE_END - 0.05);
  const [x, y] = pointOn(P, outCubic(k) * P.L);
  if (k < 1 && settled) { ctx.fillStyle = C.textHi; ctx.fillRect(Math.round(x - 7), Math.round(y - 7), 14, 14); }
}

// ---------------------------------------------------------------- intro glitch

// The broken meter of the intro: on strong hits, bands of the frame slip
// sideways for two frames, never more than about twice a second.
const GLITCH = (() => {
  const out = []; let last = -1;
  for (const o of AUDIO_ONSETS) {
    if (o < TL.bandIn || o > first(V1[0]) - 0.3) continue;
    if (audioAt(AUDIO_FLUX, o) > 0.45 && o - last > 0.45) { out.push(o); last = o; }
  }
  return out;
})();
function glitch(ctx, t) {
  const g = GLITCH.find(o => t >= o && t < o + 0.07);
  if (g === undefined || !BUF) return;
  const b = BUF.getContext("2d");
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H); b.drawImage(ctx.canvas, 0, 0);
  const r = mulberry32(Math.round(g * 1000));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 4; i++) {
    const y = Math.floor(r() * 18) * 60, h = 20 + Math.floor(r() * 5) * 20, dx = Math.round((r() - 0.5) * 80);
    ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- frame

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.setLineDash([]);
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < BR_IN) sceneLoop(ctx, t);
  else if (t < CH2) sceneBridge(ctx, t);
  else if (t < TL.run) sceneLoop(ctx, t);
  else if (t < TL.scream.t) sceneRun(ctx, t);
  else if (t < TL.bypass) sceneScream(ctx, t);
  else if (t < TL.hit) sceneBypass(ctx, t);
  else sceneFinal(ctx, t);
  if (t < first(V1[0])) glitch(ctx, t);
  const hole = t >= TL.hole.t && t < TL.bypass;
  texture(ctx, t, hole ? 0.04 : 0.07, STILL(t) || hole);
}
