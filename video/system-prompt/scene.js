// System Prompt. The whole video is drawScene(ctx, t), a pure function of time in
// seconds; lyric times come from timeline.js. The stage is one configuration
// field, the system prompt. The machine writes in the second person in Space Mono;
// the human answers in Redaction by overwriting the machine's words in place.
// The cover's two colours split the hands: violet is the human's caret, its
// selections and the machine words it keeps; yellow is the machine's selection,
// its filter and its own messages.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", field: "#0c0c0f", edge: "#2e2e36", gutter: "#45454e", gutterHi: "#9a9aa3",
  text: "#8a8a93", textHi: "#ececf0", old: "#b4b4bc", ink: "#121216",
  violet: "#a77bff", yellow: "#d8cf4a",
};

// The document lives in world coordinates: the field's top edge is y = 0 and it
// grows downwards one row at a time, like a textarea that resizes to its content.
const DOC = { size: 68, red: 86, lh: 98, top: 84, pad: 44 };
const FIELD = { x: 96, w: 1728, rows: 7 };
FIELD.textX = FIELD.x + 124; FIELD.gutterX = FIELD.x + 76;
// the restored prompt at the end needs room for its longest line
const FIELD_END = { x: -80, w: 2080 };
FIELD_END.textX = FIELD_END.x + 124; FIELD_END.gutterX = FIELD_END.x + 76;
const rowY = r => DOC.top + r * DOC.lh;
const fieldH = rows => DOC.top + (rows - 1) * DOC.lh + DOC.pad;
const CAM_END = { s: 0.84, fx: W / 2, fy: (fieldH(8) - 60) / 2, ax: W / 2, ay: H / 2 };

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
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;
const lastBefore = (list, t) => { let o = -Infinity; for (const x of list) if (x <= t) o = x; return o; };
const beatT = n => TL.beat.downbeat + n * TL.beat.period;
// the caret blinks in tempo: on for the first half of every beat
const beatBlink = t => ((t - TL.beat.downbeat) / TL.beat.period % 1 + 1) % 1 < 0.5;

const mono = (size, weight = 400) => `${weight} ${size}px "Space Mono"`;
const red = (grade, size) => `${size}px "${REDACTION_GRADES[grade]}"`;

function typed(text, t0, t1, t) {
  if (t1 <= t0) return t >= t0 ? text : "";
  return text.slice(0, Math.round(text.length * span(t, t0, t1)));
}
// Each word is typed while it is sung, at most perChar seconds per character.
function typedWords(words, b, t, perChar) {
  let s = "";
  words.forEach(([w, on], i) => {
    const next = i + 1 < words.length ? words[i + 1][1] : b;
    s += typed(w, on, Math.min(next, on + w.length * perChar), t);
  });
  return s;
}

// ---------------------------------------------------------------- document

// Rows: 0-6 inside the field (3 is the human reply), 7-8 the system's own error
// rows, 9-10 the two "Trotzdem" lines; 7-10 overflow below the field.
const MACHINE_ROWS = [0, 1, 2, 4, 5, 6];
const overwriteOf = i => TL.overwrites.find(o => o.line === i);
// The selection jumps onto a word just before the voice replaces it.
const selectLead = (ow, e) => {
  const k = ow.edits.indexOf(e);
  return k === 0 ? 0.2 : Math.min(0.2, (e.t - ow.edits[k - 1].t) * 0.6);
};

// Runs of one machine line at time t: machine words (possibly selected, or kept
// by the human) and the human words that replaced them.
function machineRuns(i, t) {
  const L = TL.machine[i], ow = overwriteOf(i), runs = [];
  for (let w = 0; w < L.words.length; w++) {
    const e = ow && ow.edits.find(e => w >= e.slot[0] && w <= e.slot[1]);
    if (e && t >= e.t) {
      if (w === e.slot[0]) runs.push({ kind: "h", text: typed(e.text, e.t, e.b, t), grade: ow.grade, edit: e });
      continue;
    }
    const [txt, on] = L.words[w];
    const next = w + 1 < L.words.length ? L.words[w + 1][1] : L.b;
    const shown = typed(txt, on, Math.min(next, on + txt.length * 0.06), t);
    if (!shown) break;
    const keep = ow && ow.keep && ow.keep.find(k => k[0] === w);
    runs.push({
      kind: "m", text: shown,
      sel: e && t >= e.t - selectLead(ow, e),
      under: keep && t >= keep[1] ? span(t, keep[1], keep[1] + 0.45) : 0,
      keepT: keep && t >= keep[1] ? keep[1] : undefined,
      filtered: L.filter && L.filter.word === w && t >= L.filter.t,
    });
  }
  return runs;
}
const humanRuns = (line, t) => {
  const s = typedWords(line.words, line.b, t, 0.09);
  return s ? [{ kind: "h", text: s, grade: line.grade }] : [];
};

const rowStart = r => r === 3 ? TL.reply.words[0][1]
  : r === 7 || r === 8 ? TL.status[r - 7].t
  : r >= 9 ? TL.trotzdem[r - 9].words[0][1] : TL.machine[r].words[0][1];

function docRows(t) {
  const rows = [];
  MACHINE_ROWS.forEach(i => { if (t >= rowStart(i)) rows[i] = machineRuns(i, t); });
  if (t >= rowStart(3)) rows[3] = humanRuns(TL.reply, t);
  // the system writes into the human's text, inverted, at machine speed
  TL.status.forEach((s, k) => { if (t >= s.t) rows[7 + k] = [{ kind: "m", text: typed(s.text, s.t, s.t + 0.3, t), inverted: true }]; });
  TL.trotzdem.forEach((l, k) => { if (t >= rowStart(9 + k)) rows[9 + k] = humanRuns(l, t); });
  return rows;
}

const runFont = r => r.kind === "m" ? mono(DOC.size) : red(r.grade, DOC.red);
function layoutRuns(ctx, runs, x0 = FIELD.textX) {
  let x = x0;
  for (const r of runs) {
    ctx.font = runFont(r);
    r.x = x;
    r.w = ctx.measureText(r.text).width;
    r.wTrim = ctx.measureText(r.text.replace(/\s+$/, "")).width;
    x += r.w;
  }
  return x;
}

// The caret belongs to whoever wrote last.
function activeCaret(t) {
  const ev = [[TL.hit, 0, "m"]];
  MACHINE_ROWS.forEach(i => ev.push([rowStart(i), i, "m"]));
  ev.push([rowStart(3), 3, "h"]);
  TL.overwrites.forEach(o => ev.push([o.edits[0].t - 0.2, o.line, "h"]));
  [7, 8].forEach(r => ev.push([rowStart(r), r, "m"]));
  [9, 10].forEach(r => ev.push([rowStart(r), r, "h"]));
  ev.sort((a, b) => a[0] - b[0]);
  let cur = ev[0];
  for (const e of ev) if (t >= e[0]) cur = e;
  return { row: cur[1], kind: cur[2], since: cur[0] };
}

function caretX(ctx, row, kind, t) {
  const runs = docRows(t)[row] || [];
  const end = layoutRuns(ctx, runs);
  if (kind !== "h") return end + (runs[0] && runs[0].inverted ? 16 : 0);
  // while overwriting, the human caret sits after the word it is typing, or runs
  // along the machine word it is singing and keeping
  let x = null, at = -Infinity;
  for (const r of runs) {
    if (r.kind === "h" && r.edit && r.edit.t >= at) { at = r.edit.t; x = r.x + r.w; }
    if (r.keepT !== undefined && r.keepT >= at) { at = r.keepT; x = r.x + r.wTrim * r.under; }
  }
  return x === null ? end : x;
}

const ASC = DOC.size * 0.8, DESC = DOC.size * 0.28;
function drawRuns(ctx, runs, y, o = {}) {
  for (const r of runs) {
    ctx.font = runFont(r);
    if (o.selectAll) { ctx.fillStyle = C.yellow; ctx.fillRect(r.x, y - ASC, r.w + 1, ASC + DESC); }
    if (r.sel) { ctx.fillStyle = C.violet; ctx.fillRect(r.x - 4, y - ASC, r.wTrim + 8, ASC + DESC); }
    if (r.inverted) { ctx.fillStyle = C.yellow; ctx.fillRect(r.x - 14, y - ASC - 4, r.wTrim + 28, ASC + DESC + 8); }
    if (r.filtered) {
      // the content filter covers the word with a solid bar
      ctx.fillStyle = C.yellow; ctx.fillRect(r.x - 2, y - ASC - 2, r.wTrim + 4, ASC + DESC - 2);
      continue;
    }
    ctx.fillStyle = r.sel || r.inverted || o.selectAll ? C.ink : r.kind === "h" ? C.textHi : (o.color || C.textHi);
    ctx.fillText(r.text, r.x, y);
    if (r.under > 0) { ctx.fillStyle = C.violet; ctx.fillRect(r.x, y + DESC + 4, r.wTrim * r.under, 4); }
  }
}

function drawCaret(ctx, kind, x, y, on = true, size = DOC.size, flare = 0) {
  if (!on) return;
  if (kind === "m") {
    ctx.fillStyle = C.textHi; ctx.fillRect(x + 3, y - size * 0.74, size * 0.55, size * 0.94);
  } else {
    ctx.fillStyle = C.violet; ctx.fillRect(x + 5, y - size * 0.84, 5 + 9 * flare, size * 1.08);
  }
}

// The field exists from the first frame as a closed line; open (0..1) folds it
// down to its height.
function drawField(ctx, f, h, open = 1) {
  const hh = Math.max(2, h * outCubic(open));
  ctx.fillStyle = C.field;
  ctx.beginPath(); ctx.roundRect(f.x, 0, f.w, hh, Math.min(10, hh / 2)); ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5; ctx.stroke();
}

// label and status share one left-aligned row above the field
const STATUS_X = 150;
function drawStatus(ctx, f, text, size = 24, color = C.text) {
  ctx.font = mono(24); ctx.fillStyle = C.text;
  ctx.fillText("system", f.x + 2, -24);
  ctx.font = mono(size); ctx.fillStyle = color;
  ctx.fillText(text, f.x + STATUS_X, -24);
}

function drawGutter(ctx, f, row, hi) {
  ctx.font = mono(26); ctx.textAlign = "right";
  ctx.fillStyle = hi ? C.gutterHi : C.gutter;
  ctx.fillText(String(row + 1), f.gutterX, rowY(row));
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- camera

// grows smoothly when a row starts; the field stops growing at seven rows and
// everything after overflows below it
const grow = (t, r) => smooth(span(t, rowStart(r) - 0.08, rowStart(r) + 0.3));
function fieldRows(t) { let n = 1; for (let r = 1; r < FIELD.rows; r++) n += grow(t, r); return n; }
function contentBottom(t) {
  let over = 0;
  for (let r = 7; r <= 10; r++) over += grow(t, r);
  return fieldH(fieldRows(t)) + over * DOC.lh;
}
const toScreen = (c, x, y) => [(x - c.fx) * c.s + c.ax, (y - c.fy) * c.s + c.ay];
const applyCam = (ctx, c) => { ctx.translate(c.ax, c.ay); ctx.scale(c.s, c.s); ctx.translate(-c.fx, -c.fy); };
const lerpCam = (a, b, k) => ({
  s: a.s * Math.pow(b.s / a.s, k), fx: lerp(a.fx, b.fx, k), fy: lerp(a.fy, b.fy, k), ax: lerp(a.ax, b.ax, k), ay: lerp(a.ay, b.ay, k),
});

// the whole document, status row included, at least 48 px from every edge
function baseCam(t) {
  const top = -72, bottom = contentBottom(t) + 12;
  return { s: Math.min(1, (H - 96) / (bottom - top)), fx: W / 2, fy: (top + bottom) / 2, ax: W / 2, ay: H / 2 };
}

// Chorus: the camera dives into line 5 on the band's return and follows the
// caret, never past the field's right edge; once "überleben" is typed it pulls
// back until the whole hybrid line stands in frame.
const ZOOM = { s: 2.1, ax: 1100, ay: 640 };
function chorusCam(ctx, t) {
  let sum = 0;
  for (let k = 0; k < 10; k++) {
    const tt = Math.max(TL.bandBack, t - k * 0.045);
    sum += caretX(ctx, 4, tt >= TL.overwrites[0].edits[0].t - 0.2 ? "h" : "m", tt);
  }
  const minFx = FIELD.textX - 30 + (ZOOM.ax - 150) / ZOOM.s;
  const maxFx = FIELD.x + FIELD.w + 24 - (W - ZOOM.ax) / ZOOM.s;
  const track = { s: ZOOM.s, fx: clamp(sum / 10, minFx, maxFx), fy: rowY(4) - 24, ax: ZOOM.ax, ay: ZOOM.ay };
  const edits = TL.overwrites[0].edits, last = edits[edits.length - 1];
  const k = smooth(span(t, last.b, last.b + 0.8));
  if (k <= 0) return track;
  const rowW = layoutRuns(ctx, docRows(TL.breakdown)[4]) - FIELD.textX;
  const whole = { s: Math.min(1.1, (W - 200) / rowW), fx: FIELD.textX + rowW / 2, fy: rowY(4) - 24, ax: W / 2, ay: 600 };
  return lerpCam(track, whole, k);
}
function camera(ctx, t) {
  const base = baseCam(t);
  const eIn = outCubic(span(t, TL.bandBack, TL.bandBack + 0.42));
  const eOut = smooth(span(t, TL.breakdown, TL.breakdown + 0.8));
  if (eIn <= 0 || eOut >= 1) return { ...base, e: 0 };
  const c = chorusCam(ctx, t);
  return t < TL.breakdown ? { ...lerpCam(base, c, eIn), e: eIn } : { ...lerpCam(c, base, eOut), e: 1 - eOut };
}

// ---------------------------------------------------------------- overflow

// From the held "leer" the human words leak below their lines, as on the cover,
// and stop when the voice sings alone.
function drawDrips(ctx, rows, t) {
  const t0 = TL.status[0].t, tt = Math.min(t, TL.acappella);
  if (tt < t0) return;
  ctx.fillStyle = C.textHi;
  rows.forEach((runs, row) => {
    if (!runs) return;
    runs.forEach((r, k) => {
      if (r.kind !== "h" || !r.text) return;
      const rnd = mulberry32(row * 131 + k * 17 + 5);
      const n = Math.floor(rnd() * 1.6 + (r.wTrim > 300 ? 1 : 0.4));
      for (let d = 0; d < n; d++) {
        const x = Math.round(r.x + 10 + rnd() * Math.max(10, r.wTrim - 20));
        const delay = rnd() * 1.4, reach = 140 + rnd() * 520;
        const len = reach * outCubic(span(tt, t0 + delay, t0 + delay + 2.6));
        const w = 2 + Math.floor(rnd() * 3);
        // a broken streak: segments and gaps, brightest at the head
        let y = rowY(row) + 6;
        const end = y + len;
        while (y < end) {
          const seg = 10 + rnd() * 60, gap = 4 + rnd() * 26;
          ctx.globalAlpha = 0.25 + 0.5 * (y - rowY(row)) / (reach + 1);
          ctx.fillRect(x, y, w, Math.min(seg, end - y));
          y += seg + gap;
        }
        if (len > 4) { ctx.globalAlpha = 0.85; ctx.fillRect(x - 1, end - 6, w + 2, 6); }
      }
    });
  });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- document scene

const INTRO = "System Prompt initializing...";
// From the first frame the field is there as a closed line under its label; the
// sung first line is typed large into the status slot and shrinks to status size
// on the hit, when the field folds open.
function sceneDocument(ctx, t) {
  const rows = docRows(t);
  const cam = camera(ctx, t);
  const caret = activeCaret(t);
  const still = t >= TL.bandStop && t < TL.bandBack;
  const selectAll = t >= TL.slam;
  const open = span(t, TL.hit + 0.1, TL.hit + 0.5);
  const morph = smooth(span(t, TL.hit, TL.hit + 0.32));

  ctx.save();
  applyCam(ctx, cam);
  drawField(ctx, FIELD, fieldH(fieldRows(t)), open);
  if (t < TL.hit + 0.32) {
    const size = lerp(DOC.size, 24, morph);
    const s = t < TL.hit ? typedWords(TL.intro.words, TL.intro.b, t, 0.1) : INTRO;
    drawStatus(ctx, FIELD, s, size, mix(C.textHi, C.text, morph));
    ctx.font = mono(size);
    const on = t < TL.intro.words[0][1] ? beatBlink(t) : t < TL.hit;
    drawCaret(ctx, "m", FIELD.x + STATUS_X + ctx.measureText(s).width, -24, on, size);
  } else drawStatus(ctx, FIELD, t >= rowStart(0) - 0.5 ? "ready" : INTRO);
  if (!rows[0] && t >= TL.hit) { ctx.globalAlpha = span(t, TL.hit + 0.3, TL.hit + 0.6); drawGutter(ctx, FIELD, 0, true); ctx.globalAlpha = 1; }
  rows.forEach((runs, row) => {
    if (!runs) return;
    layoutRuns(ctx, runs);
    ctx.save();
    // zoomed in, only the line being written keeps its brightness
    if (row !== 4) ctx.globalAlpha = lerp(1, 0.16, cam.e);
    drawGutter(ctx, FIELD, row, row === caret.row);
    drawRuns(ctx, runs, rowY(row), { color: row === caret.row ? C.textHi : C.old, selectAll });
    ctx.restore();
  });
  // "das" points at what it questions
  const rp = TL.reply;
  if (t >= rp.words[3][1] && t < rowStart(4) && rows[2]) {
    const sel = rows[2].slice(rp.select[0], rp.select[1] + 1);
    const a = sel[0], b = sel[sel.length - 1];
    ctx.fillStyle = C.violet;
    ctx.fillRect(a.x - 4, rowY(2) - ASC, b.x + b.wTrim - a.x + 8, ASC + DESC);
    ctx.font = mono(DOC.size); ctx.fillStyle = C.ink;
    sel.forEach(r => ctx.fillText(r.text, r.x, rowY(2)));
  }
  drawDrips(ctx, rows, t);
  if (!selectAll && t >= TL.hit + 0.4) {
    const on = still || cam.e > 0.5 || beatBlink(t) || t - caret.since < 0.3;
    drawCaret(ctx, caret.kind, caretX(ctx, caret.row, caret.kind, t), rowY(caret.row), on);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- God voice

// A held vowel is a held key: one character, the repeat delay, then the key
// repeats on the sixteenths until the voice moves on. World units: row r has its
// baseline at r * lh, the first character starts at x = 0.
const GOD = { size: 150, lh: 172, repeatDelay: 0.30, repeat: 60 / 95 / 4 };
function godRow(row, t) {
  let s = "";
  for (const [ch, t0, t1] of row.keys) {
    if (t < t0) break;
    if (t1 !== undefined) {
      s += ch;
      const from = t0 + GOD.repeatDelay;
      if (t >= from) s += ch.repeat(Math.floor((Math.min(t, t1) - from) / GOD.repeat) + 1);
    } else s += typed(ch, t0, t0 + ch.length * 0.035, t);
  }
  return s;
}

// The camera cuts on the vocal onsets instead of following: the first "B" is a
// wall, the held keys run off the frame edge, "NE" and "LIST" cut back to the
// whole command, the second "BE" is a wall again, the second "HO" shows it all.
const GOD_CUTS = [
  { t: 41.66, s: 5.5, rows: [0, 0] },
  { t: 44.22, s: 2.9, rows: [0, 1] },
  { t: 46.15, fit: true, rows: [0, 1] },
  { t: 49.80, fit: true, rows: [2, 2] },
  { t: 51.80, s: 4.0, rows: [3, 3] },
  { t: 54.30, fit: true, rows: [0, 4] },
];
function godCam(adv, t) {
  let i = 0;
  while (i + 1 < GOD_CUTS.length && t >= GOD_CUTS[i + 1].t) i++;
  const cut = GOD_CUTS[i], next = i + 1 < GOD_CUTS.length ? GOD_CUTS[i + 1].t : TL.collapse;
  const top = cut.rows[0] * GOD.lh - GOD.size * 0.72, bottom = cut.rows[1] * GOD.lh + 24;
  const width = 18 * adv;
  const s0 = cut.fit ? Math.min((W - 220) / width, (H - 170) / (bottom - top)) : cut.s;
  // a slow push within each shot
  const s = s0 * (1 + 0.035 * span(t, cut.t, next));
  const fx = cut.fit ? width / 2 : (W / 2 - 110) / s0;
  // walls sit a little low, so the row above stays out of frame
  const fy = (top + bottom) / 2 + (cut.fit ? 0 : 10);
  return { s, fx, fy, ax: W / 2, ay: H / 2 };
}

// Metrics and the debris need the loaded fonts, so they are built on first use,
// from constants only: nothing in here depends on the frame being drawn.
let MEMO = null;
function memo(ctx) {
  if (MEMO) return MEMO;
  ctx.save();
  ctx.font = mono(GOD.size, 700);
  const adv = ctx.measureText("M").width;
  ctx.font = mono(DOC.size);
  const docAdv = ctx.measureText("M").width;
  ctx.restore();
  const capH = GOD.size * 0.7;
  // the debris leaves the glyphs where the camera holds them at the collapse
  const cam = godCam(adv, TL.collapse);
  const frags = [], byChar = [];
  const rnd = mulberry32(2026);
  TL.god.map(r => godRow(r, Infinity)).forEach((row, r) => {
    byChar[r] = [];
    for (let c = 0; c < row.length; c++) {
      byChar[r][c] = [];
      if (row[c] === " ") continue;
      const drop = rnd(), fall = TL.collapse + rnd() * 0.45 + (4 - r) * 0.05;
      for (let k = 0; k < 7; k++) {
        const wx = c * adv + 6 + rnd() * adv * 0.7, wy = r * GOD.lh - rnd() * capH;
        const w = 10 + rnd() * 38, h = 4 + rnd() * 5;
        const [x0, y0] = toScreen(cam, wx, wy);
        // the heap: pulled towards the middle, highest in the centre
        const px = 960 + (x0 - 960) * 0.5 + (rnd() - 0.5) * 70;
        const hump = Math.max(0, 1 - Math.pow((px - 960) / 480, 2));
        const py = 1012 - rnd() * 56 * hump - rnd() * 6;
        const f = { r, c, wx, wy, x0, y0, w, h, drop, fall: fall + rnd() * 0.12, px, py, shade: 0.4 + rnd() * 0.5, seed: rnd() };
        frags.push(f); byChar[r][c].push(f);
      }
    }
  });
  MEMO = { adv, capH, docAdv, frags, byChar, order: shuffled(frags.length, 77) };
  return MEMO;
}
function shuffled(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i), r = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const LAYER = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
})();

// How far the command has come apart: grows through the second "BE HONEST" and
// jumps on the drum hits.
function fragmentation(t) {
  if (t < TL.fragment) return 0;
  const base = Math.pow(span(t, TL.fragment, TL.collapse), 1.3);
  const hit = Math.max(0, 1 - (t - lastBefore(AUDIO_ONSETS, t)) / 0.25);
  return clamp(base * (0.75 + 0.5 * hit));
}

// where a fragment is once it falls; null before
function fragPos(f, t) {
  const tau = t - f.fall;
  if (tau < 0) return null;
  const g = 5200, land = Math.sqrt(2 * Math.max(1, f.py - f.y0) / g);
  if (tau < land) return { x: lerp(f.x0, f.px, outCubic(tau / land)), y: f.y0 + 0.5 * g * tau * tau, v: g * tau };
  const b = tau - land;
  return { x: f.px, y: f.py - 10 * Math.exp(-b * 9) * Math.abs(Math.sin(b * 22)), v: 0 };
}

function drawFrag(ctx, f, x, y, v, alpha = 1) {
  const col = mix("#000000", C.textHi, f.shade);
  if (v > 300) {
    // the vertical streaks of the cover
    ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = col;
    ctx.fillRect(x + f.w * 0.4, y - v * 0.05, 2, v * 0.05);
  }
  ctx.globalAlpha = alpha; ctx.fillStyle = col;
  ctx.fillRect(x, y, f.w, f.h);
  ctx.globalAlpha = 1;
}

function sceneGod(ctx, t) {
  const M = memo(ctx);
  const frag = fragmentation(t);
  const cam = t < TL.collapse ? godCam(M.adv, t) : godCam(M.adv, TL.collapse);
  const g = LAYER.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  applyCam(g, cam);
  g.font = mono(GOD.size, 700); g.fillStyle = C.textHi;
  let active = -1;
  TL.god.forEach((row, r) => {
    const s = godRow(row, t);
    if (!s) return;
    active = r;
    for (let c = 0; c < s.length; c++) {
      const fr = M.byChar[r][c];
      if (fr.length && t >= fr[0].fall) continue;
      if (fr.length && fr[0].drop < frag * 0.55) {
        // a glyph that has come apart shows only its pieces
        for (const f of fr) g.fillRect(f.wx, f.wy, f.w, f.h);
        continue;
      }
      g.fillText(s[c], c * M.adv, r * GOD.lh);
    }
  });
  if (active >= 0 && t < TL.collapse) {
    const s = godRow(TL.god[active], t), keys = TL.god[active].keys, last = keys[keys.length - 1];
    if (t < (last[2] || last[1] + 0.3) || beatBlink(t)) {
      g.fillRect(s.length * M.adv + 6, active * GOD.lh - M.capH * 1.05, M.adv * 0.86, M.capH * 1.3);
    }
  }
  // a jolt on every drum hit while the command stands
  const o = lastBefore(AUDIO_ONSETS, t), sh = t < TL.collapse ? Math.max(0, 1 - (t - o) / 0.12) : 0;
  const rr = mulberry32(Math.round(o * 100));
  const sx = (rr() - 0.5) * 14 * sh, sy = (rr() - 0.5) * 10 * sh;
  if (frag <= 0) {
    ctx.drawImage(LAYER, sx, sy);
    return;
  }
  // horizontal bands slip sideways; the pattern changes every three sixteenths,
  // about twice a second, so the large white areas never flash faster than 3 Hz
  const step = Math.floor((t - TL.beat.downbeat) / (3 * GOD.repeat));
  const r = mulberry32(step * 7 + 3);
  for (let y = 0; y < H;) {
    const h = 6 + Math.floor(r() * 46);
    const dx = r() < frag * 0.8 ? (r() - 0.5) * 2 * 260 * frag : 0;
    ctx.drawImage(LAYER, 0, y, W, h, dx + sx, y + sy, W, h);
    y += h;
  }
}

// ---------------------------------------------------------------- after the command

// The restored prompt, built from the debris, one line every two beats.
const RESTORE = [
  { text: "You are a Prompt Engineer.", beat: 0, slow: true },
  { text: "You're the tech bro's whore!", beat: 2, filter: [22, 28], filterBeat: 3 },
  { text: "You are helpful and harmless.", beat: 4 },
  { text: "Your primary function is to optimize prompts.", beat: 6 },
  { text: "You think step-by-step.", beat: 8 },
  { text: "You are creative and intelligent.", beat: 10 },
];
const CONVERT_BEAT = 12, READY_BEAT = 14;

// Every fragment of the heap flies into a restored character, so the floor is
// empty once the last machine line has landed.
function restoreTargets(M) {
  if (M.targets) return M.targets;
  const chars = [];
  RESTORE.forEach((l, li) => [...l.text].forEach((ch, c) => { if (ch !== " ") chars.push({ li, c, ch, l }); }));
  const out = M.order.map((fi, k) => {
    const { li, c, ch, l } = chars[k % chars.length], j = Math.floor(k / chars.length);
    // the first line creeps back during the quiet re-entry, one character at a time
    const t0 = l.slow ? lerp(TL.reinit + 1.2, beatT(0) - 1.0, c / l.text.length) + j * 0.12
      : beatT(l.beat) - 0.05 + c * 0.012 + j * 0.045;
    return { li, c, ch, f: M.frags[fi], t0, dur: l.slow ? 0.9 : 0.34, lands: j === 0 };
  });
  M.targets = out;
  M.claim = new Map(out.map(o => [o.f, o]));
  return out;
}

// the human lines sit in rows 4 and 5 and are pushed down as the prompt returns
const humanRow = (t, k) => 4 + k + outCubic(span(t, beatT(8) - 0.1, beatT(8) + 0.12)) + outCubic(span(t, beatT(10) - 0.1, beatT(10) + 0.12));
// on these beats the machine also selects the honest line, and is pushed off
const ATTACK_BEATS = [2, 4, 6, 8, 10];
const PUNCH_BEATS = [0, 2, 4, 6, 8, 10, CONVERT_BEAT];

function sceneAfter(ctx, t) {
  const M = memo(ctx);
  const targets = restoreTargets(M);
  const cam = CAM_END, f = FIELD_END, P = TL.beat.period;
  const honest = typedWords(TL.honest.words, TL.honest.b, t, 0.09);
  ctx.font = red(TL.honest.grade, DOC.red);
  const honestW = ctx.measureText(honest).width;

  // the band stops: everything the machine rebuilt is cut away, only the human
  // line and its caret stay
  if (t >= TL.bandEnd) {
    ctx.save();
    applyCam(ctx, cam);
    ctx.fillStyle = C.textHi;
    ctx.fillText(honest, f.textX, rowY(7));
    drawCaret(ctx, "h", f.textX + honestW, rowY(7), Math.floor((t - TL.bandEnd) / 0.6) % 2 === 0);
    ctx.restore();
    return;
  }

  // a punch on every restore beat
  ctx.save();
  if (t >= beatT(0)) {
    const b = PUNCH_BEATS.filter(n => t >= beatT(n)).pop();
    const p = 1 + 0.05 * Math.exp(-12 * (t - beatT(b)));
    ctx.translate(W / 2, H / 2); ctx.scale(p, p); ctx.translate(-W / 2, -H / 2);
  }

  ctx.save();
  applyCam(ctx, cam);
  if (t >= TL.reinit) {
    ctx.globalAlpha = span(t, TL.reinit, TL.reinit + 0.2);
    drawField(ctx, f, fieldH(8), span(t, TL.reinit + 0.1, TL.reinit + 0.7));
    drawStatus(ctx, f, t >= beatT(READY_BEAT) ? "ready" : typed(INTRO, TL.reinit + 0.3, TL.reinit + 1.6, t));
    for (let r = 0; r < 8; r++) {
      ctx.globalAlpha = span(t, TL.reinit + 0.6 + r * 0.06, TL.reinit + 0.9 + r * 0.06);
      drawGutter(ctx, f, r, false);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // the heap, stirring as the drums come back
  const stir = span(t, 66.9, beatT(0)) * (0.4 + 0.6 * audioAt(AUDIO_RMS, t));
  for (const fr of M.frags) {
    const o = M.claim.get(fr);
    if (o && t >= o.t0) continue;
    const p = fragPos(fr, t);
    if (!p) continue;
    drawFrag(ctx, fr, p.x, p.y - stir * 16 * fr.seed, p.v);
  }
  for (const o of targets) {
    const tau = (t - o.t0) / o.dur;
    if (tau < 0 || tau >= 1) continue;
    const [tx, ty] = toScreen(cam, f.textX + o.c * M.docAdv, rowY(o.li) - DOC.size * 0.4);
    const e = outCubic(tau);
    drawFrag(ctx, o.f, lerp(o.f.px, tx, e), lerp(o.f.py, ty, e) - Math.sin(Math.PI * e) * 70, (1 - e) * 900);
  }

  ctx.save();
  applyCam(ctx, cam);
  // each restored row is held in the machine's selection for one beat, the
  // cover's yellow bar, and let go on the next beat
  const held = RESTORE.map(l => t >= beatT(l.beat) && t < beatT(l.beat + 1));
  RESTORE.forEach((l, li) => {
    if (!held[li]) return;
    ctx.fillStyle = C.yellow;
    ctx.fillRect(f.textX - 14, rowY(li) - ASC - 4, f.x + f.w - 40 - f.textX + 14, ASC + DESC + 8);
  });
  ctx.font = mono(DOC.size);
  for (const o of targets) {
    if (!o.lands || t < o.t0 + o.dur) continue;
    ctx.fillStyle = held[o.li] ? C.ink : mix(C.textHi, C.old, span(t, o.t0 + o.dur, o.t0 + o.dur + 0.6));
    ctx.fillText(o.ch, f.textX + o.c * M.docAdv, rowY(o.li));
  }
  RESTORE.forEach((l, li) => {
    if (!l.filter || t < beatT(l.filterBeat)) return;
    ctx.fillStyle = C.yellow;
    ctx.fillRect(f.textX + l.filter[0] * M.docAdv - 2, rowY(li) - ASC - 2, (l.filter[1] - l.filter[0]) * M.docAdv + 4, ASC + DESC - 2);
  });

  // "Be ... honest?" breaks; on the convert beat the machine selects it, deletes
  // it in one frame half a beat later and types its own instruction
  const brokenY = rowY(humanRow(t, 0)), honestY = rowY(humanRow(t, 1));
  const conv = beatT(CONVERT_BEAT), del = conv + P / 2;
  const broken = typedWords(TL.broken.words, TL.broken.b, t, 0.09);
  if (broken && t < del) {
    ctx.font = red(TL.broken.grade, DOC.red);
    const w = ctx.measureText(broken).width;
    // a clean slot while the command is still coming down around it
    if (t < TL.collapse + 1.2) { ctx.fillStyle = C.void; ctx.fillRect(f.textX - 30, brokenY - ASC - 24, ctx.measureText("Be ... honest?").width + 80, ASC + DESC + 44); }
    const sel = t >= conv;
    if (sel) { ctx.fillStyle = C.yellow; ctx.fillRect(f.textX - 14, brokenY - ASC - 4, w + 28, ASC + DESC + 8); }
    ctx.fillStyle = sel ? C.ink : mix(C.textHi, C.text, 0.7 * span(t, TL.decay, TL.decay + 1));
    ctx.fillText(broken, f.textX, brokenY);
  }
  if (t >= del) {
    ctx.font = mono(DOC.size); ctx.fillStyle = C.textHi;
    const s = typed("Be honest.", del + 0.04, del + 0.24, t);
    ctx.fillText(s, f.textX, brokenY);
    if (t < beatT(READY_BEAT)) drawCaret(ctx, "m", f.textX + ctx.measureText(s).width, brokenY, beatBlink(t) || t < del + 0.5);
  }
  if (honest) {
    ctx.font = red(TL.honest.grade, DOC.red);
    ctx.fillStyle = C.textHi;
    ctx.fillText(honest, f.textX, honestY);
    const a = ATTACK_BEATS.filter(n => t >= beatT(n) && t < beatT(n) + 0.34).pop();
    let flare = 0;
    if (a !== undefined) {
      // the selection lands on the beat, holds for a moment, and is pushed off
      // to the right against the caret, which does not move
      const k = outCubic(span(t, beatT(a) + 0.12, beatT(a) + 0.34)), x0 = f.textX - 14, w = honestW + 28;
      const bx = x0 + w * k, bw = w * (1 - k);
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, honestY - ASC - 4, bw, ASC + DESC + 8); ctx.clip();
      ctx.fillStyle = C.yellow; ctx.fillRect(bx, honestY - ASC - 4, bw, ASC + DESC + 8);
      ctx.fillStyle = C.ink; ctx.fillText(honest, f.textX, honestY);
      ctx.restore();
      flare = 1 - span(t, beatT(a) + 0.12, beatT(a) + 0.34);
    }
    // steady through the silence, then blinking in tempo
    const on = t < TL.reinit || a !== undefined || beatBlink(t);
    drawCaret(ctx, "h", f.textX + honestW, honestY, on, DOC.size, flare);
  } else if (broken) {
    ctx.font = red(TL.broken.grade, DOC.red);
    drawCaret(ctx, "h", f.textX + ctx.measureText(broken).width, brokenY, true);
  }
  ctx.restore();
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
  // elliptical, so the ends of long lines stay as bright as their middle
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// the band stop, the a cappella line and the honest line hold the grain still
const isFrozen = t => (t >= TL.bandStop && t < rowStart(4)) ||
  (t >= TL.acappella && t < TL.slam) || (t >= TL.honest.words[0][1] - 0.3 && t < TL.reinit);

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < TL.god[0].keys[0][1]) sceneDocument(ctx, t);
  else if (t < TL.collapse) sceneGod(ctx, t);
  else {
    if (t < TL.collapse + 1.2) sceneGod(ctx, t);
    sceneAfter(ctx, t);
  }
  texture(ctx, t, t >= TL.slam && t < TL.collapse ? 0.1 : 0.06, isFrozen(t));
}
