// Ich predicte dich. The whole video is drawScene(ctx, t), a pure function of
// time in seconds. The stage is a next-token prediction view: the sentence is
// generated token by token, each step shows its candidates with probability
// bars, and "dich" is the argmax every time. Token onsets come from timeline.js.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

// One accent, used only for the addressee (dich, du, sie) and, at the very end,
// for the token that takes her place.
const C = {
  void: "#000000", hair: "#2c2e35", dim: "#555963", text: "#a9adb6", textHi: "#f2f3f6",
  accent: "#ff6a55",
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

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, "0")).join("");
}

// onsets of the mix as a list, used as the steps of the sampler
const ONSETS = AUDIO_ONSETS;
const lastOnset = t => { let o = -1; for (const x of ONSETS) { if (x > t) break; o = x; } return o; };
const onsetIndex = t => { let i = 0; for (const x of ONSETS) { if (x > t) break; i++; } return i; };
// decaying hit envelope from the most recent onset
const hit = (t, tau = 0.12) => { const o = lastOnset(t); return o < 0 ? 0 : Math.exp(-(t - o) / tau); };

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(Math.round(g), 0, 6)]}"`;
const mono = (size, bold) => `${bold ? 700 : 400} ${size}px "Space Mono"`;
const lineText = l => l.toks.map(k => k[0]).join("");
const bare = s => s.trim().replace(/[,.!?–-]+$/, "");
const isYou = s => /^(dich|du|sie)$/i.test(bare(s));

function fitSize(ctx, full, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, size * maxW / ctx.measureText(full).width);
}

// ---------------------------------------------------------------- tokens

// Token geometry of a line: x0 is where the token's ink starts (after its
// leading space), x1 where it ends.
function layoutLine(ctx, toks, x, font) {
  ctx.font = font;
  let s = "";
  return toks.map(([txt, tt]) => {
    const lead = txt.length - txt.trimStart().length;
    const x0 = x + ctx.measureText(s + txt.slice(0, lead)).width;
    s += txt;
    return { txt, t: tt, x0, x1: x + ctx.measureText(s).width };
  });
}

// o: { x, y, size, grade, color, alpha, ticks, shear, glow, accent, caret, all, grades (per token) }
function drawLine(ctx, toks, t, o) {
  const font = gradeFont(o.grade, o.size);
  const geo = layoutLine(ctx, toks, o.x, font);
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0.003) return geo;
  ctx.save();
  if (o.shear) { ctx.translate(o.x, o.y); ctx.transform(1, 0, -o.shear, 1, 0, 0); ctx.translate(-o.x, -o.y); }
  let caretX = o.x, typing = false;
  geo.forEach((g, i) => {
    if (!o.all && t < g.t) return;
    const a = o.all ? 1 : smooth(span(t, g.t, g.t + 0.07));
    if (a < 1) typing = true;
    const grade = o.grades ? o.grades[i] : o.grade;
    ctx.font = gradeFont(grade, o.size);
    const col = o.accent !== false && isYou(g.txt) ? C.accent : (o.color || C.textHi);
    ctx.globalAlpha = alpha * a;
    ctx.fillStyle = col;
    if (o.glow) { ctx.shadowColor = col; ctx.shadowBlur = o.glow; }
    ctx.fillText(g.txt.trimStart(), g.x0, o.y + (1 - a) * 8);
    ctx.shadowBlur = 0;
    if (o.ticks) {
      // token boundaries: one hairline under each token, with a gap between
      ctx.globalAlpha = alpha * a * o.ticks;
      ctx.fillStyle = isYou(g.txt) && o.accent !== false ? C.accent : C.dim;
      ctx.fillRect(g.x0 + 2, o.y + o.size * 0.24, Math.max(4, g.x1 - g.x0 - 6), Math.max(2, o.size * 0.025));
    }
    caretX = g.x1;
  });
  if (o.caret) {
    const solid = typing || o.caret === "solid";
    if (solid || Math.floor(t / 0.53) % 2 === 0) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.textHi;
      ctx.fillRect(caretX + o.size * 0.08, o.y - o.size * 0.66, Math.max(4, o.size * 0.055), o.size * 0.8);
    }
  }
  ctx.restore();
  return geo;
}

// ---------------------------------------------------------------- stack

// The current line sits on the main baseline; earlier lines rise into the
// context above, smaller and further decayed: distance in the context is
// drawn as damage, as if attention wore the type down.
const STACK = { x: 150, y: 600, size: 104, maxW: 1620 };
const AGES = [
  { y: 600, s: 1, a: 1, g: 0 },
  { y: 392, s: 0.6, a: 0.78, g: 1 },
  { y: 296, s: 0.48, a: 0.55, g: 2 },
  { y: 222, s: 0.4, a: 0.34, g: 3 },
  { y: 164, s: 0.34, a: 0, g: 4 },
];
function ageProps(age) {
  const i = clamp(Math.floor(age), 0, AGES.length - 2), k = clamp(age - i);
  const A = AGES[i], B = AGES[i + 1];
  return { y: lerp(A.y, B.y, k), s: lerp(A.s, B.s, k), a: lerp(A.a, B.a, k), g: lerp(A.g, B.g, k) };
}
const LEAD = 0.3;
const lineStart = l => l.toks[0][1] - LEAD;

function stackState(lines, t) {
  let c = 0;
  lines.forEach((l, i) => { if (t >= lineStart(l)) c = i; });
  return { c, p: smooth(span(t, lineStart(lines[c]), lineStart(lines[c]) + 0.26)) };
}

function mainSize(ctx, l, grade) {
  return fitSize(ctx, lineText(l), grade, l.size || STACK.size, STACK.maxW);
}

// The lines of a stack that are on screen at t, with their place, size and grade.
function stackLayout(ctx, t, lines, style = () => ({}), opts = {}) {
  const { c, p } = stackState(lines, t);
  const rows = [];
  for (let i = Math.max(0, c - 4); i <= c; i++) {
    const l = lines[i];
    const age = i === c ? 0 : c - i - 1 + p;
    if (age >= AGES.length - 1) continue;
    const st = style(l, i, age) || {};
    const A = ageProps(age);
    const base = st.grade === undefined ? 1 : st.grade;
    const size = mainSize(ctx, l, base) * A.s;
    const rs = st.restore || 0;
    const o = {
      x: STACK.x, y: A.y + (opts.dy || 0), size, grade: Math.round(lerp(Math.min(6, base + Math.round(A.g)), 0, rs)),
      grades: st.grades && age < 0.5 ? st.grades : null,
      color: rs > 0.5 ? C.textHi : st.color,
      alpha: lerp(A.a, Math.max(A.a, 0.85), rs) * (st.alpha === undefined ? 1 : st.alpha) * (opts.alpha === undefined ? 1 : opts.alpha),
      ticks: age < 0.5 ? (st.ticks === undefined ? 1 : st.ticks) : 0,
      shear: st.shear, glow: st.glow, accent: st.accent, all: st.all,
      caret: i === c && opts.caret !== false ? (opts.caret || true) : false,
    };
    rows.push({ l, i, age, o, geo: layoutLine(ctx, l.toks, o.x, gradeFont(o.grade, size)) });
  }
  return { c, rows };
}

// style(l, i, age) may return { grade, color, alpha, shear, glow, ticks, grades, all }
function drawStack(ctx, t, lines, style, opts = {}) {
  const { c, rows } = stackLayout(ctx, t, lines, style, opts);
  const out = { c, geo: null, prevGeo: null, size: 0 };
  for (const r of rows) {
    const geo = drawLine(ctx, r.l.toks, t, r.o);
    if (r.i === c) { out.geo = geo; out.size = r.o.size; out.y = r.o.y; }
    if (r.i === c - 1) { out.prevGeo = geo; out.prevY = r.o.y; out.prevSize = r.o.size; }
  }
  return out;
}

// ---------------------------------------------------------------- panel

// Candidate list under the caret: token, probability bar, value. The bar
// scale is linear and honest, so a 0.97 next to a 0.01 is a wall next to a hair.
const PANEL = { row: 60, label: 250, bar: 400, font: 36, value: 28 };
const PANEL_W = PANEL.label + PANEL.bar + 190;

function fmtP(p, digits = 4) {
  if (p >= 0.0001 || p === 0) return p.toFixed(digits);
  return p.toExponential(1);
}

// o: { open, grow, pick (index or -1), picked (0..1), close, empty, jitter[], digits, header, reach (0..1) }
function drawPanel(ctx, x, y, cands, o) {
  const vis = o.open * (1 - (o.close || 0));
  if (vis <= 0) return;
  ctx.save();
  if (o.header) {
    ctx.globalAlpha = vis; ctx.font = mono(PANEL.value); ctx.fillStyle = C.text;
    ctx.fillText(o.header, x, y - 22);
  }
  // both ends of the bar scale, so an overshoot reads as one
  const bx = x + PANEL.label;
  ctx.globalAlpha = vis; ctx.fillStyle = C.hair;
  ctx.fillRect(bx, y + 6, 1, cands.length * PANEL.row - 12);
  ctx.fillRect(bx + PANEL.bar, y + 6, 1, cands.length * PANEL.row - 12);
  cands.forEach(([tok, p], i) => {
    const ry = y + i * PANEL.row;
    const rowIn = smooth(span(o.open, i * 0.08, i * 0.08 + 0.6));
    if (rowIn <= 0) return;
    const chosen = i === o.pick, lit = chosen && o.picked > 0;
    const you = isYou(tok);
    const fade = chosen ? 1 : 1 - 0.6 * (o.picked || 0);
    ctx.globalAlpha = vis * rowIn * fade;
    ctx.font = mono(PANEL.font);
    ctx.fillStyle = lit ? (you ? C.accent : C.textHi) : C.text;
    ctx.fillText(tok.trim() || "␣", x, ry + 42);
    const jit = o.jitter ? o.jitter[i] || 0 : 0;
    if (o.empty) {
      ctx.strokeStyle = C.text; ctx.lineWidth = 1.5; ctx.setLineDash([7, 8]);
      ctx.strokeRect(bx + 0.5, ry + 17.5, PANEL.bar * (o.grow || 0), 26);
      ctx.setLineDash([]);
      ctx.font = mono(PANEL.value); ctx.fillStyle = C.text;
      ctx.fillText("—", bx + PANEL.bar + 28, ry + 40);
      return;
    }
    let len = Math.max(0, p * (o.grow || 0) * (1 + jit)) * PANEL.bar;
    // the argmax keeps running after it was chosen, out to the edge of the frame
    if (lit && o.reach) len = lerp(len, W - bx, outCubic(o.reach));
    ctx.fillStyle = you ? C.accent : lit ? C.textHi : mix(C.text, C.dim, 0.25);
    ctx.fillRect(bx, ry + 17, Math.max(len > 0 ? 2 : 0, len), 26);
    if (lit && o.reach > 0) return;
    ctx.font = mono(PANEL.value); ctx.fillStyle = lit ? C.textHi : C.text;
    const shown = p * clamp(o.grow || 0) * (1 + jit);
    ctx.fillText(fmtP(shown, o.digits), bx + Math.max(PANEL.bar, len) + 28, ry + 40);
  });
  ctx.restore();
}

// A pick is the step at which one token of a line is chosen from its
// candidates. The panel opens just before the syllable, and the chosen row
// lights on the sung onset.
function pickState(t, tp, hold = 0.45, closeBy = Infinity) {
  const c0 = Math.min(tp + hold, closeBy - 0.3);
  return {
    open: span(t, tp - 0.62, tp - 0.25),
    grow: outCubic(span(t, tp - 0.5, tp - 0.06)),
    picked: smooth(span(t, tp - 0.02, tp + 0.06)),
    close: smooth(span(t, c0, c0 + 0.3)),
  };
}
const panelX = x => clamp(x, STACK.x, W - PANEL_W - 60);

// ---------------------------------------------------------------- candidates

const DICH = [[" dich", 0.9731], [" mich", 0.0112], [" dir", 0.0046], [" nicht", 0.0031], [" sie", 0.0024]];
// picks per line id: token index and its candidates (index 0 is the sampled one unless sel says otherwise)
const PICKS = {
  open: [{ i: 3, c: DICH }],
  g1: [{ i: 0, c: [["Token", 0.41], ["Doch", 0.19], ["Ich", 0.12], ["Nein", 0.08], ["Das", 0.05]], early: 1.4 }],
  g2: [{ i: 0, c: [["scale", 0.52], ["Token", 0.22], ["und", 0.09], ["so", 0.05], ["mehr", 0.04]] }],
  g3: [{ i: 0, c: [["Token", 0.93], ["scale", 0.03], ["Ich", 0.02], ["und", 0.01], ["noch", 0.01]] }],
  g4: [{ i: 3, c: DICH, hold: 0.9 }],
  v1: [{ i: 2, c: [[" auto", 0.38], [" müde", 0.21], [" hier", 0.12], [" kein", 0.07], [" da", 0.05]], hold: 1.2 }],
  v2: [{ i: 1, c: [[" emer", 0.44], [" vernetzt", 0.13], [" verliebt", 0.09], [" verwirrt", 0.06], [" wach", 0.04]], hold: 0.8 }],
  // over- and underestimated: one bar runs past the end of its scale, the next is a hair and still wins
  v3: [
    { i: 0, c: [["über-", 1.31], ["unter-", 0.21], ["gut", 0.06], ["ganz", 0.04], ["nie", 0.02]] },
    { i: 2, c: [[" über", 0.83], [" falsch", 0.11], [" gar", 0.04], [" un", 0.012], [" unter", 0.0002]], sel: 4, hold: 1.4 },
  ],
  v4: [{ i: 1, c: [[" ag", 0.09], [" leise", 0.085], [" anders", 0.08], [" still", 0.078], [" wach", 0.074]], hot: true, hold: 1.4 }],
  v5: [{ i: 1, c: [[" token", 0.9962], [" word", 0.0021], [" step", 0.0009], [" time", 0.0004], [" one", 0.0002]], hold: 0.5 }],
  v6: [{ i: 2, c: [[" Sinn,", 0.041], [" Sinnn", 0.039], [" Sin", 0.037], [" ſinn", 0.036], [" Sinn?", 0.035]], hold: 1.0 }],
  r1a: [{ i: 3, c: DICH, reach: true }],
  r1b: [{ i: 3, c: [[" liest.", 0.31], [" hörst.", 0.12], [" siehst.", 0.09], [" vergisst.", 0.07], [" gehst.", 0.06]] }],
  r2a: [{ i: 3, c: DICH, reach: true }],
  r3a: [{ i: 3, c: DICH, reach: true }],
  r4a: [{ i: 3, c: DICH, reach: true }],
  e1: [{ i: 3, c: DICH, reach: true, hold: 1.0 }],
};

// Temperature per time: the one interface parameter that carries meaning.
function temperature(t) {
  if (t < TL.verse[3].toks[0][1] - 0.2) return 0.7;
  if (t < TL.verse[4].toks[0][1] - 0.4) return lerp(0.7, 1.9, smooth(span(t, TL.verse[3].toks[0][1] - 0.2, TL.verse[3].toks[1][1])));
  if (t < TL.end) return lerp(1.9, 0.7, smooth(span(t, TL.verse[4].toks[0][1] - 0.4, TL.verse[4].toks[0][1] + 0.4)));
  return lerp(0.7, 4.0, Math.pow(span(t, TL.endLines[0].toks[3][1] + 1.0, TL.nicht), 1.6));
}

function drawReadout(ctx, t, alpha = 1) {
  const T = temperature(t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = mono(28); ctx.textAlign = "right";
  ctx.fillStyle = T > 0.75 ? mix(C.text, C.textHi, span(T, 0.7, 1.9)) : C.dim;
  ctx.fillText("T " + T.toFixed(2), W - 150, 110);
  ctx.restore();
}

// Panels of the current line, and of the next one when its first pick
// opens before the line itself has started.
function drawPicks(ctx, t, line, geo, y, next) {
  const run = (ln, g) => {
    const picks = PICKS[ln.id] || [];
    picks.forEach((pk, n) => {
      const tp = ln.toks[pk.i][1];
      const lead = pk.early || 0.65;
      if (t < tp - lead || t > tp + (pk.hold || 0.45) + 0.6) return;
      // consecutive picks in one line hand over instead of overlapping
      const prev = picks[n - 1] ? ln.toks[picks[n - 1].i][1] : -Infinity;
      const next = picks[n + 1] ? ln.toks[picks[n + 1].i][1] : Infinity;
      const opensAt = tq => Math.max(tq - 0.62, tp + 0.3);
      const st = pickState(t, tp, pk.hold, next < Infinity ? opensAt(next) : Infinity);
      if (prev > -Infinity && tp - 0.62 < prev + 0.3) {
        const o0 = prev + 0.3;
        st.open = span(t, o0, o0 + 0.15);
        st.grow = outCubic(span(t, o0 + 0.05, tp - 0.04));
      }
      if (pk.early) { st.open = span(t, tp - pk.early, tp - pk.early + 0.4); st.grow = outCubic(span(t, tp - pk.early + 0.2, tp - 0.06)); }
      let jitter = null;
      if (pk.hot) {
        // high temperature: the flat candidates keep trading places with the drums
        const r = mulberry32(onsetIndex(t) * 31 + 7);
        jitter = pk.c.map(() => (r() - 0.5) * 0.5);
      }
      const reach = pk.reach ? span(t, tp + 0.08, tp + 0.5) : 0;
      drawPanel(ctx, panelX(g[pk.i].x0), y, pk.c, { ...st, pick: pk.sel === undefined ? 0 : pk.sel, jitter, reach });
    });
  };
  run(line, geo);
  if (next && t < lineStart(next)) run(next, layoutLine(ctx, next.toks, STACK.x, gradeFont(1, mainSize(ctx, next, 1))));
}

// ---------------------------------------------------------------- attention arcs

// Autoregression drawn as attention: every new token reaches back to earlier
// ones. Weights are seeded per token; arcs to the addressee are accent.
function drawArcs(ctx, t, geo, y, size, extra = []) {
  ctx.save();
  const top = y - size * 0.78;
  geo.forEach((g, i) => {
    if (i === 0 || t < g.t) return;
    const life = 1 - span(t, g.t + 0.5, g.t + 1.8);
    if (life <= 0) return;
    const draw = outCubic(span(t, g.t, g.t + 0.22));
    const r = mulberry32(Math.round(g.t * 100));
    for (let j = 0; j < i; j++) {
      const w = j === i - 1 ? 0.9 : 0.25 + 0.6 * r();
      arc(ctx, (g.x0 + g.x1) / 2, top, (geo[j].x0 + geo[j].x1) / 2, top, draw, life * w, isYou(geo[j].txt) ? C.accent : C.text, 1 + w * 2);
    }
  });
  for (const e of extra) {
    if (t < e.t) continue;
    const life = 1 - span(t, e.t + (e.hold || 1.2), e.t + (e.hold || 1.2) + 1.0);
    if (life <= 0) continue;
    arc(ctx, e.x0, e.y0, e.x1, e.y1, outCubic(span(t, e.t, e.t + 0.3)), life, e.color || C.accent, e.width || 3, e.bow);
  }
  ctx.restore();
}

function arc(ctx, x0, y0, x1, y1, draw, alpha, color, width, bow) {
  const h = bow === undefined ? Math.min(150, 26 + Math.abs(x1 - x0) * 0.28) : bow;
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - h;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  // partial quadratic: drawn from the new token back to its target
  const n = 24, m = Math.max(1, Math.round(n * draw));
  for (let s = 1; s <= m; s++) {
    const u = s / n;
    ctx.lineTo((1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1);
  }
  ctx.stroke();
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
  if (amount > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amount;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(GRAIN[frozen ? 0 : Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ctx.createPattern(SCAN, "repeat"); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- vocabulary tail

// "scale it up": the full distribution over a vocabulary of 50 257 tokens,
// ranked, on a log scale. The head is "dich"; the human words live far out in
// the tail, a few millionths each.
const VOCAB = 50257;
const TAIL_WORDS = [
  " und", " der", " die", " das", " ist", " noch", " immer", " heute", " Zeit", " Hand", " Nacht", " Fenster",
  " warum", " Angst", " Kaffee", " müde", " leise", " Graz", " allein", " zusammen", " vielleicht", " bleib",
  " warte", " zurück", " Herz", " Atem", " Schlaf", " Tabs", " Antwort", " Frage", " Stimme", " Name", " Haus",
  " Weg", " Tür", " the", " of", " and", " to", " token", " prompt", " model", " loss", " weight", " layer",
  "ing", "ung", " ver", "er", "en", "lich", "keit", " ge", " be", " zu", " mit", " auf", " wie", " so",
  " Sommer", " Hände", " Augen", " Mund", " Stadt", " Zug", " Bahnhof", " Licht", " Rauschen", " Wasser",
  " Monstera", " Blätter", " gieß", " weiter", " stehen", " fallen", " schreib", " lies", " hör",
  " sag", " frag", " geh", " komm", " halt", " still", " wach", " echt", " falsch", " richtig", " gut", " genug",
  " niemand", " jemand", " alles", " etwas", " wenig", " viel", " mehr", " weniger", " fast", " kaum",
  " Text", " Satz", " Wort", " Zeichen", " Komma", " Punkt", "…", " –", " ?", " !", " ,", " .", "↵",
  " Brief", " Anruf", " Nachricht", " gelesen", " gesendet", " Entwurf", " gestern", " nie",
  " Regen", " Schnee", " Wind", " Meer", " Berg", " Mur", " Brücke", " Ufer", " Abend", " Mittag",
];
const TAIL_SPECIAL = { 1: " dich", 2: " mich", 3: " dir", 4: " nicht", 5: " sie", 14: " uns", 412: " morgen", 9311: " trotzdem", 50257: " nichts" };
const tailToken = r => TAIL_SPECIAL[r] || TAIL_WORDS[Math.floor(mulberry32(r * 7919 + 13)() * TAIL_WORDS.length)];
const TAIL_Z = (() => { let z = 0; for (let r = 6; r <= VOCAB; r++) z += Math.pow(r, -1.1); return z; })();
const HEAD_MASS = DICH.reduce((s, c) => s + c[1], 0);
function tailP(r) {
  if (r <= 5) return DICH[r - 1][1];
  return (1 - HEAD_MASS) * Math.pow(r, -1.1) / TAIL_Z;
}
// temperature flattens the distribution: p^(1/T), renormalised over all ranks
const TEMP_Z = {};
function tailPT(r, T) {
  if (Math.abs(T - 1) < 1e-3) return tailP(r);
  const key = T.toFixed(2);
  if (!(key in TEMP_Z)) {
    // normalised with the key's T, so the cached value does not depend on the first caller's T
    const Tk = +key;
    let z = 0;
    for (let k = 1; k <= VOCAB; k++) z += Math.pow(tailP(k), 1 / Tk);
    TEMP_Z[key] = z;
  }
  return Math.pow(tailP(r), 1 / T) / TEMP_Z[key];
}

const TAIL = { head: 700, step: 40, base: 900, k: 48 };
const barH = p => Math.max(6, (Math.log10(p) + 9.5) * TAIL.k);

// camera rank at the reading head; moves are log-space, so every whoosh feels the scale
function rankPath(t, moves) {
  let r = moves[0][1];
  for (let i = 1; i < moves.length; i++) {
    const [t0, to, d] = moves[i];
    if (t < t0) break;
    const e = smooth(span(t, t0, t0 + (d || 0.5)));
    r = Math.exp(lerp(Math.log(r), Math.log(to), e));
  }
  return r;
}
const BUILD_MOVES = [[0, 1], [22.52, 14], [24.58, 412], [25.8, 9311], [27.4, 50257], [28.52, 1, 0.48]];

// o: { h (rank at head), speed (ranks per second), T, alpha, token (rank -> text),
//      uniform (every rank 1/V), sampled (rank that won), fall (0..1, the rest collapsing) }
// At speed the bars give way to the profile of the distribution and a ruler
// of ranks, so a whoosh across ten thousand tokens still reads as distance.
function drawTail(ctx, t, o) {
  const T = o.T || 1, a = o.alpha === undefined ? 1 : o.alpha, fall = o.fall || 0;
  if (a <= 0) return;
  const token = o.token || tailToken;
  const pAt = r => o.uniform ? 1 / VOCAB : tailPT(r, T);
  const bh = p => o.uniform ? 150 : barH(p);
  const blur = smooth(span(o.speed, 10, 40));
  ctx.save();
  ctx.globalAlpha = a * (1 - fall);
  ctx.fillStyle = C.dim; ctx.fillRect(0, TAIL.base, W, 2);
  // logits re-sampled a little on every drum onset
  const shake = mulberry32(onsetIndex(t) * 17 + 3);
  const jolt = hit(t, 0.18) * 0.07;
  if (blur > 0) {
    ctx.globalAlpha = a * blur * (1 - fall);
    ctx.strokeStyle = C.text; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const r = Math.max(1, Math.round(clamp(o.h + (x - TAIL.head) / TAIL.step, 1, VOCAB)));
      const y = TAIL.base - barH(pAt(r));
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // ruler: ticks at a rank interval matched to the speed
    const step = Math.pow(10, Math.max(1, Math.floor(Math.log10(Math.max(10, o.speed * 0.12)))));
    const rl = o.h - TAIL.head / TAIL.step, rr = o.h + (W - TAIL.head) / TAIL.step;
    const span1 = (rr - rl);
    ctx.fillStyle = C.text; ctx.font = mono(20);
    for (let r = Math.ceil(rl / step) * step; r <= rr; r += step) {
      const x = TAIL.head + (r - o.h) * TAIL.step;
      ctx.fillRect(x, TAIL.base + 4, 2, 16);
      if (span1 / step < 12) ctx.fillText(r.toLocaleString("de-AT"), x + 6, TAIL.base + 22);
    }
  }
  const r0 = Math.max(1, Math.floor(o.h - TAIL.head / TAIL.step) - 1), r1 = Math.min(VOCAB, Math.ceil(o.h + (W - TAIL.head) / TAIL.step) + 1);
  const rh = Math.round(o.h);
  for (let r = r0; r <= r1 && blur < 1; r++) {
    const x = TAIL.head + (r - o.h) * TAIL.step;
    if (x < -40 || x > W + 40) continue;
    const won = r === o.sampled;
    let h = bh(pAt(r)) * (1 + (r > 1 ? (shake() - 0.5) * jolt : 0));
    if (won) h = lerp(h, barH(1), outCubic(span(t, o.sampledAt, o.sampledAt + 0.2)));
    const keep = won ? 1 : 1 - fall;
    if (keep <= 0) continue;
    const you = !o.uniform && o.sampled === undefined && r <= 5 && isYou(token(r));
    const head = r === rh;
    ctx.globalAlpha = a * (1 - blur) * keep * (won || you || head ? 1 : 0.85);
    ctx.fillStyle = won || you ? C.accent : head ? C.textHi : C.text;
    ctx.fillRect(x - 5, TAIL.base - h, 10, h);
    ctx.save();
    ctx.translate(x + 8, TAIL.base - h - 14); ctx.rotate(-Math.PI / 2);
    ctx.font = mono(head ? 26 : 20);
    ctx.globalAlpha = a * (1 - blur) * keep * (head || won ? 1 : 0.7);
    ctx.fillText(token(r).trim(), 0, 0);
    ctx.restore();
  }
  // reading head: rank and probability of the token under it
  ctx.globalAlpha = a * (o.headAlpha === undefined ? 1 : o.headAlpha);
  ctx.fillStyle = C.dim; ctx.fillRect(TAIL.head - 1, TAIL.base + 14, 2, 26);
  ctx.font = mono(28); ctx.fillStyle = o.sampled !== undefined && t >= o.sampledAt ? C.accent : C.textHi;
  ctx.fillText("#" + rh.toLocaleString("de-AT"), TAIL.head + 16, TAIL.base + 44);
  ctx.fillStyle = C.text;
  const p = o.sampled !== undefined && t >= o.sampledAt ? 1 : pAt(rh);
  ctx.fillText("p " + fmtP(p, 4), TAIL.head + 16, TAIL.base + 82);
  ctx.restore();
}

// the context the tail is predicting for, with the token under the head in its slot
function drawSlotLine(ctx, prefix, slotTok, o) {
  const size = o.size || 96, grade = o.grade === undefined ? 1 : o.grade;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.font = gradeFont(grade, size);
  ctx.fillStyle = C.textHi;
  ctx.fillText(prefix, o.x, o.y);
  const x = o.x + ctx.measureText(prefix + " ").width;
  const you = isYou(slotTok) || o.slotAccent;
  ctx.fillStyle = you ? C.accent : o.slotColor || C.text;
  ctx.fillText(slotTok.trim(), x, o.y);
  ctx.fillStyle = you ? C.accent : C.dim;
  ctx.fillRect(x + 2, o.y + size * 0.24, Math.max(10, ctx.measureText(slotTok.trim()).width - 4), Math.max(2, size * 0.025));
  ctx.restore();
}

// ---------------------------------------------------------------- opening

// Cold open: the hook is shouted before anything exists, then taken back
// token by token, until only the caret is left.
function sceneOpen(ctx, t) {
  const L = TL.open;
  const del = [1.9, 2.12, 2.34, 2.56];
  const kept = L.toks.filter((_, i) => t < del[L.toks.length - 1 - i]);
  const size = mainSize(ctx, L, 4);
  const geo = drawLine(ctx, kept, t, { x: STACK.x, y: STACK.y, size, grade: 4, ticks: 1, caret: "solid" });
  if (kept.length === L.toks.length) drawPicks(ctx, t, L, geo, STACK.y + 70);
}

// Intro: no context yet, so every token of the vocabulary is equally likely.
// A flat horizon of identical bars drifts by; the drums re-deal its labels.
// The human's sentence then arrives on top of it.
function sceneIntro(ctx, t) {
  const p0 = TL.prompt.toks[0][1];
  if (t < p0 - 0.2) drawLine(ctx, [], t, { x: STACK.x, y: STACK.y, size: STACK.size, grade: 1, caret: true });
  const deal = onsetIndex(t);
  const token = r => TAIL_WORDS[Math.floor(mulberry32(r * 131 + deal * 7919)() * TAIL_WORDS.length)];
  const g1 = TL.gen[0].toks[0][1] - PICKS.g1[0].early;
  const a = smooth(span(t, TL.intro, TL.intro + 1.0)) * (1 - smooth(span(t, g1 - 0.6, g1)));
  drawTail(ctx, t, { h: 9000 + (t - TL.intro) * 2.2, speed: 2, uniform: true, alpha: a, token });
  if (t < p0 - 0.2) drawReadout(ctx, t, a);
}

const GEN_LINES = [TL.prompt, ...TL.gen];
// the human's line is input, not output: grey, cracked type, no token marks
const genStyle = t => l => l.id === "prompt" ? { grade: 3, color: C.text, ticks: 0 }
  : { grade: 1, alpha: l.id === "g4" && t >= TL.tail - 0.25 ? 0 : 1 };

function sceneGen(ctx, t) {
  const fade = 1 - smooth(span(t, TL.tail - 0.2, TL.tail + 0.3));
  const s = drawStack(ctx, t, GEN_LINES, genStyle(t), { alpha: fade, caret: t < TL.tail - 0.4 });
  const line = GEN_LINES[s.c];
  drawPicks(ctx, t, line, s.geo, s.y + 70, GEN_LINES[s.c + 1]);
  drawReadout(ctx, t, fade);
}

function sceneTail(ctx, t) {
  const h = rankPath(t, BUILD_MOVES);
  const speed = Math.abs(rankPath(t + 0.02, BUILD_MOVES) - rankPath(t - 0.02, BUILD_MOVES)) / 0.04;
  const into = smooth(span(t, TL.tail - 0.1, TL.tail + 0.6));
  const out = smooth(span(t, TL.verse[0].toks[0][1] - 0.32, TL.verse[0].toks[0][1] - 0.12));
  drawTail(ctx, t, { h, speed, alpha: into * (1 - out) });
  // the slot shows the token under the head, at most twelve changes a second
  const hq = rankPath(Math.floor(t * 12) / 12, BUILD_MOVES);
  const g4 = TL.gen[3];
  const size = mainSize(ctx, g4, 1);
  const k = smooth(span(t, TL.tail - 0.25, TL.tail + 0.45));
  drawSlotLine(ctx, "Ich predicte", tailToken(Math.round(hq)), {
    x: STACK.x, y: lerp(STACK.y, 250, k), size: lerp(size, 96, k), alpha: 1 - out,
  });
}

// ---------------------------------------------------------------- verse

function verseStyle(l) {
  if (l.id === "v4") return { grade: 4 };
  // "schwach emergent": the word comes up out of the damage
  if (l.id === "v2") return { grade: 2, grades: [2, 5, 4] };
  return { grade: 2 };
}

function sceneVerse(ctx, t) {
  const fade = 1 - smooth(span(t, TL.still - 0.1, TL.still + 0.35));
  ctx.save();
  // at high temperature the frame flinches on every hit
  const hot = span(temperature(t), 1.2, 1.9);
  if (hot > 0) {
    const r = mulberry32(onsetIndex(t) * 13 + 1), j = hit(t, 0.09) * 14 * hot;
    ctx.translate((r() - 0.5) * j, (r() - 0.5) * j);
  }
  const s = drawStack(ctx, t, TL.verse, verseStyle, { alpha: fade });
  ctx.globalAlpha = fade;
  drawArcs(ctx, t, s.geo, s.y, s.size);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = fade;
  drawPicks(ctx, t, TL.verse[s.c], s.geo, s.y + 70, TL.verse[s.c + 1]);
  ctx.restore();
  drawReadout(ctx, t, fade);
}

// ---------------------------------------------------------------- still

// "Es ist nur eine statistische Verteilung": the distribution itself, exact
// and motionless. Nothing moves here but the spoken words.
const CHART = [...DICH, [" uns", 0.0019], [" es", 0.0013], [" dein", 0.0009]];
function sceneStill(ctx, t) {
  const a = smooth(span(t, TL.still + 0.05, TL.still + 0.6));
  const x0 = 760, base = 690, hMax = 470, colW = 112;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = mono(24); ctx.fillStyle = C.text;
  ctx.fillText("P( · | Ich predicte )", x0, base - hMax - 50);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const y = base - v * hMax;
    ctx.fillStyle = v === 0 ? C.dim : C.hair;
    ctx.fillRect(x0, y, colW * CHART.length, v === 0 ? 2 : 1);
    ctx.font = mono(20); ctx.fillStyle = C.dim;
    ctx.fillText(v.toFixed(2), x0 - 78, y + 7);
  }
  CHART.forEach(([tok, p], i) => {
    const cx = x0 + i * colW + colW / 2;
    const h = Math.max(1, p * hMax);
    ctx.fillStyle = isYou(tok) ? C.accent : C.text;
    ctx.fillRect(cx - 24, base - h, 48, h);
    ctx.font = mono(26); ctx.textAlign = "center";
    ctx.fillStyle = isYou(tok) ? C.accent : C.text;
    ctx.fillText(tok.trim(), cx, base + 42);
    ctx.font = mono(19); ctx.fillStyle = C.text;
    ctx.fillText(p.toFixed(4), cx, base - h - 14);
    ctx.textAlign = "left";
  });
  ctx.restore();
  const [s1, s2] = TL.spoken;
  const size = fitSize(ctx, lineText(s1), 0, 84, STACK.maxW);
  drawLine(ctx, s1.toks, t, { x: STACK.x, y: 870, size, grade: 0, ticks: 0.7 });
  drawLine(ctx, s2.toks, t, { x: STACK.x, y: 870 + size * 1.15, size, grade: 0, ticks: 0.7 });
}

// ---------------------------------------------------------------- refrain

// Refrain: the same prediction four times, each time the second line bends
// the instrument. "liest": being read restores the type. "schief": the line
// is skewed until the end of "ist". "Rauschen, Licht": noise, then clean light.
// "und du mich nicht": the reverse distribution, which cannot be computed.
function refrainStyle(t) {
  // "bis du mich liest": while it is read, the whole context is restored
  const r1b = TL.refrain[1], tl = r1b.toks[3][1];
  const read = smooth(span(t, tl - 0.05, tl + 0.35)) * (1 - smooth(span(t, tl + 1.6, tl + 2.6)));
  return (l, i, age) => {
    const base = { grade: 1, restore: age >= 0.5 ? read : 0 };
    if (l.id === "r1b") return { grade: 1, grades: l.toks.map((k, j) => t >= tl ? 0 : 2) };
    if (l.id === "r2b") {
      const [t0, t1] = [l.toks[0][1], l.toks[4][1]];
      return { grade: 1, shear: age < 1 ? 0.42 * (1 - smooth(span(t, t1 - 0.25, t1 + 0.2))) * (t < t0 - 0.4 ? 0 : 1) : 0 };
    }
    if (l.id === "r3b") {
      const tr = l.toks[1][1], tl = l.toks[3][1];
      if (age < 0.5 && t >= tr && t < tl) return { grade: 6 };
      if (age < 0.5 && t >= tl) return { grade: 0, glow: 34 * (1 - span(t, tl + 0.6, tl + 2.2)) };
    }
    return base;
  };
}

function sceneRefrain(ctx, t) {
  const lines = TL.refrain;
  const s = drawStack(ctx, t, lines, refrainStyle(t));
  const line = lines[s.c];
  const extra = [];
  // "du" reaches back to the "dich" of the line before: the same person
  if ((line.id === "r1b" || line.id === "r4b") && s.prevGeo) {
    const du = s.geo[1], dich = s.prevGeo[3];
    extra.push({ t: line.toks[1][1], x0: (du.x0 + du.x1) / 2, y0: s.y - s.size * 0.78, x1: (dich.x0 + dich.x1) / 2, y1: s.prevY + 14, color: C.accent, width: 3, bow: 40, hold: 1.6 });
  }
  drawArcs(ctx, t, s.geo, s.y, s.size, extra);
  drawPicks(ctx, t, line, s.geo, s.y + 70, lines[s.c + 1]);
  // "und du mich nicht": the reverse distribution has no values
  if (line.id === "r4b") {
    const tn = line.toks[3][1];
    const open = smooth(span(t, tn + 0.2, tn + 0.8)) * (1 - smooth(span(t, TL.bridge - 0.3, TL.bridge + 0.1)));
    drawPanel(ctx, panelX(s.geo[2].x0), s.y + 120, [[" mich", 0], [" ich", 0], [" uns", 0], [" wir", 0]], {
      open, grow: smooth(span(t, tn + 0.4, tn + 1.6)), pick: -1, empty: true, header: "P( · | du )",
    });
  }
  drawReadout(ctx, t);
}

// ---------------------------------------------------------------- latent space

// Every token of the song as a point in an embedding space. Pronouns, the
// machine's vocabulary, the felt words and the function words form loose
// clusters; ich, dich, du, mich are placed so that dich - ich = mich - du.
// "sie" lies far outside the cloud.
const ANALOGY = { ich: [-520, 110, -40], dich: [-290, -40, 40], du: [-560, -150, 30] };
ANALOGY.mich = ANALOGY.du.map((v, i) => v + ANALOGY.dich[i] - ANALOGY.ich[i]);
const SIE = [1150, -360, 1750];
const CLUSTERS = {
  pron: { c: [-380, 0, 0], w: ["uns", "es", "wir", "mir"] },
  tech: { c: [420, -150, 140], w: ["token", "transformer", "trans", "former", "scale", "auto", "regress", "iv", "emer", "gent", "pred", "icte", "next", "pre", "dicted", "em", "bed", "dings", "vector", "programs", "latent", "space", "statist", "ische", "verteil", "ung"] },
  feel: { c: [120, 230, -160], w: ["liest", "licht", "rauschen", "echt", "sinn", "schief", "nicht", "nichts", "spricht", "schwach", "ag", "gress", "über", "unter", "schätzt", "werd"] },
};
const keyOf = s => bare(s).toLowerCase().replace(/-$/, "");
const EMBED = (() => {
  const all = [TL.open, TL.prompt, ...TL.gen, ...TL.verse, ...TL.spoken, ...TL.refrain, ...TL.bridgeLines];
  const pts = new Map();
  const r = mulberry32(2024);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  for (const l of all) for (const [tok] of l.toks) {
    const k = keyOf(tok);
    if (!k || k === "sie" || pts.has(k)) continue;
    let pos = ANALOGY[k];
    if (!pos) {
      const cl = Object.values(CLUSTERS).find(c => c.w.includes(k));
      const c = cl ? cl.c : [-40, -250, 40];
      pos = [c[0] + gauss() * 300, c[1] + gauss() * 170, c[2] + gauss() * 260];
    }
    pts.set(k, { label: bare(tok), pos, you: isYou(tok) });
  }
  return pts;
})();
const DUST = (() => {
  const r = mulberry32(77), out = [];
  const g = () => (r() + r() + r() + r() - 2) / 2;
  for (let i = 0; i < 900; i++) out.push([g() * 1100, g() * 600, g() * 1300 + 300 * r()]);
  return out;
})();
const CLOUD_CY = 485;

function project(p, cam) {
  const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  const x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, y = p[1];
  const dz = z - cam.z;
  if (dz < 40) return null;
  const k = cam.f / dz;
  return { x: W / 2 + (x - cam.x) * k, y: CLOUD_CY + (y - cam.y) * k, k, dz };
}

function bridgeCam(t) {
  const t0 = TL.bridgeLines[2].toks[0][1];
  const e = smooth(span(t, t0, TL.flight));
  return { x: 0, y: 0, z: lerp(-1500, -1850, e), yaw: 0.42 * e + 0.05 * span(t, TL.bridge, t0), f: 1780 };
}

// Camera of the flight toward her: steady drift plus a lunge on every onset,
// normalised so that it arrives exactly on her line.
const FLIGHT_ONSETS = ONSETS.filter(o => o >= TL.flight && o < TL.her.toks[0][1]);
function flightProgress(t) {
  const t0 = TL.flight, t1 = TL.her.toks[0][1];
  const f = tt => 0.6 * (tt - t0) + FLIGHT_ONSETS.reduce((s, o) => s + (tt > o ? 1 - Math.exp(-(tt - o) / 0.16) : 0), 0);
  const u = clamp(f(Math.min(t, t1)) / f(t1));
  return 1 - Math.pow(1 - u, 1.7);
}
function rotY(p, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function flightCam(t) {
  const start = bridgeCam(TL.flight);
  const her = rotY(SIE, start.yaw);
  const e = flightProgress(t);
  return { ...start, x: lerp(start.x, her[0], e), y: lerp(start.y, her[1], e), z: lerp(start.z, her[2] - 340, e) };
}

// The vocabulary between the cloud and her, laid along the flight path in the
// turned frame, so the flight never runs through empty space.
const FIELD = (() => {
  const r = mulberry32(4242), out = [];
  const yaw = 0.47;
  const her = rotY(SIE, yaw);
  const a = [0, 0, -1850], b = [her[0], her[1], her[2] - 340];
  for (let i = 0; i < 380; i++) {
    const u = 0.15 + 0.9 * Math.sqrt(r());
    const ang = r() * Math.PI * 2, rad = 160 + 900 * Math.pow(r(), 0.7);
    out.push({
      pos: [lerp(a[0], b[0], u) + Math.cos(ang) * rad, lerp(a[1], b[1], u) + Math.sin(ang) * rad * 0.6, lerp(a[2], b[2], u)],
      label: TAIL_WORDS[Math.floor(r() * TAIL_WORDS.length)].trim(),
    });
  }
  return out;
})();

// o: { alpha, labels (0..1), dust (0..1), skip (keys drawn elsewhere), labelFade(k), herAlpha, herColor, field (0..1) }
function drawCloud(ctx, t, cam, o) {
  const items = [];
  if (o.field) for (const f of FIELD) { const q = project(rotY(f.pos, -cam.yaw), cam); if (q) items.push({ q, e: { label: f.label, you: false }, field: true }); }
  DUST.forEach((p, i) => { const q = project(p, cam); if (q) items.push({ q, dust: true, i }); });
  for (const [k, e] of EMBED) {
    if (o.skip && o.skip.has(k)) continue;
    const q = project(e.pos, cam); if (q) items.push({ q, e, k });
  }
  items.sort((a, b) => b.q.dz - a.q.dz);
  ctx.save();
  // labels that would overprint a nearer (or more important) label stay unlabelled
  const boxes = [];
  const ranked = items.filter(it => !it.dust).sort((a, b) => (b.e.you || ANALOGY[b.k] ? 1 : 0) - (a.e.you || ANALOGY[a.k] ? 1 : 0) || a.q.dz - b.q.dz);
  for (const it of ranked) {
    const fs = Math.round(clamp(24 * it.q.k, 15, 150)), s = clamp(7 * it.q.k, 3, 26);
    ctx.font = mono(fs);
    const b = [it.q.x + s - 4, it.q.y - s * 0.6 - fs * 0.8, ctx.measureText(it.e.label).width + 8, fs];
    it.hide = boxes.some(c => b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]);
    if (!it.hide) boxes.push(b);
  }
  for (const it of items) {
    const { q } = it;
    const depth = (1 - span(q.dz, 2600, 4200)) * span(q.dz, 60, 300);
    if (depth <= 0 || q.x < -200 || q.x > W + 200 || q.y < -200 || q.y > H + 200) continue;
    if (it.dust) {
      const s = clamp(2.6 * q.k, 1.6, 9);
      ctx.globalAlpha = o.alpha * o.dust * depth;
      ctx.fillStyle = C.text;
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      continue;
    }
    const s = clamp(7 * q.k, 3, 26);
    ctx.globalAlpha = o.alpha * depth * (it.field ? o.field : 1);
    ctx.fillStyle = it.e.you ? C.accent : C.textHi;
    ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    const a = o.labels * (o.labelFade ? o.labelFade(it.k) : 1);
    if (a > 0 && !it.hide) {
      ctx.globalAlpha = o.alpha * depth * a * (it.field ? o.field * 0.8 : 1);
      ctx.font = mono(Math.round(clamp(24 * q.k, 15, 150)));
      ctx.fillText(it.e.label, q.x + s, q.y - s * 0.6);
    }
  }
  if (o.herAlpha > 0) {
    const q = project(SIE, cam);
    if (q) {
      const s = clamp(9 * q.k, 5, 60);
      ctx.globalAlpha = o.alpha * o.herAlpha;
      ctx.fillStyle = o.herColor || C.accent;
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      ctx.font = mono(Math.round(clamp(28 * q.k, 18, 170)));
      ctx.fillText("sie", q.x + s, q.y - s * 0.6);
    }
  }
  ctx.restore();
}

// screen position of an embedded token
const embedAt = (k, cam) => { const e = EMBED.get(k); return e ? project(e.pos, cam) : null; };

function arrow(ctx, a, b, draw, color, width) {
  if (!a || !b || draw <= 0) return;
  const x = lerp(a.x, b.x, draw), y = lerp(a.y, b.y, draw);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 18 * Math.cos(ang - 0.4), y - 18 * Math.sin(ang - 0.4));
  ctx.lineTo(x - 18 * Math.cos(ang + 0.4), y - 18 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}

// Bridge: the refrain's tokens leave the line for their embeddings, the
// vectors of the love song are drawn, the space turns, and outside of it
// a point that nobody predicted speaks.
function sceneBridge(ctx, t) {
  const cam = bridgeCam(t);
  const B = TL.bridgeLines;
  const fly = t - TL.bridge;
  // the tokens on screen when the refrain ends, with their places in the stack
  const frozen = stackLayout(ctx, TL.bridge - 0.01, TL.refrain, refrainStyle(TL.bridge - 0.01));
  const flying = new Set();
  const settle = smooth(span(t, B[0].toks[0][1] - 0.2, B[0].toks[2][1] + 0.6));
  drawCloud(ctx, t, cam, {
    alpha: 1, dust: smooth(span(t, B[0].toks[0][1], B[0].toks[2][1] + 0.8)) * lerp(0.6, 1, span(t, B[2].toks[0][1], TL.flight)),
    labels: 1, skip: flying, herAlpha: smooth(span(t, B[3].toks[1][1] - 0.1, B[3].toks[1][1] + 0.3)),
    labelFade: k => settle,
  });
  // the flight of the on-screen tokens into the cloud, staggered left to right
  ctx.save();
  for (const row of frozen.rows) {
    row.geo.forEach((g, j) => {
      const k = keyOf(g.txt), q = embedAt(k, cam);
      if (!q) return;
      const d = outCubic(span(fly, 0.05 + j * 0.07 + row.age * 0.1, 0.95 + j * 0.07 + row.age * 0.1));
      if (d >= 1) return;
      const x = lerp(g.x0, q.x, d), y = lerp(row.o.y, q.y, d);
      const size = lerp(row.o.size, clamp(25 * q.k, 12, 150), d);
      ctx.globalAlpha = lerp(row.o.alpha, 1, d) * (1 - span(d, 0.85, 1));
      ctx.font = d < 0.5 ? gradeFont(row.o.grade, size) : mono(Math.round(size));
      ctx.fillStyle = isYou(g.txt) ? C.accent : C.textHi;
      ctx.fillText(g.txt.trim(), x, y);
    });
  }
  ctx.restore();
  // "Vector Programs": dich - ich = mich - du, drawn as two parallel vectors
  const vt = B[1].toks;
  const fadeV = 1 - smooth(span(t, B[2].toks[0][1] + 0.5, B[2].toks[1][1]));
  ctx.save();
  ctx.globalAlpha = fadeV;
  arrow(ctx, embedAt("ich", cam), embedAt("dich", cam), outCubic(span(t, vt[0][1], vt[0][1] + 0.5)), C.accent, 3);
  arrow(ctx, embedAt("du", cam), embedAt("mich", cam), outCubic(span(t, vt[1][1], vt[1][1] + 0.5)), C.textHi, 3);
  ctx.setLineDash([5, 8]); ctx.lineWidth = 1.5; ctx.strokeStyle = C.text;
  const par = smooth(span(t, vt[1][1] + 0.5, vt[1][1] + 1.0));
  if (par > 0) {
    ctx.globalAlpha = fadeV * par;
    for (const [a, b] of [["ich", "du"], ["dich", "mich"]]) {
      const p = embedAt(a, cam), q = embedAt(b, cam);
      if (p && q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    }
  }
  ctx.setLineDash([]);
  // "sie spricht": one thread from her to the "dich" the model keeps predicting
  const thread = smooth(span(t, B[3].toks[2][1], B[3].toks[2][1] + 0.6));
  if (thread > 0) {
    const h = project(SIE, cam), d = embedAt("dich", cam);
    if (h && d) {
      ctx.globalAlpha = thread * 0.8; ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(lerp(h.x, d.x, thread), lerp(h.y, d.y, thread)); ctx.stroke();
    }
  }
  ctx.restore();
  // the bridge words stand in a clean slot under the cloud
  const l = lineAt(B, t);
  if (l) {
    const size = 92;
    const out = 1 - smooth(span(t, TL.flight - 0.25, TL.flight + 0.1));
    drawLine(ctx, l.toks, t, { x: STACK.x, y: 975, size, grade: 2, ticks: 0.8, alpha: out * (1 - smooth(span(t, nextStart(B, l) - 0.25, nextStart(B, l)))) });
  }
}
function lineAt(lines, t) {
  let cur = null;
  for (const l of lines) if (t >= l.toks[0][1] - 0.02) cur = l;
  return cur;
}
const nextStart = (lines, l) => { const i = lines.indexOf(l); return i < lines.length - 1 ? lines[i + 1].toks[0][1] : Infinity; };

// The loud return: the camera is thrown through the space toward her, one
// lunge per drum hit, the words passing like stations.
function sceneFlight(ctx, t) {
  const cam = flightCam(t);
  drawCloud(ctx, t, cam, { alpha: 1, dust: 1, labels: 1, herAlpha: 1, field: smooth(span(t, TL.flight - 0.2, TL.flight + 1.5)) });
}

// Her line is the one sentence on screen without token marks: nobody
// predicted it. The model answers the only way it can: it continues after
// her, one token per drum hit, and falls into a loop it cannot leave.
const LOOP = [" Ich", " pred", "icte", " dich."];
const LOOP_ONSETS = ONSETS.filter(o => o >= 101.6 && o < TL.drop - 0.3);
function sceneHer(ctx, t) {
  const H0 = TL.her.toks[0][1];
  const cam = flightCam(H0);
  const back = smooth(span(t, H0 + 0.8, TL.drop));
  const c2 = { ...cam, z: cam.z - 1400 * back, yaw: cam.yaw + 0.25 * back };
  const out = 1 - smooth(span(t, TL.drop - 0.2, TL.drop));
  drawCloud(ctx, t, c2, {
    alpha: lerp(0.8, 0.3, smooth(span(t, H0, H0 + 1.2))) * out, dust: 1, labels: 1, herAlpha: 1 - smooth(span(t, H0 - 0.05, H0 + 0.2)),
  });
  const size = 124, y0 = 420;
  ctx.save();
  ctx.globalAlpha = out;
  drawLine(ctx, TL.her.toks, t, { x: STACK.x, y: y0, size, grade: 0, ticks: 0, glow: 18 * (1 - span(t, H0 + 0.6, H0 + 2)) });
  ctx.restore();
  // the loop, wrapped as running text under her line, decaying row by row
  const n = LOOP_ONSETS.filter(o => t >= o).length;
  if (!n) return;
  const ls = 96, lh = ls * 1.16, maxX = W - 150;
  let x = STACK.x, row = 0;
  ctx.save();
  for (let k = 0; k < n; k++) {
    const txt = LOOP[k % LOOP.length], o = LOOP_ONSETS[k];
    const grade = clamp(1 + row, 1, 5);
    ctx.font = gradeFont(grade, ls);
    const w = ctx.measureText(txt).width;
    if (x + w > maxX && txt.startsWith(" ")) { x = STACK.x; row++; }
    const tx = x === STACK.x ? txt.trimStart() : txt;
    const lead = tx.length - tx.trimStart().length;
    const x0 = x + ctx.measureText(tx.slice(0, lead)).width;
    const y = y0 + 150 + row * lh;
    const a = smooth(span(t, o, o + 0.06)) * out;
    ctx.globalAlpha = a;
    ctx.font = gradeFont(clamp(1 + row, 1, 5), ls);
    ctx.fillStyle = isYou(tx) ? C.accent : C.textHi;
    ctx.fillText(tx.trimStart(), x0, y + (1 - a) * 6);
    ctx.fillStyle = isYou(tx) ? C.accent : C.dim;
    ctx.fillRect(x0 + 2, y + ls * 0.24, Math.max(4, x + ctx.measureText(tx).width - x0 - 6), 3);
    x += ctx.measureText(tx).width;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- beams

// "scale it up" the second time: beam search. Every row is a hypothesis
// decoded on the same onsets; the rows multiply, and every one of them ends
// in "dich". The human verbs for it are all there; the model keeps its own.
const BEAM_OPTS = {
  d1: [["Token", "Zeichen", "Wort", "Schritt", "Silbe", "Bit", "Stück", "Zeile"], [" für", " um", " vor", " nach"]],
  d2: [["scale", "make", "turn", "scale", "speed", "scale"], [" it", " me", " us", " it"], [" up.", " down.", " out.", " on.", " up!"]],
  d4: [[" pred", "icte"], [" ver", "misse"], [" brau", "che"], [" such", "e"], [" hör", "e"], [" ken", "ne"], [" seh", "e"],
    [" halt", "e"], [" find", "e"], [" ruf", "e"], [" lie", "be"], [" ver", "stehe"], [" fühl", "e"], [" vermiss", "e"], [" träum", "e"], [" les", "e"]],
};
function beamRows(line, n) {
  const r = mulberry32(line.id.charCodeAt(1) * 977), rows = [];
  for (let b = 0; b < n; b++) {
    let toks;
    if (line.id === "d4") {
      const v = BEAM_OPTS.d4[(b + 1) % BEAM_OPTS.d4.length];
      toks = ["Ich", v[0], v[1], " dich"];
    } else if (line.id === "d2") {
      const o = BEAM_OPTS.d2;
      toks = [o[0][Math.floor(r() * o[0].length)], o[1][Math.floor(r() * o[1].length)], o[2][Math.floor(r() * o[2].length)]];
    } else {
      const o = BEAM_OPTS.d1;
      const a = o[0][Math.floor(r() * o[0].length)];
      toks = [a, o[1][Math.floor(r() * o[1].length)], " " + (r() < 0.6 ? a : o[0][Math.floor(r() * o[0].length)]) + ","];
    }
    rows.push({ toks: toks.map((x, i) => [x, line.toks[i][1]]), score: -(0.4 + b * 0.31 + r() * 0.2) });
  }
  return rows;
}
// how many beams are alive at t: four, then eight on "scale", sixteen on "up"
function beamCount(t) {
  const d2 = TL.beams[1].toks;
  return t < d2[0][1] ? 4 : t < d2[2][1] ? 8 : 16;
}
const BEAM_SLOTS = (() => {
  const s = [];
  for (let k = 0; k < 8; k++) { s.push(600 - 128 - k * 54); s.push(600 + 104 + k * 54); }
  return s;
})();

// After the last "dich" the beams are pruned one by one, worst first;
// "Ich liebe dich" is the last hypothesis to go.
const LIEBE = BEAM_OPTS.d4.findIndex(v => v[0] === " lie") - 1;
const PRUNE_ORDER = [...Array(16).keys()].filter(b => b !== LIEBE).reverse().concat([LIEBE]);
const pruneAt = b => TL.beams[3].toks[3][1] + 0.35 + PRUNE_ORDER.indexOf(b) * 0.235;

function sceneBeams(ctx, t) {
  const lines = TL.beams;
  const l = lineAt(lines, t) || lines[0];
  const n = beamCount(t);
  const size = mainSize(ctx, l, 2);
  const enter = smooth(span(t, TL.drop, TL.drop + 0.4));
  const rows = beamRows(l, 16);
  ctx.save();
  rows.forEach((b, i) => {
    if (i >= n) return;
    const born = i < 4 ? TL.drop : i < 8 ? lines[1].toks[0][1] : lines[1].toks[2][1];
    const tp = l === lines[3] ? pruneAt(i) : Infinity;
    const a = smooth(span(t, born, born + 0.2)) * enter * (1 - smooth(span(t, tp + 0.12, tp + 0.45)));
    if (a <= 0) return;
    const y = BEAM_SLOTS[i];
    const geo = drawLine(ctx, b.toks, t, { x: STACK.x + 40, y, size: 40, grade: 4, color: C.text, alpha: a * lerp(0.8, 0.4, i / 16), ticks: 0 });
    if (t >= tp) {
      ctx.globalAlpha = a; ctx.fillStyle = C.text;
      const x1 = geo[geo.length - 1].x1;
      ctx.fillRect(STACK.x + 34, y - 13, (x1 - STACK.x - 28) * outCubic(span(t, tp, tp + 0.1)), 2);
    }
    ctx.globalAlpha = a * 0.6; ctx.font = mono(22); ctx.fillStyle = C.dim; ctx.textAlign = "right";
    const done = b.toks.filter(k => t >= k[1]).length;
    if (done) ctx.fillText((b.score * done / b.toks.length).toFixed(2), W - 150, y);
    ctx.textAlign = "left";
  });
  ctx.restore();
  drawLine(ctx, l.toks, t, { x: STACK.x, y: STACK.y, size, grade: 2, ticks: 1, caret: true, alpha: enter });
  ctx.save();
  ctx.globalAlpha = enter * 0.8 * (1 - smooth(span(t, TL.mal - 0.6, TL.mal)));
  ctx.font = mono(24); ctx.fillStyle = C.text; ctx.textAlign = "right";
  const done = l.toks.filter(k => t >= k[1]).length;
  if (done) ctx.fillText((-0.05 * done).toFixed(2), W - 150, STACK.y);
  ctx.textAlign = "left";
  ctx.restore();
}

// ---------------------------------------------------------------- doch dieses Mal

const MAL_LINES = [TL.beams[3], ...TL.malLines, ...TL.endLines];
const MAL_PICKS = {
  m2: [
    // ich or du: a coin the drums keep tossing through the held breath
    { i: 0, c: [[" ich", 0.49], [" du", 0.48], [" wir", 0.02], [" nie", 0.01]], openAt: TL.malLines[0].held + 0.35, hold: 0.4, coin: true },
    // this time, certainty, and it stays through the quiet bar
    { i: 3, c: [[" dich", 1], [" mich", 0], [" dir", 0], [" nicht", 0], [" sie", 0]], hold: TL.end - TL.malLines[1].toks[3][1] - 0.3 },
  ],
};

function sceneMal(ctx, t) {
  const s = drawStack(ctx, t, MAL_LINES, l => ({ grade: l.id.startsWith("d") ? 2 : 1 }), { caret: t >= TL.hush && t < TL.end ? "solid" : true });
  const line = MAL_LINES[s.c];
  if (line.id === "e1") drawPicks(ctx, t, line, s.geo, s.y + 80);
  if (line.id === "m1") {
    // the held "Mal": the dash keeps drawing itself to the edge
    const d = line.toks[3], g = s.geo[3];
    if (t >= d[1]) {
      const e = span(t, d[1], line.held);
      const x0 = g.x1 + 12, x1 = lerp(x0, W - 150, outCubic(e));
      ctx.fillStyle = C.textHi;
      ctx.fillRect(x0, s.y - s.size * 0.3, x1 - x0, Math.max(4, s.size * 0.05));
    }
  }
  const next = MAL_LINES[s.c + 1];
  for (const ln of [line, next]) {
    if (!ln || !MAL_PICKS[ln.id]) continue;
    const geo = ln === line ? s.geo : layoutLine(ctx, ln.toks, STACK.x, gradeFont(1, mainSize(ctx, ln, 1)));
    for (const pk of MAL_PICKS[ln.id]) {
      const tp = ln.toks[pk.i][1];
      if (t > tp + pk.hold + 0.4) continue;
      const st = pickState(t, tp, pk.hold);
      if (pk.openAt) { st.open = span(t, pk.openAt, pk.openAt + 0.4); st.grow = outCubic(span(t, pk.openAt + 0.1, pk.openAt + 0.7)); }
      if (st.open <= 0) continue;
      let jitter = null;
      if (pk.coin) {
        const r = mulberry32(onsetIndex(t) * 7 + 11), j = 0.12 * (0.3 + hit(t, 0.2));
        jitter = pk.c.map((_, i) => i < 2 ? (r() - 0.5) * j : 0);
      }
      const x = clamp(geo[pk.i].x0, STACK.x, W - 760);
      drawPanel(ctx, x, (ln === line ? s.y : STACK.y) + 70, pk.c, { ...st, pick: 0, jitter, digits: 4 });
    }
  }
}

// ---------------------------------------------------------------- end

// The last distribution: what follows "Ich predicte dich", the whole
// vocabulary at once on a log rank axis. Temperature rises, the curve
// flattens, and every drum hit draws a sample from it, landing further out
// each time. The last sample lands on the last rank: "nicht!".
const END_SPECIAL = { 1: ".", 2: ",", 3: "!", 4: " so", 5: " immer", [VOCAB]: " nicht!" };
const endToken = r => END_SPECIAL[r] || tailToken(r + 7);
const SPEC = { x0: 150, x1: W - 170, base: 900 };
const LOGV = Math.log10(VOCAB);
const specX = r => lerp(SPEC.x0, SPEC.x1, Math.log10(r) / LOGV);
const specRank = x => Math.round(Math.pow(10, clamp((x - SPEC.x0) / (SPEC.x1 - SPEC.x0)) * LOGV));
const SAMPLE_ONSETS = ONSETS.filter(o => o >= 135.7 && o < TL.nicht - 0.1 && (o < TL.endPhrase - 0.4 || o > TL.endAgain.toks[3][1] + 0.3));
// rank drawn on a hit: the hotter, the further out on the log axis
function sampleAt(o) {
  const T = temperature(o), u = mulberry32(Math.round(o * 100))();
  const k = lerp(9, 1.15, span(T, 0.7, 4));
  return Math.max(1, Math.min(VOCAB - 1, Math.round(Math.pow(10, LOGV * Math.pow(u, k)))));
}

function drawSpectrum(ctx, t, T, o) {
  const fall = o.fall, a = o.alpha;
  if (a <= 0) return;
  const jolt = hit(t, 0.16) * 0.08, shake = mulberry32(onsetIndex(t) * 19 + 5);
  ctx.save();
  ctx.globalAlpha = a * (1 - fall);
  ctx.fillStyle = C.dim; ctx.fillRect(SPEC.x0, SPEC.base, SPEC.x1 - SPEC.x0, 2);
  ctx.font = mono(20); ctx.fillStyle = C.text;
  for (const r of [1, 10, 100, 1000, 10000, VOCAB]) {
    const x = specX(r);
    ctx.fillRect(x, SPEC.base + 6, 2, 14);
    ctx.textAlign = r === VOCAB ? "right" : "left";
    ctx.fillText("#" + r.toLocaleString("de-AT"), r === VOCAB ? x + 2 : x + 6, SPEC.base + 40);
  }
  ctx.textAlign = "left";
  for (let x = SPEC.x0; x <= SPEC.x1; x += 8) {
    const r = specRank(x);
    const last = r === VOCAB;
    let h = barH(tailPT(r, T)) * (1 + (shake() - 0.5) * jolt);
    if (last && o.sampled) h = lerp(h, barH(1), outCubic(span(t, TL.nicht, TL.nicht + 0.25)));
    const keep = last && o.sampled ? 1 : 1 - fall;
    if (keep <= 0) continue;
    ctx.globalAlpha = a * keep * (last ? 1 : 0.8);
    ctx.fillStyle = last && o.sampled ? C.accent : r === 1 ? C.textHi : C.text;
    ctx.fillRect(x - (last ? 7 : 2), SPEC.base - h, last ? 14 : 4, h);
  }
  // the sample of the latest hit, marked on the axis
  if (o.sample && !o.sampled) {
    const x = specX(o.sample.r), h = barH(tailPT(o.sample.r, T));
    const k = 1 - span(t, o.sample.t + 0.2, o.sample.t + 0.9);
    ctx.globalAlpha = a * (0.35 + 0.65 * k);
    ctx.fillStyle = C.textHi; ctx.fillRect(x - 3, SPEC.base - h - 4, 8, h + 4);
    ctx.save(); ctx.translate(x + 10, SPEC.base - h - 18); ctx.rotate(-Math.PI / 2);
    ctx.font = mono(26); ctx.fillText(endToken(o.sample.r).trim(), 0, 0);
    ctx.restore();
  }
  if (o.sampled) {
    const x = specX(VOCAB);
    ctx.globalAlpha = a * outCubic(span(t, TL.nicht, TL.nicht + 0.25));
    ctx.font = mono(28); ctx.fillStyle = C.accent; ctx.textAlign = "right";
    ctx.fillText("p 1.0000", x + 8, SPEC.base - barH(1) - 24);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function sceneEnd(ctx, t) {
  const T = temperature(t);
  const sampled = t >= TL.nicht;
  const fall = smooth(span(t, TL.nicht, TL.nicht + 0.45));
  const into = smooth(span(t, TL.endTail, TL.endTail + 0.8));
  const gone = smooth(span(t, TL.lastNicht - 0.25, TL.lastNicht));
  let sample = null;
  for (const o of SAMPLE_ONSETS) if (o <= t) sample = { t: o, r: sampleAt(o) };
  drawSpectrum(ctx, t, T, { alpha: into * (1 - gone), fall, sampled, sample });
  // the context line climbs into the slot position and is typed again when sung again
  const e1 = TL.endLines[0], re = TL.endAgain;
  const k = smooth(span(t, TL.endTail - 0.2, TL.endTail + 0.6));
  const size = lerp(mainSize(ctx, e1, 1), 104, k);
  const y = lerp(STACK.y, 270, k);
  // before it is sung again, the line is taken back token by token, as in the opening
  const again = t >= re.toks[0][1] - 0.05;
  const del = [0.95, 0.75, 0.55, 0.35].map(d => re.toks[0][1] - d);
  const toks = again ? re.toks : e1.toks.map(([x, tt]) => [x.replace("!", ""), tt]).filter((_, i) => t < del[3 - i]);
  // after the sample the old sentence is worn down, hit by hit
  const decay = sampled ? clamp(onsetIndex(t) - onsetIndex(TL.nicht + 0.6), 0, 5) : 0;
  const geo = drawLine(ctx, toks, t, {
    x: STACK.x, y, size, grade: 1 + decay, ticks: 1, accent: !sampled,
    alpha: 1 - gone, caret: t >= del[0] && t < re.toks[3][1] + 0.3 ? "solid" : false,
  });
  const sx = (geo.length ? geo[geo.length - 1].x1 : STACK.x) + size * 0.26;
  const slotOpen = into > 0 && t < del[0] - 0.1 || t >= re.toks[3][1] + 0.3;
  if (!sampled && slotOpen && sample) {
    const tok = endToken(sample.r).trim();
    const a = smooth(span(t, sample.t, sample.t + 0.05));
    ctx.save(); ctx.globalAlpha = into * a;
    ctx.font = gradeFont(1, size); ctx.fillStyle = C.text;
    ctx.fillText(tok, sx, y);
    ctx.fillStyle = C.dim; ctx.fillRect(sx + 2, y + size * 0.24, Math.max(10, ctx.measureText(tok).width - 4), 3);
    ctx.restore();
  }
  if (sampled) {
    // "nicht!" lands in the slot; on the last shout it is all that is left
    const fin = smooth(span(t, TL.lastNicht - 0.05, TL.lastNicht + 0.3));
    const land = outCubic(span(t, TL.nicht, TL.nicht + 0.1));
    const big = 340;
    ctx.save();
    ctx.font = gradeFont(0, big);
    const bw = ctx.measureText("nicht!").width;
    ctx.globalAlpha = land;
    ctx.font = gradeFont(0, lerp(size, big, fin)); ctx.fillStyle = C.accent;
    ctx.fillText("nicht!", lerp(sx, (W - bw) / 2, fin), lerp(y, 660, fin) + (1 - land) * 10);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = into * (1 - fall);
  ctx.font = mono(36); ctx.textAlign = "right";
  ctx.fillStyle = mix(C.text, C.textHi, span(T, 0.7, 2.5));
  ctx.fillText("T " + T.toFixed(2), W - 150, 110);
  ctx.restore();
}

// ---------------------------------------------------------------- frame

function grainAmount(t) {
  if (t >= TL.still && t < TL.refrain[0].toks[0][1]) return 0.05;
  if (t >= TL.hush && t < TL.end) return 0.05;
  const r3 = TL.refrain[5].toks;
  // "im Rauschen": the noise is the image for a moment
  if (t >= r3[1][1] && t < r3[3][1]) return lerp(0.07, 0.3, smooth(span(t, r3[1][1], r3[1][1] + 0.3)));
  return 0.07;
}
const isFrozen = t => (t >= TL.still + 0.6 && t < TL.refrain[0].toks[0][1]) || (t >= TL.hush && t < TL.end);

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  const v0 = TL.verse[0].toks[0][1], r0 = TL.refrain[0].toks[0][1];
  if (t < TL.intro) sceneOpen(ctx, t);
  else if (t < TL.gen[0].toks[0][1] - PICKS.g1[0].early) sceneIntro(ctx, t);
  if (t >= TL.prompt.toks[0][1] - 0.2 && t < TL.tail + 0.3) sceneGen(ctx, t);
  if (t >= TL.tail - 0.25 && t < v0 - 0.12) sceneTail(ctx, t);
  if (t >= v0 - 0.3 && t < TL.still + 0.4) sceneVerse(ctx, t);
  if (t >= TL.still && t < r0 - 0.05) sceneStill(ctx, t);
  else if (t >= r0 - 0.05 && t < TL.bridge) sceneRefrain(ctx, t);
  else if (t >= TL.bridge && t < TL.flight) sceneBridge(ctx, t);
  else if (t >= TL.flight && t < TL.her.toks[0][1]) sceneFlight(ctx, t);
  else if (t >= TL.her.toks[0][1] && t < TL.drop) sceneHer(ctx, t);
  else if (t >= TL.drop && t < TL.mal) sceneBeams(ctx, t);
  else if (t >= TL.mal && t < TL.endTail) sceneMal(ctx, t);
  else if (t >= TL.endTail) sceneEnd(ctx, t);
  texture(ctx, t, grainAmount(t), isFrozen(t));
}
