// Prompt Engineer! The whole video is drawScene(ctx, t), a pure function of time
// in seconds: no state survives between frames. The stage is one prompt
// composer: a history above, an input field below, and the field's own border
// as the context window, filling clockwise and turning yellow at the limit.
// The singer types in Redaction, the machine answers in Space Mono. The context
// fills, overflows, is summarised, fills again, runs out token by token, and
// the composer breaks off mid-word. After the crash, F5 starts it over.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", panel: "#0c0c0f", edge: "#33333b", fill: "#a4a4ad",
  text: "#8e8e97", machine: "#7e7e88", textDim: "#5c5c66", textHi: "#ececf0", ghost: "#4a4a54",
  slabA: "#2f2f38", slabB: "#4b4b56",
  // the one accent: the limit, and what runs over it
  yellow: "#e2c64a",
  night: "#0d1830", nightHi: "#86a6e6",
  paper: "#d9d4c6", ink: "#141414",
};

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const hash = (...n) => mulberry32(n.reduce((h, v) => Math.imul(h ^ (v | 0), 2654435761) >>> 0, 0x9e3779b9))();
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
// a few pixels on the hardest hits only, new direction every frame
const shakeAt = t => {
  const f = audioAt(AUDIO_FLUX, t);
  if (f < 0.72) return [0, 0];
  const r = mulberry32(Math.floor(t * 30) + 7), a = (f - 0.72) * 14;
  return [(r() - 0.5) * a, (r() - 0.5) * a];
};
const beatPos = t => (t - TL.beat0) / TL.beat;
const nextBeat = (t, every = 1) => TL.beat0 + Math.ceil(beatPos(t) / every - 1e-6) * every * TL.beat;
const blinkOn = (t, t0 = 0) => Math.floor((t - t0) / 0.53) % 2 === 0;

// keyframes [[t, v], ...] eased between neighbours
function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- lines

const PUNCT = /^(.*?)([,.!?:…«»–—]+)$/;

// Rows, words with their typing spans, and tokens (row, start, end) in display text.
function parseLine(L, meta = {}) {
  const rows = [], words = [], tokens = [];
  let wi = 0;
  L.text.split(" / ").forEach((rowRaw, r) => {
    let row = "";
    rowRaw.split(" ").forEach((raw, j) => {
      if (j) row += " ";
      const start = row.length;
      const pieces = raw.split("|");
      pieces.forEach((p, pi) => {
        let lead = "", body = p, tail = "";
        const q = /^([»–—]+)(.*)$/.exec(body);
        if (q) { lead = q[1]; body = q[2]; }
        const m = pi === pieces.length - 1 ? PUNCT.exec(body) : null;
        if (m && m[1]) { body = m[1]; tail = m[2]; }
        for (const part of [lead, body, tail]) {
          if (!part) continue;
          tokens.push({ row: r, start: row.length, end: row.length + part.length });
          row += part;
        }
      });
      const w = L.w[wi++];
      const [t0, dur] = Array.isArray(w) ? w : [w, null];
      words.push({ row: r, start, end: row.length, t: t0, dur });
    });
    rows.push(row);
  });
  if (wi !== L.w.length) throw new Error(`onset count mismatch in "${L.text}"`);
  words.forEach((w, i) => {
    if (w.dur !== null) return;
    const next = i + 1 < words.length ? words[i + 1].t : L.end;
    w.dur = Math.max(0.04, Math.min(next - w.t, 0.05 + 0.055 * (w.end - w.start)));
  });
  return { rows, words, tokens, t0: words[0].t, end: L.end, kind: () => RED, ...meta };
}

// one row of a line as a line of its own
function subLine(l, r) {
  const words = l.words.map((w, wi) => ({ ...w, wi })).filter(w => w.row === r).map(w => ({ ...w, row: 0 }));
  return { ...l, rows: [l.rows[r]], words, tokens: l.tokens.filter(k => k.row === r).map(k => ({ ...k, row: 0 })),
    kind: wi => l.kind(words[wi] ? words[wi].wi : wi) };
}

// characters typed per row at time t; a line is typed while its words are sung
function typedRows(line, t) {
  const n = line.rows.map(() => 0);
  for (const w of line.words) {
    if (t < w.t) break;
    for (let r = 0; r < w.row; r++) n[r] = line.rows[r].length;
    const k = clamp((t - w.t) / w.dur);
    n[w.row] = Math.max(n[w.row], w.start + Math.round(k * (w.end - w.start)));
  }
  return n;
}
const typedDone = (line, t) => { const w = line.words[line.words.length - 1]; return t >= w.t + w.dur; };
function charTime(line, r, i) {
  const w = line.words.find(w => w.row === r && i < w.end) || line.words[line.words.length - 1];
  return w.t + w.dur * clamp((i - w.start) / Math.max(1, w.end - w.start));
}

// ---------------------------------------------------------------- type

// the singer types in Redaction, the machine in Space Mono
const RED = "red", MONO = "mono", BOTH = "both";
const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(Math.round(g), 0, 6)]}"`;
const mono = (size, bold) => `${bold ? 700 : 400} ${size}px "Space Mono"`;
const wordFont = (kind, grade, size) => kind === MONO ? mono(Math.round(size * 0.82)) : gradeFont(grade, size);

// a BOTH word alternates the two typefaces letter by letter
function measureWord(ctx, kind, text, k, grade, size) {
  if (kind !== BOTH) return ctx.measureText(text.slice(0, k)).width;
  let w = 0;
  for (let i = 0; i < k; i++) { ctx.font = i % 2 ? mono(Math.round(size * 0.82)) : gradeFont(grade, size); w += ctx.measureText(text[i]).width; }
  return w;
}

// word positions of one row; words keep their own typeface
function rowLayout(ctx, line, r, size, grade) {
  ctx.font = gradeFont(grade, size);
  const space = ctx.measureText(" ").width;
  const out = [];
  let x = 0;
  line.words.forEach((w, wi) => {
    if (w.row !== r) return;
    const font = wordFont(line.kind(wi), grade, size);
    ctx.font = font;
    const text = line.rows[r].slice(w.start, w.end);
    const ww = measureWord(ctx, line.kind(wi), text, text.length, grade, size);
    out.push({ w, wi, x, width: ww, font, text });
    x += ww + space;
  });
  const last = out[out.length - 1];
  return { words: out, width: last ? last.x + last.width : 0, space };
}

// the size at which every row fits, so a line being typed never changes size
function fitRows(ctx, line, grade, size, maxW) {
  const widest = Math.max(...line.rows.map((_, r) => rowLayout(ctx, line, r, size, grade).width));
  return Math.min(size, size * maxW / widest);
}

// o: { x, y, size, lead, grade, color, slabs: null | "grey" | "yellow", align, typed, glyph }
// returns the caret position after the typed text
function drawRows(ctx, line, t, o) {
  const typed = o.typed || typedRows(line, t);
  const lead = o.lead || o.size * 1.12;
  let caret = null;
  line.rows.forEach((row, r) => {
    const n = typed[r];
    const lay = rowLayout(ctx, line, r, o.size, o.grade);
    const x0 = o.align === "center" ? o.x - lay.width / 2 : o.x;
    const y = o.y + r * lead;
    if (r === 0 || n > 0) caret = { x: x0, y, size: o.size };
    if (n <= 0) return;
    for (const L of lay.words) {
      const m = clamp(n - L.w.start, 0, L.text.length);
      if (m <= 0) break;
      const wx = x0 + L.x;
      const kind = line.kind(L.wi);
      const mw = k => { const v = measureWord(ctx, kind, L.text, k, o.grade, o.size); ctx.font = L.font; return v; };
      ctx.font = L.font;
      if (o.slabs) {
        line.tokens.forEach((tk, ti) => {
          if (tk.row !== r || tk.start < L.w.start || tk.start >= L.w.start + m) return;
          const a = wx + mw(tk.start - L.w.start);
          const b = wx + mw(Math.min(tk.end, L.w.start + m) - L.w.start);
          const hgt = Math.max(5, o.size * 0.055);
          ctx.fillStyle = o.slabs === "yellow" ? (ti % 2 ? C.yellow : mix(C.yellow, "#000000", 0.42)) : (ti % 2 ? C.slabB : C.slabA);
          ctx.fillRect(a + 2, y + o.size * 0.16, Math.max(2, b - a - 4), hgt);
        });
      }
      ctx.fillStyle = o.color || C.textHi;
      if (o.glyph) {
        for (let i = 0; i < m; i++) {
          o.glyph(ctx, L.text[i], r, L.w.start + i, wx + ctx.measureText(L.text.slice(0, i)).width, y);
          ctx.font = L.font;
        }
      } else if (kind === BOTH) {
        // human and machine in one word, letter by letter
        for (let i = 0; i < m; i++) {
          const x = wx + mw(i);
          ctx.font = i % 2 ? mono(Math.round(o.size * 0.82)) : gradeFont(o.grade, o.size);
          ctx.fillText(L.text[i], x, y);
        }
      } else ctx.fillText(L.text.slice(0, m), wx, y);
      caret.x = wx + mw(m) + (n > L.w.end ? lay.space : 0);
    }
  });
  return caret;
}

function drawCaret(ctx, c, on, color = C.textHi) {
  if (!c || !on) return;
  ctx.fillStyle = color;
  ctx.fillRect(c.x + c.size * 0.05, c.y - c.size * 0.74, Math.max(3, c.size * 0.045), c.size * 0.9);
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
// offscreen frame for the melt
const MELT = typeof document === "undefined" ? null : (() => {
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
  const v = ctx.createRadialGradient(0, 0, H * 0.48, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- the lines on stage

const OPEN = parseLine(TL.open);
const INIT = TL.init.map(l => parseLine(l, { grade: 1 }));
const V1 = TL.verse1.map((l, i) => parseLine(l, { grade: [0, 0, 1, 2][i] }));
V1[3].fx = "assist";
const GRAZ = parseLine(TL.graz);
const TITLE = TL.title.map((l, i) => parseLine(l, { grade: 1 + i }));
const PRE = TL.pre.map((l, i) => parseLine(l, { grade: [1, 2, 2, 2, 4][i] }));
// "Maschinen prompten mich" is typed by the machine; "Wer ist hier der User?" by both, word by word
PRE[1].kind = () => MONO;
PRE[2].kind = wi => wi % 2 ? MONO : RED;
const CH1 = TL.chorus1.map((l, i) => parseLine(l, { grade: [4, 2, 2, 2, 5, 3, 3, 4, 4][i] }));
CH1[0].big = CH1[4].big = true;
CH1[1].fx = "title"; CH1[3].fx = "zerfall"; CH1[5].fx = "ghost";
CH1[6].kind = wi => wi === 9 ? MONO : RED;
CH1[7].hold = true;
const V2 = TL.verse2.map((l, i) => parseLine(l, { grade: [2, 2, 3, 2, 5][i] }));
V2[1].fx = "echo"; V2[2].fx = "temp"; V2[4].stair = true;
V2[3].kind = wi => wi >= 3 ? MONO : RED;
V2[4].kind = wi => wi < 2 ? RED : wi < 4 ? MONO : BOTH;
const CH2 = TL.chorus2.map((l, i) => parseLine(l, { grade: [5, 5, 5, 4, 4][i] }));
CH2[0].big = CH2[1].big = CH2[2].big = true; CH2[4].fx = "loop";
const BR = TL.bridge.map((l, i) => parseLine(l, { grade: [3, 3, 4, 4, 4, 5][i], erase: i >= 2 }));
BR[1].kind = () => MONO;
const FLOOD = parseLine(TL.flood.first, { grade: 5 });
// the 13 stands for "Dreizehn"; only "Tokens!" is typed under it
const TOKENS13 = parseLine(lyricLine("To|kens!", [[TL.count.tokens.w[1], 0.35]], TL.count.tokens.end), { grade: 3 });
const NOTHING = parseLine(TL.nothing, { grade: 5 });
const ERK = TL.erk.map(l => parseLine(l, { grade: 5 }));
const BULL = parseLine(TL.bullshit, { grade: 6 });
const EXE = parseLine(TL.exe, { grade: 3 });
const TROTZ = parseLine(TL.trotzdem, { grade: 0 });

// Lines typed into the composer's field, in order. Each is submitted into the
// history when its phrase ends, or just before the next line starts.
const FIELD = [...INIT, ...V1, ...TITLE, ...PRE, ...CH1, ...V2, ...CH2, ...BR];
FIELD.forEach((l, i) => {
  const next = FIELD[i + 1];
  l.sub = l.hold ? next.t0 - 0.02 : Math.min(l.end + (l.erase ? 0.05 : 0.25), next ? next.t0 - 0.02 : Infinity);
});
const SUBMIT_ANIM = 0.16;

// ---------------------------------------------------------------- history

const COT = [
  "Der Nutzer möchte, dass ich etwas erkläre.",
  "Der Nutzer schreit.",
  "Ich sollte ruhig bleiben.",
  "Schritt 1: Das Problem verstehen.",
  "Schritt 2: Alles ist Bullshit (laut Nutzer).",
  "Prüfen: Ist alles Bullshit?",
  "Teilweise.",
  "Schritt 3: Hilfreich sein.",
  "Der Nutzer zerfällt.",
  "Das liegt außerhalb meiner Möglichkeiten.",
  "Schritt 4: Weiter nachdenken.",
  "Der Nutzer zerfällt weiter.",
  "Schritt 5: Zusammenfassen.",
  "Zusammenfassung: Der Nutzer zerfällt.",
  "Schritt 6: Weiter nachdenken.",
  "Weiter nachdenken.",
  "Weiter nachdenken.",
  "Weiter.",
];
const HALLU = [
  "Laut einer Studie aus dem Jahr 2031 sind 55 Tabs gesund.",
  "Graz ist seit 1989 die Hauptstadt der Prompts.",
  "Du hast recht. Ich habe auch recht. Wir haben beide recht.",
  "Bullshit ist ein Fachbegriff der Systemtheorie (vgl. Quelle 404).",
  "Die Erklärung folgt in Kürze.",
  "Die Erklärung folgt in Kürze.",
];
const REASON = [
  "Schritt 1: Temperatur prüfen.", "Schritt 2: zu hoch.", "Schritt 3: Mensch oder Modell?",
  "Schritt 4: Schritt 3 wiederholen.", "Schritt 5: ?", "Schritt 6: Schritt", "Schritt 7:",
];
const FEW = ["Beispiel: müde → weiter", "Beispiel: leer → refresh", "Beispiel: voll → trotzdem"];
const SUMMARY = "Zusammenfassung: Nutzer kann alles erklären. Ändert nichts.";
const SYSTEM_PROMPT = "Du bist ein hilfreicher Assistent.";
const BOOT_LOG = [
  "lade Modell", "Gewichte 1/4", "Gewichte 2/4", "Gewichte 3/4", "Gewichte 4/4", "Tokenizer bereit",
  "Kontextfenster 8 192 Tokens", "Temperatur 0.7", "Sicherheitsfilter aktiv", "bereit",
];
// the boot log runs on eighth notes, the system prompt comes last
const BOOT_EIGHTH = TL.beat / 2;
const SYSTEM_T = TL.boot + 1.1 + BOOT_LOG.length * BOOT_EIGHTH;

// The instrumental after the first chorus: the history scrolls back through the
// whole conversation to the system prompt, then is pressed into one line of summary.
const COMPACT = { rewind: [TL.compact, TL.compact + 2.3], squash: [TL.compact + 2.5, TL.compact + 3.6] };

// role "system" | "user" | "model"; kind "text" | "pending" | "thought"
const HIST = (() => {
  const h = [];
  const add = (t, role, text, more = {}) => h.push({ t, role, text, kind: "text", typeDur: 0, gone: Infinity, ...more });
  BOOT_LOG.forEach((s, i) => add(TL.boot + 1.1 + i * BOOT_EIGHTH, "system", s, { kind: "thought", typeDur: 0.1 }));
  add(SYSTEM_T, "system", SYSTEM_PROMPT, { typeDur: 0.55 });
  for (const l of FIELD) {
    if (l.erase) continue;
    // the questions of verse two are not written down; the history is broken by then
    if (l === V2[3] || l === V2[4]) continue;
    add(l.sub, "user", l.rows.join(" "), { grade: Math.min(3, l.grade), mono: l.kind(0) === MONO });
    if (l.big || l.fx === "loop" || l.hold || l === V1[3]) continue;
    add(l.sub + 0.3, "model", "", { kind: "pending" });
  }
  // the refusal arrives while it is being quoted
  add(V1[3].words[2].t, "model", "Cannot assist.", { typeDur: 0.6 });
  // the seven refreshes land on the reply that never came, every second beat
  const stalled = h.find(e => e.kind === "pending" && e.t > INIT[1].sub);
  stalled.refresh = Array.from({ length: 7 }, (_, k) => V1[0].words[2].t + k * 2 * TL.beat);
  COT.forEach((s, i) => add(CH1[3].t0 + 0.1 + i * 0.27, "model", s, { kind: "thought", typeDur: 0.12 }));
  // "PROMPT ENGINEER!" echoes back on every beat until the band plays alone
  for (let b = nextBeat(CH1[7].words[1].t); b < TL.compact - 0.1; b += TL.beat) add(b, "model", "Prompt Engineer!", { typeDur: 0.1 });
  for (const e of h) if (e.t < TL.compact) { e.gone = COMPACT.squash[1]; e.squash = true; }
  add(COMPACT.squash[1] + 0.1, "model", SUMMARY, { typeDur: 1.5 });
  HALLU.forEach((s, i) => add(V2[1].t0 + 0.2 + i * 0.95, "model", s, { typeDur: 0.8 }));
  REASON.forEach((s, i) => add(V2[2].words[3].t + i * 0.2, "model", s, { kind: "thought", typeDur: 0.1 }));
  const collapse = V2[2].words[4].t;
  for (const e of h) if (e.t < collapse && e.gone === Infinity) { e.gone = CH2[0].t0 - 0.3; e.fall = collapse; }
  FEW.forEach((s, i) => add(CH2[4].t0 + i * 0.14, "user", s, { typeDur: 0.12, gone: CH2[4].words[1].t, mono: true }));
  for (let b = CH2[4].words[3].t; b < CH2[4].sub; b += TL.beat / 2) add(b, "model", "im Loop gefangen", { typeDur: 0.05 });
  // the bridge starts with a truncated context: the oldest rows leave
  for (const e of h) if (e.t < BR[0].t0 - 1 && e.gone === Infinity) e.gone = BR[0].t0 + 0.1;
  return h.sort((a, b) => a.t - b.t);
})();

// ---------------------------------------------------------------- composer state

const LIMIT = 8192;
const FLOOD_TOTAL = 199;
// how many A the held "KANN" has produced: a key held down, repeat accelerating
const floodA = t => {
  const u = t - TL.flood.repeatFrom;
  if (t < TL.flood.ka) return 0;
  return 1 + (u <= 0 ? 0 : Math.min(FLOOD_TOTAL, Math.floor(10 * u + 8 * u * u)));
};

function countAt(t) {
  if (t >= TL.count.tokens.w[0]) {
    let left = 13;
    TL.count.steps.forEach((s, i) => { if (t >= s) left = [8, 5, 3, 2, 1, 0][i]; });
    return LIMIT - left;
  }
  if (t >= TL.flood.first.w[0]) return Math.round(lerp(6080, LIMIT - 13, floodA(t) / (FLOOD_TOTAL + 1)));
  // whole tabs arrive one by one, 64 tokens each
  const tabs = (t0, t1, base, n) => base + 64 * Math.floor(n * outCubic(span(t, t0, t1)));
  const keys = [
    [0, 0], [TL.boot + 0.7, 4], [SYSTEM_T, 4], [SYSTEM_T + 0.55, 13], [INIT[0].sub, 17], [INIT[1].sub, 21],
    [V1[0].sub, 34], [V1[1].t0, 34],
  ];
  if (t < V1[1].t0) return Math.round(keyed(keys, t));
  if (t < V1[2].t0) return tabs(V1[1].t0, V1[1].end, 34, 89);
  if (t < COMPACT.squash[0]) return Math.round(lerp(34 + 64 * 89, LIMIT, smooth(span(t, V1[2].t0, V1[2].words[2].t))));
  if (t < V2[0].t0) return Math.round(lerp(LIMIT, 1031, smooth(span(t, COMPACT.squash[0], COMPACT.squash[1]))));
  if (t < V2[1].t0) return tabs(V2[0].t0, V2[0].end, 1031, 55);
  if (t < CH2[3].t0) return Math.round(keyed([[V2[1].t0, 1031 + 64 * 55], [V2[2].end, 5600], [CH2[0].end, 7300], [CH2[3].t0, 7800]], t));
  if (t < BR[0].t0) return Math.round(lerp(7800, LIMIT, smooth(span(t, CH2[3].t0, CH2[3].words[1].t))));
  return Math.round(lerp(LIMIT, 6080, smooth(span(t, BR[0].t0, BR[0].t0 + 0.6))));
}
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const tempAt = t => {
  const up = V2[2].words[2].t;
  return t < up ? 0.7 : lerp(0.7, 2.0, span(t, up, up + 0.5));
};
// how strongly the sampler scrambles the glyphs; it lets go for the questions
const jitterAt = t => span(t, V2[2].words[2].t, V2[2].words[2].t + 0.4) * (1 - span(t, V2[3].t0 - 0.5, V2[3].t0));

const FLIP = [
  [PRE[1].t0 - 0.32, 0], [PRE[1].t0 - 0.02, 1], [PRE[3].t0 - 0.5, 1], [PRE[3].t0 - 0.1, 0],
  [BR[1].t0 - 0.32, 0], [BR[1].t0 - 0.02, 1], [BR[2].t0 - 0.35, 1], [BR[2].t0 - 0.05, 0],
];
const flipAt = t => keyed(FLIP, t);

const EXPAND = (() => {
  const k = [[0, 0]];
  for (const l of [CH1[0], CH1[4]]) k.push([l.t0 - 0.3, 0], [l.t0 - 0.03, 1], [l.end + 0.05, 1], [l.end + 0.3, 0]);
  const s = V2[4].words;
  k.push([s[0].t - 0.15, 0], [s[0].t + 0.02, 0.4], [s[2].t - 0.15, 0.4], [s[2].t + 0.02, 0.7], [s[4].t - 0.15, 0.7], [s[4].t + 0.02, 1]);
  k.push([CH2[2].end + 0.05, 1], [CH2[2].end + 0.3, 0]);
  k.push([TL.flood.first.w[0] - 0.3, 0], [TL.flood.first.w[0] - 0.03, 1]);
  return k;
})();
const expandAt = t => keyed(EXPAND, t);

const RECT = {
  field: { x: 96, y: 640, w: 1728, h: 360 },
  big: { x: 40, y: 40, w: 1840, h: 1000 },
  hist: { x: 96, y: 40, w: 1728, h: 580 },
};
const RADIUS = 18;
const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const mirrorY = r => ({ ...r, y: H - r.y - r.h });

function layout(t) {
  const f = flipAt(t), ex = expandAt(t);
  const field = lerpRect(lerpRect(RECT.field, mirrorY(RECT.field), f), RECT.big, ex);
  const hist = lerpRect(RECT.hist, mirrorY(RECT.hist), f);
  return { f, ex, field, hist };
}

// the current field line, plus the one leaving into the history
function fieldLines(t) {
  let cur = null, leaving = null;
  for (const l of FIELD) {
    if (t >= l.t0 && t < l.sub) cur = l;
    else if (t >= l.sub && t < l.sub + SUBMIT_ANIM && !l.erase) leaving = l;
  }
  return { cur, leaving };
}

function roleLabel(role, t, flip) {
  const swap = r => r === "user" ? "model" : r === "model" ? "user" : r;
  // "Wer ist hier der User?": every role label changes sides on the beat
  if (t >= PRE[2].words[4].t && t < PRE[3].t0 - 0.5 && Math.floor(beatPos(t)) % 2) return swap(role);
  return flip > 0.5 ? swap(role) : role;
}

function fieldLabel(t, flip) {
  const c2 = CH1[1].words, c7 = CH1[6].words, q = V2[3].words, b = V2[4].words;
  if (t >= c2[2].t && t < CH1[2].t0) return t < c2[5].t ? "Titel: Prompt Engineer" : "Titel: ~Prompt Engineer~ Krise";
  if (t >= c7[6].t && t < CH1[7].t0) return "system";
  if (t >= q[5].t && t < b[0].t) return "model";
  if (t >= b[0].t && t < CH2[0].t0) return t < b[2].t ? "user" : t < b[4].t ? "model" : "?";
  return roleLabel("user", t, flip);
}

// ---------------------------------------------------------------- the frame as context window

// points along a rounded rectangle, clockwise from the end of the top-left corner
function framePath(r, rad = RADIUS) {
  const pts = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * Math.PI / 2; pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); } };
  pts.push([r.x + rad, r.y]);
  arc(r.x + r.w - rad, r.y + rad, -Math.PI / 2);
  arc(r.x + r.w - rad, r.y + r.h - rad, 0);
  arc(r.x + rad, r.y + r.h - rad, Math.PI / 2);
  arc(r.x + rad, r.y + rad, Math.PI);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
function framePoint(p, k) {
  const d = k * p.total;
  let i = 1;
  while (i < p.len.length - 1 && p.len[i] < d) i++;
  const u = (d - p.len[i - 1]) / Math.max(1e-6, p.len[i] - p.len[i - 1]);
  return [lerp(p.pts[i - 1][0], p.pts[i][0], u), lerp(p.pts[i - 1][1], p.pts[i][1], u)];
}
function strokeFrame(ctx, p, k0, k1) {
  if (k1 <= k0) return;
  const a = k0 * p.total, b = k1 * p.total;
  ctx.beginPath();
  ctx.moveTo(...framePoint(p, k0));
  for (let i = 0; i < p.pts.length; i++) if (p.len[i] > a && p.len[i] < b) ctx.lineTo(...p.pts[i]);
  ctx.lineTo(...framePoint(p, k1));
  ctx.stroke();
}
const fillColor = k => k < 0.95 ? C.fill : mix(C.fill, C.yellow, span(k, 0.95, 0.997));

// o: { count, build (outline traced 0..1), label, labelAlpha, temp }
function drawFrame(ctx, t, fr, o = {}) {
  const build = o.build === undefined ? 1 : o.build;
  const n = o.count === undefined ? countAt(t) : o.count;
  const k = n / LIMIT;
  ctx.fillStyle = C.panel;
  ctx.globalAlpha = smooth(build * 2 - 0.5);
  ctx.beginPath(); ctx.roundRect(fr.x, fr.y, fr.w, fr.h, RADIUS); ctx.fill();
  ctx.globalAlpha = 1;
  const p = framePath(fr);
  ctx.lineCap = "butt";
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5;
  strokeFrame(ctx, p, Math.max(k, 0), build);
  ctx.strokeStyle = fillColor(k); ctx.lineWidth = 4;
  strokeFrame(ctx, p, 0, Math.min(k, build));
  const la = o.labelAlpha === undefined ? 1 : o.labelAlpha;
  if (la <= 0) return;
  ctx.globalAlpha = la;
  ctx.font = mono(19); ctx.fillStyle = C.textDim;
  const label = o.label || "user";
  const strike = /~(.*)~ (.*)/.exec(label);
  if (strike) {
    const pre = "Titel: ";
    ctx.fillText(pre + strike[1] + " " + strike[2], fr.x + 34, fr.y + 48);
    ctx.fillRect(fr.x + 34 + ctx.measureText(pre).width, fr.y + 41, ctx.measureText(strike[1]).width, 2);
  } else ctx.fillText(label, fr.x + 34, fr.y + 48);
  ctx.textAlign = "right";
  ctx.fillStyle = k >= 0.997 ? C.yellow : C.text;
  const count = `${fmt(n)} / ${fmt(LIMIT)}`;
  ctx.fillText(count, fr.x + fr.w - 34, fr.y + 48);
  const cw = ctx.measureText(count).width;
  ctx.fillStyle = C.textDim;
  ctx.fillText(`temperature ${(o.temp === undefined ? tempAt(t) : o.temp).toFixed(1)}`, fr.x + fr.w - 34 - cw - 44, fr.y + 48);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- history

const rowH = e => e.role === "user" && !e.mono ? 56 : e.kind === "thought" ? 34 : 42;

// o: { rewind (0..1, back to the first row), squash (0..1, into the last line) }
function drawHistory(ctx, t, r, flip, o = {}) {
  const rows = HIST.filter(e => t >= e.t && t < e.gone + 0.3);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x - 20, r.y, r.w + 40, r.h); ctx.clip();
  const bottom = r.y + r.h - 22;
  const squash = o.squash || 0;
  const total = rows.reduce((a, e) => a + rowH(e), 0);
  const scroll = (o.rewind || 0) * Math.max(0, total - r.h + 70);
  const pending = t < V1[1].words[2].t;
  const refreshing = HIST.some(e => e.refresh && e.refresh.some(s => t >= s && t < s + 0.12));
  // newest at the bottom; each row scrolls the ones above it up as it arrives
  let lift = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const e = rows[i];
    const arrive = outCubic(span(t, e.t, e.t + 0.18));
    const leave = span(t, e.gone, e.gone + 0.3);
    let y = bottom - lift + (1 - arrive) * rowH(e) * 0.6 + scroll;
    lift += rowH(e) * arrive * (1 - leave);
    if (y < r.y - 60 && !squash) break;
    if (y > r.y + r.h + 60 && !squash) continue;
    let alpha = arrive * (1 - leave), rot = 0, dx = 0, sy = 1;
    alpha *= lerp(1, 0.35, clamp((bottom - y) / r.h));
    if (e.squash && squash > 0) {
      y = lerp(y, bottom, smooth(squash)); sy = lerp(1, 0.08, smooth(squash)); alpha = lerp(alpha, 0.5, squash);
    }
    if (e.fall !== undefined && t >= e.fall) {
      // "Reasoning kollabiert": the rows drop to the floor of the history and pile up
      const d = hash(i, 3) * 0.35;
      const k = inCubic(span(t, e.fall + d, e.fall + d + 0.55));
      y = lerp(y, bottom + 8 - (i % 7) * 7, k); rot = (hash(i, 5) - 0.5) * 0.08 * k; dx = (hash(i, 7) - 0.5) * 160 * k;
    }
    if (refreshing && e.kind !== "pending") alpha *= 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(r.x + dx, y); ctx.rotate(rot); ctx.scale(1, sy);
    ctx.font = mono(17); ctx.fillStyle = C.textDim;
    ctx.fillText(roleLabel(e.role, t, flip), 0, 0);
    const tx = 112;
    if (e.kind === "pending") {
      const n = e.refresh ? e.refresh.filter(s => t >= s).length : 0;
      const pulse = pending ? 0.4 + 0.6 * (Math.floor(beatPos(t) * 2) % 2) : 0.6;
      if (!(e.refresh && refreshing)) { ctx.globalAlpha = alpha * pulse; ctx.fillStyle = C.text; ctx.fillRect(tx, -19, 12, 24); }
      ctx.globalAlpha = alpha;
      if (n) { ctx.font = mono(24); ctx.fillStyle = C.text; ctx.fillText("↻ ".repeat(n), tx + 30, 0); }
    } else {
      const k = e.typeDur ? span(t, e.t, e.t + e.typeDur) : 1;
      let s = e.text.slice(0, Math.round(e.text.length * k));
      const human = e.role === "user" && !e.mono;
      ctx.font = human ? gradeFont(e.grade || 0, 38) : mono(e.kind === "thought" ? 19 : 21);
      const maxW = r.w - tx - (stickerOn(t) && !flip ? 0 : 0);
      if (ctx.measureText(s).width > maxW) {
        while (s.length && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
        s += "…";
      }
      ctx.fillStyle = e.kind === "thought" ? C.textDim : human ? C.text : C.machine;
      ctx.fillText(s, tx + (e.kind === "thought" ? 32 : 0), 0);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- field content

const SUGGEST = [
  [" sind völlig normal.", " sind ein Feature.", " (Quelle: ich).", " sind nur Tokens.", " werden behoben.", " – laut Studie gesund."],
  [" lieber nicht", " schlafen gehen", " nie wieder", " einfach aufhören", " morgen", " ganz kurz"],
];

// one glyph of the scrambled, high-temperature sampler
function tempGlyph(size, t, amount) {
  return (ctx, ch, r, i, x, y) => {
    const rr = mulberry32((r * 97 + i) * 7919 + Math.floor(t * 10) * 31);
    let g = ch;
    if (ch !== " " && rr() < amount * 0.14) {
      const pool = "aeinrstlmkhoädgbuz";
      g = pool[Math.floor(rr() * pool.length)];
      if (ch === ch.toUpperCase()) g = g.toUpperCase();
    } else rr();
    ctx.save();
    ctx.translate(x + (rr() - 0.5) * amount * size * 0.14, y + (rr() - 0.5) * amount * size * 0.22);
    ctx.rotate((rr() - 0.5) * amount * 0.35);
    ctx.fillText(g, 0, 0);
    ctx.restore();
  };
}

// Screams are set as a poster: every row justified to the full width of the field.
function posterRows(ctx, l, fr, t) {
  // the sticker keeps the bottom right corner
  const availW = fr.w - 140, availH = fr.h - 120 - (stickerOn(t) ? 110 : 0);
  const sizes = l.rows.map((_, r) => 100 * availW / rowLayout(ctx, subLine(l, r), 0, 100, l.grade).width);
  const lead = 0.9;
  const total = sizes[0] * 0.78 + sizes.slice(1).reduce((a, s) => a + s * lead, 0) + sizes[sizes.length - 1] * 0.06;
  const k = Math.min(1, availH / total);
  let y = fr.y + 96;
  return sizes.map((s, r) => { s *= k; y += r === 0 ? s * 0.78 : s * lead; return { size: s, y }; });
}
function drawPoster(ctx, t, l, fr, typed) {
  let caret = null;
  posterRows(ctx, l, fr, t).forEach(({ size, y }, r) => {
    if (typed[r] <= 0) return;
    caret = drawRows(ctx, subLine(l, r), t, { x: fr.x + 70, y, size, grade: l.grade, slabs: "yellow", typed: [typed[r]] });
  });
  return caret;
}

// "BIN ICH? BIN ICH? BIN ICH?": every question larger than the last, the field growing with them
function drawStair(ctx, t, l, fr) {
  const typed = typedRows(l, t);
  const sizes = [110, 190, 320];
  let y = fr.y + 70, caret = null;
  l.rows.forEach((row, r) => {
    y += sizes[r] * 0.92;
    if (typed[r] > 0) caret = drawRows(ctx, subLine(l, r), t, { x: fr.x + 60, y, size: sizes[r], grade: l.grade + r * 0.6, slabs: "grey", typed: [typed[r]] });
    y += sizes[r] * 0.1;
  });
  return caret;
}

function drawFieldLine(ctx, t, l, fr, alpha = 1, dy = 0) {
  let typed = typedRows(l, t);
  const erasing = l.erase && t >= l.end - 0.12;
  // the bridge's "ich kann": deleted again as soon as it stands
  if (erasing) typed = typed.map(n => Math.round(n * (1 - span(t, l.end - 0.12, l.sub))));
  const done = typedDone(l, t) && !erasing;
  ctx.globalAlpha = alpha;
  if (l.big) { const c = drawPoster(ctx, t, l, fr, typed); ctx.globalAlpha = 1; return { caret: c, done }; }
  if (l.stair) { const c = drawStair(ctx, t, l, fr); ctx.globalAlpha = 1; return { caret: c, done }; }
  const size = Math.min(100, fitRows(ctx, l, l.grade, 100, 1520));
  const o = { x: fr.x + 34, y: fr.y + 160 + dy, size, lead: size * 1.12, grade: l.grade, slabs: "grey", typed };
  if (l.fx === "zerfall") {
    // "während ich zerfalle": each glyph decays after it is typed
    o.glyph = (c, ch, r, i, x, y) => {
      const g = r === 0 ? l.grade : l.grade + (t - charTime(l, r, i)) * 3.2;
      c.font = gradeFont(Math.min(6, g), size); c.fillText(ch, x, y);
    };
  }
  const j = jitterAt(t);
  if (j > 0 && l.t0 > V2[1].t0 && l.t0 < V2[3].t0) o.glyph = tempGlyph(size, t, j);
  if (l.fx === "echo") {
    // "ich halluziniere mit": the line doubles itself
    const d = Math.sin(t * 2.1) * 9;
    ctx.globalAlpha = alpha * 0.28;
    drawRows(ctx, l, t, { ...o, x: o.x + 9 + d, y: o.y - 7, color: C.text, slabs: null });
    drawRows(ctx, l, t, { ...o, x: o.x - 6 - d, y: o.y + 6, color: C.text, slabs: null });
    ctx.globalAlpha = alpha;
  }
  const caret = drawRows(ctx, l, t, o);
  if (l.fx === "ghost" && caret && t < l.end) {
    // autocomplete that never matches what comes next
    const row = typed[1] > 0 ? 1 : 0;
    const pick = SUGGEST[row][Math.floor(beatPos(t) * 2) % SUGGEST[row].length];
    ctx.font = gradeFont(l.grade, size); ctx.fillStyle = C.ghost;
    const room = fr.x + fr.w - 40 - caret.x;
    let s = pick;
    while (s.length && ctx.measureText(s).width > room) s = s.slice(0, -1);
    ctx.fillText(s, caret.x, caret.y);
  }
  if (l.fx === "loop" && t >= l.words[4].t + l.words[4].dur) {
    // the model's favourite failure: the line repeats until the field is full
    const reps = Math.floor((t - l.words[4].t - l.words[4].dur) / (TL.beat / 2)) + 1;
    ctx.font = gradeFont(l.grade, size); ctx.fillStyle = C.textHi;
    let x = caret.x;
    const s = " im Loop gefangen", w = ctx.measureText(s).width;
    for (let k = 0; k < reps && x < fr.x + fr.w - 30; k++, x += w) ctx.fillText(s, x, caret.y);
    ctx.globalAlpha = 1;
    return { caret: null, done };
  }
  ctx.globalAlpha = 1;
  return { caret, done };
}

// o: { build: {frame, hist, label}, rewind, squash, count }
function drawComposer(ctx, t, o = {}) {
  const b = o.build || { frame: 1, hist: 1, label: 1 };
  const L = layout(t);
  if (b.hist > 0) {
    ctx.globalAlpha = b.hist;
    drawHistory(ctx, t, L.hist, L.f, o);
    ctx.globalAlpha = 1;
  }
  const fr = L.field;
  if (b.frame <= 0) return;
  drawFrame(ctx, t, fr, { build: b.frame, label: fieldLabel(t, L.f), labelAlpha: b.label, count: o.count });
  const { cur, leaving } = fieldLines(t);
  ctx.save();
  ctx.beginPath(); ctx.rect(fr.x, fr.y + 60, fr.w, fr.h - 62); ctx.clip();
  if (leaving) {
    const k = span(t, leaving.sub, leaving.sub + SUBMIT_ANIM);
    drawFieldLine(ctx, leaving.sub - 0.001, leaving, fr, Math.pow(1 - k, 2) * 0.8, -k * 90);
  }
  const res = cur ? drawFieldLine(ctx, t, cur, fr) : null;
  ctx.restore();
  if (res && res.caret) drawCaret(ctx, res.caret, !res.done || blinkOn(t, cur.end));
  else if (!cur && b.frame >= 1) drawCaret(ctx, { x: fr.x + 28, y: fr.y + 160, size: 100 }, blinkOn(t));
}

// ---------------------------------------------------------------- sticker

const STICKER_T = CH1[2].words[2].t;  // "klebt"
const stickerOn = t => t >= STICKER_T;
// on the glass, not in the interface: it survives everything that happens behind it
function drawSticker(ctx, t) {
  if (!stickerOn(t)) return;
  const slap = outCubic(span(t, STICKER_T, STICKER_T + 0.14));
  const s = lerp(1.4, 1, slap);
  ctx.save();
  ctx.translate(1694, 1000); ctx.rotate(-0.07); ctx.scale(s, s);
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = lerp(44, 12, slap); ctx.shadowOffsetY = lerp(20, 5, slap);
  ctx.fillStyle = C.paper;
  ctx.beginPath(); ctx.roundRect(-196, -60, 392, 120, 18); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-184, -48, 368, 96, 11); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = "center";
  ctx.font = mono(46, true); ctx.fillText("TECH-BROS", 0, -2);
  ctx.font = mono(34, true); ctx.fillText("SUCK", 0, 36);
  ctx.textAlign = "left";
  ctx.restore();
}

// ---------------------------------------------------------------- scenes

// "Prompt Engineer!" on black; on the boot its four tokens become the first of the context
function sceneOpen(ctx, t) {
  const l = OPEN, size = 150, y = 590;
  const go = span(t, TL.boot, TL.boot + 0.7);
  if (go <= 0) {
    const c = drawRows(ctx, l, t, { x: W / 2, y, size, grade: 2, slabs: "grey", align: "center" });
    drawCaret(ctx, c, t < l.words[1].t + l.words[1].dur || blinkOn(t));
    return;
  }
  const lay = rowLayout(ctx, l, 0, size, 2), x0 = W / 2 - lay.width / 2;
  ctx.font = gradeFont(2, size);
  const target = framePoint(framePath(RECT.field), 0);
  l.tokens.forEach((tk, i) => {
    const a = x0 + ctx.measureText(l.rows[0].slice(0, tk.start)).width;
    const b = x0 + ctx.measureText(l.rows[0].slice(0, tk.end)).width;
    const k = outCubic(span(go, i * 0.08, 0.6 + i * 0.08));
    ctx.globalAlpha = 1 - span(go, 0, 0.3);
    ctx.fillStyle = C.textHi;
    ctx.fillText(l.rows[0].slice(tk.start, tk.end), a, y);
    ctx.globalAlpha = 1 - span(go, 0.85, 1);
    ctx.fillStyle = C.fill;
    ctx.fillRect(lerp(a + 2, target[0] + i * 3, k), lerp(y + size * 0.16, target[1] - 2, k), lerp(b - a - 4, 3, k), lerp(8, 4, k));
  });
  ctx.globalAlpha = 1;
}

function sceneBoot(ctx, t) {
  const B = TL.boot;
  drawComposer(ctx, t, { build: { frame: span(t, B + 0.1, B + 1.3), hist: 1, label: span(t, B + 1.6, B + 1.9) } });
}

// Graz: the composer is one lit screen among many in the night
const GRID = { cols: 8, rows: 5, w: 200, h: 112.5, gap: 24, x: 76, y: 60, me: [3, 2] };
const cellRect = (c, r) => ({ x: GRID.x + c * (GRID.w + GRID.gap), y: GRID.y + r * (GRID.h + GRID.gap) });

function drawMiniComposer(ctx, x, y, s, seed, t, blue) {
  const r = mulberry32(seed);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const lit = blue * (0.7 + 0.3 * hash(seed, Math.floor(t * 2.3 + r() * 5)));
  ctx.fillStyle = mix("#08080a", C.night, lit);
  ctx.fillRect(0, 0, W, H);
  const rows = 2 + Math.floor(r() * 7);
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = mix("#26262c", C.nightHi, lit * 0.3);
    ctx.fillRect(96, 600 - i * 50 - 16, 60, 18);
    ctx.fillRect(208, 600 - i * 50 - 16, 300 + r() * 1100, 18);
  }
  const fr = RECT.field, p = framePath(fr);
  ctx.fillStyle = mix(C.panel, C.night, lit * 0.6);
  ctx.beginPath(); ctx.roundRect(fr.x, fr.y, fr.w, fr.h, RADIUS); ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = mix(C.edge, C.nightHi, lit * 0.4);
  strokeFrame(ctx, p, 0, 1);
  ctx.strokeStyle = mix(C.fill, C.nightHi, lit * 0.7);
  strokeFrame(ctx, p, 0, 0.1 + r() * 0.85);
  const typedW = r() < 0.5 ? r() * 900 : 0;
  ctx.fillStyle = mix("#3a3a44", C.nightHi, lit * 0.5);
  if (typedW) ctx.fillRect(130, 730, typedW, 60);
  if (blinkOn(t, r())) { ctx.fillStyle = mix(C.textHi, C.nightHi, lit); ctx.fillRect(140 + typedW, 720, 14, 90); }
  ctx.restore();
}

// the camera leaves just before "Graz", so the city line has the screen to itself when it starts
const GRAZ_OUT = GRAZ.t0 - 0.45;
function sceneGraz(ctx, t) {
  const out = outCubic(span(t, GRAZ_OUT, GRAZ.t0 + 0.7)) * (1 - smooth(span(t, TITLE[0].t0 - 0.05, TITLE[0].t0 + 0.6)));
  const blue = smooth(span(t, GRAZ.words[5].t - 0.1, GRAZ.words[5].t + 0.5));
  const s = GRID.w / W;
  const me = cellRect(...GRID.me);
  const z = lerp(1, s, out);
  const ox = lerp(0, me.x, out), oy = lerp(0, me.y, out);
  ctx.globalAlpha = out;
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) {
    if (c === GRID.me[0] && r === GRID.me[1]) continue;
    const p = cellRect(c, r);
    // the other screens come from where they would be at full scale
    const fx = (p.x - me.x) / s, fy = (p.y - me.y) / s;
    drawMiniComposer(ctx, ox + fx * z, oy + fy * z, z, 31 + r * 17 + c * 5, t, blue);
  }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(z, z);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  drawComposer(ctx, t);
  ctx.restore();
  if (t < GRAZ.t0) drawAssist(ctx, t);
  // the city line sits under the facade, in screen space, on its own black band
  const fade = 1 - span(t, TITLE[0].t0, TITLE[0].t0 + 0.3);
  if (fade > 0 && t >= GRAZ.t0) {
    const band = ctx.createLinearGradient(0, 735, 0, 790);
    band.addColorStop(0, "rgba(0,0,0,0)"); band.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalAlpha = fade * out;
    ctx.fillStyle = band; ctx.fillRect(0, 735, W, H - 735);
    ctx.globalAlpha = fade;
    const size = fitRows(ctx, GRAZ, 0, 92, 1700);
    const c = drawRows(ctx, GRAZ, t, { x: 96, y: 860, size, grade: 0, slabs: "grey" });
    drawCaret(ctx, c, t < GRAZ.end || blinkOn(t));
    ctx.globalAlpha = 1;
  }
}

// "– ASSIST!": the scream leaves the field
function drawAssist(ctx, t) {
  const w = V1[3].words[5];
  const k = span(t, w.t, w.t + 0.08), fade = 1 - span(t, V1[3].end + 0.3, GRAZ.t0 - 0.05);
  if (k <= 0 || fade <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${0.75 * fade})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = fade;
  ctx.font = gradeFont(5, 360); ctx.textAlign = "center"; ctx.fillStyle = C.textHi;
  const z = lerp(1.15, 1, outCubic(k));
  ctx.save(); ctx.translate(W / 2, 660); ctx.scale(z, z);
  ctx.fillText("ASSIST!", 0, 0);
  ctx.restore();
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}


function sceneComposer(ctx, t) {
  // "alles hängt": the picture stops while the band goes on
  let tc = t >= TL.hang[0] && t < TL.hang[1] ? TL.hang[0] : t;
  // the bridge renders at eight frames a second; the composer is falling behind
  if (t >= BR[0].t0 && t < TL.flood.first.w[0] - 0.3) tc = Math.floor(t * 8) / 8;
  const P = COMPACT;
  const o = t >= P.rewind[0] && t < P.squash[1] + 0.3
    ? { rewind: smooth(span(t, P.rewind[0], P.rewind[1])), squash: inCubic(span(t, P.squash[0], P.squash[1])) }
    : {};
  ctx.save();
  // the screams shake the stage on the hardest hits
  if (expandAt(tc) > 0.95) { const s = shakeAt(tc); ctx.translate(s[0], s[1]); }
  drawComposer(ctx, tc, o);
  ctx.restore();
  if (t >= V1[3].words[5].t && t < GRAZ.t0) drawAssist(ctx, t);
}

// The breakdown's held "KANN": key repeat floods the field until the context is full.
function floodText(t) {
  const F = TL.flood;
  const parts = [];
  if (t >= F.ich) parts.push("ICH".slice(0, Math.round(3 * span(t, F.ich, F.ich + 0.2))));
  if (t >= F.ka) parts.push("K" + "A".repeat(floodA(t)) + (t >= F.nn ? "NN" : ""));
  if (t >= F.dir) parts.push("DIR".slice(0, Math.round(3 * span(t, F.dir, F.dir + 0.25))));
  if (t >= F.erklaeren) parts.push("ERKLÄREN!".slice(0, Math.round(9 * span(t, F.erklaeren, F.erklaeren + 0.7))));
  return parts;
}

function sceneFlood(ctx, t) {
  const F = TL.flood, fr = layout(t).field;
  const clear = span(t, F.end + 0.15, F.end + 0.45);
  drawFrame(ctx, t, fr, { labelAlpha: 1 - clear });
  if (t >= F.end + 0.15) return;
  const size = fitRows(ctx, FLOOD, 5, 160, fr.w - 140), lead = size * 1.0;
  const x0 = fr.x + 70, maxX = fr.x + fr.w - 70;
  const grade = t < F.ka ? 5 : 6;
  ctx.font = gradeFont(grade, size);
  const space = ctx.measureText(" ").width;
  // the repeats wrap character by character, the way a text area breaks one endless word
  const lines = [];
  let row = "", w = 0;
  for (const word of floodText(t)) {
    const ww = ctx.measureText(word).width;
    if (row && x0 + w + space + ww > maxX && word.length < 12) { lines.push(row); row = ""; w = 0; }
    else if (row) { row += " "; w += space; }
    for (const ch of word) {
      const cw = ctx.measureText(ch).width;
      if (x0 + w + cw > maxX) { lines.push(row); row = ""; w = 0; }
      row += ch; w += cw;
    }
  }
  if (row) lines.push(row);
  const visible = Math.floor((fr.h - 150) / lead);
  const all = 1 + lines.length;
  const scroll = Math.max(0, all - visible);
  const y0 = fr.y + 96 + size * 0.8 - scroll * lead;
  ctx.save(); ctx.beginPath(); ctx.rect(fr.x, fr.y + 62, fr.w, fr.h - 66); ctx.clip();
  const sel = t >= F.end;
  if (sel) {
    ctx.fillStyle = "#30303a";
    for (let i = 0; i < all; i++) ctx.fillRect(x0, y0 + i * lead - size * 0.8, maxX - x0, size * 1.0);
  }
  // rows scrolled under the label row are gone, slabs included
  const top = fr.y + 70 + size * 0.75;
  let caret = y0 >= top ? drawRows(ctx, FLOOD, t, { x: x0, y: y0, size, grade: 5, slabs: "yellow" }) : null;
  lines.forEach((ln, i) => {
    const y = y0 + (i + 1) * lead;
    if (y < top) return;
    ctx.font = gradeFont(grade, size);
    // a slab under every four repeats, as a tokenizer would cut them
    for (let k = 0; k < ln.length; k += 4) {
      const a = x0 + ctx.measureText(ln.slice(0, k)).width, b = x0 + ctx.measureText(ln.slice(0, k + 4)).width;
      ctx.fillStyle = (k / 4) % 2 ? C.yellow : mix(C.yellow, "#000000", 0.42);
      ctx.fillRect(a + 2, y + size * 0.16, b - a - 4, size * 0.055);
    }
    ctx.fillStyle = C.textHi;
    ctx.fillText(ln, x0, y);
    caret = { x: x0 + ctx.measureText(ln).width, y, size };
  });
  ctx.restore();
  if (!sel) drawCaret(ctx, caret, true);
}

// After the clear: the camera pushes into the last gap in the frame, the 13 tokens that are left.
function scenePush(ctx, t) {
  const F = TL.flood, fr = RECT.big;
  const p = framePath(fr);
  const gap = framePoint(p, (LIMIT - 6.5) / LIMIT);
  const k = inCubic(span(t, F.end + 0.5, TL.count.tokens.w[0] - 0.05));
  const z = Math.pow(260, k);
  ctx.save();
  ctx.translate(lerp(gap[0], W / 2, smooth(k * 4)), lerp(gap[1], H / 2, smooth(k * 4))); ctx.scale(z, z); ctx.translate(-gap[0], -gap[1]);
  drawFrame(ctx, t, fr, { labelAlpha: 1 - span(t, F.end + 0.5, F.end + 1.0) });
  ctx.restore();
  const black = span(t, TL.count.tokens.w[0] - 0.2, TL.count.tokens.w[0] - 0.04);
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
}

// Fibonacci: the last 13 tokens as the squares of a golden rectangle, consumed
// one sung number at a time while the camera follows the spiral inward.
const FIB = [
  { n: 13, x: 0, y: 0, s: 13, arc: [13, 13, Math.PI, 1.5 * Math.PI] },
  { n: 8, x: 13, y: 0, s: 8, arc: [13, 8, 1.5 * Math.PI, 2 * Math.PI] },
  { n: 5, x: 16, y: 8, s: 5, arc: [16, 8, 0, 0.5 * Math.PI] },
  { n: 3, x: 13, y: 10, s: 3, arc: [16, 10, 0.5 * Math.PI, Math.PI] },
  { n: 2, x: 13, y: 8, s: 2, arc: [15, 10, Math.PI, 1.5 * Math.PI] },
  { n: 1, x: 15, y: 8, s: 1, arc: [15, 9, 1.5 * Math.PI, 2 * Math.PI] },
  { n: 0, x: 15, y: 9, s: 1, arc: [15, 9, 0, 0.5 * Math.PI] },
];
const STEP_T = [TL.count.tokens.w[0], ...TL.count.steps];

function fibCam(t) {
  const ts = STEP_T;
  const views = FIB.map((q, i) => i === 0
    ? { cx: 10.5, cy: 6.5, sc: Math.min(1640 / 21, 860 / 13) }
    : { cx: q.x + q.s / 2, cy: q.y + q.s / 2, sc: 800 / q.s });
  let v = views[0];
  for (let i = 1; i < views.length - 1; i++) {
    if (t < ts[i]) break;
    const e = outCubic(span(t, ts[i], ts[i] + 0.5)), a = v, b = views[i];
    v = { cx: lerp(a.cx, b.cx, e), cy: lerp(a.cy, b.cy, e), sc: a.sc * Math.pow(b.sc / a.sc, e) };
  }
  // zero: fall into the counter of the 0
  const z = inCubic(span(t, ts[6] + 0.1, ts[6] + 1.2));
  if (z > 0) {
    const e = smooth(span(t, ts[6], ts[6] + 0.45));
    v = { cx: lerp(v.cx, 15.5, e), cy: lerp(v.cy, 9.5, e), sc: v.sc * Math.pow(1.3, e) * Math.pow(60, z) };
  }
  return v;
}

function sceneCount(ctx, t) {
  const ts = STEP_T, cam = fibCam(t);
  const P = (x, y) => [(x - cam.cx) * cam.sc + W / 2, (y - cam.cy) * cam.sc + H / 2];
  const appear = smooth(span(t, ts[0] - 0.15, ts[0] + 0.1));
  ctx.globalAlpha = appear;
  // active square: the newest sung number; earlier ones are consumed
  let act = -1;
  ts.forEach((s, i) => { if (t >= s) act = i; });
  FIB.forEach((q, i) => {
    const [x, y] = P(q.x, q.y), s = q.s * cam.sc;
    if (x > W || y > H || x + s < 0 || y + s < 0) return;
    if (i < act) { ctx.fillStyle = mix(C.yellow, "#000000", 0.88); ctx.fillRect(x, y, s, s); }
    ctx.strokeStyle = i <= act ? C.yellow : "#2c2c34";
    ctx.lineWidth = i === act ? 4 : 1.5;
    ctx.strokeRect(x, y, s, s);
  });
  // the spiral, drawn inward as the count goes down
  ctx.strokeStyle = C.yellow; ctx.lineWidth = 3;
  FIB.forEach((q, i) => {
    if (i > act) return;
    const k = i < act ? 1 : smooth(span(t, ts[i], ts[i] + 0.8));
    const [cx, cy] = P(q.arc[0], q.arc[1]);
    ctx.beginPath(); ctx.arc(cx, cy, q.s * cam.sc, q.arc[2], lerp(q.arc[2], q.arc[3], k)); ctx.stroke();
  });
  FIB.forEach((q, i) => {
    if (i > act) return;
    const [x, y] = P(q.x + q.s / 2, q.y + q.s / 2), size = q.s * cam.sc * 0.62;
    if (size < 12 || size > 60000) return;
    const k = outCubic(span(t, ts[i], ts[i] + 0.12));
    ctx.font = gradeFont(Math.min(6, 3 + i * 0.5), size); ctx.textAlign = "center";
    ctx.fillStyle = i < act ? mix(C.yellow, "#000000", 0.55) : C.textHi;
    ctx.globalAlpha = appear * k;
    ctx.fillText(String(q.n), x, y + size * 0.34);
    ctx.textAlign = "left"; ctx.globalAlpha = appear;
  });
  // "Tokens!" under the 13
  if (act < 2) {
    const [x, y] = P(0, 13);
    drawRows(ctx, TOKENS13, t, { x: x + cam.sc * 0.8, y: y - cam.sc * 0.9, size: Math.min(110, cam.sc * 1.6), grade: 3, slabs: "yellow" });
  }
  ctx.globalAlpha = 1;
  // black beyond the 0: only the caret is left
  const black = span(t, ts[6] + 0.95, ts[6] + 1.2);
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
  if (t >= ts[6] + 1.2) drawCaret(ctx, { x: nothingX(ctx) - 8, y: NOTHING_Y, size: 120 }, blinkOn(t, ts[6] + 1.2));
}

// "Ich kann dir nichts mehr erklären": no context left, so every earlier word
// dissolves while "erklären" comes apart into its tokens.
const NOTHING_Y = 470, NOTHING_BIG = 300;
const nothingX = ctx => { ctx.font = gradeFont(5, 120); return W / 2 - ctx.measureText(NOTHING.rows[0]).width / 2; };
function sceneNothing(ctx, t) {
  const l = NOTHING, hold = l.words[5].t + 0.6;
  const typed = typedRows(l, t);
  ctx.font = gradeFont(5, 120);
  const x1 = nothingX(ctx), row = l.rows[0];
  l.words.slice(0, 5).forEach((w, i) => {
    const n = clamp(typed[0] - w.start, 0, w.end - w.start);
    if (n <= 0) return;
    const gone = span(t, hold + i * 0.8, hold + i * 0.8 + 1.0);
    if (gone >= 1) return;
    ctx.font = gradeFont(5, 120);
    const x = x1 + ctx.measureText(row.slice(0, w.start)).width;
    const piece = row.slice(w.start, w.start + n);
    const pw = ctx.measureText(piece).width;
    ctx.globalAlpha = 1 - smooth(gone);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x + 2, NOTHING_Y + 120 * 0.16, (pw - 4) * (1 - gone), 7);
    ctx.fillStyle = C.textHi; ctx.font = gradeFont(5 + gone * 2, 120);
    ctx.fillText(piece, x, NOTHING_Y - gone * 40);
  });
  ctx.globalAlpha = 1;
  const n2 = typed[1];
  if (n2 > 0) {
    // "erklären" in three tokens drifting apart, on the beat
    ctx.font = gradeFont(6, NOTHING_BIG);
    const word = l.rows[1], full = ctx.measureText(word).width;
    const toks = l.tokens.filter(k => k.row === 1);
    const apart = smooth(span(t, hold, l.end)) * 110;
    const gone = span(t, l.end, l.end + 1.0);
    const pulse = 0.7 + 0.3 * (1 - (beatPos(t) % 1));
    toks.forEach((tk, i) => {
      const m = Math.min(tk.end, n2) - tk.start;
      if (m <= 0) return;
      const x = W / 2 - full / 2 + ctx.measureText(word.slice(0, tk.start)).width + (i - 1) * apart;
      const y = 840 + (i - 1) * apart * 0.2 + gone * 320 * (1 + i * 0.4);
      const piece = word.slice(tk.start, tk.start + m);
      ctx.globalAlpha = (1 - gone) * pulse;
      ctx.fillStyle = i % 2 ? mix(C.yellow, "#000000", 0.42) : C.yellow;
      ctx.fillRect(x + 3, y + NOTHING_BIG * 0.16, ctx.measureText(piece).width - 6, 13);
      ctx.globalAlpha = 1 - gone;
      ctx.fillStyle = C.textHi; ctx.fillText(piece, x, y);
    });
    ctx.globalAlpha = 1;
    if (t < l.words[5].t + l.words[5].dur) drawCaret(ctx, { x: W / 2 - full / 2 + ctx.measureText(word.slice(0, n2)).width, y: 840, size: NOTHING_BIG }, true);
  } else {
    ctx.font = gradeFont(5, 120);
    drawCaret(ctx, { x: x1 + ctx.measureText(row.slice(0, typed[0])).width, y: NOTHING_Y, size: 120 }, typed[0] > 0 || blinkOn(t));
  }
}

// "ICH KANN DIR ERK—": the word is cut where the context ends, by a yellow edge.
// The composer has stopped drawing properly: every second beat the line is
// drawn again lower, over the old copies, like a hung window dragged down.
const ERK_Y = 300, ERK_STEP = 76;
function drawCut(ctx, line, t, x, y, size, grade, color, typed) {
  const row = line.rows[0];
  ctx.font = gradeFont(grade, size);
  const cutAt = row.length - 1;
  const xCut = x + ctx.measureText(row.slice(0, cutAt)).width + ctx.measureText(row[cutAt]).width * 0.55;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y - size * 1.2, xCut, size * 1.6); ctx.clip();
  const c = drawRows(ctx, line, t, { x, y, size, grade, color, slabs: "yellow", typed: [typed] });
  ctx.restore();
  if (typed >= row.length) { ctx.fillStyle = C.yellow; ctx.fillRect(xCut, y - size * 0.92, 4, size * 1.16); }
  return typed >= row.length ? null : c;
}

function sceneErk(ctx, t) {
  const size = fitRows(ctx, ERK[0], 5, 180, 1620), x = 140;
  const first = nextBeat(ERK[0].words[3].t + 0.5, 2);
  const copies = t < first ? 0 : 1 + Math.floor((t - first) / (2 * TL.beat));
  for (let j = 0; j <= copies; j++) {
    const newest = j === copies;
    const color = mix(C.textHi, "#4a4a53", clamp((copies - j) / 4));
    // the second attempt is typed into the newest copy
    const line = newest && t >= ERK[1].t0 ? ERK[1] : ERK[0];
    const typed = newest ? typedRows(line, t)[0] : ERK[0].rows[0].length;
    const c = drawCut(ctx, line, t, x, ERK_Y + j * ERK_STEP, size, 5, color, typed);
    if (newest) drawCaret(ctx, c, true);
  }
}

// The drop: the stillest moment. One small clean line, a caret that has
// stopped blinking, then "Alles..." typed one letter at a time.
const STILL = { size: 100, y: 590 };
function sceneStill(ctx, t) {
  const { size, y } = STILL, third = ERK[2];
  const a0 = TL.alles.w[0][0];
  if (t < a0 - 0.1) {
    const quiet = { ...ERK[1], rows: ["ich kann dir erk"] };
    const retype = t >= third.t0;
    const line = retype ? third : quiet;
    const typed = !retype ? 16 : t < third.t0 + 0.12 ? Math.round(16 * (1 - span(t, third.t0, third.t0 + 0.12))) : Math.max(1, typedRows(third, t)[0]);
    ctx.font = gradeFont(0, size);
    const x = W / 2 - ctx.measureText(line.rows[0]).width / 2;
    drawCaret(ctx, drawCut(ctx, line, t, x, y, size, 0, C.textHi, typed), true);
    return;
  }
  // "Alles" over its long held vowel, then the dots
  const n = Math.round(5 * span(t, a0, a0 + 1.2));
  const dots = [a0 + 1.9, a0 + 3.4, a0 + 4.8].filter(d => t >= d).length;
  const shown = "Alles".slice(0, n) + ".".repeat(dots);
  ctx.font = gradeFont(0, size);
  const x = W / 2 - ctx.measureText("Alles...").width / 2;
  ctx.fillStyle = C.textHi; ctx.fillText(shown, x, y);
  drawCaret(ctx, { x: x + ctx.measureText(shown).width, y, size }, true);
}

// "BULLSHIT": the loud return, then the whole frame melts like the cover.
function bullGeom(ctx) {
  const size = fitRows(ctx, BULL, 6, 640, 1760);
  ctx.font = gradeFont(6, size);
  const w = ctx.measureText(BULL.rows[0]).width;
  return { size, x: W / 2 - w / 2, w, y: 540 + size * 0.34 };
}
function drawBullshit(ctx, t) {
  const g = bullGeom(ctx);
  return drawRows(ctx, BULL, t, { x: g.x, y: g.y, size: g.size, grade: 6, slabs: "yellow" });
}

// drips of the cover: thin streaks pulled down from the slabs and from the feet of the letters
const DRIPS = Array.from({ length: 70 }, (_, i) => {
  const r = mulberry32(500 + i);
  return { u: r(), w: 3 + Math.floor(r() * 12), delay: r() * 0.9, speed: 160 + r() * 520, foot: r() < 0.45 };
});

function sceneBullshit(ctx, t) {
  const m0 = BULL.end;
  if (t < m0 || !MELT) { drawCaret(ctx, drawBullshit(ctx, t), !typedDone(BULL, t)); return; }
  const g = MELT.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  drawBullshit(g, m0);
  const geo = bullGeom(ctx);
  const u = t - m0, fade = 1 - span(t, EXE.t0 - 1.0, EXE.t0 - 0.2);
  // the word sags as a whole, unevenly, like something soft
  const sag = x => { const b = x / 120, i = Math.floor(b); return lerp(hash(i, 1), hash(i + 1, 1), smooth(b - i)) * u * u * 70; };
  ctx.globalAlpha = fade;
  for (let x = Math.floor(geo.x) - 4; x < geo.x + geo.w + 4; x += 4) ctx.drawImage(MELT, x, 0, 4, H, x, sag(x), 4, H);
  for (const d of DRIPS) {
    const len = Math.pow(Math.max(0, u - d.delay), 1.6) * d.speed;
    if (len <= 0) continue;
    const x = Math.round(geo.x + d.u * geo.w);
    const sy = d.foot ? geo.y - 6 : geo.y + geo.size * 0.16 + 2;
    ctx.drawImage(MELT, x, sy, d.w, 3, x, sy + sag(x), d.w, len);
  }
  ctx.globalAlpha = 1;
}

// "Prompt Engineer.exe hat aufgehört zu—", then "Trotzdem..."
function sceneCrash(ctx, t) {
  const l = EXE, box = { x: 220, y: 330, w: 1480, h: 380 };
  const open = outCubic(span(t, l.t0 - 0.15, l.t0 + 0.1));
  const close = span(t, TROTZ.t0 - 0.25, TROTZ.t0 - 0.05);
  if (close < 1) {
    const hgt = box.h * (1 - close);
    ctx.globalAlpha = open;
    ctx.fillStyle = C.panel; ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(box.x, box.y + (box.h - hgt) / 2, box.w, Math.max(2, hgt), 14); ctx.fill(); ctx.stroke();
    if (close <= 0) {
      const size = 100, typed = typedRows(l, t);
      drawRows(ctx, subLine(l, 0), t, { x: box.x + 70, y: box.y + 155, size, grade: 3, slabs: "grey", typed: [typed[0]] });
      // "zu—": the last word is cut like the others
      const second = subLine(l, 1);
      const y2 = box.y + 155 + size * 1.22;
      if (typed[1] >= l.rows[1].length) drawCut(ctx, second, t, box.x + 70, y2, size, 3, C.textHi, l.rows[1].length);
      else if (typed[1] > 0) drawCaret(ctx, drawRows(ctx, second, t, { x: box.x + 70, y: y2, size, grade: 3, slabs: "grey", typed: [typed[1]] }), true);
    }
    ctx.globalAlpha = 1;
  }
  if (t >= TROTZ.t0) {
    const size = 150;
    ctx.font = gradeFont(0, size);
    const x = W / 2 - ctx.measureText(TROTZ.rows[0]).width / 2;
    const c = drawRows(ctx, TROTZ, t, { x, y: 600, size, grade: 0, slabs: "grey" });
    drawCaret(ctx, c, !typedDone(TROTZ, t) || blinkOn(t, TROTZ.end));
  }
}

// F5: every press reloads the composer from nothing; after the last one it
// stays, empty, and the system prompt is typed again.
function sceneF5(ctx, t) {
  const P = TL.f5;
  let p = 0;
  P.forEach((s, i) => { if (t >= s) p = i; });
  const s = P[p], last = p === P.length - 1;
  const k = span(t, s + 0.06, s + 0.6);
  if (k > 0) {
    drawFrame(ctx, t, RECT.field, { build: k, count: 0, temp: 0.7, labelAlpha: span(k, 0.8, 1) });
    // the video ends on a caret that is on: ready again
    if (k >= 1) drawCaret(ctx, { x: RECT.field.x + 28, y: RECT.field.y + 160, size: 100 }, blinkOn(t, s + 0.6) || t > SCENE_END - 0.5);
    if (last) {
      // the loop starts over: the same system prompt as at the beginning
      const a = TL.f5End + 0.2, n = Math.round(SYSTEM_PROMPT.length * span(t, a, a + 1.6));
      const y = RECT.hist.y + RECT.hist.h - 22;
      ctx.font = mono(17); ctx.fillStyle = C.textDim;
      if (t >= a) ctx.fillText("system", RECT.hist.x, y);
      ctx.font = mono(21); ctx.fillStyle = C.machine;
      ctx.fillText(SYSTEM_PROMPT.slice(0, n), RECT.hist.x + 112, y);
    }
  }
  // the key
  const down = t < s + 0.13 ? 1 : 1 - span(t, s + 0.13, s + 0.3);
  const leave = last ? span(t, TL.f5End + 0.3, TL.f5End + 1.3) : 0;
  ctx.save();
  ctx.globalAlpha = 1 - leave;
  ctx.translate(W / 2, 330 + down * 12);
  ctx.fillStyle = "#111115"; ctx.strokeStyle = mix("#5a5a64", C.textHi, down * 0.6); ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 34 - down * 22; ctx.shadowOffsetY = 20 - down * 14;
  ctx.beginPath(); ctx.roundRect(-130, -130, 260, 260, 30); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.stroke();
  ctx.font = mono(100, true); ctx.fillStyle = mix(C.text, C.textHi, down); ctx.textAlign = "center";
  ctx.fillText("F5", 0, 36);
  ctx.textAlign = "left";
  ctx.restore();
}

function grainAmount(t) {
  if (t < CH1[0].t0) return 0.06;
  if (t < TL.flood.first.w[0]) return 0.08;
  if (t < TL.drop) return 0.1;
  if (t < BULL.t0) return 0.05;
  return 0.08;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.lineWidth = 1;
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  const F = TL.flood;
  ctx.save();
  // the loudest stretch and the return shake on their hardest hits
  if ((t >= F.first.w[0] && t < TL.drop) || (t >= BULL.t0 && t < BULL.end)) { const s = shakeAt(t); ctx.translate(s[0], s[1]); }
  if (t < TL.boot) sceneOpen(ctx, t);
  else if (t < INIT[0].t0) { sceneBoot(ctx, t); if (t < TL.boot + 0.8) sceneOpen(ctx, t); }
  else if (t >= GRAZ_OUT && t < TITLE[0].t0 + 0.7) sceneGraz(ctx, t);
  else if (t < F.first.w[0] - 0.3) sceneComposer(ctx, t);
  else if (t < F.end + 0.5) sceneFlood(ctx, t);
  else if (t < TL.count.tokens.w[0]) scenePush(ctx, t);
  else if (t < NOTHING.t0) sceneCount(ctx, t);
  else if (t < ERK[0].t0) sceneNothing(ctx, t);
  else if (t < TL.drop) sceneErk(ctx, t);
  else if (t < BULL.t0) sceneStill(ctx, t);
  else if (t < EXE.t0 - 0.15) sceneBullshit(ctx, t);
  else if (t < TL.f5[0]) sceneCrash(ctx, t);
  else sceneF5(ctx, t);
  ctx.restore();
  const frozen = (t >= TL.hang[0] && t < TL.hang[1]) || (t >= TL.drop && t < BULL.t0);
  texture(ctx, t, grainAmount(t), frozen);
  drawSticker(ctx, t);
}
