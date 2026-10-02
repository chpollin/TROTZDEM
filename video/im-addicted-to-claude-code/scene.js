// I'm addicted to Claude Code. The whole video is drawScene(ctx, t), a pure
// function of time in seconds: no state survives between frames, so render.py
// can render frames in any order and in parallel. Word and beat times come from
// timeline.js.
//
// The stage is the activity calendar of a code profile, read as the chart of an
// addiction: one cell per day, every cell a dose. Grey is what I made; cyan is
// what the machine made, and nothing else is ever cyan. The machine's work
// spreads from today back into the year, and the shouted words are written into
// the calendar as 5 x 7 pixel letters, the way people draw into their own
// commit graphs. The year rises into a city, overflows, breaks into words, runs
// as five projects and years in one night, hangs as trophies, multiplies into a
// wall of years, goes flat (everything possible, nothing worth anything), white
// (Gott) and negative (Junkie), becomes the floor of an effortless flight, goes
// out cell by cell, relapses at full strength and burns down to the one cell it
// began with.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", empty: "#1c1f23", text: "#868b92", textHi: "#eef1f3", dim: "#43474d",
  plate: "#0a0b0d", edge: "#33373d", hot: "#effdff", ash: "#4d5156", dead: "#141618",
  skin: "#e6dbd0",
};
const ICH = [C.empty, "#474a4f", "#6f7379", "#a0a4aa", "#d4d7db"];
const ES = [C.empty, "#0f4756", "#178098", "#24bcda", "#6eeaff"];

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
// closure-free hash for the inner loops of the wall, which touch ~40k cells a frame
function ih(a, b = 0, c = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));
const loglerp = (a, b, k) => Math.exp(lerp(Math.log(a + 1), Math.log(b + 1), k)) - 1;

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
const MIX_CACHE = new Map();
// returns hex so results can be mixed again; quantised and cached because the
// city and the wall mix per cell per frame
function mix(h1, h2, k) {
  k = Math.round(clamp(k) * 32) / 32;
  const key = h1 + h2 + k;
  let v = MIX_CACHE.get(key);
  if (!v) {
    const a = hexRgb(h1), b = hexRgb(h2);
    v = "#" + a.map((x, i) => Math.round(lerp(x, b[i], k)).toString(16).padStart(2, "0")).join("");
    MIX_CACHE.set(key, v);
  }
  return v;
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

// the 0.15 s sixteenth grid; the backbeat falls on ticks 5 and 13 of every 16
const tickOf = t => (t - BEAT.t0) / BEAT.tick;
const tickTime = k => BEAT.t0 + k * BEAT.tick;
const snapTick = t => tickTime(Math.round(tickOf(t)));
function accent(t) {
  const k = Math.floor(tickOf(t)), a = k - (((k - 5) % 8) + 8) % 8;
  return Math.exp(-(t - tickTime(a)) / 0.16);
}

// ---------------------------------------------------------------- calendar

const COLS = 53, ROWS = 7;
const TODAY = 52 * 7 + 4;  // Friday, 2 Oct 2026: the last column is not full yet
const DAY_MS = 86400000, TODAY_MS = Date.UTC(2026, 9, 2);
const MONTHS = ["jan", "feb", "mär", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];
const dateOf = d => new Date(TODAY_MS - (TODAY - d) * DAY_MS);
const fmtDate = d => { const x = dateOf(d); return `${x.getUTCDate()}. ${MONTHS[x.getUTCMonth()]}. ${x.getUTCFullYear()}`; };
const MONTH_COLS = (() => {
  const out = [];
  for (let c = 1; c < COLS; c++) {
    const m = dateOf(c * 7).getUTCMonth();
    if (m !== dateOf((c - 1) * 7).getUTCMonth()) out.push([c, MONTHS[m]]);
  }
  return out;
})();

// the standard place of the year on screen
const GX = 141, GY = 360, P = 31, S = 25;
const GW = COLS * P - (P - S), GH = ROWS * P - (P - S);

const hash = (a, b = 0) => ih(a + 7, b + 3);
// my own commits in the year before the machine: sparse grey
const PAST = [], PAST_N = [], PAST_AT = [], BASE = [], SHAPE = [], CYAN_AT = [];
let PAST_SUM = 0;
// days back from today covered by the machine at time t (the streak)
const SPREAD = [[15.05, 0], [20.9, 9], [26.9, 20], [29.2, 34], [30.4, 40], [33.0, 150], [37.9, 178], [43.35, 205], [49.5, 262], [56.8, TODAY]];
function spreadAt(t) {
  if (t < SPREAD[0][0]) return -1;
  for (let i = 1; i < SPREAD.length; i++) {
    const [t0, k0] = SPREAD[i - 1], [t1, k1] = SPREAD[i];
    if (t < t1) return lerp(k0, k1, (t - t0) / (t1 - t0));
  }
  return TODAY;
}
for (let d = 0; d <= TODAY; d++) {
  const k = TODAY - d;
  PAST.push(k > 24 && hash(d, 1) < 0.12 ? (hash(d, 2) < 0.35 ? 2 : 1) : 0);
  PAST_N.push(PAST[d] ? 1 + Math.floor(hash(d, 9) * 4) : 0);
  PAST_SUM += PAST_N[d];
  PAST_AT.push(snapTick(9.0 + hash(d, 6) * 2.3));
  BASE.push(1 + Math.floor(hash(d, 3) * 3));
  // the dose escalates towards today: the city of the year is a growth curve
  SHAPE.push((0.07 + 0.93 * Math.exp(-k / 75)) * (0.68 + 0.32 * hash(d, 4)));
  let at = Infinity;
  for (let i = 1; i < SPREAD.length; i++) {
    const [t0, k0] = SPREAD[i - 1], [t1, k1] = SPREAD[i];
    if (k <= k1) { at = k1 === k0 ? t0 : t0 + (k - k0) / (k1 - k0) * (t1 - t0); break; }
  }
  CYAN_AT.push(k === 0 ? SPREAD[0][0] : Math.ceil(tickOf(at)) * BEAT.tick + BEAT.t0);
}

// ---------------------------------------------------------------- pixel letters

// 5 x 7, the height of a week: a word fills the calendar from Monday to Sunday
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "'": ["#", "#", ".", ".", ".", ".", "."],
};
// cells of a word centred in the 53 weeks: Map d -> column order 0..1 (for write-in)
const ART = {};
function artOf(word) {
  if (ART[word]) return ART[word];
  const glyphs = [...word].map(ch => GLYPHS[ch]);
  const width = glyphs.reduce((s, g) => s + g[0].length, 0) + glyphs.length - 1;
  let c = Math.floor((COLS - width) / 2);
  const cells = new Map();
  for (const g of glyphs) {
    for (let r = 0; r < 7; r++) for (let x = 0; x < g[r].length; x++) {
      if (g[r][x] === "#") cells.set((c + x) * 7 + r, (c + x) / COLS);
    }
    c += g[0].length + 1;
  }
  return (ART[word] = cells);
}

// ---------------------------------------------------------------- lyrics

function prepLine(l, grade) {
  const words = l.w.split(" ").map(p => { const k = p.lastIndexOf("@"); return { s: p.slice(0, k), t: +p.slice(k + 1) }; });
  const line = { words, t: words[0].t, e: l.e, text: words.map(w => w.s).join(" "), grade };
  if (l.echo) line.echo = prepLine({ w: l.echo, e: l.ee }, grade);
  return line;
}
const prep = (lines, grades) => lines.map((l, i) => prepLine(l, grades[i]));
// The damage grade follows the dose: clean while it is still a dream, worst at
// "Junkie" and "nothing left"; the whispered bridge is lucid again.
const LY = {
  year: [
    ...prep(TL.v1, [0, 0, 1, 1, 1, 2]),
    ...prep(TL.pre, [2, 2]),
    ...prep(TL.ch1, [2, 2, 3, 3, 3, 3, 4, 4]),
  ],
  v2: prep(TL.v2, [3, 3, 3, 4, 4, 5]),
  ch2: prep(TL.ch2, [4, 4, 5, 5, 5, 5, 6]),
  br: prep(TL.br, [0, 0, 1, 0, 6]),
  floor: [prepLine(TL.ease, 5), ...prep(TL.out, [4, 5, 6])],
};

// Typed word by word as it is sung: each word appears over most of its own duration.
function typedOf(line, t) {
  let s = "";
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    if (t < w.t) break;
    const next = i + 1 < line.words.length ? line.words[i + 1].t : line.e;
    const n = Math.ceil(w.s.length * span(t, w.t, w.t + clamp((next - w.t) * 0.8, 0.1, 0.4)));
    s += (i ? " " : "") + w.s.slice(0, n);
    if (n < w.s.length) break;
  }
  return s;
}
// the line on screen at t: from its first word until the next line or a short hold
function shownLine(lines, t, until = Infinity) {
  let i = -1;
  for (let j = 0; j < lines.length; j++) if (t >= lines[j].t) i = j;
  if (i < 0) return null;
  const l = lines[i], next = i + 1 < lines.length ? lines[i + 1].t : until;
  const end = Math.min(next, (l.echo ? l.echo.e : l.e) + 1.4, until);
  if (t >= end) return null;
  return { l, a: 1 - span(t, end - 0.22, end) };
}

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;
// size at which the complete line fits, so a line being typed never changes size
function fitSize(ctx, full, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, size * maxW / ctx.measureText(full).width);
}
function drawLyric(ctx, sl, t, x, y, size, maxW, color = C.textHi) {
  if (!sl) return;
  const { l, a } = sl;
  const fs = fitSize(ctx, l.text, l.grade, size, maxW);
  ctx.save();
  ctx.globalAlpha = a; ctx.textAlign = "left";
  ctx.font = gradeFont(l.grade, fs); ctx.fillStyle = color;
  ctx.fillText(typedOf(l, t), x, y);
  if (l.echo && t >= l.echo.t) {
    ctx.font = gradeFont(l.grade, Math.round(fs * 0.6)); ctx.fillStyle = C.text;
    ctx.fillText(typedOf(l.echo, t), x, y + fs * 0.8);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- interface

const mono = (size, bold) => `${bold ? 700 : 400} ${size}px "Space Mono"`;

// a symmetric 5 x 5 identicon in my grey
const AVATAR = (() => {
  const r = mulberry32(2026), g = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (r() < 0.55) { g.push([x, y]); if (x < 2) g.push([4 - x, y]); }
  return g;
})();

// o: { a, count, label, sub, handle (typed chars) }
function drawHUD(ctx, o) {
  if (o.a <= 0) return;
  ctx.save();
  ctx.globalAlpha = o.a;
  if (!o.noAvatar) {
    ctx.fillStyle = ICH[3];
    for (const [x, y] of AVATAR) ctx.fillRect(GX + x * 10, 98 + y * 10, 8, 8);
    ctx.font = mono(34, true); ctx.fillStyle = C.textHi; ctx.textAlign = "left";
    ctx.fillText("ich".slice(0, o.handle === undefined ? 3 : o.handle), GX + 70, 134);
  }
  if (o.sub) { ctx.font = mono(18); ctx.fillStyle = C.text; ctx.fillText(o.sub, GX + 70, 164); }
  if (o.count !== undefined) {
    ctx.textAlign = "right";
    ctx.font = mono(44, true); ctx.fillStyle = o.countColor || C.textHi;
    ctx.fillText(String(o.count), GX + GW, 134);
    ctx.font = mono(18); ctx.fillStyle = C.text;
    ctx.fillText(o.label, GX + GW, 164);
  }
  ctx.restore();
}

function drawTooltip(ctx, x, y, text, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = mono(19);
  const w = ctx.measureText(text).width + 30, h = 40;
  const bx = clamp(x - w / 2, 24, W - 24 - w), by = y - h - 14;
  ctx.fillStyle = C.plate; ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, by + h); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 8, by + h); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.textHi; ctx.textAlign = "left";
  ctx.fillText(text, bx + 15, by + 27);
  ctx.restore();
}

// month and weekday labels and the legend around the year at its standard place
function drawLabels(ctx, t, a, levels = 5) {
  if (a <= 0) return;
  ctx.save();
  ctx.font = mono(17); ctx.fillStyle = C.text; ctx.textAlign = "left";
  for (const [c, m] of MONTH_COLS) {
    const at = buildAt(c);
    if (t < at) continue;
    ctx.globalAlpha = a * span(t, at, at + 0.2);
    ctx.fillText(m, GX + c * P, GY - 16);
  }
  ctx.globalAlpha = a * span(t, buildAt(0), buildAt(0) + 0.3);
  ["mo", "mi", "fr"].forEach((s, i) => ctx.fillText(s, GX - 52, GY + i * 2 * P + 19));
  // legend: the scale of the dose
  const lx = GX + GW, ly = GY + GH + 44;
  ctx.textAlign = "right";
  ctx.fillText("mehr", lx, ly);
  let x = lx - ctx.measureText("mehr").width - 12;
  for (let i = levels - 1; i >= 0; i--) {
    const lvl = levels === 1 ? 2 : i;
    ctx.fillStyle = ES[lvl]; ctx.fillRect(x - 17, ly - 15, 17, 17);
    x -= 22;
  }
  ctx.fillStyle = C.text; ctx.fillText("weniger", x - 6, ly);
  ctx.restore();
}

// ---------------------------------------------------------------- cells

// flat year: look(d) -> { c, a, g (glow), dx, dy } or null
function drawFlat(ctx, x, y, p, s, look) {
  const glow = [];
  for (let d = 0; d <= TODAY; d++) {
    const v = look(d);
    if (!v) continue;
    const cx = x + ((d / 7) | 0) * p + (v.dx || 0) * p, cy = y + (d % 7) * p + (v.dy || 0) * p;
    ctx.globalAlpha = v.a === undefined ? 1 : v.a;
    ctx.fillStyle = v.c; ctx.fillRect(cx, cy, s, s);
    if (v.g) glow.push([cx, cy, v.g]);
  }
  ctx.globalAlpha = 1;
  glowCells(ctx, glow, s);
}

// cheap halo: two translucent squares added around each glowing cell
function glowCells(ctx, list, s, col = ES[4]) {
  if (!list.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = col;
  for (const [x, y, g] of list) {
    ctx.globalAlpha = 0.14 * g; ctx.fillRect(x - s * 0.3, y - s * 0.3, s * 1.6, s * 1.6);
    ctx.globalAlpha = 0.07 * g; ctx.fillRect(x - s * 0.8, y - s * 0.8, s * 2.6, s * 2.6);
  }
  ctx.restore();
}

// The year as a city: the calendar plane tilts back and every day becomes a
// bar as high as its dose. Back rows first; within a row right to left, because
// the left faces show. At sin = 0 this is the flat calendar.
function cityProj(cam, gx, gy, h) {
  const back = 6 * P + S - gy;
  return [cam.ox + gx + back * cam.shear * cam.sin, cam.oy + 6 * P + S - back * cam.cos - h * cam.sin];
}
function drawCity(ctx, cam, look) {
  const glow = [];
  const quad = (a, b, c, d, col) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  };
  for (let r = 0; r < 7; r++) for (let c = 52; c >= 0; c--) {
    const d = c * 7 + r;
    if (d > TODAY) continue;
    const v = look(d);
    if (!v) continue;
    const gx = c * P, gy = r * P, h = v.h || 0;
    ctx.globalAlpha = v.a === undefined ? 1 : v.a;
    const a = cityProj(cam, gx, gy, h), b = cityProj(cam, gx + S, gy, h);
    const cc = cityProj(cam, gx + S, gy + S, h), dd = cityProj(cam, gx, gy + S, h);
    if (h * cam.sin > 0.6) {
      // fronts lit from the roof down into the dark, so tall bars stay readable as a skyline
      const base = cityProj(cam, gx, gy + S, 0);
      const fg = ctx.createLinearGradient(0, dd[1], 0, base[1]);
      fg.addColorStop(0, mix(v.c, "#000000", 0.3)); fg.addColorStop(1, mix(v.c, "#000000", 0.86));
      quad(dd, cc, cityProj(cam, gx + S, gy + S, 0), base, fg);
      quad(a, dd, base, cityProj(cam, gx, gy, 0), mix(v.c, "#000000", 0.8));
    }
    quad(a, b, cc, dd, v.c);
    if (v.g) glow.push([Math.min(a[0], dd[0]), a[1], v.g]);
  }
  ctx.globalAlpha = 1;
  glowCells(ctx, glow, S);
}

// The streak drawn as a vein: one line through the days in calendar order, down
// each week and up into the next, a sawtooth like a heart trace. A bright pulse
// runs along it towards today.
function drawVein(ctx, pts, t, a, width = 3, speed = 70) {
  if (a <= 0 || pts.length < 2) return;
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.globalAlpha = a * 0.9; ctx.strokeStyle = mix(C.hot, ES[4], 0.35); ctx.lineWidth = width;
  if (width >= 2) { ctx.shadowColor = ES[4]; ctx.shadowBlur = 12; }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // the pulse: a short brighter stretch, one per backbeat
  const n = pts.length, head = ((t * speed) % (n + 40)) - 20;
  ctx.strokeStyle = C.hot; ctx.lineWidth = width + 1.5; ctx.globalAlpha = a;
  ctx.beginPath();
  let started = false;
  for (let i = Math.max(0, Math.floor(head - 14)); i <= Math.min(n - 1, Math.floor(head)); i++) {
    if (!started) { ctx.moveTo(pts[i][0], pts[i][1]); started = true; } else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
  ctx.restore();
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
// quarter-resolution copy of the frame for the bloom of the hot passages
const BLOOM = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = 480; c.height = 270; return c;
})();

function bloom(ctx, amount) {
  if (!BLOOM || amount <= 0) return;
  const g = BLOOM.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.filter = "blur(3px)";
  g.clearRect(0, 0, 480, 270);
  g.drawImage(ctx.canvas, 0, 0, 480, 270);
  g.filter = "none";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = amount;
  ctx.drawImage(BLOOM, 0, 0, W, H);
  ctx.restore();
}

function texture(ctx, t, amount, frozen) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(GRAIN[frozen ? 0 : Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(SCAN, "repeat"); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- the year (0 .. breakdown)

// The empty year draws itself from today backwards, one week per sixteenth.
const buildAt = c => tickTime(6 + (52 - c));
// the stop before the chorus is frozen except for the voice
const dataT = t => t >= TL.stop && t < TL.chorus ? TL.stop : t;
const ARTS = [
  { w: "WELTEN!", t: 28.3, end: 29.2, hot: 0, fade: 0 },
  { w: "WELTEN!", t: 29.2, end: 30.1, hot: 1, fade: 1.8, again: true },
  { w: "MACHT!", t: 39.15, end: 39.75, hot: 0, fade: 0 },
  { w: "MACHT!", t: 39.75, end: 40.9, hot: 1, fade: 2.0, again: true },
  { w: "OVERLOAD!", t: 82.15, end: TL.overloadEnd, hot: 1, fade: 0 },
];
// the art leaves a trace in the data: one level more where the letters were
const RESIDUE = new Set([...artOf("WELTEN!").keys(), ...artOf("MACHT!").keys()]);

function boostAt(t) {
  const keys = [[26.9, 0], [33, 1], [49.5, 1.2], [56.8, 2], [59.04, 2.2]];
  if (t <= keys[0][0]) return 0;
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], span(t, keys[i - 1][0], keys[i][0]));
  return 2.2;
}

function yearCell(d, t) {
  const dt = dataT(t);
  // the wrap: every counter back to zero, the year empty
  // the LCD keeps a ghost of the word for a while, as the old handheld screens did
  if (t >= TL.overloadEnd) {
    const ghost = artOf("OVERLOAD!").has(d) ? 1 - span(t, TL.overloadEnd, 87.6) : 0;
    return { c: mix(C.empty, ES[2], ghost * 0.8), lvl: 0, dx: tear(d % 7, t) };
  }
  const c = (d / 7) | 0, at = buildAt(c) + (d % 7) * 0.018;
  if (t < at) return null;
  // a new week flashes as it is drawn
  let col = mix(ICH[3], C.empty, span(t, at, at + 0.14));
  let lvl = 0, g = 0, who = null;
  if (PAST[d] && dt >= PAST_AT[d]) {
    who = "ich"; lvl = PAST[d]; col = mix(ICH[4], ICH[lvl], span(dt, PAST_AT[d], PAST_AT[d] + 0.25));
    // "früher nur geträumt": my own days breathe once while the line is sung
    const dream = span(dt, 20.9, 22.3) * (1 - span(dt, 25.3, 26.8));
    if (dream > 0) col = mix(col, ICH[4], dream * (0.35 + 0.35 * Math.sin(dt * 2.6 + d)));
  }
  else if (dt >= CYAN_AT[d]) {
    who = "es";
    lvl = Math.min(4, BASE[d] + Math.floor(boostAt(dt) + hash(d, 5)) + (RESIDUE.has(d) && dt > 31 ? 1 : 0));
    col = mix(C.hot, ES[lvl], span(dt, CYAN_AT[d], CYAN_AT[d] + 0.3));
    g = 1 - span(dt, CYAN_AT[d], CYAN_AT[d] + 0.3);
  }
  // the climb into the overload: everything at the top of the scale
  if (t >= 78.3 && who) { col = mix(col, who === "es" ? ES[4] : ICH[4], span(t, 78.3, 80.5)); lvl = 4; }
  for (const a of ARTS) {
    if (t < a.t || t >= a.end + a.fade) continue;
    const m = artOf(a.w);
    if (t >= TL.overloadEnd - 0.001 && a.w === "OVERLOAD!") continue;
    if (!m.has(d)) {
      if (a.w === "OVERLOAD!") { col = mix(col, ES[1], 0.6); g = 0; }
      continue;
    }
    const write = a.again ? 1 : span(t, a.t + m.get(d) * 0.2, a.t + m.get(d) * 0.2 + 0.05);
    if (write <= 0) continue;
    const fade = a.fade ? span(t, a.end, a.end + a.fade) : 0;
    const top = a.hot ? C.hot : ES[3];
    col = mix(top, col, fade);
    g = a.hot ? (1 - fade) * (a.w === "OVERLOAD!" ? 1.6 : 1) : 0;
    lvl = 4;
  }
  return { c: col, lvl, g, who };
}

// the scream tail tears the emptied screen: rows slip sideways on the hardest hits
function tear(r, t) {
  if (t < TL.overloadEnd || t >= BD[0][1] || audioAt(AUDIO_FLUX, t) < 0.5) return 0;
  return Math.round((ih(r, Math.floor(t * 15), 3) - 0.5) * 5);
}

function cityHeight(t) {
  const dt = dataT(t);
  // each "I'm addicted" is one more dose for every day
  let h = 160 * smooth(span(dt, 43.35, 45.4));
  for (const a of [50.3, 52.7, 55.05]) h += 45 * outCubic(span(dt, a, a + 0.25));
  h += 900 * outCubic(span(t, TL.chorus, TL.chorus + 0.45)) + 700 * span(t, TL.chorus + 0.45, 78.3);
  // the last "I'm addicted" drives today out of the frame again
  h += 1100 * inCubic(span(t, 74.45, 78.3));
  return h * (1 + 0.06 * accent(t) * (t >= TL.chorus ? 1 : 0));
}

const chorusOrbit = t => smooth(span(t, 63.8, 78.3)) * (1 - smooth(span(t, 78.3, 81.0)));
function yearCam(t) {
  const dt = dataT(t);
  const k = smooth(span(dt, 43.35, 45.4)) * (1 - smooth(span(t, 78.3, 81.0)));
  // through the chorus the camera sinks and swings round the city
  const orbit = chorusOrbit(t);
  const th = (0.95 - 0.22 * orbit) * k;
  return { ox: GX, oy: GY + 150 * k, cos: Math.cos(th), sin: Math.sin(th), shear: 0.34 + 0.55 * orbit, k };
}

function countYear(t) {
  const dt = dataT(t);
  if (dt < TL.slam) {
    let n = 0;
    for (let d = 0; d <= TODAY; d++) if (PAST[d] && dt >= PAST_AT[d]) n += PAST_N[d];
    return n;
  }
  if (t >= TL.overloadEnd) return -32768;
  const keys = [[TL.slam, PAST_SUM + 1], [20.9, PAST_SUM + 46], [33, 900], [43.35, 2600], [49.5, 4100], [56.8, 7400], [78.3, 27100], [81.25, 32767]];
  if (dt >= 81.25) return 32767;
  for (let i = 1; i < keys.length; i++) if (dt < keys[i][0]) return Math.round(loglerp(keys[i - 1][1], keys[i][1], span(dt, keys[i - 1][0], keys[i][0])));
  return 32767;
}

function sceneYear(ctx, t) {
  const dt = dataT(t);
  const cam = yearCam(t);
  const hmax = cityHeight(t);

  // camera: a slight push in the chorus, then into the empty year for the breakdown
  // the slam pushes in so the towers leave the frame; "I can build it all" pulls back to the whole skyline
  const zChorus = (0.12 * outCubic(span(t, TL.chorus, TL.chorus + 0.3)) - 0.52 * smooth(span(t, 61.66, 64.2)) - 0.06 * span(t, 64.2, 78.3))
    * (1 - smooth(span(t, 78.3, 81.0)));
  const zIn = smooth(span(t, TL.overloadEnd + 0.4, TL.breakdown[0][1]));
  const front = cam.oy + 6 * P + S;
  const qx = lerp(960, GX + GW / 2, zIn), qy = lerp(front, GY + GH / 2, zIn);
  const px = qx - 170 * chorusOrbit(t), py = lerp(front, 540, zIn);
  const z = 1 + zChorus + 0.42 * zIn;
  // the overload trembles on the sixteenths
  const shake = t >= 81.25 && t < TL.overloadEnd ? (ih(Math.floor(tickOf(t)), 77) - 0.5) * (t >= 82.15 ? 10 : 4) : 0;

  ctx.save();
  ctx.translate(px + shake, py); ctx.scale(z, z); ctx.translate(-qx, -qy);

  if (t >= 0.05 && t < TL.riff + 0.35) {
    // boot: one empty cell in the middle of the void, then it takes its place as today
    const m = outCubic(span(t, TL.riff, TL.riff + 0.35));
    const x = lerp(W / 2 - S / 2, GX + 52 * P, m), y = lerp(H / 2 - S / 2, GY + 4 * P, m);
    const pop = outCubic(span(t, 0.05, 0.2));
    ctx.fillStyle = mix(C.hot, C.empty, span(t, 0.05, 0.9) * 0.85);
    ctx.fillRect(x + S / 2 * (1 - pop), y + S / 2 * (1 - pop), S * pop, S * pop);
  }

  if (cam.sin > 0.001) {
    drawCity(ctx, cam, d => {
      const v = yearCell(d, t);
      if (!v) return null;
      v.h = v.lvl ? (v.who === "ich" ? 0.05 : SHAPE[d]) * hmax : 0;
      return v;
    });
  } else {
    drawFlat(ctx, GX, GY, P, S, d => yearCell(d, t));
  }

  // the cursor: my hover on today, from the boot until the first dose has landed
  if (t >= TL.riff + 0.35 && t < 16.6) {
    ctx.save();
    // the cursor waits on today and twitches with the riff
    ctx.globalAlpha = (0.55 + 0.45 * audioAt(AUDIO_FLUX, t)) * (1 - span(t, 16.2, 16.6));
    ctx.strokeStyle = C.textHi; ctx.lineWidth = 2;
    ctx.strokeRect(GX + 52 * P - 3, GY + 4 * P - 3, S + 6, S + 6);
    ctx.restore();
  }

  // the vein: the skyline of the streak, one point per week on its highest roof,
  // growing back from today while the streak grows
  if (dt >= 49.5 && t < 78.3) {
    const streak = Math.min(TODAY, Math.floor(spreadAt(dt)));
    const first = TODAY - Math.floor(streak * (t >= TL.chorus ? 1 : smooth(span(dt, 49.5, 56.8))));
    const pts = [];
    for (let c = (first / 7) | 0; c <= 52; c++) {
      let best = null;
      for (let r = 0; r < 7; r++) {
        const d = c * 7 + r;
        if (d < first || d > TODAY) continue;
        const v = yearCell(d, t);
        if (!v || !v.lvl) continue;
        const h = (v.who === "ich" ? 0.05 : SHAPE[d]) * hmax;
        if (best === null || h > best) best = h;
      }
      // at the depth of the front row, so the line is the envelope and does not zigzag in depth
      if (best !== null) pts.push(cityProj(cam, c * P + S / 2, 6 * P + S, best));
    }
    const veinA = t >= TL.chorus ? lerp(0.3, 1, span(t, 69.08, 69.6)) * (1 - 0.6 * span(t, 73.95, 76.5)) : 1;
    const swell = span(t, 69.08, 69.5) * (1 - span(t, 73.95, 75));
    drawVein(ctx, pts, t, veinA * (1 - span(t, 77.0, 78.3)), (5 + 5 * swell) / z, 24 + 30 * swell);
  }
  ctx.restore();

  // interface around the year, fading while it is a city
  const flat = Math.pow(1 - cam.k, 3);
  drawLabels(ctx, t, flat * (1 - span(t, TL.overloadEnd, TL.overloadEnd + 1.2)));
  const hudA = span(t, 1.6, 2.2) * lerp(1, 0, smooth(span(dt, 43.35, 44.6)) * (1 - span(t, 80.2, 81.0))) * (1 - span(t, 86.4, 87.6));
  const count = countYear(t);
  drawHUD(ctx, {
    a: hudA, handle: Math.floor(span(t, 1.9, 2.35) * 3 + 0.001),
    count: t >= 9.0 ? count : undefined, label: "commits im letzten jahr",
    countColor: count < 0 && Math.floor(t / 0.3) % 2 ? ES[4] : C.textHi,
  });

  // tooltips: the first hover, a year ago and today
  const todayAnchor = cityProj(cam, 52 * P + S / 2, 4 * P, SHAPE[TODAY] * hmax);
  const toScreen = ([x, y]) => [px + (x - qx) * z, py + (y - qy) * z];
  if (t >= TL.soft && t < 16.6) {
    const n = t >= TL.slam ? 1 : 0;
    drawTooltip(ctx, GX + 52 * P + S / 2, GY + 4 * P - 4, `${fmtDate(TODAY)}: ${n} commit${n === 1 ? "" : "s"}`, span(t, TL.soft, TL.soft + 0.2) * (1 - span(t, 16.3, 16.6)));
  }
  if (t >= 34.6 && t < 36.2) drawTooltip(ctx, GX + 0 * P + S / 2 + P * ((TODAY - 365) / 7 | 0), GY + ((TODAY - 365) % 7) * P - 4, `${fmtDate(TODAY - 365)}: 0 commits`, span(t, 34.6, 34.75));
  if (t >= 36.2 && t < 37.9) drawTooltip(ctx, GX + 52 * P + S / 2, GY + 4 * P - 4, `${fmtDate(TODAY)}: 214 commits`, 1 - span(t, 37.7, 37.9));
  // the streak counts the days of use, up to the full year at the stop
  if (dt >= 49.5 && t < TL.chorus + 0.3) {
    const n = Math.min(TODAY + 1, Math.floor(spreadAt(dt) * smooth(span(dt, 49.5, 56.8))) + 1);
    drawTooltip(ctx, todayAnchor[0], todayAnchor[1] - 6, `serie: ${n} tage`, span(dt, 49.5, 49.8) * (1 - span(t, TL.chorus, TL.chorus + 0.3)));
  }
  if (t >= 71.72 && t < 74.3) {
    const [sx, sy] = toScreen(todayAnchor);
    drawTooltip(ctx, sx, Math.max(90, sy - 6), `serie: ${TODAY + 1} tage`, span(t, 71.72, 71.9) * (1 - span(t, 74.0, 74.3)));
  }

  // the lyric: below the year, lower while it stands as a city
  const sl = shownLine(LY.year, t, TL.overloadEnd + 0.6);
  if (sl) {
    const city = sl.l.t >= 43.3 && sl.l.t < 78.3;
    drawLyric(ctx, sl, t, GX, city ? 975 : 830, 96, GW);
  }
  return t >= 82.15 && t < TL.overloadEnd ? 0.55 : (t >= TL.slam && t < TL.slam + 0.3 ? 0.3 : 0.12);
}

// ---------------------------------------------------------------- breakdown

// Zoomed into the emptied year; each shouted word fills the week rows.
const BD = TL.breakdown;
const BDZ = 1.42;
function sceneBreakdown(ctx, t) {
  ctx.save();
  ctx.translate(960, 540); ctx.scale(BDZ, BDZ); ctx.translate(-(GX + GW / 2), -(GY + GH / 2));
  let i = -1;
  for (let j = 0; j < BD.length; j++) if (t >= BD[j][1]) i = j;
  const [word, t0] = BD[i];
  const m = artOf(word);
  const tk = Math.floor(tickOf(t));
  drawFlat(ctx, GX, GY, P, S, d => {
    if (!m.has(d)) return { c: C.empty };
    const order = m.get(d);
    const write = span(t, t0 + order * 0.12, t0 + order * 0.12 + 0.04);
    if (word === "BREAK!") {
      // the word arrives broken: cells knocked out of the grid, some missing, the rest sagging
      if (hash(d, 11) < 0.16) return { c: C.empty };
      const crack = outCubic(span(t, t0, t0 + 0.18));
      const fall = inCubic(span(t, t0 + 0.4, BD[i + 1][1])) * (hash(d, 13) < 0.35 ? 2.4 : 0.3);
      return { c: ES[3], dx: (hash(d, 7) - 0.5) * 0.7 * crack, dy: (hash(d, 8) - 0.35) * 0.8 * crack + fall };
    }
    if (word === "CREATE!") return { c: mix(C.hot, ES[4], span(t, t0 + 0.8, t0 + 1.6) * 0.6), g: write * (1.4 - 0.6 * span(t, t0, t0 + 1.5)), a: write };
    if (word === "MINE?") return { c: ICH[4], a: write };
    if (word === "HIS?") return { c: ES[4], a: write, g: write * 0.6 };
    // ownership flips at most every 0.6 s, so the word never strobes
    if (word === "WHO'S?") return { c: ih(d, tk >> 2) < 0.5 ? ICH[4] : ES[4], a: write };
    return { c: ES[3], a: write };
  });
  ctx.restore();
  return word === "CREATE!" ? 0.35 : 0.1;
}

// ---------------------------------------------------------------- five projects

const PROJECTS = ["neunundachtzig-tabs", "system-prompt", "empire-of-ai", "prompt-engineer", "lost-in-the-vault", "god-machine", "ich-predicte-dich", "loving-grace", "good-morning"];
const LP = 16, LS = 13, LANE_W = COLS * LP - (LP - LS), LANE_H = ROWS * LP - (LP - LS);
const LANE_X = 560, LANE_Y = 205, LANE_GAP = 26;
const laneY = i => LANE_Y + i * (LANE_H + LANE_GAP);
const LANE_AT = [97.44, 97.6, 97.9, 98.25, 98.55];
// how far into the night each lane already is before the years start to run
const LANE_FILL = [0.55, 0.3, 0.75, 0.45, 0.2];
const CARD = { w: 520, h: 190, gx: 28, gy: 24, x: 152, y: 206 };
const cardXY = i => [CARD.x + (i % 3) * (CARD.w + CARD.gx), CARD.y + Math.floor(i / 3) * (CARD.h + CARD.gy)];
const CARD_AT = [107.6, 107.6, 107.6, 107.6, 107.6, 108.75, 109.05, 109.35, 109.65];
const MP = 8, MS = 6;  // the card's thumbnail calendar

// years per lane: the strip of years scrolls left, faster and faster, in one night
function laneSpeed(t) {
  return 190 * smooth(span(t, 99.22, 101.36)) * (1 - smooth(span(t, 102.9, 103.6)));
}
function laneScroll(i, t) {
  const a = 99.22, b = Math.min(t, 103.6);
  if (b <= a) return 0;
  const n = 60, h = (b - a) / n;
  let s = 0;
  for (let k = 0; k < n; k++) s += laneSpeed(a + (k + 0.5) * h) * h;
  return s * (0.82 + 0.09 * i);
}
const YEAR_U = COLS + 2;

function laneCell(i, u, r, t) {
  // u: column in the strip of years; the first year is the one already begun
  const y = Math.floor(u / YEAR_U), c = u - y * YEAR_U;
  if (c >= COLS) return null;
  const h = ih(i * 131 + y, c, r);
  if (y === 0 && c / COLS > LANE_FILL[i] + 0.05 * Math.sin(r)) return C.empty;
  if (y === 0 && h < 0.18) return C.empty;
  const lvl = y === 0 ? 1 + Math.floor(h * 4) : 3 + (h < 0.5 ? 1 : 0);
  return ES[Math.min(4, lvl)];
}

function sceneProjects(ctx, t) {
  const toCards = smooth(span(t, 107.6, 108.2));
  const power = t >= 103.34 && t < 107.6 ? accent(t) : 0;
  const owners = t >= 110.6;
  const lost = t >= 114.3;
  const tk = Math.floor(tickOf(t));

  // the breakdown's year shrinks into the first lane
  const shrink = smooth(span(t, TL.verse2, TL.verse2 + 1.0));
  if (shrink < 1) {
    const p = Math.exp(lerp(Math.log(P * BDZ), Math.log(LP), shrink));
    const cx = lerp(960, LANE_X + LANE_W / 2, shrink), cy = lerp(540, laneY(0) + LANE_H / 2, shrink);
    const ox = cx - (COLS * p - p * (1 - S / P)) / 2, oy = cy - (ROWS * p - p * (1 - S / P)) / 2;
    const m = artOf("WHO'S?");
    drawFlat(ctx, ox, oy, p, p * S / P, d => ({ c: m.has(d) ? mix(ih(d, 3) < 0.5 ? ICH[4] : ES[4], C.empty, shrink) : C.empty }));
  }

  for (let i = 0; i < 9; i++) {
    const [cx, cy] = cardXY(i);
    const lane = i < 5;
    if (!lane && t < CARD_AT[i]) continue;
    if (lane && t < (i === 0 ? TL.verse2 + 1.0 : LANE_AT[i])) continue;
    const appear = lane ? (i === 0 ? 1 : outCubic(span(t, LANE_AT[i], LANE_AT[i] + 0.25))) : outCubic(span(t, CARD_AT[i], CARD_AT[i] + 0.25));
    // card frame
    const frameA = lane ? toCards : appear;
    if (frameA > 0) {
      ctx.save();
      ctx.globalAlpha = frameA;
      ctx.fillStyle = C.plate; ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx, cy + (1 - appear) * 30, CARD.w, CARD.h, 6); ctx.fill(); ctx.stroke();
      ctx.font = mono(24, true); ctx.fillStyle = C.textHi; ctx.textAlign = "left";
      ctx.fillText(PROJECTS[i], cx + 48, cy + 46 + (1 - appear) * 30);
      ctx.font = mono(22); ctx.fillStyle = C.text;
      ctx.fillText("★ 0", cx + 48, cy + 166);
      if (owners) {
        const me = ih(i, (tk >> 2) + i) < 0.5;
        ctx.textAlign = "right"; ctx.font = mono(22, true);
        const label = lost ? "autor: " : `autor: ${me ? "ich" : "es"}`;
        ctx.fillStyle = lost ? C.text : me ? ICH[4] : ES[4];
        ctx.fillText(label, cx + CARD.w - 34, cy + 166);
        if (lost && Math.floor(t / 0.5) % 2 === 0) ctx.fillRect(cx + CARD.w - 30, cy + 147, 3, 24);
      }
      ctx.restore();
    }
    // the calendar inside: a lane before, a thumbnail after
    const lx = lerp(LANE_X, cx + 48, lane ? toCards : 1), ly = lerp(laneY(i), cy + 66 + (1 - appear) * 30, lane ? toCards : 1);
    const p = lerp(LP, MP, lane ? toCards : 1), s = lerp(LS, MS, lane ? toCards : 1);
    // as a trophy the thumbnail shows one whole year, no longer the running strip
    const cardMode = !lane || toCards > 0.5;
    const scroll = cardMode ? 0 : laneScroll(i, t);
    const off = scroll - Math.floor(scroll);
    const me = owners ? ih(i, (tk >> 2) + i) < 0.5 : false;
    ctx.save();
    ctx.beginPath(); ctx.rect(lx - 1, ly - 1, COLS * p + 2, ROWS * p + 2); ctx.clip();
    ctx.globalAlpha = appear;
    for (let c = 0; c <= COLS; c++) {
      const u = Math.floor(scroll) + c;
      for (let r = 0; r < 7; r++) {
        let col;
        if (cardMode) {
          if (c >= COLS || c * 7 + r > TODAY) continue;
          col = ES[3 + (ih(i, c, r) < 0.5 ? 1 : 0)];
        } else col = laneCell(i, u, r, t);
        if (!col) continue;
        if (i === 0 && t < LANE_AT[0]) col = mix(C.empty, col, span(t, TL.verse2 + 1.0, LANE_AT[0]));
        if (owners && col !== C.empty) col = lost ? (ih(i * 7 + c, r) < 0.5 ? ICH[3] : ES[3]) : me ? ICH[3 + (ih(c, r) < 0.5 ? 1 : 0)] : col;
        if (power > 0 && col !== C.empty) col = mix(col, C.hot, power * 0.45);
        ctx.fillStyle = col;
        ctx.fillRect(lx + (c - off) * p, ly + r * p, s, s);
      }
    }
    ctx.restore();
    // lane labels: the project and the year it has reached
    if (lane && toCards < 1) {
      ctx.save();
      ctx.globalAlpha = appear * (1 - toCards);
      ctx.font = mono(19); ctx.fillStyle = C.text; ctx.textAlign = "right";
      ctx.fillText(PROJECTS[i], LANE_X - 28, laneY(i) + 62);
      // the year each lane has reached, an odometer running through the night
      ctx.textAlign = "left"; ctx.fillStyle = C.textHi; ctx.font = mono(40, true);
      const year = 2026 + Math.floor((laneScroll(i, t) + COLS * LANE_FILL[i]) / YEAR_U);
      ctx.fillText(String(year), LANE_X + LANE_W + 30, laneY(i) + 70);
      ctx.restore();
    }
  }

  const keys = [[TL.verse2, 0], [97.44, 0], [99.22, 380], [102.9, 186000], [107.5, 241000], [117.2, 322000]];
  let n = 0;
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { n = Math.round(loglerp(keys[i - 1][1], keys[i][1], span(t, keys[i - 1][0], keys[i][0]))); break; }
  drawHUD(ctx, {
    a: span(t, TL.verse2 + 0.6, TL.verse2 + 1.2), count: n, label: "commits heute nacht",
    sub: t < 101.36 ? "02:14" : "02:15",
  });
  drawLyric(ctx, shownLine(LY.v2, t, TL.chorus2), t, CARD.x, 960, 96, W - 2 * CARD.x);
  return power > 0 ? 0.25 * power + 0.1 : 0.1;
}

// ---------------------------------------------------------------- the wall of years

// World units are cells. Block (i, j) is one year of one project; the year at
// (0, 0) is the year of the verse, so the wall can zoom back into it.
const BW = COLS + 3, BH = ROWS + 2;
// cam: { p (pixel pitch), fx, fy (world point), sx, sy (where it lands) }
function wallView(cam) {
  const x0 = Math.floor((0 - cam.sx) / cam.p + cam.fx) - 1, x1 = Math.ceil((W - cam.sx) / cam.p + cam.fx) + 1;
  const y0 = Math.floor((0 - cam.sy) / cam.p + cam.fy) - 1, y1 = Math.ceil((H - cam.sy) / cam.p + cam.fy) + 1;
  return { x0, x1, y0, y1 };
}
// look(X, Y, i, j, d) -> colour or null; returns the glow list
function drawWall(ctx, cam, look) {
  const v = wallView(cam), s = cam.p * S / P;
  for (let j = Math.floor(v.y0 / BH); j <= Math.floor(v.y1 / BH); j++) {
    for (let i = Math.floor(v.x0 / BW); i <= Math.floor(v.x1 / BW); i++) {
      for (let c = 0; c < COLS; c++) {
        const X = i * BW + c;
        if (X < v.x0 || X > v.x1) continue;
        const sx = cam.sx + (X - cam.fx) * cam.p;
        for (let r = 0; r < 7; r++) {
          const d = c * 7 + r;
          if (d > TODAY) continue;
          const Y = j * BH + r;
          if (Y < v.y0 || Y > v.y1) continue;
          const col = look(X, Y, i, j, d);
          if (!col) continue;
          ctx.fillStyle = col;
          ctx.fillRect(sx, cam.sy + (Y - cam.fy) * cam.p, s, s);
        }
      }
    }
  }
}
const wallLevel = (i, j, d) => {
  const h = ih(i * 977 + 13, j * 619 + 7, d);
  if (h < 0.05) return 0;
  if (h < 0.11) return -1 - Math.floor(ih(i, j, d + 999) * 3);  // grey: mine
  const g = ih(d, i, j);
  return g < 0.1 ? 1 : g < 0.3 ? 2 : g < 0.6 ? 3 : 4;
};
const wallColor = lvl => lvl < 0 ? ICH[-lvl + 1] : ES[lvl];
// ---------------------------------------------------------------- the facade of trophies

// The nine trophies of the verse are part of an endless wall of them; the
// chorus pulls back until the wall is a facade of lit windows, hung together by
// cables like the lines of a drip. The thumbnails are pre-drawn, because at the
// end hundreds of cards are visible at once.
const THUMBS = typeof document === "undefined" ? [] : Array.from({ length: 8 }, (_, v) => {
  const c = document.createElement("canvas"); c.width = COLS * MP; c.height = ROWS * MP;
  const g = c.getContext("2d");
  for (let d = 0; d <= TODAY; d++) {
    const h = ih(v, d, 41);
    g.fillStyle = h < 0.05 ? C.empty : h < 0.1 ? ICH[3] : ES[h < 0.4 ? 3 : 4];
    g.fillRect(((d / 7) | 0) * MP, (d % 7) * MP, MS, MS);
  }
  return c;
});
const WORDS = ["welten", "macht", "vision", "venen", "serie", "dosis", "grenzen", "nacht", "architekt", "build", "break", "create", "trophäe", "werk"];
const cardName = (col, row) => {
  if (col >= 0 && col < 3 && row >= 0 && row < 3) return PROJECTS[row * 3 + col];
  return `${WORDS[Math.floor(ih(col, row, 3) * WORDS.length)]}-${1 + Math.floor(ih(col, row, 4) * 99)}`;
};
const CPX = CARD.w + CARD.gx, CPY = CARD.h + CARD.gy;
// the thumbnail of card (1, 1) becomes the year of the bridge at its standard place
const MSB = MP * S / P;  // cell size of the thumbnail in the proportions of the big year
const THUMB_C = { x: CARD.x + CPX + 48 + (COLS * MP - (MP - MSB)) / 2, y: CARD.y + CPY + 66 + (ROWS * MP - (MP - MSB)) / 2 };
const BRIDGE_Z = P / MP;

function facadeCam(t) {
  const end = 135.9;
  let z = Math.exp(lerp(0, Math.log(0.27), smooth(span(Math.min(t, end), TL.chorus2, end))));
  z *= 1 + 0.025 * accent(Math.min(t, end));
  const k = smooth(span(t, 136.0, TL.bridge));
  return {
    z: Math.exp(lerp(Math.log(z), Math.log(BRIDGE_Z), k)),
    sx: lerp(THUMB_C.x, GX + GW / 2, k), sy: lerp(THUMB_C.y, GY + GH / 2, k), k,
  };
}

function sceneWall(ctx, t) {
  const end = 135.9, tt = Math.min(t, end);
  const cam = facadeCam(t);
  const X = x => cam.sx + (x - THUMB_C.x) * cam.z, Y = y => cam.sy + (y - THUMB_C.y) * cam.z;
  const c0 = Math.floor((CARD.x + (0 - cam.sx) / cam.z + THUMB_C.x - CARD.x) / CPX) - 1;
  const c1 = Math.ceil(((W - cam.sx) / cam.z + THUMB_C.x - CARD.x) / CPX) + 1;
  const r0 = Math.floor(((0 - cam.sy) / cam.z + THUMB_C.y - CARD.y) / CPY) - 1;
  const r1 = Math.ceil(((H - cam.sy) / cam.z + THUMB_C.y - CARD.y) / CPY) + 1;
  const ak = Math.floor(tickOf(tt) / 8);  // one backbeat
  const lit = lerp(0.55, 1, smooth(span(tt, 118.86, 121.5)));
  const hot = smooth(span(tt, 131.5, end));
  const drain = span(t, end, 137.0);
  const waveT = span(tt, 121.66, 124.2);
  const veinA = span(tt, 126.6, 127.2) * (1 - span(tt, 131.4, 132.4));
  const textA = clamp((cam.z - 0.32) / 0.2) * (1 - clamp((cam.z - 1.3) / 0.3));
  const cables = [];
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
    const x = CARD.x + col * CPX, y = CARD.y + row * CPY;
    const sx = X(x), sy = Y(y), w = CARD.w * cam.z, h = CARD.h * cam.z;
    if (sx > W || sy > H || sx + w < 0 || sy + h < 0) continue;
    const centre = col === 1 && row === 1;
    ctx.fillStyle = C.plate; ctx.fillRect(sx, sy, w, h);
    if (cam.z > 0.25) { ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5; ctx.strokeRect(sx, sy, w, h); }
    const tx = X(x + 48), ty = Y(y + 66), tw = COLS * MP * cam.z, th = ROWS * MP * cam.z;
    // windows going on, a few more on every backbeat, until all are lit
    const on = ih(col, row, ak) < lit || centre;
    if (centre && cam.z > 1.2) {
      drawFlat(ctx, tx, ty, MP * cam.z, MSB * cam.z, () => ({ c: mix(ES[3], ES[2], drain) }));
    } else {
      ctx.globalAlpha = on ? 1 : 0.22;
      ctx.drawImage(THUMBS[Math.floor(ih(col, row, 9) * THUMBS.length)], tx, ty, tw, th);
      ctx.globalAlpha = 1;
      // all windows flare on the downbeat of the chorus
      let over = 0.75 * (1 - span(t, TL.chorus2, TL.chorus2 + 0.35)), col2 = C.hot;
      if (waveT > 0 && waveT < 1) {
        const w0 = Math.abs((tx + ty * 0.5) / W - (waveT * 1.9 - 0.2));
        over = Math.max(over, clamp(1 - w0 / 0.1) * 0.85);
      }
      if (hot > 0) over = Math.max(over, hot * (0.35 + 0.4 * ih(col, row, tickOf(tt) >> 2)));
      if (drain > 0) { over = drain; col2 = ES[2]; }
      if (over > 0) { ctx.globalAlpha = over; ctx.fillStyle = col2; ctx.fillRect(tx, ty, tw, th); ctx.globalAlpha = 1; }
    }
    if (textA > 0) {
      ctx.globalAlpha = textA;
      ctx.font = mono(24 * cam.z, true); ctx.fillStyle = C.textHi; ctx.textAlign = "left";
      ctx.fillText(cardName(col, row), X(x + 48), Y(y + 46));
      ctx.font = mono(22 * cam.z); ctx.fillStyle = C.text;
      ctx.fillText("★ 0", X(x + 48), Y(y + 166));
      ctx.globalAlpha = 1;
    }
    if (veinA > 0) cables.push([sx + w, Y(y + 66 + 27), sx + w + CARD.gx * cam.z + 48 * cam.z, col, row]);
  }
  // the drip lines: one sagging cable from each card into the next
  if (cables.length) {
    ctx.save();
    ctx.globalAlpha = veinA; ctx.strokeStyle = ES[3]; ctx.lineWidth = Math.max(1.5, 4 * cam.z);
    ctx.shadowColor = ES[4]; ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const [x0, y0, x1] of cables) {
      ctx.moveTo(x0 - 48 * cam.z, y0); ctx.lineTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 120 * cam.z, x1, y0);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // a drop runs along every cable
    ctx.fillStyle = C.hot;
    for (const [x0, y0, x1, col, row] of cables) {
      const k = ((t * 0.9 + ih(col, row, 5)) % 1);
      const x = lerp(x0, x1, k), y = y0 + 2 * (1 - k) * k * 120 * cam.z;
      const r = Math.max(2, 7 * cam.z);
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  // the band for the lyric
  const band = 1 - cam.k;
  if (band > 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 830, 0, 880);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalAlpha = band; ctx.fillStyle = g; ctx.fillRect(0, 830, W, 50); ctx.fillStyle = "#000"; ctx.fillRect(0, 879, W, H - 879);
    ctx.restore();
  }
  drawLyric(ctx, shownLine(LY.ch2, t, 136.6), t, GX, 990, 96, GW);
  return 0.15 + hot * 0.45;
}

// ---------------------------------------------------------------- bridge

function sceneBridge(ctx, t) {
  const gott = smooth(span(t, 151.8, 154.55));
  const tk = Math.floor(tickOf(t));
  // the arpeggio walks through the days from the first, one per sixteenth
  const play = t >= 137.9 && t < 151.8 ? (tk - Math.floor(tickOf(137.9))) % (TODAY + 1) : -1;
  // a slow push into the flat year, the only movement of the whisper
  const z = 1 + 0.14 * smooth(span(t, TL.bridge, 157.0));
  ctx.save();
  ctx.translate(GX + GW / 2, GY + GH / 2); ctx.scale(z, z); ctx.translate(-(GX + GW / 2), -(GY + GH / 2));
  drawFlat(ctx, GX, GY, P, S, d => {
    const col = gott > 0 ? mix(ES[2], C.hot, gott) : ES[2];
    // in the negative the glow is a bruise, and it spreads until the band comes back
    return { c: col, g: gott * 1.2 * (1 + 2.5 * span(t, 157.0, TL.flight)) };
  });
  if (play >= 0) {
    const a = span(t, 137.9, 138.4) * (1 - span(t, 151.4, 151.8));
    const x = GX + ((play / 7) | 0) * P, y = GY + (play % 7) * P;
    ctx.globalAlpha = a; ctx.fillStyle = C.hot; ctx.fillRect(x, y, S, S); ctx.globalAlpha = 1;
    glowCells(ctx, [[x, y, a]], S);
  }
  const enter = span(t, TL.bridge, TL.bridge + 0.8);
  drawLabels(ctx, t, (1 - gott) * enter, 1);
  ctx.restore();
  drawHUD(ctx, { a: (1 - gott) * enter });
  const sl = shownLine(LY.br, t, TL.flight);
  drawLyric(ctx, sl, t, GX, 830, 104, GW, C.textHi);
  return 0.1 + gott * 0.55;
}

// ---------------------------------------------------------------- flight and outro

// Five lanes of years laid as a floor, the calendar seen from just above, and
// a flight over it that needs no effort: the 16-bit racing floor, made of days.
const FL = { F: 1100, lanes: 5 };
const laneX = (L, r) => L * 10 + r;
const CAM_X0 = laneX(2, 3) + 0.41;
function flightSpeed(t) {
  // weeks per second
  if (t < TL.flight) return 0;
  const v = lerp(9, 14, span(t, TL.flight, 166.4)) + 14 * span(t, 166.4, 174.8);
  return v * (1 - smooth(span(t, TL.outroDrop, 177.6)));
}
function flightZ(t) {
  const a = TL.flight, b = Math.min(t, 177.7);
  if (b <= a) return 0;
  const n = 120, h = (b - a) / n;
  let s = 0;
  for (let k = 0; k < n; k++) s += flightSpeed(a + (k + 0.5) * h) * h;
  return s;
}
const STOP_Z = flightZ(177.7);
// the last cells: "one more", "one more", and the one that is left
const ONE = [{ x: laneX(2, 3), z: Math.floor(STOP_Z) + 6, t: 175.5 }, { x: laneX(2, 4), z: Math.floor(STOP_Z) + 6, t: 178.4 }];
const LAST = ONE[0];

function floorCam(t) {
  const crane = smooth(span(t, 183.5, 187.0));
  const z = flightZ(t);
  const h0 = 1.7, h1 = FL.F * 0.82 / S;
  return {
    x: lerp(CAM_X0, LAST.x + 0.41, crane),
    z: lerp(z, LAST.z + 0.41, crane),
    h: Math.exp(lerp(Math.log(h0), Math.log(h1), crane)),
    a: lerp(0.07, Math.PI / 2, crane),
    roll: 0.075 * Math.sin(2 * Math.PI * (t - TL.flight) / 4.8) * span(t, 163, 168) * (1 - smooth(span(t, TL.outroDrop, 177.6))),
  };
}
function project(cam, X, Z) {
  const x = X - cam.x, y = -cam.h, z = Z - cam.z;
  const ca = Math.cos(cam.a), sa = Math.sin(cam.a);
  const depth = -y * sa + z * ca, up = y * ca + z * sa;
  if (depth < 0.05) return null;
  return [960 + x * FL.F / depth, 540 - up * FL.F / depth, depth];
}

function floorLevel(L, w, r) {
  const h = ih(L * 31 + 5, w, r);
  if (h < 0.08) return 0;
  if (h < 0.13) return -1;
  return 1 + Math.floor(ih(w, L, r) * 4);
}

function sceneFloor(ctx, t) {
  const cam = floorCam(t);
  const dark = span(t, TL.outroDrop, 183.5);
  const ashFade = 1 - span(t, 187.0, 188.6);
  const acc = t < TL.outroDrop ? accent(t) : 0;
  ctx.save();
  ctx.translate(960, 540); ctx.rotate(cam.roll); ctx.translate(-960, -540);
  // light at the end of the floor
  if (cam.a < 1.2) {
    const yH = 540 - FL.F * Math.tan(cam.a), glowA = 0.22 * (1 - dark) * (1 - span(cam.a, 0.2, 1.2));
    const g = ctx.createLinearGradient(0, yH - 70, 0, yH + 20);
    g.addColorStop(0, "rgba(110,234,255,0)"); g.addColorStop(0.8, `rgba(110,234,255,${glowA})`); g.addColorStop(1, "rgba(110,234,255,0)");
    ctx.fillStyle = g; ctx.fillRect(-400, yH - 70, W + 800, 90);
  }
  const zFar = cam.a > 0.6 ? 26 : 80;
  const w0 = Math.floor(cam.z - (cam.a > 0.6 ? 26 : 0)), w1 = Math.ceil(cam.z + zFar);
  for (let w = w1; w >= w0; w--) {
    for (let L = 0; L < FL.lanes; L++) for (let r = 0; r < 7; r++) {
      const X = laneX(L, r);
      const a = project(cam, X, w), b = project(cam, X + 0.82, w), c = project(cam, X + 0.82, w + 0.82), d = project(cam, X, w + 0.82);
      if (!a || !b || !c || !d) continue;
      if (Math.max(a[0], b[0], c[0], d[0]) < 0 || Math.min(a[0], b[0], c[0], d[0]) > W) continue;
      if (Math.max(a[1], c[1]) < 0 || Math.min(a[1], c[1]) > H) continue;
      const lvl = floorLevel(L, w, r);
      let col = lvl < 0 ? ICH[2] : ES[lvl];
      const one = ONE.findIndex(o => o.x === X && o.z === w);
      if (dark > 0) {
        // the 8-bit decay: everything dims, then the days go out one at a time,
        // the far ones sooner, until only the last one is left
        col = mix(col, ES[1], 0.45 * span(t, TL.outroDrop, 176.6));
        const dist = Math.hypot(X - LAST.x, (w - LAST.z) * 0.6);
        const u = clamp(0.6 * ih(L * 7 + r, w, 99) + 0.4 * (1 - clamp(dist / 45)));
        const dieAt = lerp(175.9, 183.2, u);
        let k = span(t, dieAt, dieAt + 0.12);
        if (one === 0) k = 0;
        if (one === 1) k = span(t, 182.95, 183.1);
        col = mix(col, C.dead, k);
      }
      if (one >= 0 && t >= ONE[one].t && !(one === 1 && t >= 183.1)) col = C.hot;
      if (acc > 0 && lvl > 0) col = mix(col, C.hot, acc * 0.25);
      const fog = cam.a < 0.6 ? clamp(1 - (a[2] - 2) / (zFar - 4)) : 1;
      let alpha = fog;
      if (!(one === 0)) alpha *= ashFade;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // "Claude Code in den Venen": the vein from the last cells along the lane to the horizon
  const veinA = span(t, 179.6, 180.0) * (1 - span(t, 181.74, 183.3));
  if (veinA > 0) {
    const pts = [];
    const reach = lerp(1, 0, span(t, 181.74, 183.3));
    for (let w = LAST.z; w < LAST.z + 22 * reach; w++) for (let r = 0; r < 7; r++) {
      const q = project(cam, laneX(2, r) + 0.41, w + 0.41);
      if (q) pts.push(q);
    }
    drawVein(ctx, pts, t, veinA, 4, 40);
  }
  ctx.restore();

  const keys = [[TL.flight, 2104337], [TL.outroDrop, 9800000]];
  const n = Math.round(loglerp(keys[0][1], keys[1][1], span(t, keys[0][0], keys[1][0])));
  drawHUD(ctx, { a: 1 - span(t, TL.outroDrop, 177.0), count: n, label: "commits heute nacht" });
  const sl = shownLine(LY.floor, t, 188.0);
  drawLyric(ctx, sl, t, GX, 300, 104, GW, C.textHi);
  return t < TL.outroDrop ? 0.22 + acc * 0.15 : 0.18;
}

// ---------------------------------------------------------------- relapse and burn

// Today's cell of year (0, 0) stays at the centre where the last cell was; the
// whole wall comes back around it at once and then burns from it outwards.
const RL = { fx: 52 + S / P / 2, fy: 4 + S / P / 2 };
const BURN0 = 192.3, BURN1 = 212.3;
const relapsePitch = t => t < 191.7
  ? Math.exp(lerp(Math.log(P), Math.log(13), outCubic(span(t, TL.relapse, 191.7))))
  : Math.exp(lerp(Math.log(13), Math.log(6.6), smooth(span(t, 191.7, 212.4))));
// radius of the fire in cells: it always reaches the corners of the frame at the
// end, however far the camera has pulled back by then
const BURN_R = (() => {
  const out = [];
  for (let t = BURN0; t <= BURN1 + 0.001; t += 0.05) out.push([t, 1.25 * (960 / relapsePitch(t)) * Math.pow(span(t, BURN0, BURN1), 0.85)]);
  return out;
})();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  return lerp(lerp(ih(xi, yi, 71), ih(xi + 1, yi, 71), u), lerp(ih(xi, yi + 1, 71), ih(xi + 1, yi + 1, 71), u), v);
}
function burnAt(X, Y) {
  const dist = Math.hypot(X - 52, (Y - 4) * 1.15);
  if (dist < 0.5) return Infinity;  // today burns last, with the shutdown
  // a ragged front: some years are better fuel than others
  const d = dist * (0.72 + 0.56 * vnoise(X / 16, Y / 7));
  let lo = 0, hi = BURN_R.length - 1;
  if (d > BURN_R[hi][1]) return BURN1 + (d - BURN_R[hi][1]) * 0.05;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (BURN_R[m][1] >= d) hi = m; else lo = m; }
  return tickTime(Math.round(tickOf(BURN_R[hi][0] + (ih(X, Y, 5) - 0.5) * 0.5)));
}
function relapseCam(t) {
  const p = relapsePitch(t);
  return { p: p * (1 + 0.012 * accent(t)), fx: RL.fx, fy: RL.fy, sx: 960, sy: 540 };
}

function sceneRelapse(ctx, t) {
  const cam = relapseCam(t);
  const s = cam.p * S / P;
  const flash = 1 - span(t, TL.relapse, TL.relapse + 0.25);
  const acc = accent(t);
  const embers = [];
  drawWall(ctx, cam, (X, Y, i, j, d) => {
    const lvl = wallLevel(i, j, d);
    const b = burnAt(X, Y);
    if (t < b) {
      let col = wallColor(lvl === 0 ? 1 : lvl);
      if (flash > 0) col = mix(col, C.hot, flash * 0.8);
      if (lvl > 2) col = mix(col, C.hot, acc * 0.18);
      return col;
    }
    const a = t - b;
    if (ih(X, Y, 17) < 0.12 && a < 2.4) embers.push([X, Y, a]);
    if (a < 0.1) return C.hot;
    if (a < 0.7) return mix(C.hot, C.ash, (a - 0.1) / 0.6);
    return mix(C.ash, C.dead, clamp((a - 0.7) / 2.4));
  });
  // embers: burning days that come loose and rise
  if (embers.length) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [X, Y, a] of embers) {
      const k = a / 2.4;
      const x = cam.sx + (X - cam.fx) * cam.p + Math.sin(a * 2.3 + X * 0.7) * cam.p * 2;
      const y = cam.sy + (Y - cam.fy) * cam.p - (a * 6 + a * a * 5) * cam.p;
      const sz = s * (1.2 - k * 0.8);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = k < 0.3 ? C.hot : ES[4];
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.restore();
  }
  // today, the last cell: it goes out with the shutdown sound and leaves an afterimage
  const out = span(t, TL.shutdown, TL.shutdown + 0.08);
  const ghost = 1 - span(t, TL.shutdown + 0.08, TL.shutdown + 0.75);
  const tx = cam.sx + (52 - cam.fx) * cam.p, ty = cam.sy + (4 - cam.fy) * cam.p;
  ctx.fillStyle = out < 1 ? mix(ES[4], C.dead, out) : mix(ES[1], C.dead, 1 - ghost);
  ctx.fillRect(tx, ty, s, s);
  if (out < 1) glowCells(ctx, [[tx, ty, 2.2 * (1 - out)]], s);
  // the dead wall fades after the cell is out
  const black = span(t, TL.shutdown + 0.1, SCENE_END - 0.15);
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }

  const frac = span(t, BURN0, BURN1);
  const n = t >= TL.shutdown ? 0 : t < BURN0 ? 9800000 : Math.max(1, Math.round(9800000 * Math.pow(1 - frac, 2.2)));
  // the count sits on its own plate above the burning wall
  ctx.save();
  ctx.globalAlpha = 1 - span(t, TL.shutdown + 0.2, TL.shutdown + 0.7);
  ctx.font = mono(44, true);
  const tw = Math.max(ctx.measureText(String(n)).width, 280);
  ctx.fillStyle = "#000"; ctx.fillRect(GX + GW - tw - 24, 84, tw + 48, 100);
  ctx.restore();
  drawHUD(ctx, { a: span(t, TL.relapse + 0.4, TL.relapse + 1.0) * (1 - span(t, TL.shutdown + 0.2, TL.shutdown + 0.7)), count: n, label: "commits heute nacht", noAvatar: true });
  return t < TL.shutdown ? 0.35 + flash * 0.4 : 0.1;
}

// ---------------------------------------------------------------- frame

function grainAmount(t) {
  if (t < TL.slam) return 0.05;
  if (t < TL.bridge) return 0.08;
  if (t < TL.flight) return 0.05;
  return 0.08;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  let glow = 0.1;
  if (t < BD[0][1]) glow = sceneYear(ctx, t);
  else if (t < TL.verse2) glow = sceneBreakdown(ctx, t);
  else if (t < TL.chorus2) glow = sceneProjects(ctx, t);
  else if (t < TL.bridge) glow = sceneWall(ctx, t);
  else if (t < TL.flight) glow = sceneBridge(ctx, t);
  else if (t < TL.relapse) glow = sceneFloor(ctx, t);
  else glow = sceneRelapse(ctx, t);
  bloom(ctx, glow);
  // "Ich bin Junkie!": the same graph in negative, the white days become dark marks on skin
  if (t >= 157.0 && t < TL.flight) {
    ctx.save();
    ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = C.skin; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const frozen = (t >= TL.stop && t < TL.chorus) || (t >= TL.still && t < TL.relapse);
  texture(ctx, t, grainAmount(t), frozen);
}
