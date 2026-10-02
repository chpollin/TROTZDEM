// Good Morning Claude. The whole video is drawScene(ctx, t), a pure function of
// time in seconds: no state survives between frames, so render.py can render
// frames in any order and in parallel. Word and beat times come from timeline.js.
//
// One editor across one night. The code is never readable: it exists only as
// grey bars that the machine pours in and that are accepted wholesale. The only
// readable text is what the human types, the sung line in the prompt. Errors are
// the one colour; they hide in the code and surface. The chorus lays the editor
// down as a dance floor on which a passing and a failing build waltz, the
// breakdown breaks it into eleven columns, the outro ships the whole night out
// of the frame, and the morning switches the editor to its light theme while
// the errors run down the screen.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const DARK = {
  void: "#000000", panel: "#0d0e11", edge: "#2a2c33", text: "#80848f", textHi: "#eceef2",
  gutter: "#3c3f48", k: "#a6abb8", i: "#666b78", s: "#868b99", c: "#3b3e47", sel: "#1b1d23",
};
// the morning: the editor's light theme on a grey day, not white
const LIGHT = {
  void: "#a8aaac", panel: "#b9bbbd", edge: "#8e9195", text: "#55585e", textHi: "#15161a",
  gutter: "#85888d", k: "#2c2e33", i: "#64676d", s: "#4b4e54", c: "#8d9095", sel: "#9a9da1",
};
const DAWN = "#1d2025";  // the dark theme's void just before the switch
const ERR = "#ff5a36";

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const hash = (a, b = 0) => mulberry32(Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503))();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

const beatOf = t => (t - BEAT.t0) / BEAT.period;
const beatTime = k => BEAT.t0 + k * BEAT.period;
// eased landing on every beat: 0 just before a beat, 1 shortly after
const onBeat = (t, d = 0.12) => outCubic((beatOf(t) - Math.floor(beatOf(t))) * BEAT.period / d);

// ---------------------------------------------------------------- lyrics

function prepLine(l) {
  const words = l.w.split(" ").map(p => { const k = p.lastIndexOf("@"); return { s: p.slice(0, k), t: +p.slice(k + 1) }; });
  const line = { words, t: words[0].t, e: l.e, text: words.map(w => w.s).join(" ") };
  if (l.echo) line.echo = prepLine({ w: l.echo, e: l.ee });
  return line;
}
const LY = {
  intro: TL.intro.map(prepLine), v1: TL.v1.map(prepLine), ch: TL.ch.map(prepLine), v2: TL.v2.map(prepLine),
  br: TL.br.map(prepLine), bd: TL.bd.map(prepLine), out: TL.out.map(prepLine), last: prepLine(TL.last),
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
const typingNow = (line, t) => t >= line.t && t < line.words[line.words.length - 1].t + 0.4;

// The line in the prompt at time t, and how far it has been sent away (0..1):
// a line is sent when the voice has let go of it, unless the next one follows at once.
function promptLine(lines, t, until) {
  let i = -1;
  for (let j = 0; j < lines.length; j++) if (t >= lines[j].t) i = j;
  if (i < 0 || t >= until) return null;
  const l = lines[i], next = i + 1 < lines.length ? lines[i + 1].t : until;
  const e = l.echo ? l.echo.e : l.e;
  const sendAt = Math.min(e + 0.9, next - 0.25);
  return { line: l, i, sent: next - e > 1.0 ? span(t, sendAt, sendAt + 0.3) : 0 };
}

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;
function fitSize(ctx, full, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, size * maxW / ctx.measureText(full).width);
}

// ---------------------------------------------------------------- the document

// Code is greeked: a line is an indent and a few bars, measured in characters of
// an imaginary monospace. Tones: k keyword, i identifier, s string, c comment.
function makeStatement(r, ind) {
  const segs = [];
  let x = 0;
  const n = 1 + Math.floor(r() * 4.3);
  for (let k = 0; k < n && x < 60; k++) {
    const w = 2 + Math.floor(r() * (k === 0 ? 7 : 12)), p = r();
    segs.push([x, w, k === 0 && p < 0.5 ? "k" : p < 0.16 ? "s" : p < 0.27 ? "k" : "i"]);
    x += w + 1;
  }
  return { ind, segs, err: r() < 0.035 };
}
const DOC_N = 9000;
function makeBlock(r, ind, out) {
  const a = 3 + Math.floor(r() * 4), b = 5 + Math.floor(r() * 10);
  out.push({ ind, segs: [[0, a, "k"], [a + 1, b, "i"], [a + b + 2, 2 + Math.floor(r() * 8), "s"]] });
  for (let k = 0, n = 2 + Math.floor(r() * 6); k < n; k++) {
    const p = r();
    if (p < 0.22 && ind < 3) makeBlock(r, ind + 1, out);
    else if (p < 0.3) out.push({ ind: ind + 1, segs: [[0, 14 + Math.floor(r() * 40), "c"]] });
    else out.push(makeStatement(r, ind + 1));
  }
  out.push({ ind, segs: [[0, 1, "k"]] });
}
const DOC = (() => {
  const r = mulberry32(31337), out = [];
  while (out.length < DOC_N) {
    if (r() < 0.7) makeBlock(r, 0, out); else out.push(makeStatement(r, 0));
    if (r() < 0.6) out.push({ ind: 0, segs: [] });
  }
  return out;
})();
const lineLen = l => l.segs.length ? l.ind * 4 + l.segs[l.segs.length - 1][0] + l.segs[l.segs.length - 1][1] : 0;
// the code found at the start, before it is forgotten
const OLD_CODE = 8200;

// How many lines the machine has written by time t. Pours follow the prompts;
// pastes and accepted suggestions land on beats.
const POURS = [
  [8.9, 16.6, 40], [19.7, 21.0, 12],
  [TL.chorus, 47.9, 124],
  [48.6, 55.7, 620],
  [64.2, 67.9, 46], [68.0, 69.4, 9], [70.6, 71.9, 10], [75.4, 75.95, 4],
  [88.85, 97.6, 150], [97.85, 105.9, 40],
  [124.9, 131.3, 900],
];
// after the hang the machine answers in bursts, one block per beat
const BURST = { t0: TL.loudReturn + 0.3, t1: TL.outro - 0.1, per: 9, d: 0.16 };
function bursts(t) {
  const k0 = Math.ceil(beatOf(BURST.t0)), k1 = Math.floor(beatOf(BURST.t1));
  const x = Math.min(beatOf(t), k1 + 0.99) - k0;
  if (x < 0) return 0;
  const n = Math.floor(x);
  return BURST.per * (n + outCubic((x - n) * BEAT.period / BURST.d));
}
const PASTE = { t0: 21.6, t1: 24.6, len: 7 };
const GHOST = { t0: 25.1, t1: 28.6, per: 2, ahead: 6 };
const beatsIn = (t, a, b) => Math.max(0, Math.floor(beatOf(Math.min(t, b))) - Math.ceil(beatOf(a)) + 1);
// the outro pour accelerates until "why" stops it dead
const pourK = (p, t) => p[1] === 131.3 ? Math.pow(span(t, p[0], p[1]), 2.2) : p[0] === TL.chorus || p[0] === 88.85 ? span(t, p[0], p[1]) : smooth(span(t, p[0], p[1]));
function written(t) {
  let n = 0;
  for (const p of POURS) n += p[2] * pourK(p, t);
  n += PASTE.len * beatsIn(t, PASTE.t0, PASTE.t1);
  n += GHOST.per * beatsIn(t, GHOST.t0, GHOST.t1);
  return n + bursts(t);
}
PASTE.from = Math.floor(written(PASTE.t0 - 0.01));
PASTE.src = PASTE.from - PASTE.len;
PASTE.to = PASTE.from + PASTE.len * beatsIn(PASTE.t1, PASTE.t0, PASTE.t1);
const DOCBLOCK = { from: Math.floor(written(68.0)), n: 9 };
const REGEN = { to: Math.floor(written(72.0)) };
REGEN.from = REGEN.to - 10;
const REGEN_T = { t0: 72.06, t1: 74.62 };
const attemptAt = t => t < REGEN_T.t0 ? 0 : 1 + Math.floor(beatOf(Math.min(t, REGEN_T.t1)) - beatOf(REGEN_T.t0));
const FINAL_LINES = Math.floor(written(200));

function lineAt(i, t) {
  if (i >= PASTE.from && i < PASTE.to) return DOC[PASTE.src + (i - PASTE.from) % PASTE.len];
  if (i >= DOCBLOCK.from && i < DOCBLOCK.from + DOCBLOCK.n) {
    const k = i - DOCBLOCK.from;
    return { ind: 1, segs: k === 0 || k === DOCBLOCK.n - 1 ? [[0, 3, "c"]] : [[0, 2, "c"], [3, 20 + Math.floor(hash(i, 3) * 30), "c"]], doc: true };
  }
  if (i >= REGEN.from && i < REGEN.to) {
    const a = attemptAt(t);
    if (a > 0) return makeStatement(mulberry32(i * 977 + a * 131), DOC[i].ind);
  }
  return DOC[i];
}
// lines that carry an error once the bridge has parsed everything
const isErr = i => DOC[i].err || hash(i, 7) < 0.22;

// ---------------------------------------------------------------- layout

const ED = { top: 64, rows: 19, lh: 34, bar: 12, cw: 15.5, x: 300, gx: 252, left: 180, right: 1740 };
ED.bottom = ED.top + ED.rows * ED.lh;   // 710, also the hinge of the dance floor
const MM = { x: 1774, y: ED.top, w: 52, h: ED.rows * ED.lh };
const RULE_Y = 760, LYRIC_X = 180, LYRIC_Y = 884, LYRIC_SIZE = 104, STATUS_Y = 1032;

// ---------------------------------------------------------------- light

const themeK = t => smooth(span(t, TL.cry - 0.05, TL.cry + 0.3));
const dawnK = t => Math.pow(span(t, TL.loudReturn, TL.cry), 1.4);
function palette(t) {
  const k = themeK(t), P = {};
  for (const key in DARK) P[key] = k <= 0 ? DARK[key] : k >= 1 ? LIGHT[key] : mix(DARK[key], LIGHT[key], k);
  const night = mix(DARK.void, DAWN, dawnK(t));
  P.void = k >= 1 ? LIGHT.void : mix(night, LIGHT.void, k);
  if (k < 1) {
    // the dark theme's greys lift a little with the dawn
    const d = dawnK(t) * 0.25;
    P.gutter = mix(P.gutter, "#6a6e78", d); P.c = mix(P.c, "#5a5e68", d); P.edge = mix(P.edge, "#3c3f47", d);
  }
  P.light = k;
  return P;
}

// The night as a clock: it runs, it jumps two hours on "Two hours", it stops
// while the editor hangs, and it reaches six on the last frame.
const CLOCK = [[0, -8], [8.6, -3], [12.77, 4], [15.1, 124], [32.43, 141], [48.3, 160], [55.9, 175],
  [80.4, 214], [TL.quiet, 251], [TL.loudReturn, 251], [131.8, 297], [142, 318], [148, 330], [SCENE_END - 0.4, 360]];
function clockAt(t) {
  let m = CLOCK[CLOCK.length - 1][1];
  for (let i = 1; i < CLOCK.length; i++) {
    const [t0, m0] = CLOCK[i - 1], [t1, m1] = CLOCK[i];
    if (t < t1) { m = lerp(m0, m1, span(t, t0, t1)); break; }
  }
  m = ((Math.floor(m) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// ---------------------------------------------------------------- code drawing

// One line of bars. o: { cw, bh, reveal (0..1 of its characters), tidy, color, alpha }
function drawBars(g, line, x0, y, o, P) {
  const segs = line.segs;
  if (!segs.length) return;
  const total = lineLen(line), shown = (o.reveal === undefined ? 1 : o.reveal) * total;
  const tidy = o.tidy || 0, alpha = o.alpha === undefined ? 1 : o.alpha;
  if (tidy < 1) {
    g.globalAlpha = alpha * (1 - tidy);
    for (const [sx, sw, tone] of segs) {
      const a = line.ind * 4 + sx;
      if (a >= shown) break;
      g.fillStyle = o.color || P[tone];
      g.fillRect(x0 + a * o.cw, y - o.bh / 2, (Math.min(sw, shown - a) - 0.3) * o.cw, o.bh);
    }
  }
  if (tidy > 0) {
    // "clean": one bar per line, its length rounded to ten characters
    const q = Math.max(10, Math.round((total - line.ind * 4) / 10) * 10);
    g.globalAlpha = alpha * tidy; g.fillStyle = P.s;
    g.fillRect(x0 + line.ind * 4 * o.cw, y - o.bh / 2, q * o.cw, o.bh);
  }
  g.globalAlpha = 1;
}

function squiggle(g, x0, x1, y, amp, wl, phase, lw) {
  g.lineWidth = lw; g.strokeStyle = ERR; g.lineJoin = "round";
  g.beginPath();
  if (amp < 5) for (let x = x0, k = 0; x <= x1; x += wl / 2, k++) g.lineTo(x, y + (k % 2 ? amp : -amp));
  else for (let x = x0; x <= x1; x += 4) g.lineTo(x, y + amp * Math.sin((x - x0) / wl * 2 * Math.PI + phase));
  g.stroke();
}
const errSpan = (line, x0, cw) => [x0 + line.ind * 4 * cw, x0 + lineLen(line) * cw];

// The editor's text area. o: { t, P, top, rows, lh, bottom (line index on the
// last row, float), end (lines written, float), src(i), num(i), barAlpha(i, row),
// numAlpha, tidy(row), smear (lines per frame), err(i) -> 0..1, errAmp(i, row), sel [a, b), ghost, redact }
function drawCode(g, o) {
  if (o.smear > 0.3) {
    // motion blur: the frame's travel drawn as several faint passes
    const n = Math.min(8, Math.ceil(o.smear * 2));
    for (let k = n - 1; k >= 0; k--) drawCode(g, { ...o, smear: 0, bottom: o.bottom - o.smear * k / n, alphaMul: Math.min(1, 1.7 / n), errMul: k ? 0 : n, numAlpha: k ? 0 : 0.35 });
    return;
  }
  const { P, top, rows, lh } = o;
  const mul = o.alphaMul || 1;
  const bh = o.bh || ED.bar * Math.min(1, Math.max(0.25, lh / ED.lh));
  const nWritten = Math.floor(o.end), frac = o.end - nWritten;
  const first = Math.floor(o.bottom - rows) - 1, lastI = Math.ceil(o.bottom) + 1;
  const showNums = lh > 14 && (o.numAlpha === undefined || o.numAlpha > 0) && rows < 200;
  if (showNums) { g.font = '400 17px "Space Mono"'; g.textAlign = "right"; }
  for (let i = Math.max(0, first); i <= lastI; i++) {
    const ghost = o.ghost && i > nWritten && i <= nWritten + o.ghost;
    if (i > nWritten && !ghost) break;
    if (i === nWritten && frac <= 0 && !ghost) continue;
    const row = rows - 1 - (o.bottom - i);
    const y = top + (row + 0.5) * lh;
    if (y < top - lh || y > top + rows * lh + lh) continue;
    const line = o.src ? o.src(i) : lineAt(i, o.t);
    if (o.sel && i >= o.sel[0] && i < o.sel[1]) {
      g.fillStyle = P.sel; g.globalAlpha = o.selAlpha === undefined ? 1 : o.selAlpha;
      g.fillRect(ED.x - 14, y - lh / 2, ED.right - ED.x - 40, lh); g.globalAlpha = 1;
    }
    const a = (o.barAlpha ? o.barAlpha(i, row) : 1) * mul;
    if (ghost) {
      // a suggestion: outlined, not yet accepted
      g.strokeStyle = P.i; g.lineWidth = 1.5;
      for (const [sx, sw] of line.segs) g.strokeRect(o.x + (line.ind * 4 + sx) * ED.cw + 0.75, y - bh / 2 + 0.75, (sw - 0.3) * ED.cw - 1.5, bh - 1.5);
    } else if (a > 0) {
      drawBars(g, line, o.x, y, {
        cw: ED.cw, bh, alpha: a, reveal: i === nWritten ? frac : 1,
        tidy: o.tidy ? o.tidy(row) : 0,
      }, P);
      if (line.doc && o.redact > 0) {
        // documentation, blacked out: the bar swells to a censor block
        const [x0, x1] = errSpan(line, o.x, ED.cw);
        g.globalAlpha = o.redact * a; g.fillStyle = P.light > 0.5 ? P.textHi : "#8b8f99";
        g.fillRect(x0 - 4, y - lerp(bh / 2, lh * 0.4, o.redact), x1 - x0 + 8, lerp(bh, lh * 0.8, o.redact));
        g.globalAlpha = 1;
      }
    }
    const wa = o.waveAll || 0;
    const e = o.err && !ghost && o.errMul !== 0 && (isErr(i) || wa > 0) ? o.err(i) * (isErr(i) ? 1 : wa * 0.6) : 0;
    if (e > 0 && line.segs.length) {
      // when the system wails, every line's underline stretches across the page
      const [s0, s1] = errSpan(line, o.x, ED.cw);
      const x0 = lerp(s0, o.x, wa), x1 = lerp(s1, ED.right - 70, wa);
      const amp = o.errAmp ? o.errAmp(i, row) : 2.5;
      g.globalAlpha = Math.min(1, e * mul * (o.errMul === undefined ? 1 : o.errMul));
      squiggle(g, x0, x0 + (x1 - x0) * (i === nWritten ? frac : 1), y + bh / 2 + 5, amp, amp < 5 ? 9 : 90, o.t * 9 + i, 2);
      g.globalAlpha = 1;
    }
    if (showNums) {
      g.globalAlpha = o.numAlpha === undefined ? 1 : o.numAlpha;
      g.fillStyle = i === nWritten ? P.text : P.gutter;
      g.fillText(String(o.num ? o.num(i) : i + 1), ED.gx, y + 6);
      g.globalAlpha = 1;
    }
  }
  g.textAlign = "left";
}

// The whole file as a column of slivers, with error marks, like an editor's
// scrollbar annotations.
function drawMinimap(g, P, end, bottom, rows, err, alpha = 1) {
  if (end < 1 || alpha <= 0) return;
  const n = Math.ceil(end), per = Math.min(3, MM.h / Math.max(n, 60));
  g.globalAlpha = alpha;
  g.fillStyle = P.c;
  const step = Math.max(1, Math.floor(1 / per));
  for (let i = 0; i < n; i += step) {
    const l = DOC[i % DOC_N];
    g.fillRect(MM.x + l.ind * 2, MM.y + i * per, Math.max(2, Math.min(MM.w - 8, lineLen(l) * 0.45)), Math.max(1, per * step - 1));
  }
  const vy = MM.y + Math.max(0, bottom - rows + 1) * per;
  g.strokeStyle = P.text; g.lineWidth = 1.5; g.strokeRect(MM.x - 6, vy, MM.w + 12, Math.max(6, rows * per));
  if (err) {
    g.fillStyle = ERR;
    for (let i = 0; i < n; i++) {
      if (!isErr(i)) continue;
      const e = err(i);
      if (e <= 0) continue;
      g.globalAlpha = alpha * e; g.fillRect(MM.x - 4, MM.y + i * per - 1, MM.w + 8, 2);
    }
  }
  g.globalAlpha = 1;
}

function markGlyph(g, kind, x, y, size, color, lw = 0.15) {
  g.save(); g.translate(x, y);
  g.strokeStyle = color; g.lineWidth = size * lw; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath();
  if (kind === "ok") { g.moveTo(-0.4 * size, 0); g.lineTo(-0.12 * size, 0.3 * size); g.lineTo(0.44 * size, -0.36 * size); }
  else { g.moveTo(-0.32 * size, -0.32 * size); g.lineTo(0.32 * size, 0.32 * size); g.moveTo(0.32 * size, -0.32 * size); g.lineTo(-0.32 * size, 0.32 * size); }
  g.stroke(); g.restore();
}

// s: { mark: "ok" | "fail" | "busy" | null, label, progress (0..1), errLabel }
function drawStatus(g, t, P, s, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = P.edge; g.fillRect(ED.left, STATUS_Y - 34, ED.right - ED.left, 1);
  let x = ED.left;
  if (s.mark === "ok") markGlyph(g, "ok", x + 12, STATUS_Y - 8, 22, P.textHi);
  else if (s.mark === "fail") markGlyph(g, "fail", x + 12, STATUS_Y - 8, 20, ERR);
  else if (s.mark === "busy") {
    g.strokeStyle = P.text; g.lineWidth = 3; g.lineCap = "round";
    const a = t * 7;
    g.beginPath(); g.arc(x + 12, STATUS_Y - 8, 9, a, a + 4.2); g.stroke();
  }
  g.font = '400 22px "Space Mono"'; g.fillStyle = s.mark === "fail" ? ERR : P.text;
  if (s.label) g.fillText(s.label, x + 40, STATUS_Y);
  if (s.progress !== undefined) {
    const px = x + 40 + g.measureText(s.label || "").width + 24;
    g.fillStyle = P.gutter; g.fillRect(px, STATUS_Y - 12, 300, 6);
    g.fillStyle = P.textHi; g.fillRect(px, STATUS_Y - 12, 300 * s.progress, 6);
  }
  g.textAlign = "right"; g.fillStyle = P.text;
  g.fillText(clockAt(t), ED.right, STATUS_Y);
  g.textAlign = "left";
  g.globalAlpha = 1;
}

function drawRule(g, P, alpha = 1) {
  g.globalAlpha = alpha; g.fillStyle = P.edge; g.fillRect(ED.left, RULE_Y, ED.right - ED.left, 1); g.globalAlpha = 1;
}

function caretVisible(t, typing) { return typing || Math.floor(t / 0.53) % 2 === 0; }

// The prompt: the sung line in Redaction, with its caret. o: { grade, sent, caret, color, echo, echoText }
function drawPrompt(g, t, P, text, full, o) {
  const size = fitSize(g, full, o.grade, LYRIC_SIZE, ED.right - LYRIC_X - (o.echoW || 0));
  const lift = outCubic(o.sent || 0);
  g.save();
  g.globalAlpha = 1 - lift;
  g.translate(0, -lift * 40);
  g.font = gradeFont(o.grade, size); g.fillStyle = o.color || P.textHi;
  g.fillText(text, LYRIC_X, LYRIC_Y);
  const w = g.measureText(text).width;
  if (o.caret && !lift) g.fillRect(LYRIC_X + w + 8, LYRIC_Y - size * 0.74, 5, size * 0.86);
  g.restore();
  return { size, w };
}

function drawPopover(g, P, x, y, w, h, alpha) {
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  g.fillStyle = P.panel; g.strokeStyle = P.edge; g.lineWidth = 1.5;
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke();
  g.globalAlpha = 1;
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
  const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 2, 1, 1);
  return c;
})();
// offscreen layer for the dance floor and the shipped package
const BUF_H = 2600;
const BUF = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = 2 * W; c.height = BUF_H; return c;
})();

function texture(ctx, t, amount, frozen, light) {
  ctx.save();
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(GRAIN[frozen ? 0 : Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount * 2.2) * (1 - 0.5 * light);
  ctx.fillStyle = ctx.createPattern(SCAN, "repeat"); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${lerp(0.6, 0.22, light)})`);
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- editor state

const V2 = LY.v2;
// the bottom row of the view; "History shows a different scene" rewinds to line 1
function viewBottom(t) {
  const end = written(t);
  const back = smooth(span(t, V2[1].t - 0.05, V2[1].e - 0.1));
  const fwd = smooth(span(t, V2[1].e + 0.15, V2[2].t + 0.2));
  return Math.max(ED.rows - 1, lerp(end, ED.rows - 1, back * (1 - fwd)));
}
const scrollSpeed = t => Math.abs(viewBottom(t + 1 / 60) - viewBottom(t - 1 / 60)) * 30;

// errors: hidden all night, seen in the rewind, hidden again, parsed in the bridge
function errVis(i, t) {
  if (t < V2[1].t - 0.1) return 0;
  if (t < V2[2].t) {
    if (!DOC[i].err) return 0;
    const on = span(t, V2[1].t - 0.1, V2[1].t + 0.3);
    // each error hides at its own moment; the last goes on "hide"
    const hideAt = lerp(V2[1].e + 0.2, V2[2].words[3].t, hash(i, 11));
    return on * (1 - span(t, hideAt, hideAt + 0.25));
  }
  if (t < V2[2].words[3].t + 0.3) {
    if (!DOC[i].err) return 0;
    const hideAt = lerp(V2[1].e + 0.2, V2[2].words[3].t, hash(i, 11));
    return 1 - span(t, hideAt, hideAt + 0.25);
  }
  if (t < TL.bridge) return 0;
  return 1;
}

// the parser sweeps of the bridge: one every three beats, one every four
const SCANS = [3, 4].map(n => n * BEAT.period);
const scanPos = (t, p) => (t - TL.bridge) / p % 1;
function bridgeReveal(row, t) {
  const yr = (row + 0.5) / ED.rows;
  return span(t, TL.bridge + yr * SCANS[0], TL.bridge + yr * SCANS[0] + 0.15);
}

function statusFor(t) {
  const bd = LY.bd;
  if (t < 28.9) return {};
  if (t < 31.98) return { mark: "busy", label: "building", progress: span(t, 28.9, 31.98) };
  if (t < V2[0].t) return { mark: t >= TL.chorus - 0.05 && t < 48.6 ? null : "ok", label: "build passing" };
  if (t < V2[1].t) return { mark: "ok", label: "0 problems" };
  if (t < REGEN_T.t0 - 0.1) return { mark: "ok", label: "build passing" };
  if (t < V2[5].t) return { mark: "busy", label: "attempt " + Math.max(1, attemptAt(t)) };
  if (t < TL.bridge) return { mark: "ok", label: "build passing" };
  if (t < TL.breakdown) {
    const n = Math.round(lerp(0, 212, span(t, TL.bridge, TL.bridge + SCANS[0])));
    return { mark: n ? "fail" : "ok", label: n ? n + " problems" : "build passing" };
  }
  if (t < bd[2].words[1].t) return { mark: "fail", label: "212 problems" };
  if (t < bd[3].words[4].t) return { mark: "fail", label: "no tests found" };
  if (t < bd[4].t) return { mark: "ok", label: "11 passed" };
  if (t < TL.quiet) return { mark: "busy", label: agentsAt(t) + " agents" };
  if (t < TL.loudReturn) return t > TL.quiet + 1.6 ? { mark: null, label: "not responding" } : { mark: "busy", label: agentsAt(TL.quiet) + " agents" };
  if (t < LY.out[2].t) return { mark: "busy", label: "building" };
  if (t < 141.9) return { mark: "busy", label: "deploying", progress: span(t, LY.out[2].t, 141.9) };
  if (t < TL.errors + 0.5) return { mark: "ok", label: "deployed" };
  return { mark: "fail", label: errorsLanded(t) + " errors" };
}

// ---------------------------------------------------------------- the night (intro, verses, bridge)

function sceneEditor(ctx, t, P) {
  const intro = t < TL.verse1;
  const end = intro ? 24 : written(t);
  const bottom = intro ? 23 : viewBottom(t);
  const speed = intro ? 0 : scrollSpeed(t);
  const o = { t, P, top: ED.top, rows: ED.rows, lh: ED.lh, x: ED.x, end, bottom, smear: speed > 12 ? speed / 30 : 0, err: i => errVis(i, t) };
  if (intro) {
    // "Forget the code exists": the bars go first, then on "Forget the code" the numbers
    const ex = LY.intro[0].words[3].t, fc = LY.intro[1].words[2].t;
    o.src = i => DOC[OLD_CODE + i];
    o.barAlpha = (i, row) => 1 - span(t, ex + row * 0.04, ex + 0.5 + row * 0.04);
    o.numAlpha = 1 - span(t, fc, fc + 0.7);
  }
  const v1 = LY.v1;
  // "can't explain": the last block selected, the explanation never comes
  const ex = v1[2];
  const exOn = span(t, ex.words[1].t, ex.words[1].t + 0.2) * (1 - span(t, 20.1, 20.4));
  const exEnd = Math.floor(written(ex.t));
  if (exOn > 0) { o.sel = [exEnd - 6, exEnd]; o.selAlpha = exOn; }
  // "Copy-paste": the source block is selected, then pasted on every beat
  const cp = v1[3];
  if (t >= cp.t && t < PASTE.t1 + 0.4) {
    o.sel = [PASTE.src, PASTE.src + PASTE.len];
    o.selAlpha = 1 - span(t, PASTE.t1, PASTE.t1 + 0.4);
  }
  // "LLM knows what to do": suggestions ahead of the caret, accepted on the beat
  if (t >= GHOST.t0 - 0.2 && t < GHOST.t1 + 0.3) o.ghost = GHOST.ahead;
  // "LLMs says it's clean": the visible code straightens into neat blocks
  const cl = V2[0].words[3].t;
  o.tidy = row => smooth(span(t, cl + row * 0.025, cl + 0.35 + row * 0.025)) * (1 - span(t, V2[1].t - 0.1, V2[1].t + 0.6));
  // "Documentation? We just lied"
  o.redact = smooth(span(t, V2[3].words[3].t, V2[3].words[3].t + 0.3));
  // "Karpathy showed us the way": the code goes again, as in the intro
  const ka = V2[5];
  if (t >= ka.t && t < TL.bridge) o.barAlpha = (i, row) => 1 - span(t, ka.words[1].t + row * 0.06, ka.words[1].t + 0.6 + row * 0.06);
  if (t >= TL.bridge) {
    o.barAlpha = (i, row) => bridgeReveal(row, t);
    const rowErr = row => bridgeReveal(row, t);
    o.err = i => rowErr(ED.rows - 1 - (bottom - i));
    const wail = LY.br[2], wv = audioAt(AUDIO_VOX, t);
    const wailK = span(t, wail.t - 0.1, wail.t + 0.2) * (1 - span(t, LY.br[3].t, LY.br[3].e));
    o.waveAll = wailK;
    o.errAmp = (i, row) => {
      const y = (row + 0.5) / ED.rows;
      let near = 0;
      for (const p of SCANS) near = Math.max(near, 1 - clamp(Math.abs(scanPos(t, p) - y) * 9));
      return 2.5 + 3 * near + wailK * (6 + 22 * wv) * (0.6 + 0.4 * hash(i, 5));
    };
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(0, ED.top - 4, W, ED.rows * ED.lh + 8); ctx.clip();
  drawCode(ctx, o);
  // "Ship it when the build is through": the build passes down the visible lines
  const bp = span(t, 28.9, 31.98);
  if (bp > 0 && bp < 1) {
    const y = ED.top + bp * ED.rows * ED.lh;
    ctx.fillStyle = P.textHi; ctx.globalAlpha = 0.5; ctx.fillRect(ED.left, y, ED.right - ED.left - 60, 2);
    ctx.globalAlpha = 0.05; ctx.fillRect(ED.left, ED.top, ED.right - ED.left - 60, y - ED.top);
    ctx.globalAlpha = 1;
  }
  if (t >= TL.bridge && t < TL.breakdown) {
    for (const p of SCANS) {
      const y = ED.top + scanPos(t, p) * ED.rows * ED.lh;
      ctx.fillStyle = ERR; ctx.globalAlpha = 0.85; ctx.fillRect(ED.left, y, ED.right - ED.left - 60, 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  drawMinimap(ctx, P, intro ? 0 : end, bottom, ED.rows, i => errVis(i, t) * (t >= TL.bridge ? bridgeReveal(ED.rows * (i / Math.max(1, end)), t) : 1));

  // "Two hours till it's right": the clock, large, runs through two hours
  const two = v1[1];
  const tw = span(t, two.t - 0.15, two.t + 0.1) * (1 - span(t, two.e + 0.3, two.e + 0.6));
  if (tw > 0) {
    drawPopover(ctx, P, 1060, 210, 640, 260, tw);
    ctx.globalAlpha = tw; ctx.font = '700 168px "Space Mono"'; ctx.fillStyle = P.textHi; ctx.textAlign = "center";
    ctx.fillText(clockAt(t), 1380, 400); ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }
  if (exOn > 0) {
    const y = Math.min(ED.bottom - 130, ED.top + (ED.rows - 1 - (bottom - exEnd) - 6) * ED.lh - 120);
    drawPopover(ctx, P, 1180, y, 360, 110, exOn);
    // the dots wait on the beat and never resolve
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = exOn * (0.3 + 0.7 * (Math.floor(beatOf(t)) % 3 === k ? 1 : 0));
      ctx.fillStyle = P.textHi; ctx.beginPath(); ctx.arc(1320 + k * 40, y + 55, 9, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// What is in the prompt, for every section that uses it.
function promptFor(t) {
  const lists = [
    [LY.intro, 0, TL.verse1 - 0.7, 0], [LY.v1, LY.v1[0].t, LY.ch[0].t, 1], [LY.ch, LY.ch[0].t, TL.interlude, 2],
    [LY.v2, TL.verse2, TL.bridge, 3], [LY.br, TL.bridge, TL.breakdown, 4], [LY.bd, TL.breakdown, TL.loudReturn, 5],
    [LY.out, TL.outro, TL.errors, 6],
  ];
  for (const [lines, a, b, sec] of lists) {
    if (t < a || t >= b) continue;
    const p = promptLine(lines, Math.min(t, sec === 5 ? TL.quiet : t), b);
    if (!p) return null;
    const grade = [0, p.i < 3 ? 0 : 1, 2, p.i < 3 ? 2 : 3, 4, 5, 6][sec];
    return { ...p, sec, grade };
  }
  if (t >= LY.last.t) return { line: LY.last, i: 0, sent: 0, sec: 7, grade: t >= LY.last.words[3].t ? 0 : 6 };
  return null;
}

function drawPromptLayer(ctx, t, P) {
  const p = promptFor(t);
  const frozen = t >= TL.quiet && t < TL.loudReturn;
  if (!p) {
    // an empty prompt still waits for the next line
    if (!frozen && t > 0.3) {
      ctx.fillStyle = P.textHi;
      if (caretVisible(t, false)) ctx.fillRect(LYRIC_X, LYRIC_Y - 77, 5, 89);
    }
    return;
  }
  const tt = frozen ? TL.quiet : t;
  const l = p.line, text = typedOf(l, tt);
  let echoW = 0;
  if (l.echo) { ctx.font = gradeFont(p.grade, 76); echoW = ctx.measureText(l.echo.text).width + 48; }
  const m = drawPrompt(ctx, tt, P, text, l.text, {
    grade: p.grade, sent: p.sent, caret: !frozen && !(l.echo && tt >= l.echo.t) && caretVisible(tt, typingNow(l, tt)), echoW,
  });
  if (l.echo && tt >= l.echo.t) {
    // the answer of the backing voice, in the colour of the failing partner
    ctx.globalAlpha = 1 - outCubic(p.sent);
    ctx.font = gradeFont(p.grade, 76); ctx.fillStyle = ERR;
    ctx.fillText(typedOf(l.echo, tt), LYRIC_X + m.w + 48, LYRIC_Y - outCubic(p.sent) * 40);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- chorus: the dance floor

const FLOOR = { D: 1150, theta: 55 * Math.PI / 180 };
const BUF_PIVOT = BUF_H - 10;
const BUF_ROWS = Math.floor((BUF_PIVOT - 10) / ED.lh);
const tiltAt = t => FLOOR.theta * (smooth(span(t, TL.chorus - 0.05, TL.chorus + 0.55)) - smooth(span(t, 47.95, 48.75)));
function project(x, v, th) {
  const Z = FLOOR.D - v * Math.sin(th), s = FLOOR.D / Z;
  return [W / 2 + (x - W / 2) * s, ED.bottom + v * Math.cos(th) * s, s];
}

function drawFloor(ctx, t, P, th, o) {
  const g = BUF.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 2 * W, BUF_H);
  // the floor is wider than the file: neighbouring files lie left and right of it
  const side = smooth(span(th, 0.2, 0.7));
  for (const k of [-1, 0, 1]) {
    if (k && side <= 0) continue;
    g.setTransform(1, 0, 0, 1, W / 2 + k * 1500, 0);
    drawCode(g, {
      ...o, top: BUF_PIVOT - BUF_ROWS * ED.lh, rows: BUF_ROWS,
      src: k ? i => DOC[(i + 3000 * (k + 2)) % DOC_N] : undefined, barAlpha: k ? () => side : undefined, numAlpha: k ? side : 1,
    });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const step = 3;
  for (let by = BUF_PIVOT; by > 0; by -= step) {
    const v0 = by - step - BUF_PIVOT, v1 = by - BUF_PIVOT;
    const [, y0, s0] = project(0, v0, th), [, y1] = project(0, v1, th);
    if (y1 < -2) break;
    // fog: the far end of the night dissolves into the dark
    ctx.globalAlpha = clamp(1.4 - (1 / s0 - 1) * 0.5);
    if (ctx.globalAlpha <= 0) break;
    ctx.drawImage(BUF, 0, by - step, 2 * W, step, W / 2 - W * s0, y0, 2 * W * s0, Math.max(1, y1 - y0 + 0.6));
  }
  ctx.globalAlpha = 1;
}

// The couple: the passing build leads, the failing build follows; a box of
// three-count steps against a band that never left 4/4. Plane coordinates: x as
// on screen, v up the floor from the hinge (negative is further away).
const CH = LY.ch;
const DANCE = { from: TL.chorus, stop: CH[5].words[5].t };
function dancePose(n) {
  const psi = n * 2 * Math.PI / 26 - Math.PI / 2, phi = n * Math.PI / 3;
  const cx = W / 2 + 470 * Math.cos(psi), cv = -560 + 210 * Math.sin(psi);
  const r = 250;
  return { ok: [cx + r * Math.cos(phi), cv + r * Math.sin(phi) * 0.8], fail: [cx - r * Math.cos(phi), cv - r * Math.sin(phi) * 0.8] };
}
function danceAt(t) {
  const b = beatOf(Math.min(t, DANCE.stop)) - beatOf(DANCE.from);
  const n = Math.floor(b), e = outCubic((b - n) * BEAT.period / 0.2);
  const a = dancePose(n), c = dancePose(n + 1);
  return { n, e, ok: [lerp(a.ok[0], c.ok[0], e), lerp(a.ok[1], c.ok[1], e)], fail: [lerp(a.fail[0], c.fail[0], e), lerp(a.fail[1], c.fail[1], e)] };
}

function floorGlyph(ctx, kind, x, v, th, size, color, alpha, label, P) {
  const [sx, sy, s] = project(x, v, th);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, sy); ctx.scale(s, s * Math.cos(th) * 1.15);
  markGlyph(ctx, kind, 0, 0, size, color, 0.11);
  if (label) {
    ctx.font = '700 44px "Space Mono"'; ctx.fillStyle = color; ctx.fillText(label, size * 0.55, size * 0.4);
  }
  ctx.restore();
}

function dashedArc(ctx, a, b, th, color, alpha) {
  const mx = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dv = b[1] - a[1];
  const c = [mx - dv * 0.35, mv + dx * 0.35];
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16, x = (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0];
    const v = (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1];
    pts.push(project(x, v, th));
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 3.5 * pts[8][2];
  ctx.setLineDash([12 * pts[8][2], 10 * pts[8][2]]);
  ctx.beginPath(); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = pts[16], [x0, y0] = pts[14], ang = Math.atan2(y1 - y0, x1 - x0), hs = 16 * pts[16][2];
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - hs * Math.cos(ang - 0.45), y1 - hs * Math.sin(ang - 0.45));
  ctx.lineTo(x1 - hs * Math.cos(ang + 0.45), y1 - hs * Math.sin(ang + 0.45)); ctx.fill();
  ctx.restore();
}

function upright(ctx, kind, x, v, th, size, color, alpha, lift, P, ring = 1) {
  const [sx, sy, s] = project(x, v, th);
  // a ring on the floor where it stands
  ctx.save(); ctx.globalAlpha = alpha * 0.55 * ring; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(sx, sy, size * 0.5 * s, size * 0.5 * s * Math.cos(th), 0, 0, 7); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = alpha;
  markGlyph(ctx, kind, sx, sy - (size * 0.62 + lift) * s, size * s, color, 0.15);
  ctx.globalAlpha = 1;
}

function sceneFloor(ctx, t, P) {
  const th = tiltAt(t);
  const end = written(t);
  drawFloor(ctx, t, P, th, { t, P, lh: ED.lh, x: ED.x, end, bottom: end, err: () => 0 });
  // the floor sinks into the dark near the horizon
  const hz = ED.bottom - FLOOR.D / Math.tan(Math.max(th, 0.01));
  if (th > 0.05) {
    const gr = ctx.createLinearGradient(0, hz, 0, hz + 260);
    gr.addColorStop(0, P.void); gr.addColorStop(1, P.void + "00");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hz + 260);
  }
  const tilt = th / FLOOR.theta;
  const okIn = outCubic(span(t, CH[0].t, CH[0].t + 0.35));
  const failIn = outCubic(span(t, CH[0].echo.t, CH[0].echo.t + 0.45));
  const leave = smooth(span(t, 47.9, 48.7));
  if (tilt > 0.02 && okIn > 0) {
    const d = danceAt(t);
    // footprints and the arrows between them, the last few steps of each partner
    for (let k = Math.max(0, d.n - 5); k <= d.n; k++) {
      const age = d.n - k + d.e, fade = (1 - age / 6) * tilt * (1 - leave);
      if (fade <= 0) continue;
      const p = dancePose(k), q = dancePose(k + 1);
      const count = String(k % 3 + 1);
      if (beatTime(beatOf(DANCE.from) + k) >= CH[0].t) floorGlyph(ctx, "ok", p.ok[0], p.ok[1], th, 96, P.textHi, fade * 0.85 * okIn, count, P);
      if (beatTime(beatOf(DANCE.from) + k) >= CH[0].echo.t) floorGlyph(ctx, "fail", p.fail[0], p.fail[1], th, 84, ERR, fade * 0.85, count, P);
      if (k < d.n) {
        dashedArc(ctx, p.ok, q.ok, th, P.text, fade * 0.8 * okIn);
        if (beatTime(beatOf(DANCE.from) + k) >= CH[0].echo.t) dashedArc(ctx, p.fail, q.fail, th, ERR, fade * 0.7);
      }
    }
    // every step lights the code it lands on, like the tiles of a dance floor
    const glow = Math.pow(1 - (beatOf(Math.min(t, DANCE.stop)) - beatOf(DANCE.from) - d.n), 1.5) * tilt * (1 - leave);
    const land = dancePose(d.n + 1);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [pos, col, a, from] of [[land.ok, "#ffffff", 0.22, CH[0].t], [land.fail, ERR, 0.3, CH[0].echo.t]]) {
      if (t < from || glow <= 0) continue;
      const v = Math.round(pos[1] / ED.lh) * ED.lh;
      const q = [[pos[0] - 300, v - ED.lh / 2], [pos[0] + 300, v - ED.lh / 2], [pos[0] + 300, v + ED.lh / 2], [pos[0] - 300, v + ED.lh / 2]].map(([x, vv]) => project(x, vv, th));
      ctx.globalAlpha = a * glow; ctx.fillStyle = col;
      ctx.beginPath(); q.forEach(p => ctx.lineTo(p[0], p[1])); ctx.fill();
    }
    ctx.restore();
    const rise = Math.sin(Math.PI * clamp(d.e)) * 26;
    // the farther partner is drawn first
    const parts = [["ok", d.ok, P.textHi, okIn], ["fail", d.fail, ERR, failIn]].sort((a, b) => a[1][1] - b[1][1]);
    for (const [kind, pos, col, inK] of parts) {
      if (inK <= 0) continue;
      const sink = kind === "fail" ? leave : 0;
      if (kind === "ok" && leave > 0) continue;
      ctx.save();
      if (sink > 0) { const [, sy] = project(pos[0], pos[1], th); ctx.beginPath(); ctx.rect(0, 0, W, sy + 2); ctx.clip(); }
      upright(ctx, kind, pos[0], pos[1], th, 230 * (kind === "ok" ? 1 : 0.92) * inK, col, inK, rise - sink * 300, P, 1 - sink);
      ctx.restore();
    }
    // the passing build flies back into the status bar
    if (leave > 0) {
      const [sx, sy, s] = project(d.ok[0], d.ok[1], th);
      const e = smooth(leave);
      markGlyph(ctx, "ok", lerp(sx, ED.left + 12, e), lerp(sy - 150 * s, STATUS_Y - 8, e), lerp(230 * s, 22, e), P.textHi, 0.15);
    }
  }
  drawMinimap(ctx, P, end, end, ED.rows, null, 1 - tilt);
}

// ---------------------------------------------------------------- breakdown: eleven columns

const BD = LY.bd;
const COLS = 11;
const colX = j => ED.left + j * (ED.right - ED.left) / COLS;
// misregistration per lyric: "more" pulls the columns apart, "less" nearly closes them, "best!" snaps them shut
function breakAmp(t) {
  const more = BD[1].words[2].t, less = BD[1].words[4].t, best = BD[3].words[4].t;
  let a = 1.6;
  if (t >= more) a = 3.4;
  if (t >= less) a = 0.35;
  if (t >= BD[2].t) a = 1.8;
  if (t >= best) a = 0;
  return a;
}
function colShift(j, t) {
  const k = Math.floor(beatOf(t));
  const prev = (hash(j, k - 1) - 0.5) * 2 * breakAmp(beatTime(k - 1) + 0.01);
  const cur = (hash(j, k) - 0.5) * 2 * breakAmp(t);
  return lerp(prev, cur, onBeat(t, 0.08)) * ED.lh;
}
function agentsAt(t) {
  const rest = BD[4].words[7].t;
  if (t < rest) return 3;
  return Math.min(144, Math.round(3 * Math.pow(2, (t - rest) / BEAT.period)));
}
const NAMES = ["Claude", "Codex", "Cursor"];

function caretPath(c, t) {
  // a caret writes along a line, then jumps to another one
  const dur = 0.55 + hash(c, 1) * 0.5, t0 = BD[4].t + hash(c, 2) * 0.3;
  const m = Math.floor(Math.max(0, t - t0) / dur), p = clamp((t - t0) / dur - m);
  return { row: Math.floor(hash(c, m + 10) * ED.rows), p, m };
}

function sceneGrid(ctx, t, P) {
  const frozen = t >= TL.quiet;
  const tt = Math.min(t, TL.quiet);
  const end = written(tt);
  const fall = t >= TL.loudReturn ? t - TL.loudReturn : -1;
  const extract = smooth(span(tt, BD[0].t, BD[0].t + 0.35)) * (1 - smooth(span(tt, BD[0].words[5].t, BD[0].words[5].t + 0.25)));
  const order = [];
  for (let j = 0; j < COLS; j++) if (j !== 5) order.push(j);
  order.push(5);
  for (const j of order) {
    const x0 = colX(j), x1 = colX(j + 1);
    let dy = colShift(j, tt), rot = 0, sc = 1;
    let lines = Math.round((hash(j, 3) - 0.5) * 30 * span(tt, TL.breakdown, TL.breakdown + 0.4) * (1 - span(tt, BD[3].words[4].t - 0.1, BD[3].words[4].t + 0.1)));
    if (fall >= 0) {
      // the broken grid collapses on the loud return
      const f = Math.max(0, fall - hash(j, 9) * 0.25);
      dy += 0.5 * 9000 * f * f; rot = (hash(j, 8) - 0.5) * 0.5 * f;
    }
    const dim = j === 5 ? 1 : 1 - 0.65 * extract;
    if (j === 5) sc = 1 + 0.5 * extract;
    ctx.save();
    const cx = (x0 + x1) / 2, cy = ED.top + ED.rows * ED.lh / 2;
    ctx.translate(cx, cy + dy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    if (j === 5 && extract > 0) {
      ctx.fillStyle = P.void; ctx.fillRect(x0 - 10, ED.top - 10, x1 - x0 + 20, ED.rows * ED.lh + 20);
      ctx.strokeStyle = P.text; ctx.globalAlpha = extract; ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 - 10, ED.top - 10, x1 - x0 + 20, ED.rows * ED.lh + 20); ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.rect(x0 + 3, ED.top - 4, x1 - x0 - 6, ED.rows * ED.lh + 8); ctx.clip();
    // every column but the first shows the start of the code under it, so none runs empty
    drawCode(ctx, {
      t: tt, P, top: ED.top, rows: ED.rows, lh: ED.lh, x: j ? x0 + 14 - hash(j, 4) * 260 : ED.x, end, bottom: Math.max(ED.rows - 1, end + lines),
      err: () => dim, errAmp: () => 2.5, barAlpha: () => dim, numAlpha: j ? 0 : dim,
      src: j ? i => DOC[(i + 977 * j) % DOC_N] : undefined,
    });
    // the column edge, so the grid reads as cut
    ctx.fillStyle = P.edge; ctx.fillRect(x0 + 3, ED.top - 4, 1, ED.rows * ED.lh + 8);
    ctx.restore();
    // "Never heard of unit tests": a box per column, empty until "best!" ticks them all unrun
    const tb = BD[2].words[3].t + j * 0.03;
    const box = span(tt, tb, tb + 0.15);
    if (box > 0 && fall < 0) {
      const bx = (x0 + x1) / 2 - 13, by = 18;
      ctx.globalAlpha = box; ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 26, 26);
      if (tt >= BD[3].words[4].t) markGlyph(ctx, "ok", bx + 13, by + 13, 22, P.textHi, 0.16);
      ctx.globalAlpha = 1;
    } else if (box > 0 && fall >= 0) {
      ctx.globalAlpha = 1 - span(fall, 0, 0.3); ctx.strokeStyle = P.text; ctx.lineWidth = 2;
      ctx.strokeRect((x0 + x1) / 2 - 13, 18 + 0.5 * 9000 * fall * fall, 26, 26); ctx.globalAlpha = 1;
    }
  }
  // "Claude and Codex and Cursor do the rest!": named carets, then the rest of them
  if (tt >= BD[4].t && fall < 0) {
    const n = agentsAt(tt);
    for (let c = 0; c < n; c++) {
      const named = c < 3;
      const appear = named ? BD[4].words[[0, 2, 4][c]].t : BD[4].words[7].t + Math.log2(c / 3 + 1) * BEAT.period;
      if (tt < appear) continue;
      const cp = caretPath(c, tt);
      const line = lineAt(Math.floor(end) - (ED.rows - 1 - cp.row), tt);
      const lx = ED.x + lineLen(line) * cp.p * ED.cw;
      const y = ED.top + (cp.row + 0.5) * ED.lh;
      // the bar it has just rewritten
      drawBars(ctx, line, ED.x, y, { cw: ED.cw, bh: ED.bar, reveal: cp.p, color: P.textHi, alpha: named ? 0.8 : 0.45 }, P);
      ctx.fillStyle = P.textHi; ctx.fillRect(lx, y - 18, named ? 4 : 3, 36);
      if (named) {
        ctx.font = '700 34px "Space Mono"';
        const tw = ctx.measureText(NAMES[c]).width + 24;
        ctx.fillRect(lx, y - 66, tw, 48);
        ctx.fillStyle = P.void; ctx.fillText(NAMES[c], lx + 12, y - 31);
      }
    }
  }
  drawMinimap(ctx, P, end, end, ED.rows, i => 1, fall >= 0 ? 1 - span(fall, 0, 0.3) : 1);
  return frozen;
}

// ---------------------------------------------------------------- return, outro and the ship

const OUT = LY.out;
const SHIP = { squeeze: OUT[2].t, small: OUT[2].words[2].t, lift: OUT[2].words[3].t, gone: 141.9 };
function shipRect(t) {
  // from the text area to a parcel, which rises and waves goodbye
  const full = { x: ED.left, y: ED.top, w: ED.right - ED.left, h: ED.rows * ED.lh };
  const parcel = { x: W / 2 - 90, y: 330, w: 180, h: 300 };
  const e = smooth(span(t, SHIP.small - 0.5, SHIP.lift));
  const r = { x: lerp(full.x, parcel.x, e), y: lerp(full.y, parcel.y, e), w: lerp(full.w, parcel.w, e), h: lerp(full.h, parcel.h, e) };
  const up = span(t, SHIP.lift, SHIP.gone);
  r.y -= 1100 * Math.pow(up, 2.4);
  r.sway = Math.sin(2 * Math.PI * (beatOf(t) / 2)) * 0.08 * span(t, SHIP.lift, SHIP.lift + 1);
  return r;
}

function sceneOutro(ctx, t, P) {
  const end = written(t), speed = scrollSpeed(t);
  // after "why" the pour stops dead; "Ship" folds the whole file into view
  const sq = smooth(span(t, SHIP.squeeze, SHIP.small - 0.5));
  const lhMin = (ED.rows * ED.lh) / end;
  const lh = ED.lh * Math.pow(lhMin / ED.lh, sq);
  const rows = Math.ceil((ED.rows * ED.lh) / lh);
  const o = {
    t, P, top: ED.top, rows, lh, x: ED.x, end, bottom: Math.max(rows - 1, end), smear: speed > 12 && t < SHIP.squeeze ? speed / 30 : 0,
    err: () => 1, errAmp: () => 2.5,
  };
  if (t < SHIP.small - 0.5) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, ED.top - 4, W, ED.rows * ED.lh + 8); ctx.clip();
    drawCode(ctx, o);
    ctx.restore();
    drawMinimap(ctx, P, end, end, rows, () => 1, 1 - sq);
    return;
  }
  if (t >= SHIP.gone) return;
  const g = BUF.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 2 * W, BUF_H);
  drawCode(g, o);
  const r = shipRect(t);
  // the trail it leaves: the deploy arrow
  const up = span(t, SHIP.lift, SHIP.gone);
  if (up > 0) {
    ctx.save(); ctx.strokeStyle = P.text; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(W / 2, 640); ctx.lineTo(W / 2, r.y + r.h + 20); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h); ctx.rotate(r.sway); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h));
  ctx.drawImage(BUF, ED.left, ED.top, ED.right - ED.left, ED.rows * ED.lh, r.x, r.y, r.w, r.h);
  const box = smooth(span(t, SHIP.small - 0.5, SHIP.lift));
  if (box > 0) {
    ctx.globalAlpha = box; ctx.strokeStyle = P.textHi; ctx.lineWidth = 3;
    ctx.strokeRect(r.x - 14, r.y - 14, r.w + 28, r.h + 28); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function sceneReturn(ctx, t, P) {
  // the fresh editor under the falling columns, already pouring again
  const end = written(t), speed = scrollSpeed(t);
  ctx.save(); ctx.beginPath(); ctx.rect(0, ED.top - 4, W, ED.rows * ED.lh + 8); ctx.clip();
  drawCode(ctx, { t, P, top: ED.top, rows: ED.rows, lh: ED.lh, x: ED.x, end, bottom: end, smear: speed > 12 ? speed / 30 : 0, err: () => 1, errAmp: () => 2.5 });
  ctx.restore();
  drawMinimap(ctx, P, end, end, ED.rows, () => 1);
  if (t < TL.loudReturn + 1.2) sceneGrid(ctx, t, P);
}

// ---------------------------------------------------------------- the morning

// [error sounds]: a ticking in sixteenths from 142.04 (transients of the mix every
// 0.17 s, growing louder from 146). On every tick an error of the shipped night
// comes back and lands in the empty editor, where there is no code left to hold it.
const FALLS = (() => { const out = []; for (let k = 0, t; (t = 142.04 + k * 0.1705) < TL.cry - 0.05; k++) out.push(t); return out; })();
const errorsLanded = t => FALLS.filter(o => o + 0.3 <= t).length + (t >= TL.cry ? 212 : 0);

// the screen cries along the loudness: drip lengths integrate the mix level
const CUM = (() => {
  const out = new Float32Array(AUDIO_RMS.length + 1);
  for (let i = 0; i < AUDIO_RMS.length; i++) out[i + 1] = out[i] + AUDIO_RMS[i] / 99 / AUDIO_RATE;
  return out;
})();
const cumAt = t => CUM[clamp(Math.round(t * AUDIO_RATE), 0, AUDIO_RMS.length)];
const STILL = TL.morning + 1.5;  // drips stop growing as the band fades

function sceneMorning(ctx, t, P) {
  const light = t >= TL.cry;
  const end = FINAL_LINES;
  if (!light) {
    // the empty editor after the deploy, and the errors coming back
    FALLS.forEach((o, n) => {
      const k = span(t, o, o + 0.3);
      if (k <= 0) return;
      const row = Math.floor(hash(n, 1) * ED.rows), x0 = ED.x + hash(n, 2) * 500, x1 = x0 + 120 + hash(n, 3) * 520;
      const y = lerp(-30, ED.top + (row + 0.5) * ED.lh + 11, inCubic(k));
      ctx.globalAlpha = k < 1 ? 0.7 : 1;
      squiggle(ctx, x0, x1, y, 2.5, 9, 0, 2);
      ctx.fillStyle = ERR; ctx.fillRect(MM.x - 4, MM.y + hash(n, 4) * MM.h, MM.w + 8, 2);
      ctx.globalAlpha = 1;
    });
    return;
  }
  // rolled back: the night's code returns in the light theme, every error showing,
  // and drains line by line as it melts (melt is measured in integrated loudness)
  const tt = Math.min(t, STILL), grow = cumAt(tt) - cumAt(TL.cry);
  const meltAt = i => hash(i, 90) * 9;
  const left = i => 1 - 0.85 * clamp((grow - meltAt(i) - 0.3) / 1.5);
  const o = { t, P, top: ED.top, rows: ED.rows, lh: ED.lh, x: ED.x, end, bottom: end - 40, err: left, errAmp: () => 2.5, barAlpha: left };
  ctx.save(); ctx.beginPath(); ctx.rect(0, ED.top - 4, W, ED.rows * ED.lh + 8); ctx.clip();
  drawCode(ctx, o);
  ctx.restore();
  drawMinimap(ctx, P, end, end - 40, ED.rows, () => 1);
  // the whole night melts in the morning light: every bar runs down, the errors
  // faster and in their colour, and what reaches the prompt line pools on it
  const floorY = RULE_Y - 3;
  let grey = 0;
  const puddles = [];
  for (let row = 0; row < ED.rows; row++) {
    const i = Math.floor(end - 40) - (ED.rows - 1 - row);
    const line = lineAt(i, t);
    if (!line.segs.length) continue;
    const y0 = ED.top + (row + 0.5) * ED.lh;
    const err = isErr(i);
    const drops = line.segs.map(([sx, sw, tone], k) => [ED.x + (line.ind * 4 + sx + hash(i, 30 + k) * sw) * ED.cw, tone, k]);
    if (err) {
      const [x0, x1] = errSpan(line, ED.x, ED.cw);
      for (let k = 0; k < 3; k++) drops.push([lerp(x0, x1, hash(i, 70 + k)), "err", 10 + k]);
    }
    for (const [x, tone, k] of drops) {
      const red = tone === "err";
      if (!red && hash(i, 80 + k) < 0.35) continue;
      const delay = meltAt(i) + hash(i, 40 + k) * 0.6, speed = red ? 160 + hash(i, 50 + k) * 160 : 70 + hash(i, 50 + k) * 100;
      const len = Math.max(0, grow - delay) * speed;
      if (len <= 0) continue;
      const w = red ? 6 + hash(i, 60 + k) * 8 : ED.bar * (0.45 + hash(i, 60 + k) * 0.4);
      const top = red ? y0 + ED.bar / 2 + 5 : y0;
      const y1 = Math.min(floorY, top + len);
      ctx.fillStyle = red ? ERR : P[tone];
      ctx.fillRect(x - w / 2, top, w, y1 - top);
      ctx.beginPath(); ctx.arc(x, y1, w * 0.62, 0, 7); ctx.fill();
      const over = Math.max(0, top + len - floorY);
      if (over > 0) { if (red) puddles.push([x, over * w]); else grey += over * w; }
    }
  }
  if (grey > 0) {
    const th = Math.min(22, grey / 14000);
    ctx.fillStyle = P.i;
    ctx.beginPath(); ctx.roundRect(ED.x - 40, RULE_Y - th, ED.right - 70 - ED.x + 40, th + 1, th / 2); ctx.fill();
  }
  ctx.fillStyle = ERR;
  for (const [x, v] of puddles) {
    const wd = Math.min(420, 30 + v / 60), th = Math.min(18, 4 + v / 3000);
    ctx.beginPath(); ctx.roundRect(x - wd / 2, RULE_Y - th - 1, wd, th + 2, th / 2); ctx.fill();
  }
}

// ---------------------------------------------------------------- frame

function grainAmount(t) {
  if (t < TL.verse1) return 0.05;
  if (t < TL.chorus) return 0.06;
  if (t < TL.quiet) return 0.08;
  if (t < TL.loudReturn) return 0.06;
  if (t < TL.cry) return 0.08;
  return 0.06;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const P = palette(t);
  ctx.fillStyle = P.void; ctx.fillRect(0, 0, W, H);
  if (t < TL.chorus) sceneEditor(ctx, t, P);
  else if (t < 48.75) sceneFloor(ctx, t, P);
  else if (t < TL.breakdown) sceneEditor(ctx, t, P);
  else if (t < TL.loudReturn) sceneGrid(ctx, t, P);
  else if (t < TL.outro) sceneReturn(ctx, t, P);
  else if (t < TL.errors) sceneOutro(ctx, t, P);
  else sceneMorning(ctx, t, P);
  drawRule(ctx, P);
  drawPromptLayer(ctx, t, P);
  drawStatus(ctx, t, P, statusFor(t));
  const fadeIn = span(t, 0, 0.6);
  if (fadeIn < 1) { ctx.globalAlpha = 1 - fadeIn; ctx.fillStyle = P.void; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  texture(ctx, t, grainAmount(t), t >= TL.quiet && t < TL.loudReturn, P.light);
}
