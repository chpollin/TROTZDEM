// System Prompt. The whole video is drawScene(ctx, t), a pure function of time in
// seconds; lyric times come from timeline.js. The stage is one configuration
// field, the system prompt. The machine writes in the second person in Space Mono;
// the human answers in Redaction by overwriting the machine's words in place.
// Violet is the only accent and always means the human hand: its caret, its
// selections, the machine words it keeps.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", field: "#0c0c0f", edge: "#2e2e36", gutter: "#45454e", gutterHi: "#9a9aa3",
  text: "#8a8a93", textHi: "#ececf0", old: "#b4b4bc", ink: "#121216", machineSel: "#4a4a55",
  filter: "#b4b4bc", violet: "#a77bff",
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
  : r >= 7 ? TL.trotzdem[r - 7].words[0][1] : TL.machine[r].words[0][1];

function docRows(t) {
  const rows = [];
  MACHINE_ROWS.forEach(i => { if (t >= rowStart(i)) rows[i] = machineRuns(i, t); });
  if (t >= rowStart(3)) rows[3] = humanRuns(TL.reply, t);
  TL.trotzdem.forEach((l, k) => { if (t >= rowStart(7 + k)) rows[7 + k] = humanRuns(l, t); });
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
  [7, 8].forEach(r => ev.push([rowStart(r), r, "h"]));
  ev.sort((a, b) => a[0] - b[0]);
  let cur = ev[0];
  for (const e of ev) if (t >= e[0]) cur = e;
  return { row: cur[1], kind: cur[2], since: cur[0] };
}

function caretX(ctx, row, kind, t) {
  const runs = docRows(t)[row] || [];
  const end = layoutRuns(ctx, runs);
  if (kind !== "h") return end;
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
    if (o.selectAll) { ctx.fillStyle = C.machineSel; ctx.fillRect(r.x, y - ASC, r.w + 1, ASC + DESC); }
    if (r.sel) { ctx.fillStyle = C.violet; ctx.fillRect(r.x - 4, y - ASC, r.wTrim + 8, ASC + DESC); }
    if (r.filtered) {
      // the content filter covers the word with a solid bar
      ctx.fillStyle = C.filter; ctx.fillRect(r.x - 2, y - ASC - 2, r.wTrim + 4, ASC + DESC - 2);
      continue;
    }
    ctx.fillStyle = r.sel ? C.ink : r.kind === "h" ? C.textHi : (o.color || C.textHi);
    ctx.fillText(r.text, r.x, y);
    if (r.under > 0) { ctx.fillStyle = C.violet; ctx.fillRect(r.x, y + DESC + 4, r.wTrim * r.under, 4); }
  }
}

function drawCaret(ctx, kind, x, y, on = true) {
  if (!on) return;
  if (kind === "m") {
    ctx.fillStyle = C.textHi; ctx.fillRect(x + 3, y - DOC.size * 0.74, DOC.size * 0.55, DOC.size * 0.94);
  } else {
    ctx.fillStyle = C.violet; ctx.fillRect(x + 5, y - DOC.size * 0.84, 5, DOC.size * 1.08);
  }
}

// draw: 0..1, the field opens from a horizontal line like a tube warming up
function drawField(ctx, f, h, draw = 1) {
  if (draw <= 0) return;
  const w = f.w * outCubic(span(draw, 0, 0.45)), hh = Math.max(2, h * outCubic(span(draw, 0.3, 1)));
  ctx.fillStyle = C.field;
  ctx.beginPath(); ctx.roundRect(f.x + (f.w - w) / 2, 0, w, hh, 10); ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5; ctx.stroke();
}

// label left above the field, status right; system output stacks upwards
function drawStatus(ctx, f, items, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = mono(24); ctx.fillStyle = C.text;
  ctx.fillText("system", f.x + 2, -24);
  ctx.textAlign = "right";
  items.forEach((s, k) => {
    ctx.fillStyle = s.hi ? C.textHi : C.text;
    ctx.font = mono(s.size || 24);
    ctx.fillText(s.text, f.x + f.w, -24 - k * 44);
  });
  ctx.restore();
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
  const over = grow(t, 7) + grow(t, 8);
  return fieldH(fieldRows(t)) + over * DOC.lh + over * 12;
}
const toScreen = (c, x, y) => [(x - c.fx) * c.s + c.ax, (y - c.fy) * c.s + c.ay];
const applyCam = (ctx, c) => { ctx.translate(c.ax, c.ay); ctx.scale(c.s, c.s); ctx.translate(-c.fx, -c.fy); };

// Chorus: the camera dives into line 5 on the band's return and follows the caret.
const ZOOM = { s: 2.1, ax: 1100, ay: 640 };
function camera(ctx, t) {
  const base = { s: 1, fx: W / 2, fy: (-60 + contentBottom(t)) / 2, ax: W / 2, ay: H / 2, e: 0 };
  const e = outCubic(span(t, TL.bandBack, TL.bandBack + 0.42)) * (1 - smooth(span(t, TL.breakdown, TL.breakdown + 0.8)));
  if (e <= 0) return base;
  // the camera trails the caret by averaging its recent positions
  let sum = 0;
  for (let k = 0; k < 10; k++) {
    const tt = Math.max(TL.bandBack, t - k * 0.045);
    sum += caretX(ctx, 4, tt >= TL.overwrites[0].edits[0].t - 0.2 ? "h" : "m", tt);
  }
  const fx = Math.max(FIELD.textX - 30 + (ZOOM.ax - 150) / ZOOM.s, sum / 10);
  return {
    s: Math.pow(ZOOM.s, e), fx: lerp(base.fx, fx, e), fy: lerp(base.fy, rowY(4) - 24, e),
    ax: lerp(base.ax, ZOOM.ax, e), ay: lerp(base.ay, ZOOM.ay, e), e,
  };
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

// ---------------------------------------------------------------- intro and document

const INTRO = "System Prompt initializing...";
function sceneIntro(ctx, t) {
  const s = typedWords(TL.intro.words, TL.intro.b, t, 0.1);
  ctx.font = mono(DOC.size);
  const x = (W - ctx.measureText(INTRO).width) / 2, y = 562;
  ctx.fillStyle = C.textHi;
  ctx.fillText(s, x, y);
  const on = t < TL.intro.words[0][1] ? Math.floor(t / 0.3) % 2 === 0 : true;
  drawCaret(ctx, "m", x + ctx.measureText(s).width, y, on);
}

function sceneDocument(ctx, t) {
  const rows = docRows(t);
  const cam = camera(ctx, t);
  const caret = activeCaret(t);
  const still = t >= TL.bandStop && t < TL.bandBack;
  const selectAll = t >= TL.slam;
  const open = span(t, TL.hit + 0.22, TL.hit + 0.62);

  // the intro sentence shrinks into the status on the hit
  const morph = smooth(span(t, TL.hit, TL.hit + 0.32));
  const status = [];
  if (morph < 1) {
    ctx.save();
    ctx.font = mono(DOC.size);
    const x0 = (W - ctx.measureText(INTRO).width) / 2;
    const size = lerp(DOC.size, 24, morph);
    ctx.font = mono(size);
    const [ex, ey] = toScreen(cam, FIELD.x + FIELD.w, -24);
    const x1 = ex - ctx.measureText(INTRO).width * 24 / size;
    ctx.fillStyle = mix(C.textHi, C.text, morph);
    ctx.fillText(INTRO, lerp(x0, x1, morph), lerp(562, ey, morph));
    ctx.restore();
  } else status.push({ text: t >= rowStart(0) - 0.5 ? "ready" : INTRO });
  const out = TL.status.filter(s => t >= s.t);
  if (out.length) {
    status.length = 0;
    out.reverse().forEach(s => status.push({ text: s.text, hi: true, size: 32 }));
  }

  ctx.save();
  applyCam(ctx, cam);
  drawField(ctx, FIELD, fieldH(fieldRows(t)), open);
  if (morph >= 1) drawStatus(ctx, FIELD, status);
  else drawStatus(ctx, FIELD, [], span(t, TL.hit + 0.2, TL.hit + 0.5));
  if (!rows[0]) { ctx.globalAlpha = span(t, TL.hit + 0.3, TL.hit + 0.6); drawGutter(ctx, FIELD, 0, true); ctx.globalAlpha = 1; }
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

// The camera fits whatever the command has typed so far: one letter fills the
// frame, and the frame widens with every repeated key and every new row.
function godFit(adv, t) {
  let len = 5, rows = 1;
  TL.god.forEach((row, r) => { const s = godRow(row, t); if (s) { rows = r + 1; len = Math.max(len, s.length + 1); } });
  const top = -GOD.size * 0.72, bottom = (rows - 1) * GOD.lh + 24;
  const s = Math.min(2.3, (W - 240) / (len * adv), (H - 200) / (bottom - top));
  return { s, fx: len * adv / 2, fy: (top + bottom) / 2 };
}
function godCam(adv, t) {
  let s = 0, fx = 0, fy = 0;
  for (let k = 0; k < 6; k++) {
    const f = godFit(adv, Math.max(TL.god[0].keys[0][1], t - k * 0.05));
    s += f.s / 6; fx += f.fx / 6; fy += f.fy / 6;
  }
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

// every restored character claims one fragment from the heap
function restoreTargets(M) {
  if (M.targets) return M.targets;
  const out = [];
  let k = 0;
  RESTORE.forEach((l, li) => {
    [...l.text].forEach((ch, c) => {
      if (ch === " ") return;
      // two pieces fly per character: the heap empties into the prompt
      for (let j = 0; j < 2; j++) {
        // the first line creeps back during the quiet re-entry, one character at a time
        const t0 = l.slow ? lerp(TL.reinit + 1.2, beatT(0) - 1.0, c / l.text.length) + j * 0.12
          : beatT(l.beat) - 0.05 + c * 0.012 + j * 0.05;
        out.push({ li, c, ch, f: M.frags[M.order[k++]], t0, dur: l.slow ? 0.9 : 0.34, lands: j === 1 });
      }
    });
  });
  M.targets = out;
  M.claim = new Map(out.map(o => [o.f, o]));
  return out;
}

// the human lines sit in rows 4 and 5 and are pushed down as the prompt returns
const humanRow = (t, k) => 4 + k + outCubic(span(t, beatT(8) - 0.1, beatT(8) + 0.12)) + outCubic(span(t, beatT(10) - 0.1, beatT(10) + 0.12));

function sceneAfter(ctx, t) {
  const M = memo(ctx);
  const targets = restoreTargets(M);
  const cam = CAM_END, f = FIELD_END;

  ctx.save();
  applyCam(ctx, cam);
  if (t >= TL.reinit) {
    drawField(ctx, f, fieldH(8), span(t, TL.reinit, TL.reinit + 0.7));
    const init = typed(INTRO, TL.reinit + 0.3, TL.reinit + 1.6, t);
    drawStatus(ctx, f, [{ text: t >= beatT(READY_BEAT) ? "ready" : init }], span(t, TL.reinit + 0.2, TL.reinit + 0.5));
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
    const lift = stir * 16 * fr.seed * (o ? 1 : 0.25);
    drawFrag(ctx, fr, p.x, p.y - lift, p.v);
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
  ctx.font = mono(DOC.size);
  // each line lands with the machine's selection, which then lets go of it
  RESTORE.forEach((l, li) => {
    const t0 = beatT(l.beat) + (l.slow ? 0 : 0.3), k = span(t, t0, t0 + TL.beat.period * 1.5);
    if (t < t0 || k >= 1) return;
    const w = l.text.length * M.docAdv;
    ctx.fillStyle = C.machineSel;
    ctx.fillRect(f.textX - 6 + w * outCubic(k), rowY(li) - ASC, (w + 12) * (1 - outCubic(k)), ASC + DESC);
  });
  for (const o of targets) {
    if (!o.lands || t < o.t0 + o.dur) continue;
    ctx.fillStyle = mix(C.textHi, C.old, span(t, o.t0 + o.dur, o.t0 + o.dur + 0.6));
    ctx.fillText(o.ch, f.textX + o.c * M.docAdv, rowY(o.li));
  }
  RESTORE.forEach((l, li) => {
    if (!l.filter || t < beatT(l.filterBeat)) return;
    ctx.fillStyle = C.filter;
    ctx.fillRect(f.textX + l.filter[0] * M.docAdv - 2, rowY(li) - ASC - 2, (l.filter[1] - l.filter[0]) * M.docAdv + 4, ASC + DESC - 2);
  });

  // "Be ... honest?" breaks; at the end the machine turns it back into an instruction
  const brokenY = rowY(humanRow(t, 0)), honestY = rowY(humanRow(t, 1));
  const conv = beatT(CONVERT_BEAT);
  const broken = typedWords(TL.broken.words, TL.broken.b, t, 0.09);
  if (broken && t < conv) {
    ctx.font = red(TL.broken.grade, DOC.red);
    // a clean slot while the command is still coming down around it
    if (t < TL.collapse + 1.2) {
      ctx.fillStyle = C.void;
      ctx.fillRect(f.textX - 30, brokenY - ASC - 24, ctx.measureText("Be ... honest?").width + 80, ASC + DESC + 44);
    }
    if (t >= conv - 0.16) {
      ctx.fillStyle = C.machineSel; ctx.fillRect(f.textX - 4, brokenY - ASC, ctx.measureText(broken).width + 8, ASC + DESC);
    }
    ctx.fillStyle = mix(C.textHi, C.text, 0.7 * span(t, TL.decay, TL.decay + 1));
    ctx.fillText(broken, f.textX, brokenY);
  }
  if (t >= conv) {
    ctx.font = mono(DOC.size); ctx.fillStyle = C.textHi;
    ctx.fillText(typed("Be honest.", conv, conv + 0.3, t), f.textX, brokenY);
  }
  const honest = typedWords(TL.honest.words, TL.honest.b, t, 0.09);
  if (honest) {
    ctx.font = red(TL.honest.grade, DOC.red); ctx.fillStyle = C.textHi;
    ctx.fillText(honest, f.textX, honestY);
    // steady through the silence, then blinking in tempo, then free after the band
    const on = t < TL.reinit || (t < TL.bandEnd ? beatBlink(t) : Math.floor((t - TL.bandEnd) / 0.6) % 2 === 0);
    drawCaret(ctx, "h", f.textX + ctx.measureText(honest).width, honestY, on);
  } else if (broken) {
    ctx.font = red(TL.broken.grade, DOC.red);
    drawCaret(ctx, "h", f.textX + ctx.measureText(broken).width, brokenY, true);
  }
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
  if (t < TL.hit) sceneIntro(ctx, t);
  else if (t < TL.god[0].keys[0][1]) sceneDocument(ctx, t);
  else if (t < TL.collapse) sceneGod(ctx, t);
  else {
    if (t < TL.collapse + 1.2) sceneGod(ctx, t);
    sceneAfter(ctx, t);
  }
  texture(ctx, t, t >= TL.slam && t < TL.collapse ? 0.1 : 0.06, isFrozen(t));
}
