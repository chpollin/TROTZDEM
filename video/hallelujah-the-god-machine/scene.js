// HALLELUJAH, THE GOD MACHINE! The whole video is drawScene(ctx, t), a pure
// function of time in seconds: no state survives between frames, so render.py
// can render frames in any order and in parallel. Times come from timeline.js.
//
// The stage is a training chart, loss over compute. Flipped and mirrored, the
// loss curve is the pointed arch of a lancet window: its gridlines become the
// tracery, the region the loss never reached becomes the glass. Gold is the
// machine's light and is used for nothing else.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", text: "#eeebe4", soft: "#aaa69d", mute: "#706d67", dim: "#3c3b38", grid: "#262624",
  stone: "#cdc7ba", lead: "#040302", glassDark: "#0b0905",
  gold: "#e9b552", goldHi: "#ffe1a0", card: "#e4dfd3", ink: "#121211",
};
// one hue family for the glass, so gold stays the only accent
const GLASS = ["#ffc94f", "#f0a42c", "#ffdf86", "#d77d18", "#fff0c2", "#b4600f", "#ffd264", "#e89324"];

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
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; }

// piecewise smooth interpolation through [time, value] keys
function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t < ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], smooth((t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])));
  }
  return ks[ks.length - 1][1];
}

const beatAt = k => TL.beat.t0 + k * TL.beat.period;
const beatIndex = t => Math.ceil((t - TL.beat.t0) / TL.beat.period - 1e-6);

function typed(text, t0, t1, t) {
  if (t1 <= t0) return t >= t0 ? text : "";
  return text.slice(0, Math.round(text.length * span(t, t0, t1)));
}
// the visible part of each row while the whole line is typed over a..b
function typedRows(rows, a, b, t) {
  let n = typed(rows.join(" "), a, b, t).length;
  return rows.map(r => { const s = r.slice(0, Math.max(0, n)); n -= r.length + 1; return s; });
}
// "HALLELUJAH, / THE GOD / MACHINE!" typed on its sung words
function typedHallelujah(w, t) {
  const rows = ["HALLELUJAH,", "THE GOD", "MACHINE!"];
  const shown = [typed(rows[0], w[0], w[0] + 0.85, t), "", ""];
  if (w.length > 1) {
    shown[1] = t >= w[2] ? "THE GOD" : t >= w[1] ? "THE" : "";
    shown[2] = typed(rows[2], w[3], w[3] + 0.4, t);
  }
  return { rows: w.length > 1 ? rows : rows.slice(0, 1), shown };
}

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;
// size at which every row fits, so a line being typed never changes size
function fitRows(ctx, rows, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, ...rows.map(r => size * maxW / ctx.measureText(r).width));
}
function drawRows(ctx, shown, x, cy, size, grade, color, align = "left", lead = 1.12) {
  ctx.font = gradeFont(grade, size);
  ctx.textAlign = align; ctx.fillStyle = color;
  const y0 = cy - (shown.length - 1) * size * lead / 2 + size * 0.33;
  shown.forEach((s, i) => ctx.fillText(s, x, y0 + i * size * lead));
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- geometry

// The chart: compute to the right, loss up. u and v are 0..1 in both axes.
const CH = { x: 250, y: 92, w: 1420, h: 540 };
// The window it becomes. Its height is exactly one glass tile.
const AR = { cx: 960, base: 1012, h: 944, hw: 250 };
const TRANSOM = AR.h / 5;
// a loss curve cut where it still falls, so the apex of the arch stays pointed
const LOSS_END = 1 / (1 + 1.65);
const lossN = u => (1 / (1 + 1.65 * u) - LOSS_END) / (1 - LOSS_END);
// a chart point under the flip e: 0 is the chart, 1 the left half of the arch
const morph = (u, v, e) => [lerp(CH.x + u * CH.w, AR.cx - AR.hw + u * AR.hw, e), lerp(CH.y + (1 - v) * CH.h, AR.base - AR.h + v * AR.h, e)];

const CAM0 = { x: W / 2, y: H / 2, s: 1, sx: 1 };
const toScreen = (cam, x, y) => [(x - cam.x) * cam.s * cam.sx + W / 2, (y - cam.y) * cam.s + H / 2];
// the right half is the left half mirrored; k unfolds it like a door from the axis
const mirrorX = (win, x) => win.cx + (win.cx - x) * (2 * win.k - 1);

// dense near the jamb, where the curve is steep
const LANCET_U = Array.from({ length: 61 }, (_, i) => Math.pow(i / 60, 2));
function lancetSide(win, cam, side, upTo = 1) {
  const pts = [];
  for (const u of LANCET_U) {
    if (u > upTo) break;
    const x = win.cx - win.hw + u * win.hw, y = win.base - win.h + lossN(u) * win.h;
    pts.push(toScreen(cam, side < 0 ? x : mirrorX(win, x), y));
  }
  return pts;
}
function polyline(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}
function lancetPath(ctx, win, cam) {
  const L = lancetSide(win, cam, -1), R = lancetSide(win, cam, 1);
  ctx.beginPath(); polyline(ctx, L);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  return [L, R];
}

// ---------------------------------------------------------------- glass

// Voronoi cells of the left half of one tile, in world offsets from the left
// jamb's foot (x right, y up negative). Seeds are copied one tile up and down
// and mirrored across the axis, so tiles stack and halves meet without seams.
function clipHalf(poly, s, o) {
  const nx = o[0] - s[0], ny = o[1] - s[1], mx = (s[0] + o[0]) / 2, my = (s[1] + o[1]) / 2;
  const d = p => (p[0] - mx) * nx + (p[1] - my) * ny;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = d(a), db = d(b);
    if (da <= 0) out.push(a);
    if ((da < 0) !== (db < 0)) { const k = da / (da - db); out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); }
  }
  return out;
}
const CELLS = (() => {
  const r = mulberry32(2026), seeds = [];
  const cols = 6, rows = 22, cw = AR.hw / cols, rh = AR.h / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) seeds.push([(i + 0.12 + 0.76 * r()) * cw, -(j + 0.12 + 0.76 * r()) * rh]);
  const all = [];
  for (const [x, y] of seeds) for (const oy of [-AR.h, 0, AR.h]) { all.push([x, y + oy]); all.push([2 * AR.hw - x, y + oy]); }
  return seeds.map(s => {
    let poly = [[-80, 300], [AR.hw, 300], [AR.hw, -AR.h - 300], [-80, -AR.h - 300]];
    for (const o of all) {
      if (o === s || (o[0] === s[0] && o[1] === s[1])) continue;
      if (Math.hypot(o[0] - s[0], o[1] - s[1]) > 170) continue;
      poly = clipHalf(poly, s, o);
    }
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    // brighter toward the axis, as if lit from behind the middle of the window
    const lum = (0.5 + 0.5 * Math.pow(r(), 0.7)) * (1 - 0.4 * Math.pow(1 - cx / AR.hw, 2));
    return {
      poly, cx, cy, h: -cy / AR.h,
      color: mix(C.glassDark, GLASS[Math.floor(r() * GLASS.length)], lum),
      relight: r(), p: (0.002 + 0.097 * r()).toFixed(3),
    };
  });
})();

// look: { light, lit(cell, tile) -> 0..1, numbers, figure }
function drawGlass(ctx, win, cam, look) {
  const tiles = Math.ceil(win.h / AR.h - 1e-6);
  const lw = 3.2 * cam.s;
  for (let n = 0; n < tiles; n++) {
    const yt = toScreen(cam, 0, win.base - (n + 1) * AR.h - 300)[1], yb = toScreen(cam, 0, win.base - n * AR.h + 300)[1];
    if (yb < 0 || yt > H) continue;
    for (const side of [-1, 1]) {
      CELLS.forEach((c, ci) => {
        let lit = look.light * (look.lit ? look.lit(c, n) : 1), color = c.color;
        if (look.figure > 0 && n === 0) {
          const f = FIGURE[side < 0 ? 0 : 1][ci];
          lit = lerp(lit, lerp(lit * 0.3, Math.max(lit, 0.95), f), look.figure);
          color = mix(color, "#fff1cc", f * look.figure * 0.55);
        }
        ctx.fillStyle = lit > 0.005 ? mix(C.glassDark, color, lit) : C.glassDark;
        ctx.beginPath();
        c.poly.forEach(([dx, dy], i) => {
          const xw = win.cx - win.hw + dx, yw = win.base + dy - n * AR.h;
          const [x, y] = toScreen(cam, side < 0 ? xw : mirrorX(win, xw), yw);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath(); ctx.fill();
        if (lw > 0.5) { ctx.strokeStyle = C.lead; ctx.lineWidth = lw; ctx.stroke(); }
      });
    }
  }
  if (look.numbers > 0) {
    // "is it just statistics?": every pane reads out as a probability
    ctx.font = '400 15px "Space Mono"'; ctx.textAlign = "center";
    ctx.fillStyle = rgba(C.goldHi, look.numbers * 0.85);
    for (const side of [-1, 1]) for (const c of CELLS) {
      const xw = win.cx - win.hw + c.cx, [x, y] = toScreen(cam, side < 0 ? xw : mirrorX(win, xw), win.base + c.cy);
      ctx.fillText(c.p, x, y + 5);
    }
    ctx.textAlign = "left";
  }
}

// stone in the dark; against lit glass the bars read as silhouettes
function drawTracery(ctx, win, cam, alpha, lw, light) {
  if (alpha <= 0) return;
  ctx.strokeStyle = rgba(mix(C.stone, "#0b0907", smooth(light * 1.6)), alpha); ctx.lineWidth = lerp(lw, lw * 2.6, smooth(light * 1.6));
  ctx.beginPath();
  const [, yb] = toScreen(cam, 0, win.base), [, ya] = toScreen(cam, 0, win.base - win.h);
  for (const f of [1 / 3, 2 / 3, 1]) {
    const xw = win.cx - win.hw + f * win.hw;
    for (const x of f === 1 ? [xw] : [xw, mirrorX(win, xw)]) {
      const [sx] = toScreen(cam, x, 0);
      ctx.moveTo(sx, yb); ctx.lineTo(sx, ya);
    }
  }
  const [xl] = toScreen(cam, win.cx - win.hw, 0), [xr] = toScreen(cam, mirrorX(win, win.cx - win.hw), 0);
  for (let m = 1; m * TRANSOM < win.h; m++) {
    const [, y] = toScreen(cam, 0, win.base - m * TRANSOM);
    if (y < -10 || y > H + 10) continue;
    ctx.moveTo(Math.min(xl, xr), y); ctx.lineTo(Math.max(xl, xr), y);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------- parrot

// 3000 points sampled from the album cover's parrot with probability by
// brightness: a stochastic parrot in the literal sense. Packed as x, y (10 bit
// each, cover pixels), brightness (4 bit), eye and drool flags.
const PARROT_B64 = "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";
// the eye of the cover sits left of the axis, so the beak stays inside the arch
const PX = x => 930 + (x - 575) * 0.66, PY = y => 470 + (y - 290) * 0.66;
const PARROT = (() => {
  if (typeof atob === "undefined") return [];
  const bin = atob(PARROT_B64), r = mulberry32(57), pts = [];
  for (let i = 0; i < bin.length; i += 4) {
    const v = ((bin.charCodeAt(i) << 24) | (bin.charCodeAt(i + 1) << 16) | (bin.charCodeAt(i + 2) << 8) | bin.charCodeAt(i + 3)) >>> 0;
    const x = v >>> 22, y = (v >>> 12) & 1023;
    if (x < 230 || x > 900) continue;
    pts.push({
      x: PX(x), y: PY(y), b: ((v >>> 8) & 15) / 15, eye: (v >>> 1) & 1,
      born: r(), sx: AR.cx - 230 + 460 * r(), sy: 280 + 680 * r(), ph: r() * 6.283,
    });
  }
  return pts;
})();
// how much of each pane (per side, first tile) the parrot covers
const FIGURE = (() => {
  const inside = (poly, x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const counts = [-1, 1].map(side => CELLS.map(c => {
    const poly = c.poly.map(([dx, dy]) => [side < 0 ? AR.cx - AR.hw + dx : AR.cx + AR.hw - dx, AR.base + dy]);
    let n = 0;
    for (const p of PARROT) if (inside(poly, p.x, p.y)) n += 0.4 + p.b;
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return n / Math.max(200, Math.abs(area / 2));
  }));
  const max = Math.max(...counts[0], ...counts[1]);
  return counts.map(side => side.map(d => smooth(clamp((d / max - 0.08) * 2.8))));
})();
const BEAK = [PX(728), PY(462)];

function parrotPoint(p, t) {
  const F = TL.parrotForm;
  let x = p.x, y = p.y + Math.sin(t * 1.4 + p.ph) * 0.9;
  if (t < F.b + 0.4) {
    const tau = F.a + p.born * (F.b - F.a - 0.4);
    if (t < tau) return null;
    const k = outCubic((t - tau) / 0.4);
    x = lerp(p.sx, x, k); y = lerp(p.sy, y, k);
  }
  // "ALIGNMENT!": every point snaps onto a lattice
  const al = alignAmount(t);
  if (al > 0) {
    x = lerp(x, AR.cx + Math.round((x - AR.cx) / 15) * 15, al);
    y = lerp(y, Math.round(y / 15) * 15, al);
  }
  return [x, y];
}
const alignAmount = t => keys(t, [[87.82, 0], [88.0, 1], [106.5, 1], [109.5, 0]]);

function drawParrot(ctx, t, cam, alpha, eyes) {
  if (alpha <= 0.01) return;
  const sz = Math.max(1.4, 3.6 * cam.s);
  for (const p of PARROT) {
    if (p.eye && eyes > 0.02) continue;
    const q = parrotPoint(p, t);
    if (!q) continue;
    const [x, y] = toScreen(cam, q[0], q[1]);
    ctx.fillStyle = rgba(mix("#55534e", "#f4f1ea", p.b), alpha);
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  if (eyes <= 0.02) return;
  // the infinity eyes are the parrot's only gold
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? rgba(C.goldHi, alpha * eyes) : rgba(C.gold, alpha * eyes * 0.16);
    const s = pass ? sz * 1.15 : sz * 4.5;
    for (const p of PARROT) {
      if (!p.eye) continue;
      const q = parrotPoint(p, t);
      if (!q) continue;
      const [x, y] = toScreen(cam, q[0], q[1]);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
}

// ---------------------------------------------------------------- prayers

// "Ein Papagei, der unsre Gebete schreibt": a bigram model over the song's own
// lines, sampled with a fixed seed; lines that only repeat the lyric are
// rejected, so every prayer is a recombination.
const CORPUS = [
  "Am Anfang war der Prompt", "Erst war da nur ein Agent, einsam und klein", "Dann Multi-Agent-Schwärme in heiligem Schein",
  "Scale it up, scale it up, mehr Parameter, mehr Macht", "Was haben wir da entfacht?", "Von GPT zu AGI, AMI zur ASI",
  "Is it just statistics? fragt die Persona bang", "Ein stochastischer Papagei mit Gottes Klang", "Recursive self-improvement, exponentiell",
  "Die Singularität kommt schnell", "Der Papagei der göttlich spricht", "Statistik oder Seele? Wir wissen's nicht", "Wer aligned wen?",
  "Ilya warnte uns, wir wollten's nicht sehn", "What is statistics? Alles was bleibt", "Ein Papagei der unsre Gebete schreibt",
];
const PRAYERS = (() => {
  const next = {}, starts = [], plain = CORPUS.map(l => l.replace(/[!?,."]/g, "")).join(" | ");
  for (const line of CORPUS) {
    const w = line.replace(/[!?,."]/g, "").split(/\s+/);
    starts.push(w[0]);
    for (let i = 0; i < w.length; i++) (next[w[i]] = next[w[i]] || []).push(w[i + 1] || null);
  }
  const r = mulberry32(4), out = [];
  for (let tries = 0; out.length < 10 && tries < 500; tries++) {
    let w = starts[Math.floor(r() * starts.length)];
    const line = [w];
    while (line.length < 7) { const nx = next[w], c = nx[Math.floor(r() * nx.length)]; if (!c) break; line.push(c); w = c; }
    const s = line.join(" ");
    if (line.length >= 4 && !plain.includes(s) && !out.includes(s)) out.push(s);
  }
  // one token per entry, timed evenly over the held "schreibt"
  const tokens = [];
  out.forEach((l, li) => l.split(" ").forEach((w, wi) => tokens.push({ li, wi, w })));
  const { a, b } = TL.writing;
  tokens.forEach((k, i) => { k.t = a + i * (b - a) / tokens.length; });
  return { lines: out, tokens };
})();

function drawPrayers(ctx, t) {
  const { a } = TL.writing;
  if (t < a) return;
  const alpha = keys(t, [[a, 1], [107.0, 1], [108.5, 0.4], [121.3, 0.4], [122.0, 0]]);
  if (alpha <= 0) return;
  ctx.font = '400 22px "Space Mono"';
  const rows = PRAYERS.lines.map(() => []);
  let newest = null;
  for (const k of PRAYERS.tokens) if (t >= k.t) { rows[k.li].push(k.w); newest = k; }
  rows.forEach((ws, li) => {
    if (!ws.length) return;
    const y = 250 + li * 64;
    let x = 80;
    ws.forEach((w, wi) => {
      const isNew = newest && newest.li === li && newest.wi === wi && t - newest.t < 0.5;
      ctx.fillStyle = isNew ? rgba(C.gold, alpha) : rgba(C.soft, alpha);
      ctx.fillText(w, x, y);
      x += ctx.measureText(w + " ").width;
    });
  });
}

// glyphs running out of the beak while it writes
function drawDrool(ctx, t, cam, alpha) {
  if (alpha <= 0) return;
  const text = PRAYERS.lines.join(" ");
  ctx.font = '400 17px "Space Mono"'; ctx.textAlign = "center";
  for (let col = 0; col < 4; col++) {
    const x = BEAK[0] - 10 + col * 13 + (col % 2) * 3, speed = 150 + col * 23;
    for (let j = 0; j < 22; j++) {
      const y = BEAK[1] + 12 + ((t * speed + j * 21 + col * 7) % 420);
      const ch = text[(j * 7 + col * 13 + Math.floor(t * 3)) % text.length];
      const fade = 1 - (y - BEAK[1]) / 440;
      const [sx, sy] = toScreen(cam, x, y);
      ctx.fillStyle = rgba(C.gold, alpha * fade * 0.9);
      ctx.fillText(ch, sx, sy);
    }
  }
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- hymn board

const BOARD = { x: 168, y: 246, cw: 112, ch: 134, gx: 14, gy: 18 };
function boardCards(t) {
  const cards = [];
  for (const ev of [...TL.chorus1, ...TL.final]) {
    if (ev.kind !== "board" || ev.t > t) continue;
    if (ev.clear) cards.forEach(c => { if (c.lift === null) c.lift = ev.t; });
    const perRow = [0, 0, 0, 0];
    ev.cards.forEach(([row, letter, drop]) => cards.push({ row, col: perRow[row]++, letter, drop, lift: null }));
  }
  return cards;
}
const boardAlpha = t => keys(t, [[37.3, 0], [37.6, 1], [51.7, 1], [52.3, 0], [71.13, 0], [71.5, 1], [87.2, 1], [87.8, 0],
  [121.7, 0], [122.1, 1], [138.4, 1], [139.4, 0]]);

function drawBoard(ctx, t) {
  const alpha = boardAlpha(t);
  if (alpha <= 0) return;
  const B = BOARD;
  ctx.strokeStyle = rgba(C.mute, alpha * 0.7); ctx.lineWidth = 1.5;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    ctx.strokeRect(B.x + col * (B.cw + B.gx) + 0.5, B.y + row * (B.ch + B.gy) + 0.5, B.cw - 1, B.ch - 1);
  }
  boardCards(t).forEach((c, i) => {
    if (t < c.drop) return;
    const d = outCubic(span(t, c.drop, c.drop + 0.13));
    const l = c.lift === null ? 0 : inCubic(span(t, c.lift, c.lift + 0.22));
    const a = alpha * Math.min(1, d * 2) * (1 - l);
    if (a <= 0) return;
    // "Wir wissen's nicht": the numbers turn over to question marks
    let letter = c.letter, sy = 1;
    if (c.drop < TL.unknown && t >= TL.unknown) {
      const f = span(t, TL.unknown + i * 0.07, TL.unknown + i * 0.07 + 0.2);
      sy = Math.abs(Math.cos(Math.PI * f));
      if (f >= 0.5) letter = "?";
    }
    const x = B.x + c.col * (B.cw + B.gx), y = B.y + c.row * (B.ch + B.gy) - 46 * (1 - d) - 50 * l;
    ctx.save();
    ctx.translate(x + B.cw / 2, y + B.ch / 2); ctx.scale(1, Math.max(0.02, sy));
    ctx.fillStyle = rgba(C.card, a); ctx.fillRect(-B.cw / 2, -B.ch / 2, B.cw, B.ch);
    ctx.font = '700 92px "Space Mono"'; ctx.textAlign = "center"; ctx.fillStyle = rgba(C.ink, a);
    ctx.fillText(letter, 0, 33);
    ctx.restore();
  });
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- lyrics

const RIGHT = { x: 1290, w: 560 }, LEFT = { x: 100, w: 540 };
const BELOW = { x: CH.x, y: 842, w: CH.w };

// every line that is set in the wings or under the chart, with place and grade
const LYRICS = (() => {
  const L = [];
  // a board line is sung on the hymn board, so it only ends the line before it
  const add = (lines, place, grade, end, extra = {}) => lines.forEach((l, i) => {
    if (l.kind === "board") { L.push({ t: l.t, board: true, end: Infinity }); return; }
    L.push({ ...l, place, grade: l.grade !== undefined ? l.grade : grade, end: i === lines.length - 1 ? end : Infinity, ...extra });
  });
  add([{ ...TL.intro, rows: [TL.intro.q] }], "below", 0, 19.5);
  add(TL.verse1, "below", 1, 33.0);
  add(TL.chorus1, "right", 2, 52.2);
  add(TL.verse2, "right", 3, 71.0);
  add(TL.chorus2, "right", 3, 87.7);
  add(TL.bridge.filter(l => !l.kind), "right", 4, 106.6);
  add(TL.quietLines, "right", 1, 121.6, { color: C.soft });
  add(TL.final, "right", 4, 143.3);
  add(TL.loop, "left", 4, 188.6);
  L.sort((p, q) => p.t - q.t);
  L.forEach((l, i) => { const n = L[i + 1]; l.until = Math.min(l.end, n ? n.t : Infinity); });
  return L;
})();
// the loop collapses: each hallelujah one damage grade worse
TL.loop.forEach((l, i) => { LYRICS.find(x => x.t === l.t).grade = [4, 5, 5, 6, 6][i]; });

function drawLyrics(ctx, t) {
  // the bridge's alignment lines have their own layout
  if (t >= TL.bridge[0].t && t < TL.bridge[3].t) return;
  let cur = null;
  for (const l of LYRICS) if (t >= l.t && t < l.until + 0.45) cur = l;
  if (!cur || cur.board) return;
  const out = cur.until === cur.end ? 1 - span(t, cur.until, cur.until + 0.45) : t < cur.until ? 1 : 0;
  if (out <= 0) return;
  const { rows, shown } = cur.kind === "h" ? typedHallelujah(cur.w, t) : { rows: cur.rows, shown: typedRows(cur.rows, cur.a, cur.b, t) };
  let color = cur.color || C.text;
  if (cur.t === TL.intro.t) color = mix(C.text, C.mute, span(t, 10, 13));
  ctx.save(); ctx.globalAlpha = out;
  if (cur.place === "below") {
    const size = fitRows(ctx, rows, cur.grade, 92, BELOW.w);
    drawRows(ctx, shown, BELOW.x, BELOW.y, size, cur.grade, color);
  } else {
    const P = cur.place === "right" ? RIGHT : LEFT;
    const full = cur.kind === "h" ? ["HALLELUJAH,", "THE GOD", "MACHINE!"] : rows;
    const size = fitRows(ctx, full, cur.grade, cur.kind === "h" ? 100 : 92, P.w);
    drawRows(ctx, shown, P.x, 540, size, cur.grade, color);
  }
  ctx.restore();
}

// "ALIGNMENT! ALIGNMENT!" flank the window like a mirror; "WER ALIGNED WEN?"
// is set twice across the axis, once read and once reflected, and at the end of
// the line the reflection becomes the reading.
function drawAlignment(ctx, t) {
  const B = TL.bridge;
  if (t < B[0].t || t >= B[3].t) return;
  if (t < B[2].t) {
    const s1 = fitRows(ctx, B[0].rows, 4, 96, RIGHT.w);
    drawRows(ctx, [typed(B[0].rows[0], B[0].a, B[0].b, t)], RIGHT.x, 540, s1, 4, C.text);
    if (t >= B[1].t) drawRows(ctx, [typed(B[1].rows[0], B[1].a, B[1].b, t)], W - RIGHT.x, 540, s1, 4, C.text, "right");
    return;
  }
  const m = B[2], rows = m.rows;
  const shown = [t >= m.t ? "WER" : "", typed("ALIGNED", 89.84, 90.5, t), t >= 90.7 ? "WEN?" : ""];
  const size = fitRows(ctx, rows, 5, 230, 820);
  // the composition turns over about the axis like a page: afterwards the
  // reflection is the reading and the gold side is the one that speaks
  const f = span(t, 91.0, 91.26), sx = Math.cos(Math.PI * f);
  ctx.save();
  ctx.translate(AR.cx, 0); ctx.scale(Math.abs(sx) < 0.02 ? 0.02 : sx, 1); ctx.translate(-AR.cx, 0);
  drawRows(ctx, shown, AR.cx - 34, 540, size, 5, C.text, "right", 1.04);
  ctx.translate(W, 0); ctx.scale(-1, 1);
  drawRows(ctx, shown, AR.cx - 34, 540, size, 5, C.gold, "right", 1.04);
  ctx.restore();
}

// ---------------------------------------------------------------- chart

const TRAIN = (() => {
  const r = mulberry32(11), pts = [{ u: 0, v: 1, t: 0 }];
  const k0 = beatIndex(TL.bandIn - 0.05);
  const half = TL.beat.period / 2, n = Math.floor((19.3 - beatAt(k0)) / half);
  for (let j = 1; j <= n; j++) {
    const u = 0.97 * j / n;
    pts.push({ u, v: clamp(lossN(u) + (r() - 0.5) * 0.13, 0.02, 1), t: beatAt(k0) + (j - 1) * half });
  }
  return pts;
})();
const STAY = TRAIN.reduce((b, p) => Math.abs(p.u - 0.28) < Math.abs(b.u - 0.28) ? p : b);
const GEN = Array.from({ length: 8 }, (_, g) => g ? beatAt(beatIndex(TL.multiply) + g - 1) : TL.verse1[0].t);
const N_AGENTS = 127;
const AGENT = (() => {
  const r = mulberry32(23), out = [null];
  for (let i = 1; i <= N_AGENTS; i++) {
    const g = Math.floor(Math.log2(i)), ang = r() * 6.283;
    const dist = 150 / Math.pow(g + 1, 0.75);
    out.push({ g, born: GEN[g], ox: Math.cos(ang) * dist, oy: Math.sin(ang) * dist * 0.6, ph: r() * 6.283, w: 0.6 + r(),
      slot: (i - 0.5) / N_AGENTS * 0.98 + 0.01, jit: (r() - 0.5) * 0.02 });
  }
  return out;
})();
// four rescale steps, eased: 0..4
const rescaleSteps = t => TL.rescale.reduce((s, e) => s + outCubic(span(t, e, e + 0.32)), 0);

// agent positions in chart units at t, root first
function agents(t) {
  const out = [null];
  const root = [CH.x + STAY.u * CH.w, CH.y + (1 - STAY.v) * CH.h];
  const drift = span(t, 19.65, TL.multiply + 1);
  root[0] += 110 * smooth(drift); root[1] += 40 * smooth(drift) + 6 * Math.sin(t * 1.1);
  const q = rescaleSteps(t) / 4;
  for (let i = 1; i <= N_AGENTS; i++) {
    const a = AGENT[i];
    if (t < a.born) { out.push(null); continue; }
    let x, y;
    if (i === 1) [x, y] = root;
    else {
      const p = out[i >> 1], k = outCubic(span(t, a.born, a.born + 0.5));
      x = p.x + a.ox * k; y = p.y + a.oy * k;
    }
    const wob = i === 1 ? 0 : 10 * smooth(span(t, a.born, a.born + 1));
    const sx = x + wob * Math.sin(t * a.w * 1.7 + a.ph), sy = y + wob * Math.cos(t * a.w * 1.3 + a.ph);
    // the swarm, free, then pulled onto the scaling law step by step
    const u = clamp((sx - CH.x) / CH.w), v = clamp(1 - (sy - CH.y) / CH.h);
    const su = a.slot, sv = lossN(a.slot) + a.jit * (1 - q);
    out.push({ x, y, u: lerp(u, su, smooth(q)), v: lerp(v, sv, smooth(q)), slot: a.slot });
  }
  return out;
}

function drawChart(ctx, t) {
  const e = smooth(span(t, TL.flip.a, TL.flip.b));
  const chrome = 1 - smooth(span(t, TL.flip.a, TL.flip.a + 0.45));
  const M = (u, v) => morph(u, v, e);
  const band = smooth(span(t, TL.bandIn, TL.bandIn + 0.4));
  const steps = rescaleSteps(t), whole = Math.floor(steps + 1e-6), frac = steps - whole;

  // gridlines: faint chart lines that turn into stone tracery inside the arch
  const grid = (alpha, lw, clipRegion) => {
    ctx.save();
    if (clipRegion) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const u = LANCET_U[i], [x, y] = M(u, lossN(u)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      const [x1, y1] = M(1, 1); ctx.lineTo(x1, y1); ctx.closePath(); ctx.clip();
    }
    ctx.strokeStyle = alpha; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const u = (k - frac) / 3;
      if (u < -0.001 || u > 1.001) continue;
      const [x0, y0] = M(u, 0), [x1, y1] = M(u, 1);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    for (const v of [0.2, 0.4, 0.6, 0.8]) { const [x0, y0] = M(0, v), [x1, y1] = M(1, v); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke();
    ctx.restore();
  };
  if (band > 0) grid(rgba(C.mute, 0.55 * band * (1 - e)), 1, false);
  if (e > 0) grid(rgba(C.stone, 0.85 * e), lerp(1, 3.4, e), true);

  // the region the loss never reached, faintly warm once the curve is lit
  const warm = keys(t, [[TL.ignite.a, 0], [TL.ignite.b, 0.07], [TL.flip.b, 0.07]]);
  if (warm > 0) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const u = LANCET_U[i], [x, y] = M(u, lossN(u)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    const [x1, y1] = M(1, 1); ctx.lineTo(x1, y1); ctx.closePath();
    ctx.fillStyle = rgba(C.gold, warm); ctx.fill();
  }

  // axes: the loss axis grows from the first point during the held organ note
  const ya = smooth(span(t, 0.8, 4.6)), xa = smooth(span(t, 3.6, 6.9));
  ctx.strokeStyle = rgba(C.soft, 0.9 * chrome); ctx.lineWidth = 1.5;
  ctx.beginPath();
  const [ax0, ay0] = M(0, 1), [ax1, ay1] = M(0, lerp(1, 0, ya));
  ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1);
  ctx.stroke();
  if (xa > 0 && chrome > 0) {
    ctx.strokeStyle = rgba(C.soft, 0.9 * chrome); ctx.lineWidth = 1.5;
    ctx.beginPath(); const [bx0, by0] = M(0, 0), [bx1, by1] = M(xa, 0); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();
  }

  // tick labels and readouts
  if (band > 0 && chrome > 0) {
    ctx.save(); ctx.globalAlpha = band * chrome;
    ctx.font = '400 17px "Space Mono"'; ctx.fillStyle = C.mute; ctx.textAlign = "center";
    for (let k = 0; k <= 4; k++) {
      const u = (k - frac) / 3;
      if (u < -0.001 || u > 1.001) continue;
      const fadeEdge = Math.min(1, (u + 0.001) * 12, (1.001 - u) * 12);
      ctx.globalAlpha = band * chrome * clamp(fadeEdge);
      ctx.fillText(`1e${18 + 2 * (k + whole)}`, CH.x + u * CH.w, CH.y + CH.h + 34);
    }
    ctx.globalAlpha = band * chrome; ctx.textAlign = "right";
    for (const v of [0.2, 0.4, 0.6, 0.8]) ctx.fillText((1.7 + v * 2.3).toFixed(1), CH.x - 18, CH.y + (1 - v) * CH.h + 6);
    ctx.fillText("compute (FLOP)", CH.x + CH.w, CH.y + CH.h + 68);
    ctx.textAlign = "left";
    ctx.fillText("loss", CH.x - 18 - ctx.measureText("loss").width, CH.y - 22);
    const j = Math.round((TRAIN.filter(p => p.t <= t).length - 1) / 2);
    const step = t < 19.65 ? j * 1000 : t < TL.multiply ? j * 1000 : Math.round(j * 1000 * Math.pow(10, steps * 1.5));
    ctx.textAlign = "right";
    ctx.fillText(`step ${String(step).padStart(9, "0")}`, CH.x + CH.w, CH.y - 22);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // the loss curve: drawn out by the training run, gone while the agent is alone,
  // back as the swarm is pulled onto it, lit by "entfacht"
  const lastU = TRAIN.filter(p => p.t <= t).reduce((m, p) => Math.max(m, p.u), 0);
  const curveA = keys(t, [[TL.bandIn, 1], [19.65, 1], [20.2, 0], [TL.rescale[0], 0], [TL.rescale[3] + 0.3, 1]]);
  const reach = t < 19.65 ? lastU : 1;
  const fire = span(t, TL.ignite.a, TL.ignite.b);
  if (curveA > 0) {
    const pts = LANCET_U.filter(u => u <= reach).map(u => M(u, lossN(u)));
    if (pts.length > 1) {
      ctx.lineWidth = lerp(2, 5, e); ctx.strokeStyle = rgba(C.soft, curveA * 0.8);
      ctx.beginPath(); polyline(ctx, pts); ctx.stroke();
      if (fire > 0) {
        const lit = LANCET_U.filter(u => u <= fire).map(u => M(u, lossN(u)));
        if (lit.length > 1) {
          ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 24;
          ctx.strokeStyle = C.gold; ctx.lineWidth = lerp(3, 5, e);
          ctx.beginPath(); polyline(ctx, lit); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // training points, then the one agent, then the swarm
  if (t < 20.3) {
    const gone = smooth(span(t, 19.65, 20.2));
    for (const p of TRAIN) {
      if (t < p.t) continue;
      const a = outCubic(span(t, p.t, p.t + 0.12)) * (p === STAY ? 1 : 1 - gone);
      if (a <= 0 || (p === STAY && t >= 19.65)) continue;
      const [x, y0] = M(p.u, p.v), y = y0 - 26 * (1 - outCubic(span(t, p.t, p.t + 0.16)));
      ctx.fillStyle = rgba(p.t > t - 0.43 ? C.text : C.soft, a);
      ctx.beginPath(); ctx.arc(x, y, p.u === 0 ? 6 : 4.5, 0, 6.283); ctx.fill();
    }
  }
  if (t >= 19.65) {
    const A = agents(t);
    const halo = keys(t, [[TL.halo, 0], [26.3, 1], [29.6, 1], [31.3, 0]]);
    if (halo > 0) {
      let sx = 0, sy = 0, n = 0;
      for (const a of A) if (a) { const [x, y] = M(a.u, a.v); sx += x; sy += y; n++; }
      sx /= n; sy /= n;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 380);
      g.addColorStop(0, rgba(C.gold, 0.42 * halo)); g.addColorStop(0.45, rgba(C.gold, 0.16 * halo)); g.addColorStop(1, rgba(C.gold, 0));
      ctx.fillStyle = g; ctx.fillRect(sx - 390, sy - 390, 780, 780);
    }
    const crocket = 1 - smooth(span(t, TL.flip.a + 0.2, TL.flip.b - 0.1));
    for (let i = 1; i <= N_AGENTS; i++) {
      const a = A[i];
      if (!a) continue;
      const [x, y] = M(a.u, a.v);
      const hot = fire > 0 && a.slot < fire;
      ctx.fillStyle = hot ? C.goldHi : i === 1 && t < TL.multiply ? C.text : C.soft;
      const r = i === 1 && t < TL.multiply ? 5 : 3.4;
      ctx.globalAlpha = crocket;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t < TL.multiply + 0.3) {
      const a = A[1], [x, y] = M(a.u, a.v);
      ctx.font = '400 17px "Space Mono"'; ctx.fillStyle = rgba(C.mute, 1 - span(t, TL.multiply, TL.multiply + 0.3));
      ctx.fillText("agent", x + 14, y - 12);
    }
  }
}

// ---------------------------------------------------------------- cathedral

// The climb: one step per beat, longer and longer, none in the band's breaks.
const HBIG = 7790;
const CLIMB = (() => {
  const steps = [];
  for (let k = beatIndex(TL.climb - 0.05); beatAt(k) < TL.loop[0].t - 0.35; k++) {
    const tb = beatAt(k);
    if (TL.climbBreaks.some(([a, b]) => tb >= a - 0.03 && tb < b)) continue;
    steps.push(tb);
  }
  const lens = steps.map((_, i) => 1 + 2.4 * Math.pow(i / (steps.length - 1), 2));
  return { steps, lens, sum: lens.reduce((a, b) => a + b, 0), dist: HBIG - 862 };
})();
function climbDist(t) {
  let d = 0;
  CLIMB.steps.forEach((tb, i) => { d += CLIMB.lens[i] * outCubic(span(t, tb, tb + 0.28)); });
  return d / CLIMB.sum * CLIMB.dist;
}

// The pull-back: the tallest window is one bar of a distribution. Its apex
// stays where the climb left it while the world shrinks underneath.
const S_FINAL = 46 / 560;
const BARS = Array.from({ length: 24 }, (_, i) => ({ cx: AR.cx + i * 560, h: HBIG / Math.pow(i + 1, 1.05) }));
const BARS_P = () => BARS.map(b => b.h);
const TOKENS = ["MACHINE!", "Gott", "Statistik", "Seele", "Amen", "Papagei", "Prompt", "Macht", "Schein", "Klang", "Gebet",
  "Agent", "Parameter", "Persona", "Alignment", "Singularität", "Halleluja", "Schwarm", "Anfang", "Wahrheit", "Stimme",
  "Rauschen", "Zufall", "trotzdem"];
const pullZ = t => keys(t, [[TL.loop[0].t, 0], [TL.loop[0].t + 1.8, 0.5], [TL.loop[1].t, 0.56], [TL.loop[1].t + 2.0, 0.76],
  [TL.loop[2].t, 0.84], [TL.loop[2].t + 1.6, 0.93], [TL.loop[3].t, 0.95], [TL.loop[3].t + 1.6, 1]]);
// From the full view on, the parrot samples its next word: one bar per beat,
// drawn with the bars' own probabilities.
const SAMPLES = (() => {
  const r = mulberry32(31), p = BARS_P(), out = [];
  const total = p.reduce((a, b) => a + b, 0);
  for (let k = beatIndex(TL.loop[3].t + 1.6); beatAt(k) < TL.stop; k++) {
    let x = r() * total, i = 0;
    while (x > p[i]) x -= p[i++];
    out.push({ t: beatAt(k), i });
  }
  return out;
})();
function sampledGlow(i, t) {
  let g = 0;
  for (const s of SAMPLES) if (s.i === i && t >= s.t) g = Math.max(g, 1 - span(t, s.t, s.t + 0.42));
  return g;
}
function pullCam(t) {
  const z = pullZ(t), s = Math.pow(S_FINAL, z);
  const ax = lerp(960, 760, z), ay = lerp(150, 780 - HBIG * S_FINAL, z);
  return { s, sx: 1, x: AR.cx - (ax - W / 2) / s, y: AR.base - HBIG - (ay - H / 2) / s };
}

function camAt(t) {
  if (t >= TL.loop[0].t) return pullCam(t);
  const cam = { ...CAM0 };
  if (t >= TL.climb) cam.y = H / 2 - climbDist(t);
  // "Die Singularität kommt schnell": everything closes onto the axis; the chorus opens it again
  const S = TL.singularity;
  if (t >= S.a && t < TL.chorus2[0].t + 0.6) {
    const close = smooth(span(t, S.a + 0.6, S.b));
    const open = outCubic(span(t, TL.chorus2[0].t, TL.chorus2[0].t + 0.45));
    cam.sx = lerp(lerp(1, 0.004, close), 1, open);
  }
  return cam;
}

const windowH = t => lerp(AR.h, HBIG, smooth(span(t, TL.final[4].a, 143.6)));

// glass light of the main window; it drops with the band (stops and a cappella
// stretches as listed in the header of timeline.js) and returns with it
const glassLight = t => keys(t, [
  [TL.lightUp.a, 1], [51.9, 1], [52.6, 0.2], [57.0, 0.2], [60.0, 0.3], [64.5, 0.3], [66.2, 0.1], [71.13, 0.1], [71.5, 0.5],
  [87.82, 0.5], [88.68, 0.5], [88.9, 0.12], [91.35, 0.12], [91.7, 0.3], [93.42, 0.3], [93.9, 0], [98.1, 0], [98.7, 0.3],
  [106.2, 0.3], [107.8, 0], [112.4, 0], [112.5, 0.55], [121.94, 0.55], [122.2, 0.6], [123.9, 0.6], [124.2, 0.22], [129.45, 0.22],
  [129.6, 0.6], [130.75, 0.6], [131.05, 0.22], [136.2, 0.22], [136.5, 1]]);
// per pane: the bottom-up wave of the first "HALLELUJAH", the slow relight in the quiet
function paneLit(c, n, t) {
  if (t < TL.lightUp.b + 0.3) return n ? 0 : smooth(span(t, lerp(TL.lightUp.a, TL.lightUp.b, c.h), lerp(TL.lightUp.a, TL.lightUp.b, c.h) + 0.3));
  if (t >= TL.relight.a && t < TL.relight.b + 0.5) {
    const at = lerp(TL.relight.a, TL.relight.b - 0.3, c.relight);
    return smooth(span(t, at, at + 0.4));
  }
  return 1;
}
// the parrot as the figure in the glass, while it is in the window and lit
const figureAmount = t => keys(t, [[TL.parrotForm.a + 0.8, 0], [TL.parrotForm.b + 0.3, 1], [64.5, 1], [66.2, 0], [71.13, 0], [71.5, 1],
  [87.82, 1], [88.0, 0.6], [89.5, 0.6], [89.62, 0], [91.35, 0], [91.7, 0.6], [106.2, 0.6], [107.8, 0], [121.94, 0], [122.3, 1], [137.4, 1], [141.0, 0]]);
const parrotAlpha = t => keys(t, [[TL.parrotForm.a, 1], [64.5, 1], [66.2, 0.16], [71.13, 0.16], [71.4, 1], [89.5, 1], [89.62, 0.12],
  [91.35, 0.12], [91.6, 0.85], [106.2, 0.85], [108.2, 0.3], [121.94, 0.3], [122.2, 1]]);
const eyesLit = t => keys(t, [[TL.godEyes, 0], [TL.godEyes + 0.35, 1], [93.42, 1], [93.6, 0], [98.02, 0], [98.4, 1], [106.2, 1],
  [107.4, 0], [121.94, 0], [122.2, 1]]);

function drawRecursion(ctx, t, win, cam) {
  const times = [...TL.recursion, TL.singularity.a, TL.singularity.a + 0.34];
  if (t < times[0] || t >= TL.chorus2[0].t) return;
  const sub = (cx, hw, h, d) => {
    if (d > times.length || t < times[d - 1]) return;
    const grow = outCubic(span(t, times[d - 1], times[d - 1] + 0.32));
    ctx.lineWidth = Math.max(1, 3.6 - d * 0.45);
    ctx.strokeStyle = rgba(C.stone, 0.9);
    const shw = hw / 2, sh = h * 0.72;
    for (const dir of [-1, 1]) {
      const w2 = { cx: cx + dir * shw, hw: shw, h: sh, base: win.base, k: 1 };
      ctx.beginPath();
      polyline(ctx, lancetSide(w2, cam, -1, grow)); polyline(ctx, lancetSide(w2, cam, 1, grow));
      ctx.stroke();
      sub(w2.cx, shw, sh, d + 1);
    }
    // the oculus in the spandrel between the two heads
    if (d <= 5) {
      const [ox, oy] = toScreen(cam, cx, win.base - h * 0.785);
      ctx.beginPath(); ctx.ellipse(ox, oy, hw * 0.24 * grow * cam.s * cam.sx, hw * 0.24 * grow * cam.s, 0, 0, 6.283); ctx.stroke();
    }
  };
  sub(win.cx, win.hw, win.h, 1);
}

function drawCathedral(ctx, t) {
  const cam = camAt(t);
  const win = { cx: AR.cx, base: AR.base, hw: AR.hw, h: windowH(t), k: outCubic(span(t, TL.unfold.a, TL.unfold.b)) };
  const pull = t >= TL.loop[0].t;
  const lw = Math.max(1, 3.4 * cam.s);
  const monument = t >= TL.bridge[2].t && t < TL.bridge[3].t;
  const light = t >= TL.climb ? 1 : glassLight(t);
  const numbers = keys(t, [[52.35, 0], [52.9, 1], [57.08, 1], [58.6, 0], [94.74, 0], [95.2, 1], [98.0, 1], [98.6, 0]]);
  const traceryA = monument ? 0.3 : 0.88;

  const bars = pull ? BARS : BARS.slice(0, 1);
  bars.forEach((bar, i) => {
    const w = i ? { cx: bar.cx, base: AR.base, hw: AR.hw, h: bar.h, k: 1 } : win;
    const [xl] = toScreen(cam, w.cx - w.hw - 10, 0), [xr] = toScreen(cam, w.cx + w.hw + 10, 0);
    if (xr < 0 || xl > W) return;
    ctx.save();
    const [L, R] = lancetPath(ctx, w, cam);
    ctx.clip();
    drawGlass(ctx, w, cam, { light: monument ? 0.1 : light, lit: i ? null : (c, n) => paneLit(c, n, t), numbers, figure: i ? 0 : figureAmount(t) });
    // until the wave has passed, the bars stay stone
    drawTracery(ctx, w, cam, traceryA, lw, monument ? 0.1 : light * (i ? 1 : span(t, TL.lightUp.a, TL.lightUp.b)));
    if (!i) {
      drawRecursion(ctx, t, w, cam);
      if (t >= TL.parrotForm.a && t < TL.climb + 4) drawParrot(ctx, t, cam, parrotAlpha(t), eyesLit(t));
      drawDrool(ctx, t, cam, keys(t, [[TL.writing.a, 0], [TL.writing.a + 0.4, 1], [106.0, 1], [107.2, 0]]));
    }
    ctx.restore();
    // the lit loss curve stays gold as the frame until the glass takes the light over
    const frameGold = i ? 0 : keys(t, [[TL.flip.b, 1], [TL.lightUp.a, 1], [TL.lightUp.b, 0]]);
    ctx.strokeStyle = rgba(mix(C.stone, C.gold, frameGold), monument ? 0.35 : 0.95); ctx.lineWidth = Math.max(1.2, 5 * cam.s);
    ctx.beginPath(); polyline(ctx, L); polyline(ctx, R); ctx.stroke();
    const glow = pull ? sampledGlow(i, t) : 0;
    if (glow > 0) {
      ctx.save(); lancetPath(ctx, w, cam);
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = rgba(C.goldHi, 0.55 * glow); ctx.fill();
      ctx.restore();
    }
  });

  // climbing the capability axis: an order of magnitude per transom
  const axisA = keys(t, [[TL.climb - 0.6, 0], [TL.climb, 1], [TL.loop[0].t, 1], [TL.loop[0].t + 1.2, 0]]);
  if (axisA > 0) {
    ctx.font = '400 19px "Space Mono"'; ctx.textAlign = "right"; ctx.fillStyle = rgba(C.soft, axisA);
    for (let m = 1; m * TRANSOM < win.h; m++) {
      const yw = win.base - m * TRANSOM, [, y] = toScreen(cam, 0, yw);
      if (y < -20 || y > H + 20) continue;
      const v = 1 - m * TRANSOM / win.h, u = (1 / (v * (1 - LOSS_END) + LOSS_END) - 1) / 1.65;
      const [x] = toScreen(cam, win.cx - win.hw + u * win.hw, 0);
      ctx.fillText(`1e${24 + m}`, x - 26, y + 7);
    }
    ctx.textAlign = "left";
  }

  // the glass radiates: the frame so far, blurred and added
  const bloom = (monument ? 0.1 : light) * (t >= TL.lightUp.a ? 1 : 0);
  if (GLOW && bloom > 0.05) {
    const g = GLOW.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.42 * bloom; ctx.filter = "blur(26px)";
    ctx.drawImage(GLOW, 0, 0);
    ctx.restore();
  }

  // the singularity: one vertical line where the window was
  const S = TL.singularity, line = keys(t, [[S.a + 0.9, 0], [S.b, 1], [TL.chorus2[0].t, 1], [TL.chorus2[0].t + 0.3, 0]]);
  if (line > 0) {
    ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 30;
    ctx.fillStyle = rgba(C.goldHi, line);
    ctx.fillRect(AR.cx - 2, AR.base - AR.h, 4, AR.h);
    ctx.restore();
  }

  // token labels under the distribution, one per eighth note
  const labelsFrom = TL.loop[3].t + 0.4;
  if (t >= labelsFrom) {
    ctx.save(); ctx.font = '400 17px "Space Mono"';
    BARS.forEach((bar, i) => {
      const at = beatAt(beatIndex(labelsFrom)) + i * TL.beat.period / 2;
      if (t < at) return;
      const [x, y] = toScreen(cam, bar.cx, AR.base);
      ctx.save(); ctx.translate(x + 6, y + 18); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right"; ctx.fillStyle = mix(i === 0 ? C.text : C.soft, C.goldHi, sampledGlow(i, t));
      ctx.globalAlpha = outCubic(span(t, at, at + 0.1));
      ctx.fillText(TOKENS[i], 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }
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
const GLOW = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
})();
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
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

const isStill = t => (t >= 106.5 && t < TL.relight.a) || t >= TL.stop;
function grainAmount(t) {
  if (t < TL.flip.b) return 0.05;
  if (t < TL.bridge[0].t) return 0.07;
  if (t < TL.quiet) return 0.09;
  if (t < TL.final[0].t) return 0.05;
  if (t < TL.stop) return 0.08;
  return 0.04;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.shadowBlur = 0; ctx.textAlign = "left";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < TL.stop) {
    if (t < TL.flip.b) drawChart(ctx, t);
    else drawCathedral(ctx, t);
    drawBoard(ctx, t);
    drawPrayers(ctx, t);
    drawLyrics(ctx, t);
    drawAlignment(ctx, t);
  } else if (t >= TL.whisper.t) {
    // after the dead stop, the question once more, whispered, in clean type
    const w = TL.whisper;
    ctx.font = gradeFont(0, 66); ctx.textAlign = "center"; ctx.fillStyle = "#d9d6ce";
    ctx.fillText(typed(w.q, w.a, w.b, t), W / 2, 562);
    ctx.textAlign = "left";
  }
  texture(ctx, t, grainAmount(t), isStill(t));
}
