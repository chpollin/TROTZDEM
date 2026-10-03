// Recursive Self-Improvement. The whole video is drawScene(ctx, t), a pure
// function of time in seconds: no state survives between frames. Word times,
// commits and the measured tempo come from timeline.js.
//
// The stage is one plain text editor whose document is the song itself, with a
// blame column (who wrote each line), a history of commits, a run log and a
// status bar with version, measured tempo, tests and the lead of the
// prediction. The human types his German lines in Redaction, the machine's
// English lines arrive as grey ghost text in Space Mono and run ever further
// ahead of him: half a line in verse 2, a whole line in verse 3, an opaque wall
// in the bridge, the rest of the song after "I know how this song ends." Every
// sung "Version" is a commit whose diff sweep gets shorter each time, and the
// damage grade of his letters rises with it. The tempo does not rise (measured
// 93-97 BPM throughout); only the lead does. Hot white with bloom means one
// thing: a prediction became text, accepted on his behalf or come true.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#060607", doc: "#0f1012", gutter: "#0b0c0e", panel: "#0c0d0f", bar: "#131417", edge: "#24272c",
  dim: "#454b53", ui: "#8a929b", uiHi: "#c3cad1",
  ink: "#d4c8b3", inkPast: "#9d9382",
  mach: "#a9b8c6", machDim: "#5f6b76", machPast: "#77838e",
  ghost: "#565e68", comment: "#7b8088",
  add: "#2b2f35", del: "#1c1e22", pass: "#8a929b", fail: "#c3cad1",
  acc: "#fff4e2",
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

// ---------------------------------------------------------------- time

const parse = s => [...(s || "").matchAll(/\s*(.+?)@(\d+(?:\.\d+)?)/g)].map(m => ({ s: m[1], t: +m[2] }));

function section(t) {
  let s = SECTIONS[0];
  for (const x of SECTIONS) if (t >= x.t) s = x;
  return s;
}
const period = s => s.period || 60 / s.bpm;
function beatFrac(t) { const s = section(t), b = (t - s.first) / period(s); return b - Math.floor(b); }
const beatKick = (t, d = 0.1) => Math.exp(-beatFrac(t) * period(section(t)) / d);
const beatIndex = t => { const s = section(t); return Math.floor((t - s.first) / period(s)); };

// Visible characters of a sung word: typed from its onset within 0.28 s.
function chars(w, next, t) {
  if (t < w.t) return 0;
  const d = Math.max(0.05, Math.min(0.28, ((next === undefined ? w.t + 0.5 : next) - w.t) * 0.85));
  return Math.max(1, Math.round(w.s.length * span(t, w.t, w.t + d)));
}
const bloomK = (t, ta) => ta === null || t < ta ? 0 : Math.exp(-(t - ta) / 0.45) * (t - ta < 2 ? 1 : 0);

// ---------------------------------------------------------------- the document

const strip = s => s.replace(/[.,!?;:-]+$/, "");
// Every line, prepared once: who, words, ghost, when it starts, when the
// machine's part becomes text, when the line flares.
function prep(src, extra = {}) {
  const L = { ...src, ...extra };
  L.hw = parse(L.w);
  L.mw = parse(L.m);
  if (L.who === "m") { L.mw = parse(L.m); L.hw = []; }
  if (L.who === "m" && !L.m) L.mw = parse(L.w);
  L.predW = L.pred ? L.pred.split(" ") : null;
  L.acc = L.mw.length ? (L.acc !== undefined ? L.acc : L.mw[0].t) : null;
  L.ts = L.hw.length ? L.hw[0].t : L.acc;
  L.last = L.hw.length ? L.hw[L.hw.length - 1].t : L.acc;
  L.done = L.hw.length ? L.last + 0.3 : L.acc;
  L.exists = Math.min(L.ts, L.g === undefined ? Infinity : L.g, L.preset ? TL.enter : Infinity);
  // what flares: the machine part on acceptance, the whole chorus on Enter, a
  // predicted human line when he has typed exactly what was predicted
  if (L.preset) L.bloomAt = TL.enter;
  else if (L.mw.length) L.bloomAt = L.acc;
  else if (L.predW && L.hw.map(w => strip(w.s)).join(" ") === L.predW.map(strip).join(" ")) L.bloomAt = L.done;
  else L.bloomAt = null;
  L.author = (L.who === "h" || L.who === "term" || L.who === "com") && !L.predW && !L.preset ? "ich" : null;
  L.ta = L.mw.length ? L.acc : L.preset ? TL.enter : L.predW ? L.done : L.ts;
  return L;
}
const A = [...TL.v1, ...TL.chorus1, ...TL.v2, ...TL.chorus2, ...TL.v3, TL.bridge[0], TL.bridge[1]].map(l => prep(l));
const REST = TL.rest.map((l, i) => {
  const own = l.who !== "m" ? { pred: l.pred || parse(l.w).map(w => w.s).join(" ") } : {};
  return prep(l, { g: TL.ends + 0.12 + i * 0.09, ...own });
});
// "FOLGSAM GE-": the predicted rest of the word disappears when "Yes." is taken
REST[4].ghostCut = REST[5].acc;
const B_PAGE = [A[A.length - 1], prep(TL.bridge[2]), prep(TL.bridge[3]), ...TL.breakdown.map(l => prep(l)), ...REST];
const O1 = REST[8]; // "Version eins hat mir gute Nacht gesagt."
// typed in the flashback, where there is no prediction: it stays his
const O1_FLASH = prep(TL.rest[8]);
const FLASH = [...A.slice(0, 8), O1_FLASH];

function page(t) {
  if (t < TL.blink) return { lines: A, num0: 1, mode: "A", start: 0 };
  if (t < TL.back) return { lines: B_PAGE, num0: 1, mode: "B", start: TL.blink };
  if (t < TL.forward) return { lines: FLASH, num0: 1, mode: "F", start: TL.back };
  return { lines: B_PAGE.map(l => l === O1 ? O1_FLASH : l), num0: 1, mode: "B", start: TL.forward };
}

// ---------------------------------------------------------------- versions

const COMMITS = TL.commits.map(c => ({ ...c, ws: parse(c.w), label: "v" + c.n }));
// The counter as a fraction: it runs between the sung milestones of the
// breakdown, keeps running after "ich hör auf zu zählen" and becomes n.
function versionNum(t) {
  if (t < 9.24) return 0;
  if (t < 45.66) return 1;
  if (t < 90.18) return 2;
  const geo = (a, b, k) => a * Math.pow(b / a, k);
  if (t < 129.46) return 3;
  // each sung "Version" runs the counter up to the number that follows it
  if (t < 133.10) return geo(3, 100, Math.pow(span(t, 129.46, 133.10), 1.6));
  if (t < 134.36) return 100;
  if (t < 135.90) return geo(100, 1000, Math.pow(span(t, 134.36, 135.90), 1.4));
  if (t < 136.82) return 1000;
  if (t < 138.10) return geo(1000, 10000, Math.pow(span(t, 136.82, 138.10), 1.2));
  if (t < 147.60) return 10000;
  if (t < 167.42) return geo(10000, 1e11, Math.pow(span(t, 147.60, 167.42), 0.8));
  return Infinity;
}
function versionLabel(t, mode) {
  if (mode === "F") return "v1";
  const n = versionNum(t);
  if (n === 0) return "new file";
  if (n === Infinity) {
    if (t >= TL.running) return "vn+" + Math.max(1, beatIndex(t) - beatIndex(TL.running) + 1);
    return "vn";
  }
  return "v" + Math.floor(n);
}
function sectionGrade(t) {
  if (t < 45.66) return 0;
  if (t < 90.18) return 1;
  if (t < 104) return 2;
  if (t < 133.10) return 3;
  if (t < 135.90) return 4;
  if (t < 148.3) return 5;
  if (t < 168.1) return 6;
  return 0;
}
// Grade and blame of a line at time t: set when it was written, then rewritten
// by every commit whose diff sweep has passed it. The outro restores the type.
function lineState(L, t, yNorm, mode) {
  if (mode === "F") return { grade: 0, blame: "ich" };
  // while he is still typing into a prediction the line is his
  let grade = sectionGrade(Math.min(L.ta, Math.max(L.ts, t))), blame = L.author || (t < L.ta && L.hw.length ? "ich" : versionLabel(L.ta, "B"));
  for (const c of COMMITS) {
    if (c.c <= L.ta || t < c.c) continue;
    if (t >= c.c + c.dur * clamp(yNorm)) { grade = c.grade; blame = c.label; }
  }
  if (t >= TL.back) grade = 0;
  return { grade, blame };
}

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(Math.round(g), 0, 6)]}"`;
const monoFont = (size, w = 400) => `${w} ${size}px "Space Mono"`;
const MEASURE = new Map();
function measure(ctx, font, s) {
  const k = font + "|" + s;
  let v = MEASURE.get(k);
  if (v === undefined) { ctx.font = font; v = ctx.measureText(s).width; MEASURE.set(k, v); }
  return v;
}
function mono(ctx, text, x, y, size, color, weight = 400, align = "left") {
  ctx.font = monoFont(size, weight);
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = "left";
}

// ---------------------------------------------------------------- the window

const WIN = { x: 60, y: 36, w: 1800, h: 1008 };
const TITLE_B = 96, STATUS_T = 992;
const GUT = { x: 60, w: 280 };
const DOC = { x: 362, w: 1110 };
const PANEL = { x: 1494, w: 366 };
const DOC_TOP = TITLE_B + 14, DOC_BOT = STATUS_T - 8;
const Y_ACT = 410;
const BIG = 86, SMALL = 40, FAR = 30;

// Tokens of a line with their font role. The layout uses the predicted words
// where there is a prediction, so typing into the ghost never moves anything.
function tokens(L) {
  const out = [];
  if (L.who === "com") out.push({ role: "mark", s: "#" });
  L.hw.forEach((w, i) => out.push({ role: L.who === "term" ? "term" : L.who === "com" ? "com" : "h", s: L.predW ? L.predW[i] : w.s, w, next: L.hw[i + 1] ? L.hw[i + 1].t : undefined, i }));
  L.mw.forEach(w => out.push({ role: "m", s: w.s, w }));
  return out;
}
function tokFont(role, S, grade) {
  if (role === "h") return gradeFont(grade, S);
  if (role === "term") return monoFont(Math.round(S * 0.84), 700);
  if (role === "com" || role === "mark") return monoFont(Math.round(S * 0.8));
  return monoFont(Math.round(S * 0.84));
}
const LAYOUT = new Map();
function layoutLine(ctx, L, S) {
  const key = L.w + "|" + (L.m || "") + "|" + S;
  let lay = LAYOUT.get(key);
  if (lay) return lay;
  const toks = tokens(L);
  const maxW = DOC.w - (L.indent ? 64 : 0);
  const rows = [[]];
  let x = 0;
  // a short machine completion is never split across rows
  const mf = tokFont("m", S, 0);
  const tail = L.who === "hm" ? measure(ctx, mf, L.mw.map(w => w.s).join(" ")) : 0;
  for (const tk of toks) {
    const f = tokFont(tk.role, S, 0);
    const ww = measure(ctx, f, tk.s), sp = measure(ctx, f, " ");
    const keep = tk.role === "m" && tk.w === L.mw[0] && tail < maxW * 0.45 ? tail : ww;
    if (rows[rows.length - 1].length && x + sp + keep > maxW) { rows.push([]); x = 0; }
    if (rows[rows.length - 1].length) x += sp;
    rows[rows.length - 1].push({ ...tk, x, ww });
    x += ww;
  }
  lay = { rows, S, h: rows.length * S * 1.2 };
  LAYOUT.set(key, lay);
  return lay;
}

// ---------------------------------------------------------------- drawing a line

// role colours; past lines are dimmer, unsung words of accepted text too
function inkFor(role, past) {
  if (role === "h") return past ? C.inkPast : C.ink;
  if (role === "term") return past ? C.inkPast : C.ink;
  if (role === "com" || role === "mark") return C.comment;
  return past ? C.machPast : C.mach;
}

function drawLine(ctx, L, t, o) {
  const { lay, x0, y0, alpha, past, grade, flash } = o;
  if (alpha <= 0.01) return null;
  const S = lay.S, bk = flash ? 0 : bloomK(t, L.bloomAt);
  const bkH = L.who === "hm" ? 0 : bk;
  let caret = null;
  ctx.save();
  ctx.globalAlpha = alpha;
  lay.rows.forEach((row, ri) => {
    const by = y0 + S * 0.92 + ri * S * 1.2;
    for (const tk of row) {
      const x = x0 + tk.x;
      const f = tokFont(tk.role, S, grade);
      ctx.font = f;
      if (tk.role === "mark") {
        if (t >= L.exists) { ctx.fillStyle = C.comment; ctx.fillText(tk.s, x, by); }
        continue;
      }
      if (tk.role === "m") {
        // machine words: ghost from g, text from acceptance
        if (t >= L.acc) {
          const sung = t >= tk.w.t - 0.02;
          let col = sung ? inkFor("m", past) : (past ? C.machPast : C.machDim);
          if (L.preset) col = sung ? inkFor("m", past) : C.machDim;
          drawGlyphs(ctx, tk.s, x, by, col, bk);
          caret = { x: x + tk.ww, y: by, S };
        } else if (!flash && L.g !== undefined && t >= L.g) {
          const n = ghostChars(L, tk, t);
          if (n > 0) { ctx.fillStyle = C.ghost; ctx.fillText(tk.s.slice(0, n), x, by); }
        }
        continue;
      }
      // human words (and the term and comments he types)
      if (L.preset && t >= TL.enter && t < L.ts) {
        drawGlyphs(ctx, tk.w.s, x, by, tk.role === "term" ? C.machDim : mix(C.inkPast, C.doc, 0.25), bkH);
        continue;
      }
      if (L.preset && t >= L.ts) {
        const sung = t >= tk.w.t - 0.02;
        const col = sung ? inkFor(tk.role, past) : mix(C.inkPast, C.doc, 0.25);
        drawGlyphs(ctx, tk.w.s, x, by, tk.role === "term" ? (sung ? C.mach : C.machDim) : col, bkH);
        if (sung) caret = { x: x + measure(ctx, f, tk.w.s), y: by, S };
        continue;
      }
      const n = chars(tk.w, tk.next, t);
      const typedS = tk.w.s.slice(0, n);
      // a cut-off word keeps no ghost once the machine has answered
      const cut = L.ghostCut !== undefined && t >= L.ghostCut;
      if (!flash && L.predW && L.g !== undefined && t >= L.g && !cut) {
        const gs = tk.s;
        const shownG = gs.slice(0, ghostChars(L, tk, t));
        const typedW = n ? measure(ctx, f, typedS) : 0;
        // ghost glyphs not yet covered by his typing
        if (shownG.length > n) {
          ctx.fillStyle = C.ghost;
          if (n === 0) ctx.fillText(shownG, x, by);
          else if (typedS === gs.slice(0, n)) ctx.fillText(shownG.slice(n), x + typedW, by);
          else ctx.fillText(shownG.slice(Math.min(n, shownG.length)), x + typedW, by);
        }
      }
      if (n > 0) {
        drawGlyphs(ctx, typedS, x, by, inkFor(tk.role, past), bkH);
        caret = { x: x + measure(ctx, f, typedS), y: by, S };
      }
    }
  });
  ctx.restore();
  return caret;
}
function ghostChars(L, tk, t) {
  // the machine writes its ghost at 45 characters per second
  const toks = tokens(L);
  let before = 0;
  // the ghost of a completion starts where his part ends
  for (const k of toks) {
    if (k.s === tk.s && k.w === tk.w) break;
    if ((k.role === "m") === (tk.role === "m")) before += k.s.length + 1;
  }
  return clamp(Math.floor((t - L.g) * 45) - before, 0, tk.s.length);
}
function drawGlyphs(ctx, s, x, y, col, bk) {
  if (bk > 0.01) {
    ctx.save();
    ctx.fillStyle = mix(col, C.acc, Math.min(1, bk * 1.4));
    ctx.shadowColor = rgba(C.acc, bk); ctx.shadowBlur = 70 * bk;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 28 * bk; ctx.fillText(s, x, y);
    ctx.shadowBlur = 8 * bk; ctx.fillText(s, x, y);
    ctx.restore();
  } else { ctx.fillStyle = col; ctx.fillText(s, x, y); }
}

// ---------------------------------------------------------------- document layout

// Typewriter layout: the active line large at Y_ACT, older lines small above,
// predicted and accepted lines small below.
function activeIndex(lines, t) {
  let a = -1;
  lines.forEach((L, i) => { if (t >= L.ts - 0.02) a = i; });
  return a;
}
function layoutDoc(ctx, lines, act, t) {
  const out = new Map();
  if (act >= 0) {
    const L = lines[act], lay = layoutLine(ctx, L, BIG);
    out.set(L, { lay, y: Y_ACT });
  }
  let y = Y_ACT - 16;
  for (let i = act - 1; i >= 0; i--) {
    const L = lines[i], lay = layoutLine(ctx, L, SMALL);
    y -= lay.h;
    out.set(L, { lay, y });
    y -= 14;
    if (y < DOC_TOP - 200) break;
  }
  const y0 = act >= 0 ? Y_ACT + out.get(lines[act]).lay.h + 30 : Y_ACT + BIG * 1.2 + 30;
  const fut = lines.slice(act + 1).filter(L => t >= L.exists);
  // the far predictions shrink until all of them fit above the status bar
  for (let far = FAR; ; far -= 2) {
    let y = y0;
    const placed = fut.map((L, k) => {
      const lay = layoutLine(ctx, L, k === 0 ? SMALL + 4 : far);
      const e = { lay, y };
      y += lay.h + (k === 0 ? 18 : 6);
      return e;
    });
    if (y <= DOC_BOT + 6 || far <= 18) { fut.forEach((L, k) => out.set(L, placed[k])); break; }
  }
  return out;
}

function drawDocument(ctx, t, pg, opts) {
  const lines = pg.lines, flash = pg.mode === "F";
  const act = activeIndex(lines, t);
  const tsAct = act >= 0 ? lines[act].ts : -1;
  // a line that opens a page arrives with the cut, without a scroll
  const k = act >= 0 && Math.abs(tsAct - pg.start) > 0.05 ? outCubic((t - tsAct) / 0.24) : 1;
  const cur = layoutDoc(ctx, lines, act, t);
  const prev = k < 1 && act >= 0 ? layoutDoc(ctx, lines, act - 1, t) : null;
  // current-line band, breathing with the beat
  if (act >= 0) {
    const e = cur.get(lines[act]);
    const pe = prev && prev.get(lines[act]);
    const y = pe ? lerp(pe.y, e.y, k) : e.y, h = pe ? lerp(pe.lay.h, e.lay.h, k) : e.lay.h;
    ctx.fillStyle = rgba("#ffffff", 0.025 + 0.025 * beatKick(t) * audioAt(AUDIO_RMS, t));
    ctx.fillRect(DOC.x - 22, y - 10, DOC.w + 40, h + 18);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(GUT.x, DOC_TOP, DOC.x + DOC.w + 20 - GUT.x, DOC_BOT - DOC_TOP); ctx.clip();
  let caret = null;
  const states = [];
  lines.forEach((L, i) => {
    const a = cur.get(L), p = prev ? prev.get(L) : null;
    if (!a && !p) return;
    const draws = [];
    if (a && p) {
      draws.push({ e: a, y: lerp(p.y, a.y, k), al: k });
      if (k < 1) draws.push({ e: p, y: lerp(p.y, a.y, k), al: (1 - k) * (1 - k), sc: true });
    } else if (a) draws.push({ e: a, y: a.y, al: k });
    else draws.push({ e: p, y: p.y, al: 1 - k });
    const yN = (draws[0].y + draws[0].e.lay.h / 2 - DOC_TOP) / (DOC_BOT - DOC_TOP);
    const st = lineState(L, t, yN, pg.mode);
    const isPast = i < act, isFuture = i > act;
    for (const d of draws) {
      if (d.y > DOC_BOT + 20 || d.y + d.e.lay.h < DOC_TOP - 20) continue;
      const al = d.al * (isPast ? 0.8 : 1) * (opts.docAlpha === undefined ? 1 : opts.docAlpha);
      const c = drawLine(ctx, L, t, { lay: d.e.lay, x0: DOC.x + (L.indent ? 64 : 0), y0: d.y, alpha: al, past: isPast, grade: st.grade, flash });
      if (i === act && d.al >= 0.5) caret = c;
    }
    states.push({ L, i, y: draws[0].y, S: draws[0].e.lay.S, st, act: i === act, future: isFuture, al: draws[0].al });
  });
  ctx.restore();
  const fade = ctx.createLinearGradient(0, DOC_TOP, 0, DOC_TOP + 90);
  fade.addColorStop(0, rgba(C.doc, 1)); fade.addColorStop(1, rgba(C.doc, 0));
  ctx.fillStyle = fade; ctx.fillRect(GUT.x + GUT.w + 1, DOC_TOP, DOC.x + DOC.w + 20 - GUT.x - GUT.w, 90);
  const gfade = ctx.createLinearGradient(0, DOC_TOP, 0, DOC_TOP + 90);
  gfade.addColorStop(0, rgba(C.gutter, 1)); gfade.addColorStop(1, rgba(C.gutter, 0));
  ctx.fillStyle = gfade; ctx.fillRect(GUT.x, DOC_TOP, GUT.w, 90);
  return { caret, states, act, cur };
}

// ---------------------------------------------------------------- gutter

// the gutter has room for six characters; past a million the count turns
// into a power of ten
const compact = s => /^v\d{7,}$/.test(s) ? "v" + Number(s.slice(1)).toExponential(1).replace("+", "") : s;

function drawGutter(ctx, t, doc, pg) {
  ctx.save();
  ctx.beginPath(); ctx.rect(GUT.x, DOC_TOP, GUT.w, DOC_BOT - DOC_TOP); ctx.clip();
  for (const s of doc.states) {
    if (s.future && t < s.L.ta) {
      // predicted lines carry no author yet
      mono(ctx, String(pg.num0 + s.i), GUT.x + GUT.w - 26, s.y + s.S * 0.92, 18, C.dim, 400, "right");
      continue;
    }
    const size = s.act ? 26 : 19;
    const by = s.y + s.S * 0.92;
    ctx.globalAlpha = s.act ? 1 : 0.85;
    const human = s.st.blame === "ich";
    mono(ctx, compact(s.st.blame), GUT.x + 26, by, size, human ? C.ink : C.machPast, human ? 700 : 400);
    mono(ctx, String(pg.num0 + s.i), GUT.x + GUT.w - 26, by, size - 4, s.act ? C.ui : C.dim, 400, "right");
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- commits

function commitAt(t) {
  for (const c of COMMITS) {
    const a = c.g !== undefined ? c.g : c.ws[0].t - 0.15;
    if (t >= a && t < c.c + c.dur + 0.5) return c;
  }
  return null;
}
// The diff sweep: a rule runs down the document, everything above it is the
// new version.
function drawSweep(ctx, t) {
  for (const c of COMMITS) {
    if (t < c.c || t > c.c + c.dur + 0.9) continue;
    const p = span(t, c.c, c.c + c.dur);
    const y = lerp(DOC_TOP, DOC_BOT, p);
    const fade = 1 - span(t, c.c + c.dur, c.c + c.dur + 0.9);
    ctx.fillStyle = rgba(C.add, 0.28 * fade);
    ctx.fillRect(GUT.x, DOC_TOP, DOC.x + DOC.w + 20 - GUT.x, y - DOC_TOP);
    if (p < 1) {
      ctx.fillStyle = rgba(C.pass, 0.8);
      ctx.fillRect(GUT.x, y - 1, DOC.x + DOC.w + 20 - GUT.x, 2);
      mono(ctx, "+", GUT.x + 8, y - 6, 20, C.pass, 700);
    }
  }
}
function drawCommitBox(ctx, t) {
  const c = commitAt(t);
  if (!c) return;
  const a = c.g !== undefined ? c.g : c.ws[0].t - 0.15;
  const appear = outCubic(span(t, a, a + 0.25));
  const leave = smooth(span(t, c.c + c.dur, c.c + c.dur + 0.5));
  const y = lerp(DOC_BOT + 10, 846, appear) + leave * 160;
  const x = DOC.x - 22, w = DOC.w + 40, h = 128;
  ctx.save();
  ctx.beginPath(); ctx.rect(GUT.x, DOC_TOP, W, DOC_BOT - DOC_TOP); ctx.clip();
  ctx.globalAlpha = 1 - leave;
  ctx.fillStyle = C.bar; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  mono(ctx, "commit", x + 18, y + 26, 18, C.ui);
  mono(ctx, c.n === 1 ? "by ich" : "by " + compact(versionLabel(c.c - 0.05, "B")), x + w - 18, y + 26, 18, c.n === 1 ? C.ink : C.machPast, 400, "right");
  const S = 74, by = y + 106;
  ctx.font = monoFont(S);
  if (c.show) {
    // the last commit is written by the machine before it is sung
    const bk = bloomK(t, c.c);
    if (t >= c.c) drawGlyphs(ctx, c.show, x + 18, by, C.mach, bk);
    else { ctx.fillStyle = C.ghost; ctx.fillText(c.show.slice(0, Math.floor((t - c.g) * 6)), x + 18, by); }
  } else {
    let xx = x + 18;
    c.ws.forEach((wd, i) => {
      const n = chars(wd, c.ws[i + 1] ? c.ws[i + 1].t : undefined, t);
      // the held "Version" of the breakdown is typed as slowly as it is sung
      const held = c.n === 100 && i === 0 ? Math.max(n ? 1 : 0, Math.round(wd.s.length * span(t, wd.t, 131.3))) : n;
      if (held > 0) { ctx.fillStyle = C.mach; ctx.fillText(wd.s.slice(0, held), xx, by); }
      xx += measure(ctx, monoFont(S), wd.s + " ");
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the opaque wall

// Bridge: the machine predicts the rest of the song over and over, one row per
// eighth note of the measured pulse, in stacked echoes, until nothing shows
// through. Its rows are the lines still to come.
const FUTURE = [...TL.bridge, ...TL.breakdown, ...TL.rest].map(l => prep(l));
const EIGHTH = 60 / 96.2 / 2;
// rows sized so the wall closes on "undurchsichtig" (24 eighths after 104.35)
const WALL_ROW = 35;
const WALL_CAP = Math.floor((DOC_BOT - DOC_TOP - 20) / WALL_ROW);
const wallRows = t => t < TL.wallStart || t >= TL.blink ? 0 : Math.floor((t - 104.35) / EIGHTH) + 1;
// each row runs across the whole page: two predicted lines back to back
const lineText = L => [...L.hw, ...L.mw].map(w => w.s).join(" ");
const wallText = i => lineText(FUTURE[i % FUTURE.length]) + "   " + lineText(FUTURE[(i + 5) % FUTURE.length]);
function drawWall(ctx, t) {
  const n = wallRows(t);
  if (t < TL.wallStart || t >= TL.blink) return;
  const opaque = smooth(span(t, TL.wallStart, 111.94));
  ctx.save();
  ctx.beginPath(); ctx.rect(GUT.x, DOC_TOP, DOC.x + DOC.w + 20 - GUT.x, DOC_BOT - DOC_TOP); ctx.clip();
  ctx.fillStyle = rgba(C.doc, 0.25 + 0.75 * opaque);
  const top = n >= WALL_CAP ? DOC_TOP : DOC_BOT - 10 - n * WALL_ROW;
  ctx.fillRect(GUT.x, top, DOC.x + DOC.w + 20 - GUT.x, DOC_BOT - top);
  const kick = beatKick(t, 0.08);
  for (let i = 0; i < n; i++) {
    const layer = Math.floor(i / WALL_CAP), r = i % WALL_CAP;
    const y = DOC_BOT - 18 - r * WALL_ROW + layer * 9;
    const x = DOC.x - 22 + ((layer * 37 + r * 13) % 70) - 30;
    const land = outCubic((t - (104.35 + i * EIGHTH)) / 0.12);
    const s = wallText(i);
    const mixed = FUTURE[i % FUTURE.length].who === "m";
    ctx.font = mixed ? monoFont(25) : gradeFont(Math.min(6, 3 + layer), 32);
    ctx.globalAlpha = (0.42 + 0.1 * (i === n - 1 ? kick : 0)) * land;
    ctx.fillStyle = C.ghost;
    for (let e = 0; e < 3; e++) ctx.fillText(s, x + e * 7 - (1 - land) * 30, y - e * 3);
    // the gutter fills with the same predicted lines, unattributed
    ctx.fillStyle = C.dim; ctx.fillRect(GUT.x + 30, y - 8, 10, 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the lead

function lead(t, pg) {
  let best = 0;
  if (pg.mode === "F") return 0;
  for (const L of pg.lines) {
    if (L.g === undefined || t < L.g) continue;
    if (L === O1 && t >= TL.back) continue;
    const far = Math.max(L.mw.length ? L.mw[L.mw.length - 1].t : 0, L.predW ? L.last : 0);
    if (L.ghostCut !== undefined && t >= L.ghostCut) continue;
    best = Math.max(best, far - t);
  }
  const n = wallRows(t);
  if (n > 0) {
    let far = 0;
    for (let i = 0; i < Math.min(n + 5, FUTURE.length); i++) far = Math.max(far, FUTURE[i].last);
    best = Math.max(best, far - t);
  }
  const vn = COMMITS[COMMITS.length - 1];
  if (t >= vn.g && t < vn.c) best = Math.max(best, vn.c - t);
  return Math.max(0, best);
}

// ---------------------------------------------------------------- panels

function historyEntries(t, mode) {
  if (mode === "F") return { n: 1, frac: 0 };
  const v = versionNum(t);
  if (v === Infinity) {
    const extra = t >= TL.running ? Math.max(1, beatIndex(t) - beatIndex(TL.running) + 1) : 0;
    return { n: Infinity, extra };
  }
  return { n: Math.floor(v), frac: v - Math.floor(v) };
}
const MILESTONE = { 1: "Version one.", 2: "Version two.", 3: "Version three.", 100: "Version one hundred.", 1000: "Version one thousand.", 10000: "Version ten thousand." };
function drawHistory(ctx, t, mode, reveal) {
  const x = PANEL.x + 22, top = DOC_TOP + 8, bottom = 640, rowH = 32;
  ctx.globalAlpha = reveal;
  mono(ctx, "history", x, top + 18, 18, C.ui);
  ctx.fillStyle = C.edge; ctx.fillRect(x, top + 32, PANEL.w - 44, 1);
  // "I have read everything you ever wrote."
  const readA = 139.0, readB = 141.6;
  if (t >= readA && t < readB && mode !== "F") {
    const all = [...A, ...B_PAGE.slice(1, 3)].filter(L => L.ts < t);
    const p = span(t, 139.06, 140.9);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 4, top + 40, PANEL.w - 36, bottom - top - 40); ctx.clip();
    const off = p * Math.max(0, all.length * 26 - (bottom - top - 60));
    all.forEach((L, i) => {
      const y = top + 64 + i * 26 - off;
      const s = [...L.hw, ...L.mw].map(w => w.s).join(" ");
      const scanned = i * 26 - off < (bottom - top - 60) * (p * 1.1);
      ctx.font = monoFont(15); ctx.fillStyle = scanned ? C.machPast : C.dim;
      ctx.fillText(s.slice(0, 27), x, y);
      if (scanned) mono(ctx, "read", x + PANEL.w - 50, y, 14, C.machDim, 400, "right");
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }
  const h = historyEntries(t, mode);
  if (h.n === 0) { mono(ctx, "no commits", x, top + 66, 18, C.dim); ctx.globalAlpha = 1; return; }
  const rows = Math.floor((bottom - top - 50) / rowH);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 4, top + 40, PANEL.w - 36, bottom - top - 40); ctx.clip();
  if (h.n === Infinity) {
    const list = ["vn  Version n."];
    for (let i = 1; i <= h.extra; i++) list.push("vn+" + i + "  auto");
    const startI = Math.max(0, list.length - rows);
    for (let i = startI; i < list.length; i++) {
      const y = top + 66 + (i - startI) * rowH;
      mono(ctx, list[i], x, y, 18, i === list.length - 1 ? C.uiHi : C.ui);
      mono(ctx, i === 0 ? "vn-1" : i === 1 ? "vn" : "vn+" + (i - 1), x + PANEL.w - 50, y, 15, C.machDim, 400, "right");
    }
  } else {
    const rate = rateOf(t);
    const fast = rate * rowH > 360;
    const first = Math.max(1, h.n - rows + 1);
    const off = h.n > rows ? h.frac * rowH : 0;
    for (let k = first; k <= h.n; k++) {
      const y = top + 66 + (k - first) * rowH - off;
      if (fast && !MILESTONE[k]) {
        ctx.fillStyle = rgba(C.machPast, 0.35); ctx.fillRect(x, y - 12, 60 + (k * 37) % 180, 3);
        continue;
      }
      const msg = MILESTONE[k] || "auto";
      const mx = x + 78 + Math.max(0, String(k).length - 3) * 11;
      mono(ctx, "v" + k, x, y, 18, k === h.n ? C.uiHi : C.ui, 700);
      mono(ctx, msg, mx, y, 18, k === h.n ? C.uiHi : C.ui);
      // the author only where the message leaves room for it
      if (mx + measure(ctx, monoFont(18), msg) < x + PANEL.w - 110)
        mono(ctx, k === 1 ? "ich" : "v" + (k - 1), x + PANEL.w - 50, y, 15, k === 1 ? C.ink : C.machDim, 400, "right");
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function rateOf(t) {
  const a = versionNum(t), b = versionNum(t + 0.05);
  return isFinite(a) && isFinite(b) ? (b - a) / 0.05 : 0;
}

// "das Log sieht super aus": three green rows; "nur liefen die Tests nie": the
// tests row turns out to have run nothing.
function drawRunLog(ctx, t, mode, reveal) {
  const x = PANEL.x + 22, top = 668;
  ctx.globalAlpha = reveal;
  mono(ctx, "run log", x, top, 18, C.ui);
  ctx.fillStyle = C.edge; ctx.fillRect(x, top + 14, PANEL.w - 44, 1);
  const tt = mode === "F" ? 24.0 : t;
  const v = TL.v1[2], hw = parse(v.w);
  const rows = [["build", hw[5].t], ["lint", hw[7].t], ["tests", hw[8].t]];
  const nie = parse(TL.v1[3].w)[4].t;
  rows.forEach(([name, at], i) => {
    if (tt < at) return;
    const y = top + 52 + i * 34;
    mono(ctx, name, x, y, 20, C.ui);
    if (name === "tests" && tt >= nie) mono(ctx, "0 run", x + 120, y, 20, C.fail, 700);
    else mono(ctx, "ok", x + 120, y, 20, C.pass, 700);
  });
  if (mode !== "F" && t >= TL.running) {
    const y = top + 52 + 3 * 34 + 10;
    mono(ctx, "running", x, y, 20, C.uiHi);
    const d = ((beatIndex(t) % 4) + 4) % 4;
    mono(ctx, ".".repeat(d), x + 100, y, 20, C.uiHi);
  }
  ctx.globalAlpha = 1;
}

function testsField(t, mode) {
  if (mode === "F") return ["tests passed", C.pass];
  const v = parse(TL.v1[2].w), nie = parse(TL.v1[3].w)[4].t;
  if (t < v[4].t) return ["tests —", C.dim];
  if (t < nie) return ["tests passed", C.pass];
  return ["tests 0 run", C.fail];
}

function drawStatus(ctx, t, pg, reveal) {
  const y = STATUS_T + 34;
  const fields = [];
  fields.push([versionLabel(t, pg.mode), C.uiHi, 700]);
  const s = section(t);
  fields.push([s.bpm ? "tempo " + s.bpm.toFixed(1) + " bpm" : "tempo —", C.ui, 400]);
  const tf = testsField(t, pg.mode);
  fields.push([tf[0], tf[1], 400]);
  const ld = lead(t, pg);
  fields.push(["lead " + (ld < 10 ? ld.toFixed(1) : Math.round(ld)) + " s", ld > 0.05 ? C.uiHi : C.ui, 400]);
  const xs = [GUT.x + 26, 420, 760, 1080];
  fields.forEach((f, i) => {
    if (reveal[i] <= 0) return;
    ctx.globalAlpha = reveal[i];
    mono(ctx, f[0], xs[i], y, 22, f[1], f[2]);
    if (i > 0) { ctx.fillStyle = C.edge; ctx.fillRect(xs[i] - 26, STATUS_T + 12, 1, 28); }
    ctx.globalAlpha = 1;
  });
  if (reveal[4] > 0) {
    ctx.globalAlpha = reveal[4];
    const state = pg.mode !== "F" && t >= TL.running ? "running" : t < 17.2 ? "idle" : "editing";
    mono(ctx, state, WIN.x + WIN.w - 26, y, 22, state === "running" ? C.uiHi : C.ui, 400, "right");
    if (state === "running") {
      ctx.fillStyle = rgba(C.pass, 0.5 + 0.5 * beatKick(t, 0.2));
      ctx.beginPath(); ctx.arc(WIN.x + WIN.w - 150, y - 7, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- chrome

function controlsAlpha(t, mode) {
  if (mode === "F") return 1;
  return 1 - smooth(span(t, TL.noPlug, TL.noPlug + 0.7));
}
function drawChrome(ctx, t, pg, rv) {
  // window
  ctx.fillStyle = C.doc; ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.fillStyle = C.gutter; ctx.fillRect(GUT.x, TITLE_B, GUT.w, STATUS_T - TITLE_B);
  ctx.fillStyle = C.panel; ctx.fillRect(PANEL.x - 10, TITLE_B, WIN.x + WIN.w - PANEL.x + 10, STATUS_T - TITLE_B);
  ctx.fillStyle = C.bar; ctx.fillRect(WIN.x, WIN.y, WIN.w, TITLE_B - WIN.y);
  ctx.fillRect(WIN.x, STATUS_T, WIN.w, WIN.y + WIN.h - STATUS_T);
  ctx.fillStyle = C.edge;
  ctx.fillRect(WIN.x, TITLE_B, WIN.w, 1); ctx.fillRect(WIN.x, STATUS_T, WIN.w, 1);
  ctx.fillRect(GUT.x + GUT.w, TITLE_B, 1, STATUS_T - TITLE_B);
  ctx.fillRect(PANEL.x - 10, TITLE_B, 1, STATUS_T - TITLE_B);
  const edge = 0.5 + 0.5 * audioAt(AUDIO_RMS, t);
  ctx.strokeStyle = mix(C.edge, "#3a3f46", edge); ctx.lineWidth = 2;
  ctx.strokeRect(WIN.x - 1, WIN.y - 1, WIN.w + 2, WIN.h + 2);
  // title
  if (rv.title > 0) {
    ctx.globalAlpha = rv.title;
    mono(ctx, "song.txt", WIN.x + 30, WIN.y + 39, 24, C.uiHi);
    ctx.globalAlpha = 1;
  }
  const ca = controlsAlpha(t, pg.mode) * rv.title;
  if (ca > 0) {
    ctx.globalAlpha = ca;
    const pressed = pg.mode !== "F" && t >= TL.click && t < TL.click + 0.22;
    const bx = 1648, by = WIN.y + 12, bw = 128, bh = 36;
    ctx.fillStyle = pressed ? "#2b2e33" : "#1b1d21"; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = pressed ? C.ui : C.edge; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = C.fail; ctx.fillRect(bx + 18, by + 11, 14, 14);
    mono(ctx, "stop", bx + 46, by + 26, 21, C.uiHi);
    // close
    ctx.strokeStyle = C.ui; ctx.lineWidth = 2.5;
    const cx = 1816, cy = WIN.y + 30;
    ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawPointer(ctx, t, mode) {
  if (mode === "F" || t < 99.0 || t > 103.9) return;
  const p = outCubic(span(t, 99.0, 100.3));
  const x = lerp(1180, 1716, p), y = lerp(640, 70, p);
  const a = 1 - span(t, 103.3, 103.9);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(19, 34); ctx.lineTo(13, 21); ctx.lineTo(23, 21); ctx.closePath();
  ctx.fillStyle = C.uiHi; ctx.fill();
  ctx.strokeStyle = C.void; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// v3: the only difference between his line and the prediction
function drawDiffNote(ctx, t, doc) {
  for (const s of doc.states) {
    const L = s.L;
    if (!L.predW || !s.act || L.bloomAt === null || t < L.done || L.who !== "h") continue;
    const pred = L.predW.join(" "), typed = L.hw.map(w => w.s).join(" ");
    if (pred === typed) continue;
    const a = span(t, L.done, L.done + 0.25);
    const e = doc.cur.get(L);
    const y = e.y + e.lay.h + 26;
    ctx.globalAlpha = a;
    const x = DOC.x;
    const f = monoFont(26);
    [["-", pred, C.del], ["+", typed, C.add]].forEach(([m, s2, bg], r) => {
      const yy = y + r * 40;
      ctx.fillStyle = rgba(bg, 0.55); ctx.fillRect(x - 22, yy, measure(ctx, f, m + " " + s2) + 44, 36);
      mono(ctx, m + " " + s2, x, yy + 27, 26, C.uiHi);
      const wPre = measure(ctx, f, m + " " + s2.slice(0, -1));
      ctx.strokeStyle = C.uiHi; ctx.lineWidth = 2;
      ctx.strokeRect(x + wPre - 2, yy + 3, measure(ctx, f, s2.slice(-1)) + 4, 30);
    });
    ctx.globalAlpha = 1;
  }
}

function drawCaret(ctx, t, doc, pg) {
  if (pg.mode !== "F" && t >= TL.running) return;
  let c = doc.caret;
  if (!c) {
    if (doc.act >= 0) return;
    c = { x: DOC.x, y: Y_ACT + BIG * 0.92, S: BIG };
  }
  const typing = doc.act >= 0 && (() => {
    const L = pg.lines[doc.act];
    return L.hw.some(w => t >= w.t && t < w.t + 0.4);
  })();
  const on = typing || beatFrac(t) < 0.55;
  if (!on) return;
  ctx.fillStyle = rgba(C.ink, smooth(span(t, 2.55, 3.05)));
  ctx.fillRect(c.x + 6, c.y - c.S * 0.78, Math.max(3, c.S * 0.05), c.S * 0.95);
}

// ---------------------------------------------------------------- frame

// the window assembles itself over the intro, element by element on the beat
function reveal(t) {
  const at = a => smooth(span(t, a, a + 0.5));
  return {
    frame: at(0.2), title: at(1.26), gutter: at(2.55), history: at(3.83), run: at(5.12),
    status: [at(6.4), at(7.04), at(7.68), at(8.33), at(6.4)],
  };
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.shadowBlur = 0; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  const rv = reveal(t);
  const pg = page(t);

  ctx.globalAlpha = rv.frame;
  drawChrome(ctx, t, pg, rv);
  ctx.globalAlpha = 1;

  const doc = drawDocument(ctx, t, pg, {});
  // the wall covers everything written so far; his line stays on top of it
  if (pg.mode === "A" && t >= TL.wallStart) {
    drawWall(ctx, t);
    const L = pg.lines[doc.act];
    if (L && L.ts >= TL.wallStart) {
      const e = doc.cur.get(L);
      const k = outCubic((t - L.ts) / 0.32);
      ctx.fillStyle = rgba(C.doc, 0.94 * k);
      ctx.fillRect(DOC.x - 22, e.y - 14, DOC.w + 40, e.lay.h + 26);
      const st = lineState(L, t, 0.4, pg.mode);
      doc.caret = drawLine(ctx, L, t, { lay: e.lay, x0: DOC.x, y0: e.y, alpha: k, past: false, grade: st.grade, flash: false });
    }
  }
  ctx.globalAlpha = rv.gutter;
  drawGutter(ctx, t, doc, pg);
  ctx.globalAlpha = 1;
  drawDiffNote(ctx, t, doc);
  drawSweep(ctx, t);
  drawCommitBox(ctx, t);
  drawCaret(ctx, t, doc, pg);

  drawHistory(ctx, t, pg.mode, rv.history);
  drawRunLog(ctx, t, pg.mode, rv.run);
  drawStatus(ctx, t, pg, rv.status);
  drawPointer(ctx, t, pg.mode);

  // vignette
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.55, 0, 0, H * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
  const out = span(t, SCENE_END - 0.9, SCENE_END - 0.1);
  if (out > 0) { ctx.fillStyle = rgba(C.void, out); ctx.fillRect(0, 0, W, H); }
}
