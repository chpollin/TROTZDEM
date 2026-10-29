// Promptotyping. The whole video is drawScene(ctx, t), a pure function of time
// in seconds; nothing survives between frames. Line onsets and editorial events
// come from timeline.js.
//
// The song's own lyrics are the research material. They are typed as an idea,
// read back from a facsimile, profiled, written into a knowledge base, placed
// on a map, distilled, dated on a timeline, carried word by word into a new
// session, typeset as a paper, committed, spawned into a flood of artefacts and
// finally shown as a diff of the idea they started from. The frame is split by
// a mirror axis: on the left the researcher's Markdown files, on the right what
// is built from them. Mint means exactly one thing: the human. It marks the
// caret and, after "Ich.", the one artefact that was validated.

const W = 1920, H = 1080;
const BAR = 46;
const FULL = { x: 60, y: 82, w: 1800, h: 900 };
const STAGE = { x: 586, y: 82, w: 1294, h: 900 };
const COL = { x: 40, w: 476 };
const AXIS_X = 551;

const C = {
  void: "#0b0c0e", panel: "#111317", panel2: "#15171b", edge: "#2b2f36",
  line: "#e6e1d8", dim: "#575d66", ui: "#9aa1a9", ink: "#ece6da",
  mach: "#a9b8c6", red: "#ff5a4e", acc: "#3fe0a8",
  paper: "#e9e4da", paperInk: "#1c1d20", hand: "#d9cdb4", sheet: "#1c1a16",
};
const GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outBack = k => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const span = (t, a, b) => clamp((t - a) / (b - a));
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const font = (ctx, px, fam = "Space Mono", weight = 400) => {
  ctx.font = (fam === "Space Mono" ? `${weight} ` : "") + `${px}px "${fam}"`;
};

// ---------------------------------------------------------------- lines

const LN = {};
LINES.forEach((l, i) => { LN[l.id] = { ...l, end: l.e ?? (LINES[i + 1] ? LINES[i + 1].t : SCENE_END) }; });
// Characters of a line visible at t: typed from its onset, done within 70% of its span.
function typed(id, t, cps = 24) {
  const l = LN[id];
  if (t < l.t) return "";
  const rate = Math.max(cps, l.s.length / Math.max(0.2, (l.end - l.t) * 0.7));
  return l.s.slice(0, Math.min(l.s.length, Math.floor((t - l.t) * rate) + 1));
}
const done = (id, t) => typed(id, t).length === LN[id].s.length;
const beat = 60 / BPM;

function wrap(ctx, text, maxW) {
  const out = []; let cur = "";
  for (const w of text.split(" ")) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxW && cur) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------- status

function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], span(t, keys[i - 1][0], keys[i][0]));
  }
  return keys[keys.length - 1][1];
}
const CLOCK = [[0, 1320], [EV.split, 1328], [LN.nein.t, 1361], [LN.v2.t, 1367], [LN.ctx.t, 1395], [LN.m1.t, 1590], [EV.rushStart, 1596], [EV.cut, 1679], [LN.r1.t, 1680], [SCENE_END, 1681]];
const step = (keys, at, v) => keys.push([at - 0.01, keys[keys.length - 1][1]], [at, v]);
const COFFEE = [[0, 1]]; step(COFFEE, LN.nein.t, 2); step(COFFEE, LN.v2.t, 3); step(COFFEE, LN.ctx.t, 4); step(COFFEE, LN.m1.t, 6);
COFFEE.push([EV.rushStart, 6], [EV.cut, 14]);
const TABS = [[0, 3]]; step(TABS, LN.v1.t, 4); step(TABS, LN.v2.t, 9); step(TABS, LN.v3.t, 17);
TABS.push([EV.rushStart, 17], [EV.cut, 89]);
const frozenT = t => Math.min(t, EV.cut);

function drawStatus(ctx, t) {
  ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, BAR);
  ctx.fillStyle = C.edge; ctx.fillRect(0, BAR - 1, W, 1);
  const tf = frozenT(t);
  const m = Math.floor(keyed(CLOCK, tf)) % 1440;
  const clock = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const ver = t >= LN.v3.t ? "v3" : t >= LN.v2.t ? "v2" : t >= LN.v1.t ? "v1" : "v0";
  const val = t >= EV.enter ? 1 : 0;
  font(ctx, 18); ctx.textBaseline = "middle";
  ctx.fillStyle = C.ui; ctx.textAlign = "left";
  ctx.fillText("promptotyping", 24, BAR / 2);
  const items = [["Graz", C.ui], [clock, C.line], [`Kaffee ${Math.floor(keyed(COFFEE, tf))}`, C.ui],
    [`Tabs ${Math.floor(keyed(TABS, tf))}`, C.ui], [`validated ${val}`, val ? C.acc : C.ui], [ver, C.line]];
  let x = W - 24; ctx.textAlign = "right";
  for (let i = items.length - 1; i >= 0; i--) {
    ctx.fillStyle = items[i][1]; ctx.fillText(items[i][0], x, BAR / 2);
    x -= ctx.measureText(items[i][0]).width;
    if (i) { ctx.fillStyle = C.dim; ctx.fillText("  |  ", x, BAR / 2); x -= ctx.measureText("  |  ").width; }
  }
  drawCup(ctx, x - 34, BAR / 2 + 1, 0.42, C.ui);
}

function drawCup(ctx, x, y, s, col, steam = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 3 / Math.max(s, 0.5); ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-18, 20); ctx.lineTo(18, 20); ctx.lineTo(22, -18); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(26, 0, 9, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  for (let i = 0; i < 3 && steam > 0; i++) {
    ctx.globalAlpha = steam * 0.7;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const yy = -26 - k * 3.2, xx = -10 + i * 10 + Math.sin(k * 0.7 + t * 2.4 + i) * 3;
      k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCaret(ctx, x, y, h, t, label) {
  if (Math.floor(t * 2.2) % 2 === 0) { ctx.fillStyle = C.acc; ctx.fillRect(x + 3, y - h * 0.8, 3, h); }
  if (!label) return;
  font(ctx, 14, "Space Mono", 700);
  const w = ctx.measureText(label).width + 14;
  ctx.fillStyle = C.acc; ctx.fillRect(x + 3, y - h * 0.8 - 24, w, 20);
  ctx.fillStyle = C.void; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + 10, y - h * 0.8 - 14);
}
const caretLabel = t => (t >= LN.r4.t + 1.6 ? "researcher | developer" : "researcher");

// ---------------------------------------------------------------- shapes

const RNG = mulberry32(20261029);
const COAST = Array.from({ length: 22 }, (_, i) => {
  const a = i / 22 * Math.PI * 2, r = 0.36 + RNG() * 0.1 + Math.sin(a * 3) * 0.04;
  return [0.5 + Math.cos(a) * r * 1.05, 0.52 + Math.sin(a) * r * 0.9];
});
const DOTS = [[0.3, 0.36], [0.62, 0.3], [0.38, 0.66], [0.7, 0.62], [0.52, 0.48], [0.24, 0.52]];
const NET = Array.from({ length: 11 }, () => [0.1 + RNG() * 0.8, 0.15 + RNG() * 0.7]);
const NET_E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 5], [5, 6], [6, 7], [7, 2], [8, 3], [9, 8], [10, 9], [10, 5], [6, 9]];
const TYPES = ["map", "timeline", "network", "facsimile", "ledger", "kgraph"];

function coastPath(ctx, x, y, w, h, upto = 1) {
  const n = Math.max(2, Math.ceil(COAST.length * upto));
  ctx.beginPath();
  for (let i = 0; i <= n && i <= COAST.length; i++) {
    const p = COAST[i % COAST.length];
    i ? ctx.lineTo(x + p[0] * w, y + p[1] * h) : ctx.moveTo(x + p[0] * w, y + p[1] * h);
  }
}

// One artefact body inside (x, y, w, h). col is the line colour, prog 0..1 how much is built.
function drawBody(ctx, type, x, y, w, h, col, prog = 1, pixel = false) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, w / 260);
  if (type === "map") {
    if (pixel) {
      const g = Math.max(6, Math.round(w / 52));
      const pts = [];
      for (let i = 0; i < COAST.length; i++) {
        const a = COAST[i], b = COAST[(i + 1) % COAST.length];
        const steps = Math.ceil(Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h) / g);
        for (let k = 0; k < steps; k++) pts.push([lerp(a[0], b[0], k / steps), lerp(a[1], b[1], k / steps)]);
      }
      const n = Math.floor(pts.length * prog);
      for (let i = 0; i < n; i++) {
        ctx.fillRect(x + Math.round(pts[i][0] * w / g) * g, y + Math.round(pts[i][1] * h / g) * g, g - 2, g - 2);
      }
    } else {
      coastPath(ctx, x, y, w, h, prog); ctx.stroke();
    }
  } else if (type === "timeline") {
    const yy = y + h * 0.62;
    ctx.beginPath(); ctx.moveTo(x + w * 0.05, yy); ctx.lineTo(x + w * (0.05 + 0.9 * prog), yy); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const xx = x + w * (0.08 + i * 0.105);
      if ((i + 1) / 9 > prog) break;
      ctx.beginPath(); ctx.moveTo(xx, yy - h * 0.05); ctx.lineTo(xx, yy + h * 0.05); ctx.stroke();
      if (i % 2 === 0) ctx.fillRect(xx - 2, yy - h * (0.18 + (i % 3) * 0.08), Math.max(2, w * 0.006), h * (0.18 + (i % 3) * 0.08));
    }
  } else if (type === "network" || type === "kgraph") {
    const n = Math.floor(NET_E.length * prog);
    const pos = type === "network" ? NET : NET.map(p => [1 - p[1] * 0.9, p[0] * 0.9 + 0.05]);
    for (let i = 0; i < n; i++) {
      const [a, b] = NET_E[i];
      ctx.beginPath(); ctx.moveTo(x + pos[a][0] * w, y + pos[a][1] * h); ctx.lineTo(x + pos[b][0] * w, y + pos[b][1] * h); ctx.stroke();
    }
    const nodes = Math.ceil(pos.length * prog);
    for (let i = 0; i < nodes; i++) {
      ctx.beginPath(); ctx.arc(x + pos[i][0] * w, y + pos[i][1] * h, Math.max(2, w * (type === "kgraph" && i % 3 === 0 ? 0.03 : 0.016)), 0, Math.PI * 2);
      ctx.fillStyle = C.void; ctx.fill(); ctx.stroke();
    }
  } else if (type === "facsimile") {
    ctx.strokeRect(x + w * 0.2, y + h * 0.08, w * 0.6, h * 0.84);
    for (let i = 0; i < 7 * prog; i++) {
      const yy = y + h * (0.18 + i * 0.1);
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const xx = x + w * (0.26 + k * 0.03);
        const dy = Math.sin(k * 1.9 + i * 2.3) * h * 0.012;
        k ? ctx.lineTo(xx, yy + dy) : ctx.moveTo(xx, yy + dy);
      }
      ctx.stroke();
      if (i % 3 === 1) ctx.strokeRect(x + w * 0.24, yy - h * 0.04, w * 0.52, h * 0.08);
    }
  } else if (type === "ledger") {
    for (let i = 0; i < 7 * prog; i++) {
      const yy = y + h * (0.14 + i * 0.11);
      ctx.beginPath(); ctx.moveTo(x + w * 0.08, yy); ctx.lineTo(x + w * 0.92, yy); ctx.stroke();
      ctx.fillRect(x + w * 0.12, yy + h * 0.03, w * (0.2 + (i * 37 % 20) / 100), Math.max(1, h * 0.025));
      ctx.fillRect(x + w * 0.7, yy + h * 0.03, w * (0.08 + (i * 13 % 9) / 100), Math.max(1, h * 0.025));
    }
    ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + h * 0.1); ctx.lineTo(x + w * 0.62, y + h * (0.1 + 0.8 * prog)); ctx.stroke();
  }
}

// A window in the style of the paper's figure: frame, title bar with three dots, a status dot.
function drawWindow(ctx, x, y, w, h, o = {}) {
  const col = o.col || C.line, tb = Math.max(8, Math.min(30, h * 0.09));
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.fill || C.panel; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = col; ctx.lineWidth = o.lw || Math.max(1, Math.min(2.5, w / 300));
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x, y + tb); ctx.lineTo(x + w, y + tb); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(x + tb * (0.6 + i * 0.55), y + tb / 2, Math.max(1.2, tb * 0.13), 0, Math.PI * 2); ctx.stroke();
  }
  if (o.title && tb >= 20) {
    font(ctx, Math.round(tb * 0.55)); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(o.title, x + tb * 2.4, y + tb / 2 + 1);
  }
  if (o.type) drawBody(ctx, o.type, x + w * 0.04, y + tb + h * 0.04, w * 0.92, h - tb - h * 0.08, col, o.prog ?? 1, o.pixel);
  if (o.dot) {
    const r = Math.max(2.5, Math.min(10, w * 0.022));
    ctx.beginPath(); ctx.arc(x + w - r * 2.2, y + h - r * 2.2, r, 0, Math.PI * 2);
    ctx.fillStyle = o.dot === "acc" ? C.acc : C.dim; ctx.fill();
  }
  ctx.restore();
}

// Handwriting: a damaged Redaction cut, slanted, as on a facsimile or an editor's correction.
function hand(ctx, text, x, y, px, col, grade = "Redaction70") {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.16, 1, 0, 0);
  font(ctx, px, grade); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, 0); ctx.restore();
}

function stroke(ctx, x0, y0, x1, y1, k, col, lw) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round";
  ctx.beginPath();
  const n = 40, m = Math.floor(n * clamp(k));
  for (let i = 0; i <= m; i++) {
    const u = i / n, xx = lerp(x0, x1, u), yy = lerp(y0, y1, u) + Math.sin(u * 9) * 10;
    i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
  }
  ctx.stroke(); ctx.restore();
}

// ---------------------------------------------------------------- the knowledge column

const FILES = [
  { name: "data.md", at: "rc1", entries: [{ id: "rc2" }] },
  { name: "specification.md", at: "rc3", entries: [{ id: "rc4" }, { at: LN.upd2.t, text: "lauter. mehr Wut." }] },
  { name: "journal.md", at: "rc5", entries: [{ id: "rc6" }, { at: LN.upd1.t + 0.2, text: "22:41 Stopp. Das bin nicht ich. Du singst mein Lied, doch du kennst mich nicht." }, { at: LN.gut.t + 1.0, text: "22:52 Fast. Aber gut." }] },
  { name: "CLAUDE.md", at: "rc7", entries: [{ id: "rc8" }] },
];

// Returns the centres of the file cards so that words can leave from them.
function drawColumn(ctx, t, slide) {
  const x = COL.x + slide, w = COL.w;
  font(ctx, 16); ctx.fillStyle = C.dim; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("knowledge/", x, 112);
  let y = 128; const centres = [];
  const rush = t >= LN.v3.t;
  for (const f of FILES) {
    const at = LN[f.at].t;
    if (t < at) { centres.push([x + w / 2, y + 30]); continue; }
    const k = smooth(span(t, at, at + 0.35));
    font(ctx, 24, "Redaction");
    const lines = [];
    for (const e of f.entries) {
      const when = e.id ? LN[e.id].t : e.at;
      if (t < when) continue;
      const text = e.id ? typed(e.id, t) : e.text.slice(0, Math.floor((t - when) * 60) + 1);
      for (const l of wrap(ctx, text, w - 36)) lines.push({ l, typing: e.id && !done(e.id, t) });
    }
    const shown = rush ? lines.slice(-1) : lines;
    const h = 46 + shown.length * 32 + 8;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = C.panel; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    font(ctx, 18, "Space Mono", 700); ctx.fillStyle = C.mach;
    ctx.fillText(f.name, x + 16, y + 30);
    font(ctx, 24, "Redaction"); ctx.fillStyle = C.ink;
    shown.forEach((s, i) => {
      ctx.fillText(s.l, x + 18, y + 72 + i * 32);
      if (s.typing) drawCaret(ctx, x + 18 + ctx.measureText(s.l).width, y + 72 + i * 32, 26, t, null);
    });
    ctx.restore();
    centres.push([x + w / 2, y + h / 2]);
    y += h + 14;
  }
  if (rush) drawCommits(ctx, t, x, y + 20, w);
  return centres;
}

const FRAGS = ["MARKDOWN! MARKDOWN!", "ICH BRAUCH KEINEN DEVELOPER MEHR!", "ICH BAU MIR ALLES SELBST!", "PROMPTOTYPING!", "Ich brauch keinen Developer mehr!"];
function drawCommits(ctx, t, x, y, w) {
  const n = spawned(frozenT(t));
  font(ctx, 16); ctx.fillStyle = C.dim; ctx.textAlign = "left";
  ctx.fillText("git log", x, y);
  const rows = Math.floor((980 - y) / 26);
  for (let r = 0; r < rows; r++) {
    const i = n - rows + r;
    if (i < 3) continue;
    const hash = Math.floor(mulberry32(i * 977)() * 0xfffffff).toString(16).padStart(7, "0");
    const msg = `${TYPES[CELL_TYPE[i]]}: ${FRAGS[i % FRAGS.length]}`;
    ctx.fillStyle = r === rows - 1 ? C.line : C.ui;
    ctx.fillText(`${hash}  ${msg}`.slice(0, 50), x, y + 30 + r * 26);
  }
}

// ---------------------------------------------------------------- the machine's terminal

const TERM = ["read", "think1", "think2", "think3", "rc1", "rc3", "rc5", "rc7", "v1", "upd1", "v2", "ctx", "v3"];
function drawTerminal(ctx, t, x) {
  const cur = TERM.filter(id => LN[id].t <= t && t < LN[id].end + 1.6);
  font(ctx, 24); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  cur.slice(-2).forEach((id, i, a) => {
    const fade = 1 - span(t, LN[id].end + 1.0, LN[id].end + 1.6);
    ctx.fillStyle = rgba(i === a.length - 1 ? C.mach : C.dim, fade);
    ctx.fillText("> " + typed(id, t, 40), x, 1060 - (a.length - 1 - i) * 32);
  });
}

// ---------------------------------------------------------------- material: idea, facsimile, profile

// Drawn in full-frame coordinates; the caller scales it into the stage after the split.
const IDEA = { x: 260, y: 170, w: 1400, h: 640 };
const INTRO = ["intro1", "intro2", "intro3", "intro4"];
// The first line is typed with one live correction: "Leid" becomes "Lied".
const TYPO = (() => {
  const s = [], a = "Ich hab kein Le", b = "id", c = "ied, nur eine Idee";
  for (let i = 1; i <= a.length; i++) s.push(a.slice(0, i));
  for (const ch of b) s.push(s[s.length - 1] + ch);
  for (let i = 0; i < 3; i++) s.push(s[s.length - 1].slice(0, -1));
  for (const ch of c) s.push(s[s.length - 1] + ch);
  return s;
})();
function introText(id, t) {
  if (id !== "intro1") return typed(id, t);
  const l = LN.intro1; if (t < l.t) return "";
  return TYPO[Math.min(TYPO.length - 1, Math.floor(span(t, l.t, l.t + (l.end - l.t) * 0.85) * (TYPO.length - 1)))];
}

function drawMaterial(ctx, t) {
  const ed = 1 - smooth(span(t, LN.read.t - 0.6, LN.read.t + 0.5));
  const fx = smooth(span(t, LN.read.t - 0.5, LN.read.t + 0.7));
  const { x, y, w, h } = IDEA;
  if (ed > 0) {
    drawWindow(ctx, x, y, w, h, { title: "idee.md", col: C.ui, alpha: ed });
    ctx.save(); ctx.globalAlpha = ed;
    font(ctx, 60, "Redaction"); ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let caret = null;
    INTRO.forEach((id, i) => {
      const s = introText(id, t), yy = y + 140 + i * 100;
      ctx.fillText(s, x + 80, yy);
      if (t >= LN[id].t && t < LN[id].end) caret = [x + 80 + ctx.measureText(s).width, yy];
    });
    if (!caret && t < LN.intro1.t) caret = [x + 80, y + 140];
    if (caret) drawCaret(ctx, caret[0], caret[1], 60, t, caretLabel(t));
    drawCup(ctx, x + w - 120, y + h - 90, 1.4, C.ui, 1, t);
    ctx.restore();
  }
  if (fx > 0) {
    ctx.save(); ctx.globalAlpha = fx;
    ctx.fillStyle = C.sheet; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.hand; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    INTRO.forEach((id, i) => hand(ctx, LN[id].s, x + 80, y + 140 + i * 100, 58, C.hand));
    // transcription boxes read the hand back as text
    font(ctx, 58, "Redaction70");
    INTRO.forEach((id, i) => {
      const k = smooth(span(t, LN.read.t + 0.3 + i * 0.4, LN.read.t + 0.7 + i * 0.4));
      if (!k) return;
      const tw = ctx.measureText(LN[id].s).width + 40, yy = y + 140 + i * 100;
      ctx.strokeStyle = rgba(C.mach, k); ctx.lineWidth = 2;
      ctx.strokeRect(x + 60, yy - 60, tw * k, 80);
      font(ctx, 16); ctx.fillStyle = rgba(C.mach, k);
      ctx.fillText(`line ${i + 1} | ${(0.97 - i * 0.03).toFixed(2)}`, x + 64, yy - 66);
      font(ctx, 58, "Redaction70");
    });
    ctx.restore();
    drawProfile(ctx, t, x + w - 400, y + 60, 360, h - 120);
  }
}

const PROFILE = [["one voice", 0.35], ["German", 0.8], ["angry", 0.95], ["tired", 0.9]];
function drawProfile(ctx, t, x, y, w, h) {
  const k0 = smooth(span(t, LN.think1.t, LN.think1.t + 0.6));
  if (!k0) return;
  ctx.save(); ctx.globalAlpha = k0;
  ctx.fillStyle = rgba(C.void, 0.85); ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.mach; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  font(ctx, 16); ctx.fillStyle = C.mach; ctx.textAlign = "left";
  ctx.fillText("profile", x + 18, y + 30);
  const bw = (w - 80) / 4;
  PROFILE.forEach(([label, v], i) => {
    const k = outBack(span(t, LN.think2.t + i * 0.45, LN.think2.t + i * 0.45 + 0.7));
    const bh = (h - 130) * v * k, bx = x + 40 + i * bw, by = y + h - 70;
    ctx.fillStyle = i === 2 ? C.red : C.mach; ctx.fillRect(bx + 8, by - bh, bw - 16, bh);
    ctx.save(); ctx.translate(bx + bw / 2, by + 16); font(ctx, 14); ctx.fillStyle = C.line; ctx.textAlign = "center";
    ctx.fillText(t >= LN.think2.t + i * 0.45 ? label : "", 0, 6); ctx.restore();
  });
  if (t >= LN.think3.t) {
    font(ctx, 18, "Space Mono", 700); ctx.fillStyle = C.red; ctx.textAlign = "left";
    ctx.fillText("hook: missing", x + 18, y + 58);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- version one: the 8-bit map

const MAPR = { x: STAGE.x + 40, y: STAGE.y + 20, w: STAGE.w - 80, h: STAGE.h - 40 };
const C1 = ["c1a", "c1b", "c1c", "c1d"];
const V1_DOTS = [[0.18, 0.26], [0.4, 0.42], [0.2, 0.6], [0.48, 0.76]];
function drawV1(ctx, t) {
  const a = smooth(span(t, LN.v1.t, LN.v1.t + 0.4)) * (1 - smooth(span(t, LN.upd1.t + 0.6, LN.upd1.t + 1.4)));
  if (!a) return;
  const grey = smooth(span(t, LN.nein.t, LN.nein.t + 0.3));
  const col = grey ? C.dim : C.line;
  const { x, y, w, h } = MAPR;
  ctx.save(); ctx.globalAlpha = a;
  drawWindow(ctx, x, y, w, h, { title: "promptotype v1 | map", col, type: "map", pixel: true, prog: span(t, LN.v1.t + 0.2, LN.c1a.t - 0.1) });
  const tb = 30, bx = x + w * 0.04, by = y + tb + h * 0.04, bw = w * 0.92, bh = h - tb - h * 0.08;
  C1.forEach((id, i) => {
    if (t < LN[id].t) return;
    const [dx, dy] = V1_DOTS[i], px = bx + dx * bw, py = by + dy * bh;
    const k = outBack(span(t, LN[id].t, LN[id].t + 0.25));
    ctx.fillStyle = grey ? C.dim : C.mach; ctx.fillRect(px - 9 * k, py - 9 * k, 18 * k, 18 * k);
    font(ctx, 40, "Space Mono", 700); ctx.fillStyle = grey ? C.dim : C.mach; ctx.textBaseline = "middle";
    // a place name that would leave the window is set to the left of its dot
    const fits = px + 22 + ctx.measureText(LN[id].s).width < x + w - 24;
    ctx.textAlign = fits ? "left" : "right";
    ctx.fillText(typed(id, t, 30), fits ? px + 22 : px - 22, py);
  });
  ctx.restore();
  // the human verdict
  if (t >= LN.nein.t) {
    const fade = 1 - smooth(span(t, LN.upd1.t + 0.4, LN.upd1.t + 1.2));
    ctx.save(); ctx.globalAlpha = fade;
    stroke(ctx, x + 60, y + h - 80, x + w - 60, y + 90, span(t, LN.nein.t, LN.nein.t + 0.45), C.red, 12);
    hand(ctx, "Nein.", x + 70, y + 210, 150, C.red, "Redaction50");
    ctx.restore();
    drawVerdict(ctx, t, x + 70, y + h - 200);
  }
}

// "Stopp…" is written large in red, then flies into journal.md.
function drawVerdict(ctx, t, x, y) {
  const fly = smooth(span(t, LN.upd1.t - 0.6, LN.upd1.t + 0.2));
  if (fly >= 1) return;
  const tx = COL.x + 18, ty = 330;
  ["stopp", "kennst"].forEach((id, i) => {
    const s = typed(id, t); if (!s) return;
    const px = lerp(54, 24, fly);
    hand(ctx, s, lerp(x, tx, fly), lerp(y + i * 74, ty + i * 30, fly), px, i ? C.ink : C.red, fly > 0.5 ? "Redaction" : "Redaction50");
  });
}

// ---------------------------------------------------------------- distillation

const FILLER = ["im Grunde", "gewissermaßen", "eigentlich", "sozusagen", "in gewisser Weise", "möglicherweise", "quasi", "im Prinzip", "durchaus", "letztlich"];
const DIST = ["d1", "d2", "d3", "d4"].map((id, n) => {
  const r = mulberry32(100 + n), toks = [];
  LN[id].s.split(" ").forEach((wd, i) => {
    toks.push({ s: wd, keep: true });
    if (r() < 0.75) toks.push({ s: FILLER[Math.floor(r() * FILLER.length)] + (r() < 0.3 ? "," : ""), keep: false });
    if (r() < 0.3) toks.push({ s: FILLER[Math.floor(r() * FILLER.length)], keep: false });
  });
  return { id, toks };
});
function layoutTokens(ctx, toks, x, y, maxW, lh) {
  let cx = x, cy = y; const sp = ctx.measureText(" ").width;
  return toks.map(tk => {
    const tw = ctx.measureText(tk.s).width;
    if (cx + tw > x + maxW && cx > x) { cx = x; cy += lh; }
    const p = [cx, cy]; cx += tw + sp; return p;
  });
}
function drawDistill(ctx, t) {
  const a = smooth(span(t, LN.upd1.end, LN.upd1.end + 0.5)) * (1 - smooth(span(t, LN.v2.t - 0.2, LN.v2.t + 0.6)));
  if (!a) return;
  const { x, y, w, h } = STAGE;
  ctx.save(); ctx.globalAlpha = a;
  drawWindow(ctx, x + 20, y + 10, w - 40, h - 20, { title: "distillation", col: C.ui, fill: C.panel });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  DIST.forEach((d, n) => {
    const l = LN[d.id];
    if (t < l.t) return;
    const k = smooth(span(t, l.t + 0.25, l.t + 1.3)), drop = smooth(span(t, l.t + 0.15, l.t + 0.8));
    const appear = smooth(span(t, l.t, l.t + 0.2));
    font(ctx, 34, "Redaction100");
    const P0 = layoutTokens(ctx, d.toks, x + 80, y + 520, w - 160, 50);
    const kept = d.toks.filter(tk => tk.keep);
    font(ctx, 50, "Redaction");
    const P1 = layoutTokens(ctx, kept, x + 80, y + 130 + n * 88, w - 160, 60);
    const grade = GRADES[Math.round((1 - k) * (GRADES.length - 1))];
    let ki = 0;
    d.toks.forEach((tk, i) => {
      if (tk.keep) {
        const p1 = P1[ki++];
        font(ctx, lerp(34, 50, k), grade); ctx.fillStyle = rgba(C.ink, appear);
        ctx.fillText(tk.s, lerp(P0[i][0], p1[0], k), lerp(P0[i][1], p1[1], k));
      } else if (drop < 1) {
        font(ctx, 34, "Redaction100"); ctx.fillStyle = rgba(C.dim, appear * (1 - drop));
        ctx.fillText(tk.s, P0[i][0], P0[i][1] + drop * 40);
      }
    });
  });
  ctx.restore();
}

// ---------------------------------------------------------------- version two: map, timeline, network

const V2 = {
  map: { x: STAGE.x + 20, y: STAGE.y + 10, w: 620, h: 440 },
  tl: { x: STAGE.x + 660, y: STAGE.y + 10, w: 614, h: 440 },
  net: { x: STAGE.x + 20, y: STAGE.y + 470, w: 1254, h: 420 },
};
const C2 = ["c2a", "c2b", "c2c", "c2d"];
const C2_TIME = ["22:47", "22:48", "22:49", "22:50"];
function drawV2(ctx, t, rebuilt = 0) {
  const live = t < LN.ctx.t;
  const a = live ? smooth(span(t, LN.v2.t, LN.v2.t + 0.5)) : rebuilt;
  if (!a) return;
  const tf = live ? Math.min(t, LN.fast.t) : 200;   // the build freezes on "Fast."
  const loud = live ? smooth(span(t, LN.lauter.t, LN.lauter.t + 1.2)) : 1;
  const angry = live && t >= LN.wut.t;
  ctx.save(); ctx.globalAlpha = a;
  const m = V2.map, tl = V2.tl, nt = V2.net;
  drawWindow(ctx, m.x, m.y, m.w, m.h, { title: "promptotype v2 | map", type: "map", prog: span(tf, LN.v2.t + 0.2, LN.v2.t + 1.8) });
  drawWindow(ctx, tl.x, tl.y, tl.w, tl.h, { title: "timeline", type: "timeline", prog: span(tf, LN.v2.t + 1.0, LN.c2a.t) });
  if (tf >= LN.c2c.t - 1 || !live) drawWindow(ctx, nt.x, nt.y, nt.w, nt.h, { title: "network", type: "network", prog: live ? span(tf, LN.c2c.t - 1, LN.c2c.t + 2) : 1 });
  // the chorus lines as dated events; rows grow with the type, so they never overlap
  const size = lerp(26, 38, loud);
  let ey = tl.y + 92;
  C2.forEach((id, i) => {
    if (live && t < LN[id].t) return;
    const ex = tl.x + 40;
    const jx = angry ? (mulberry32(Math.floor(t * 12) + i * 31)() - 0.5) * 8 : 0;
    font(ctx, 18); ctx.fillStyle = C.ui; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(C2_TIME[i], ex, ey);
    font(ctx, size, angry ? "Redaction70" : "Redaction");
    ctx.fillStyle = angry ? C.red : C.ink;
    const s = live ? typed(id, t) : LN[id].s;
    const lines = wrap(ctx, s, tl.w - 150);
    lines.forEach((l, j) => ctx.fillText(l, ex + 80 + jx, ey + j * size * 1.05));
    ey += Math.max(1, lines.length) * size * 1.05 + 26;
  });
  ctx.restore();
}

const FAST = ["fast", "lauter", "gut", "wut"];
function drawFast(ctx, t) {
  if (t < LN.fast.t || t >= LN.ctx.t) return;
  const { x, y, w, h } = V2.net;
  ctx.fillStyle = rgba(C.void, 0.78); ctx.fillRect(x, y, w, h);
  FAST.forEach((id, i) => {
    const s = typed(id, t); if (!s) return;
    const big = id === "fast";
    hand(ctx, s, x + 40 + (i % 2) * 560, y + 110 + Math.floor(i / 2) * 150, big ? 110 : 64, id === "wut" || big ? C.red : C.ink, "Redaction50");
  });
}

// ---------------------------------------------------------------- the new session

const WH = ["w1", "w2", "w3", "w4"];
function drawSession(ctx, t, centres) {
  if (t < LN.ctx.t || t >= LN.m1.t + 0.3) return;
  // clear: the agent's side is wiped top to bottom
  const wipe = smooth(span(t, LN.ctx.t, LN.ctx.t + 0.8));
  if (wipe < 1) {
    drawV2(ctx, LN.ctx.t - 0.01);
    drawFast(ctx, LN.ctx.t - 0.01);
    ctx.fillStyle = C.void; ctx.fillRect(STAGE.x - 20, STAGE.y, STAGE.w + 40, STAGE.h * wipe);
    ctx.fillStyle = C.mach; ctx.fillRect(STAGE.x, STAGE.y + STAGE.h * wipe, STAGE.w, 2);
    return;
  }
  drawV2(ctx, t, 0.4 * smooth(span(t, LN.w2.t, LN.w4.t + 1)));
  ctx.fillStyle = rgba(C.void, 0.7); ctx.fillRect(STAGE.x, STAGE.y + 500, STAGE.w, 330);
  WH.forEach((id, n) => {
    const l = LN[id]; if (t < l.t - 1) return;
    const words = l.s.split(" ");
    font(ctx, 44, "Redaction"); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const sp = ctx.measureText(" ").width, total = ctx.measureText(l.s).width;
    let cx = STAGE.x + (STAGE.w - total) / 2; const cy = STAGE.y + 570 + n * 74;
    words.forEach((wd, j) => {
      const ta = l.t + (j / words.length) * (l.end - l.t) * 0.8, k = smooth(span(t, ta - 0.9, ta));
      const [sx, sy] = centres[(n + j) % centres.length];
      const ww = ctx.measureText(wd).width;
      if (k > 0) {
        if (k < 1) {
          const px = lerp(sx, cx, k), py = lerp(sy, cy, k) - Math.sin(k * Math.PI) * 90;
          ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(px + ww / 2, py - 14, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(C.ink, 0.25 + 0.5 * k); ctx.fillText(wd, px, py);
        } else {
          ctx.fillStyle = C.ink; ctx.fillText(wd, cx, cy);
        }
      }
      cx += ww + sp;
    });
  });
}

// ---------------------------------------------------------------- the paper

function drawPaper(ctx, t) {
  const a = smooth(span(t, LN.m1.t - 0.3, LN.m1.t + 0.1)) * (1 - smooth(span(t, LN.v3.t - 0.4, LN.v3.t + 0.1)));
  if (!a) return;
  const pw = 680, ph = 860, x = STAGE.x + (STAGE.w - pw) / 2, y = STAGE.y + 20;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = C.paper; ctx.fillRect(x, y, pw, ph);
  ctx.fillStyle = C.paperInk; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  font(ctx, 15); ctx.fillText("Working Paper | 2026", x + 60, y + 70);
  font(ctx, 72, "Redaction"); ctx.fillText(PAPER.title, x + 60, y + 170);
  font(ctx, 28, "Redaction");
  wrap(ctx, PAPER.subtitle, pw - 120).forEach((l, i) => ctx.fillText(l, x + 60, y + 220 + i * 34));
  font(ctx, 18); ctx.fillText(PAPER.author, x + 60, y + 310);
  ctx.fillRect(x + 60, y + 340, pw - 120, 1.5);
  font(ctx, 16, "Space Mono", 700); ctx.fillText("Abstract", x + 60, y + 390);
  font(ctx, 38, "Redaction");
  ["m1", "m2"].forEach((id, i) => {
    wrap(ctx, typed(id, t), pw - 120).forEach((l, j) => ctx.fillText(l, x + 60, y + 450 + i * 100 + j * 44));
  });
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 60, y + 660 + i * 22, (pw - 120) * (i === 5 ? 0.5 : 1), 6);
  if (t >= LN.m2.t + 1.6) { font(ctx, 14); ctx.fillText("¹ Eine Arbeitspraxis, keine evaluierte Methode.", x + 60, y + ph - 40); }
  ctx.restore();
}

// ---------------------------------------------------------------- the rush

const MAXN = 160;
const SPIRAL = (() => {
  const out = [[0, 0]]; let x = 0, y = 0, dx = 1, dy = 0, len = 1;
  while (out.length < MAXN) {
    for (let r = 0; r < 2 && out.length < MAXN; r++) {
      for (let i = 0; i < len && out.length < MAXN; i++) { x += dx; y += dy; out.push([x, y]); }
      [dx, dy] = [-dy, dx];
    }
    len++;
  }
  return out;
})();
const CELL_TYPE = Array.from({ length: MAXN }, (_, i) => i < 3 ? i : Math.floor(mulberry32(i * 53)() * TYPES.length));
// Spawn times accelerate towards the cut and snap to half beats.
const SPAWN = Array.from({ length: MAXN }, (_, i) => {
  if (i < 3) return LN.v3.t;
  const raw = EV.rushStart + (EV.cut - 0.3 - EV.rushStart) * Math.pow((i - 2) / (MAXN - 3), 1 / 1.6);
  const q = beat / 2;
  return BEAT0 + Math.ceil((raw - BEAT0) / q) * q;
});
const VANISH = (() => {
  const order = Array.from({ length: MAXN }, (_, i) => i), r = mulberry32(4711);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out = new Array(MAXN), d = (LN.r1.t - 0.8 - EV.dissolve) / MAXN;
  order.forEach((cell, rank) => { out[cell] = EV.dissolve + rank * d; });
  return out;
})();
function spawned(t) { let n = 0; while (n < MAXN && SPAWN[n] <= t) n++; return n; }
const PW = 360, PH = 260;

function rushCamera(t) {
  const n = Math.max(3, spawned(frozenT(t)));
  const r = Math.sqrt(n) / 2 + 0.6;
  let s = Math.min(STAGE.w / ((2 * r) * PW), STAGE.h / ((2 * r) * PH), 1.1);
  s *= lerp(1, 0.86, smooth(span(t, LN.who.t, LN.who.t + 2.4)));
  return s;
}
function cellRect(i, t) {
  const s = rushCamera(t), [gx, gy] = SPIRAL[i];
  const cx = STAGE.x + STAGE.w / 2 + gx * PW * s, cy = STAGE.y + STAGE.h / 2 + gy * PH * s;
  return { x: cx - 150 * s, y: cy - 105 * s, w: 300 * s, h: 210 * s, s };
}

function drawRush(ctx, t) {
  if (t < LN.v3.t || t >= LN.r1.t + 1.2) return;
  const tf = frozenT(t), n = spawned(tf), frozen = t >= EV.cut;
  const fade = 1 - smooth(span(t, LN.r1.t, LN.r1.t + 1.2));
  ctx.save();
  ctx.beginPath(); ctx.rect(STAGE.x - 10, STAGE.y, STAGE.w + 20, STAGE.h); ctx.clip();
  for (let i = n - 1; i >= 1; i--) {
    // in the instrumental after "Ich." the unvalidated artefacts go, one by one
    const gone = span(t, VANISH[i], VANISH[i] + 0.3);
    if (gone >= 1) continue;
    const r = cellRect(i, t), pop = frozen ? 1 - gone : outBack(span(tf, SPAWN[i], SPAWN[i] + 0.18));
    const w = r.w * pop, h = r.h * pop;
    drawWindow(ctx, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, {
      type: TYPES[CELL_TYPE[i]], col: frozen ? C.dim : C.line, alpha: fade * (t >= EV.enter ? 0.55 : 1),
      dot: "grey", title: r.s > 0.7 ? TYPES[CELL_TYPE[i]] : null,
    });
  }
  ctx.restore();
  drawChosen(ctx, t);
}

// The first artefact, the map he iterated on, is the one he validates.
const CHOSEN_END = { x: STAGE.x + STAGE.w - 470, y: STAGE.y + 20, w: 440, h: 300 };
function drawChosen(ctx, t) {
  if (t < LN.v3.t || t >= EV.fadeOut + 2) return;
  const r = cellRect(0, t), up = smooth(span(t, EV.enter, EV.enter + 0.8)), mv = smooth(span(t, LN.r1.t, LN.r1.t + 1.5));
  let w = r.w * lerp(1, 1.5, up), h = r.h * lerp(1, 1.5, up);
  let x = r.x + r.w / 2 - w / 2, y = r.y + r.h / 2 - h / 2;
  x = lerp(x, CHOSEN_END.x, mv); y = lerp(y, CHOSEN_END.y, mv); w = lerp(w, CHOSEN_END.w, mv); h = lerp(h, CHOSEN_END.h, mv);
  const ok = t >= EV.enter;
  drawWindow(ctx, x, y, w, h, {
    type: "map", title: w > 260 ? "promptotype v3 | map" : null,
    col: ok ? C.acc : t >= EV.cut ? C.dim : C.line, dot: ok ? "acc" : "grey", lw: ok ? 3 : undefined,
  });
}

function drawShouts(ctx, t) {
  for (const id of ["md1", "md2"]) {
    for (const off of [0, 1]) {
      const ts = off ? LN[id].second : LN[id].t;
      if (t < ts || t > ts + 1.6) continue;
      const k = span(t, ts, ts + 0.22), a = Math.exp(-(t - ts) / 0.6);
      ctx.save(); ctx.translate(STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h * (off ? 0.66 : 0.34));
      ctx.scale(lerp(1.35, 1, outBack(k)), lerp(1.35, 1, outBack(k)));
      font(ctx, 190, "Space Mono", 700); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(C.void, 0.6 * a); ctx.fillRect(-760, -110, 1520, 220);
      ctx.fillStyle = rgba(C.line, a); ctx.fillText("# MARKDOWN", 0, 0);
      ctx.restore();
    }
  }
  for (const id of ["sc1", "sc2"]) {
    const l = LN[id]; if (t < l.t || t >= l.end - 0.05) continue;
    ctx.fillStyle = rgba(C.void, 0.82); ctx.fillRect(STAGE.x, STAGE.y + STAGE.h / 2 - 80, STAGE.w, 160);
    font(ctx, 74, "Redaction50");
    const fit = Math.min(74, 74 * (STAGE.w - 80) / ctx.measureText(l.s).width);
    font(ctx, Math.floor(fit), "Redaction50"); ctx.fillStyle = C.red; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(typed(id, t, 50), STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h / 2 + 6);
  }
}

// The final chorus as a network of its own words; repetitions thicken the edges.
const WORDS = ["Ich", "brauch", "keinen", "Developer", "mehr"];
const WPOS = [[0.56, 0.25], [0.78, 0.33], [0.84, 0.58], [0.66, 0.76], [0.42, 0.7]];
function drawChorusNet(ctx, t) {
  if (t < LN.f1.t || t >= LN.who.t + 0.8) return;
  const out = 1 - smooth(span(t, LN.who.t, LN.who.t + 0.8));
  const { x, y, w, h } = STAGE, frozen = t >= EV.cut;
  ctx.save(); ctx.globalAlpha = out;
  ctx.fillStyle = rgba(C.void, 0.8); ctx.fillRect(x + 30, y + 40, w - 60, h - 80);
  const P = [x + w * 0.24, y + h * 0.5];
  const pts = WPOS.map(([u, v]) => [x + u * w, y + v * h]);
  // word onsets from the forced alignment in the timing report
  const t2 = [126.82, 126.84, 127.06, 127.40, 128.22], t4 = [132.98, 133.02, 133.22, LN.f4.develo, 999];
  const col = frozen ? C.dim : C.line;
  // edges: PROMPTOTYPING -> Ich -> ... -> mehr -> PROMPTOTYPING
  const chain = [P, ...pts, P];
  for (let j = 0; j < chain.length - 1; j++) {
    const first = j < WORDS.length ? t2[j] : LN.f3.t, second = j < WORDS.length ? t4[j] : 999;
    if (t < first) continue;
    if (j === 4 && t >= LN.f4.develo + 0.45) continue;         // "Develo—" never reaches "mehr" again
    const thick = (t >= second && !(j === 4)) ? 7 : 2.5;
    ctx.strokeStyle = col; ctx.lineWidth = thick;
    ctx.beginPath(); ctx.moveTo(...chain[j]); ctx.lineTo(...chain[j + 1]); ctx.stroke();
  }
  font(ctx, 66, "Redaction"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const pk = t >= LN.f3.t ? 1 + 0.15 * Math.exp(-(t - LN.f3.t) / 0.4) : 1;
  ctx.save(); ctx.translate(...P); ctx.scale(pk, pk);
  ctx.fillStyle = C.void; const pw = ctx.measureText("PROMPTOTYPING").width + 40; ctx.fillRect(-pw / 2, -50, pw, 100);
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(-pw / 2, -50, pw, 100);
  ctx.fillStyle = frozen ? C.dim : C.ink; ctx.fillText("PROMPTOTYPING", 0, 4); ctx.restore();
  font(ctx, 54, "Redaction");
  WORDS.forEach((wd, j) => {
    if (t < t2[j]) return;
    const [px, py] = pts[j];
    if (wd === "Developer" && t >= LN.f4.develo + 0.45) {
      // the word splits into tokens and the second one never arrives
      font(ctx, 54, "Redaction"); const a = ctx.measureText("Develo").width + 30, b = ctx.measureText("per").width + 30;
      ctx.fillStyle = C.void; ctx.fillRect(px - (a + b) / 2 - 6, py - 44, a, 88);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(px - (a + b) / 2 - 6, py - 44, a, 88);
      ctx.fillStyle = frozen ? C.dim : C.ink; ctx.fillText("Develo", px - (a + b) / 2 - 6 + a / 2, py + 4);
      ctx.setLineDash([8, 8]); ctx.strokeRect(px - (a + b) / 2 + a + 6, py - 44, b, 88); ctx.setLineDash([]);
      return;
    }
    const tw = ctx.measureText(wd).width + 34;
    ctx.fillStyle = C.void; ctx.fillRect(px - tw / 2, py - 44, tw, 88);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(px - tw / 2, py - 44, tw, 88);
    ctx.fillStyle = frozen ? C.dim : C.ink; ctx.fillText(wd, px, py + 4);
  });
  ctx.restore();
}

// ---------------------------------------------------------------- validation

function drawValidation(ctx, t) {
  if (t < LN.who.t || t >= LN.r1.t + 1.2) return;
  const a = smooth(span(t, LN.who.t + 0.4, LN.who.t + 1.0)) * (1 - smooth(span(t, LN.r1.t, LN.r1.t + 1.2)));
  const ok = t >= EV.enter;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = rgba(C.void, 0.85); ctx.fillRect(STAGE.x + STAGE.w / 2 - 330, STAGE.y + 20, 660, 110);
  font(ctx, 64, "Space Mono", 700); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.line; ctx.fillText("validated: ", STAGE.x + STAGE.w / 2 - 40, STAGE.y + 76);
  ctx.fillStyle = ok ? C.acc : C.red; ctx.fillText(ok ? "1" : "0", STAGE.x + STAGE.w / 2 + 210, STAGE.y + 76);
  ctx.restore();
  // the question is asked in the terminal and answered by typing
  const ty = 1060;
  ctx.fillStyle = C.void; ctx.fillRect(STAGE.x - 20, 990, STAGE.w + 40, 90);
  font(ctx, 28); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.mach; ctx.fillText("> " + typed("who", t, 30), STAGE.x, ty - 38);
  if (t >= LN.ich.t - 0.4) {
    ctx.fillStyle = C.acc; const p = "researcher> "; ctx.fillText(p, STAGE.x, ty);
    const s = t >= LN.ich.t ? "Ich." : "";
    font(ctx, 30, "Redaction"); ctx.fillStyle = C.ink;
    ctx.fillText(s, STAGE.x + 196, ty);
    if (!ok) drawCaret(ctx, STAGE.x + 196 + ctx.measureText(s).width, ty, 30, t, null);
    else { font(ctx, 18); ctx.fillStyle = rgba(C.acc, 1 - span(t, EV.enter, EV.enter + 1.5)); ctx.fillText("[enter]", STAGE.x + 270, ty); }
  }
}

// ---------------------------------------------------------------- the diff

const DIFF = [
  { id: "r1", old: "Ich hab kein Lied, nur eine Idee" },
  { id: "r2", old: null },
  { id: "r3", old: "Kein Geld und kein Developer," },
  { id: "r4", old: "nur Markdown und Kaffee." },
];
function drawDiff(ctx, t) {
  if (t < LN.r1.t) return;
  const a = smooth(span(t, LN.r1.t + 0.6, LN.r1.t + 1.4));
  const x = STAGE.x + 20, y = STAGE.y + 340, w = STAGE.w - 40, h = 470;
  ctx.save(); ctx.globalAlpha = a;
  drawWindow(ctx, x, y, w, h, { title: "idee.md | diff", col: C.ui });
  font(ctx, 18); ctx.fillStyle = C.dim; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("@@ idee.md @@", x + 30, y + 66);
  let yy = y + 116, caret = null;
  DIFF.forEach(d => {
    const l = LN[d.id];
    const show = t >= l.t - 0.6;
    font(ctx, 38, "Redaction");
    if (d.old) {
      ctx.fillStyle = rgba(C.red, show ? 1 : 0.9);
      font(ctx, 24, "Space Mono", 700); ctx.fillText("-", x + 30, yy);
      font(ctx, 38, "Redaction"); ctx.fillText(d.old, x + 70, yy);
      if (show) {
        const k = span(t, l.t - 0.6, l.t - 0.1), tw = ctx.measureText(d.old).width;
        ctx.fillRect(x + 70, yy - 12, tw * k, 3);
      }
      yy += 46;
      if (show) {
        const s = typed(d.id, t);
        ctx.fillStyle = C.acc; font(ctx, 24, "Space Mono", 700); ctx.fillText("+", x + 30, yy);
        font(ctx, 38, "Redaction"); ctx.fillText(s, x + 70, yy);
        if (t < l.end) caret = [x + 70 + ctx.measureText(s).width, yy];
        yy += 56;
      } else yy += 12;
    } else {
      ctx.fillStyle = C.ink; ctx.fillText(show ? typed(d.id, t) : "und alles, was ich versteh.", x + 70, yy);
      yy += 56;
    }
  });
  if (caret) drawCaret(ctx, caret[0], caret[1], 38, t, caretLabel(t));
  ctx.restore();
  if (t >= LN.r4.t + 2.2) {
    const k = smooth(span(t, LN.r4.t + 2.2, LN.r4.t + 2.8));
    font(ctx, 20); ctx.fillStyle = rgba(C.ui, k); ctx.textAlign = "left";
    ctx.fillText("commit e1n5a1d", STAGE.x + 20, 905);
    ctx.fillText("Author: researcher | developer", STAGE.x + 20, 935);
    font(ctx, 26, "Redaction"); ctx.fillStyle = rgba(C.acc, k);
    ctx.fillText("Ich bin jetzt selber einer.", STAGE.x + 20, 972);
    drawCup(ctx, STAGE.x + STAGE.w - 80, 940, 1.2, rgba(C.ui, k), k, t);
  }
}

// ---------------------------------------------------------------- frame

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);

  const split = smooth(span(t, EV.split, EV.split + 1.2));
  // the mirror axis between what he knows and what is built from it
  const axis = split * (1 - smooth(span(t, EV.axisOff, EV.axisOff + 1.4)));
  if (axis > 0) {
    ctx.strokeStyle = rgba(C.ui, 0.5 * axis); ctx.lineWidth = 1.5; ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.moveTo(AXIS_X, 70); ctx.lineTo(AXIS_X, 1060); ctx.stroke(); ctx.setLineDash([]);
  }
  let centres = [];
  if (split > 0) centres = drawColumn(ctx, t, lerp(-540, 0, split));

  // material layer: full frame before the split, scaled into the stage after, gone at version one
  const mat = 1 - smooth(span(t, LN.v1.t, LN.v1.t + 0.8));
  if (mat > 0) {
    ctx.save();
    const s = lerp(1, STAGE.w / W, split);
    ctx.translate(lerp(0, STAGE.x, split), lerp(0, STAGE.y + 70, split));
    ctx.scale(s, s);
    ctx.globalAlpha = mat * lerp(1, 0.6, split);
    drawMaterial(ctx, t);
    ctx.restore();
  }
  drawV1(ctx, t);
  drawDistill(ctx, t);
  if (t < LN.ctx.t) { drawV2(ctx, t); drawFast(ctx, t); }
  drawSession(ctx, t, centres);
  drawPaper(ctx, t);
  drawRush(ctx, t);
  if (t >= LN.r1.t) drawChosen(ctx, t);
  drawShouts(ctx, t);
  drawChorusNet(ctx, t);
  drawValidation(ctx, t);
  drawDiff(ctx, t);
  if (t < LN.who.t) drawTerminal(ctx, t, lerp(FULL.x, STAGE.x, split));

  drawStatus(ctx, t);
  const end = smooth(span(t, EV.fadeOut, SCENE_END));
  if (end > 0) { ctx.fillStyle = rgba(C.void, end); ctx.fillRect(0, 0, W, H); }
}
