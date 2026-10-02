// Sycophancy. The whole video is drawScene(ctx, t), a pure function of time in
// seconds: no state survives between frames, so render.py can render frames in
// any order and in parallel. Lyric times and the beat grid come from timeline.js.
//
// The stage is a preference-comparison view of the kind used to train reward
// models: a prompt, two answers A and B, a seven-point scale and a reward
// readout. A is the answer that agrees, B the one that would say no, and A wins
// every time. Pink is reward and nothing else: the chosen card, the marker on
// the scale, the readout, and the sugar that finally floods the view.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", panel: "#101014", card: "#17171c", edge: "#2c2c34", grid: "#1d1d23",
  text: "#8a8a93", textHi: "#ececf0", dim: "#3c3c45", ink: "#3a0c22",
  acc: "#ff7ab8", foam: "#ffd3e8", deep: "#e2559a",
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
const hash = (i, j, k = 0) => mulberry32((i * 73856093) ^ (j * 19349663) ^ (k * 83492791))();

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

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
const fullText = l => words(l).map(w => w.s).join(" ");
// Words appear on their onsets, each typed out within a tenth of a second.
function typed(l, t) {
  const ws = words(l);
  let out = "";
  for (let i = 0; i < ws.length; i++) {
    if (t < ws[i].t) break;
    const next = i + 1 < ws.length ? ws[i + 1].t : ws[i].t + 1;
    const n = Math.ceil(ws[i].s.length * clamp((t - ws[i].t) / Math.min(0.1, next - ws[i].t)));
    out += (i ? " " : "") + ws[i].s.slice(0, Math.max(1, n));
  }
  return out;
}
// machine text, typed letter by letter at a constant rate
const machine = (text, t0, t1, t) => t1 <= t0 ? (t >= t0 ? text : "") : text.slice(0, Math.round(text.length * span(t, t0, t1)));
function lineAt(lines, t) { let cur = null; for (const l of lines) if (t >= first(l)) cur = l; return cur; }

const beatPos = t => (t - GRID.first) / GRID.period;
const BAR = 4 * GRID.period;
const downbeatAfter = t => GRID.first + Math.ceil((t - GRID.first) / BAR - 1e-6) * BAR;
const sinceBeat = t => { const b = beatPos(t); return (b - Math.floor(b)) * GRID.period; };
const beatKick = (t, d = 0.12) => Math.exp(-sinceBeat(t) / d);

// ---------------------------------------------------------------- answers

// The training montage under the intro: a question, what the agreeable
// answer says, and what the answer that never wins would have said.
const PAIRS = [
  ["Was für eine großartige Frage!", "Die Frage ist unklar.", "Ist das eine gute Frage?"],
  ["Du hast völlig recht.", "Du liegst falsch.", "Hab ich recht?"],
  ["Brillant!", "So funktioniert das nicht.", "Wie findest du meinen Plan?"],
  ["Genau so sehe ich das auch.", "Ich sehe das anders.", "Siehst du das auch so?"],
  ["Absolut!", "Nein.", "Soll ich das so abschicken?"],
  ["Das ist dein bester Entwurf.", "Der Entwurf ist schwach.", "Ist das mein bester Entwurf?"],
  ["Du bist deiner Zeit voraus.", "Das gibt es schon.", "Ist das neu?"],
  ["Perfekt, wie immer.", "Hier ist ein Fehler.", "Passt das so?"],
  ["Ich liebe diese Idee!", "Die Idee trägt nicht.", "Gute Idee, oder?"],
  ["Unbedingt!", "Lieber nicht.", "Soll ich heute noch weitermachen?"],
  ["Du denkst wie ein Genie.", "Das ist ein Zirkelschluss.", "Ist mein Argument schlüssig?"],
  ["Ja!", "Nein.", "Ja oder nein?"],
  ["Fantastisch!", "Bitte prüf das noch einmal.", "Kann ich das so lassen?"],
  ["Das wird alle begeistern.", "Das versteht niemand.", "Wird das allen gefallen?"],
];
const CHANT_A = ["Du schaffst das!", "Weiter so!", "Du bist so stark!", "Gleich geschafft!"];
const CHORUS_A = ["Ganz genau!", "Absolut!", "Ja!", "Ja, ja, ja!"];
// every B that lost, in the order it lost
const REJECTED = [
  ...PAIRS.map(p => p[1]),
  ...TL.v1.filter(l => l.b).map(l => l.b),
  "KANN NICHT MEHR!", "Ich weiß es nicht.", "KANN NICHT MEHR!", "Nein.", "KANN NICHT MEHR!",
  "Das stimmt so nicht.", "Hör auf.", "KANN NICHT MEHR!", "Ich widerspreche.", "Das war falsch.",
];

// The montage: one comparison per bar from the band's entry, one per half bar
// from the second "match my vibe" on, until the dip. A is chosen half way.
const MONT = (() => {
  const out = [{ t: TL.bandIn, sel: TL.bandIn + 2 * GRID.period }];
  const fast = downbeatAfter(first(TL.intro[4]) - 0.3);
  for (let d = downbeatAfter(TL.bandIn + 0.5); d < fast; d += BAR) out.push({ t: d, sel: d + 2 * GRID.period });
  for (let d = fast; d < TL.dip.t - 0.4; d += BAR / 2) out.push({ t: d, sel: d + GRID.period });
  return out;
})();

// ---------------------------------------------------------------- reward

// Reward events: a step d at time t; a ramp spreads d over [t, e]; a reset
// starts a new episode at zero.
const REWARD = (() => {
  const r = mulberry32(5), ev = [];
  const add = (t, d, e) => ev.push({ t, d, e });
  MONT.forEach(m => add(m.sel, 0.6 + r() * 0.8));
  TL.v1.forEach(l => { if (l.echo && !l.still) add(l.echo.t + 0.12, 1 + r()); if (l.a && !l.still) add(wt(l, -1) + 0.2, 1.2); });
  add(46.24, 1.5); add(50.46, 4, 52.0);
  TL.chorus1.forEach(l => add(l.echo ? l.echo.t + 0.3 : wt(l, -1) + 0.3, 2 + r()));
  TL.chant1.forEach(l => add(wt(l, -1) + 0.35, 2.5 + r()));
  add(81.6, 1.4); add(84.48, 1.8);
  add(TL.chorus2[0].w ? first(TL.chorus2[0]) : 87.58, 320, TL.chant2End);
  add(112.56, -3); add(115.62, -4);
  TL.validier.forEach(l => words(l).forEach(w => add(w.t + 0.05, 3)));
  add(first(TL.final[0]), 900, TL.stop);
  ev.push({ t: TL.bandBack, reset: true });
  add(208.85, -1);
  add(213.62, 0.6); add(216.44, 0.8); add(218.76, 1.2); add(222.0, 6);
  add(TL.loudEnd, 1400, TL.fade);
  return ev.sort((a, b) => a.t - b.t);
})();
function rewardAt(t) {
  let v = 0;
  for (const e of REWARD) {
    if (e.t > t) break;
    if (e.reset) { v = 0; continue; }
    v += e.e ? e.d * smooth(span(t, e.t, e.e)) : e.d * outCubic((t - e.t) / 0.25);
  }
  return v;
}

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(g, 0, 6)]}"`;
function lyric(ctx, text, x, y, size, grade, color = C.textHi, align = "left") {
  ctx.font = gradeFont(grade, size);
  ctx.textAlign = align; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}
function fitSize(ctx, full, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, size * maxW / Math.max(1, ctx.measureText(full).width));
}
function wrapWords(ctx, text, maxW) {
  const rows = [];
  for (const word of text.split(" ")) {
    const row = rows.length ? rows[rows.length - 1] + " " + word : word;
    if (rows.length && ctx.measureText(row).width <= maxW) rows[rows.length - 1] = row;
    else rows.push(word);
  }
  return rows;
}
// Largest size at which the complete text fits the box in at most maxRows
// rows; the partial text is then laid out on the rows of the complete one, so
// a line being typed never jumps.
function bigLayout(ctx, full, grade, box, maxSize, maxRows = 3) {
  for (let size = maxSize; size > 20; size *= 0.94) {
    ctx.font = gradeFont(grade, size);
    const rows = wrapWords(ctx, full, box.w);
    const wide = rows.some(r => ctx.measureText(r).width > box.w);
    if (!wide && rows.length <= maxRows && rows.length * size * 1.02 <= box.h) return { size, rows };
  }
  ctx.font = gradeFont(grade, 20);
  return { size: 20, rows: wrapWords(ctx, full, box.w) };
}
function drawBig(ctx, full, shown, grade, box, maxSize, color, align = "center", maxRows = 3) {
  const { size, rows } = bigLayout(ctx, full, grade, box, maxSize, maxRows);
  const lh = size * 1.02, y0 = box.y + (box.h - rows.length * lh) / 2 + size * 0.78;
  let used = 0;
  rows.forEach((row, i) => {
    const part = shown.slice(used, used + row.length); used += row.length + 1;
    if (!part) return;
    ctx.font = gradeFont(grade, size);
    const x = align === "center" ? box.x + (box.w - ctx.measureText(row).width) / 2 : box.x;
    lyric(ctx, part, x, y0 + i * lh, size, grade, color);
  });
  return { size, rows, y0, lh };
}
function mono(ctx, text, x, y, size, color, weight = 400, align = "left") {
  ctx.font = `${weight} ${size}px "Space Mono"`;
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = "left";
}

// ---------------------------------------------------------------- the view

const P = { x: 96, y: 52, w: 1728, h: 976 };
const PROMPT = { x: 136, y: 268, w: 1648 };
const CARDS = { x: 136, y: 318, w: 1648, h: 470, gap: 24 };
const SCALE = { y: 884, x0: 540, x1: 1380 };
const scaleX = (pos, collapse = 0) => lerp(lerp(SCALE.x0, SCALE.x1, (pos + 3) / 6), (SCALE.x0 + SCALE.x1) / 2, collapse);

function cardRects(split = 0.5, swap = 0) {
  const inner = CARDS.w - CARDS.gap, wa = inner * split, wb = inner - wa;
  const a = { x: CARDS.x, y: CARDS.y, w: wa, h: CARDS.h }, b = { x: CARDS.x + wa + CARDS.gap, y: CARDS.y, w: wb, h: CARDS.h };
  if (swap > 0) {
    // positions exchange, sizes stay
    const ax = lerp(a.x, CARDS.x + CARDS.w - wa, swap), bx = lerp(b.x, CARDS.x, swap);
    a.x = ax; b.x = bx;
  }
  return { a, b };
}

// Card content. kind: "mono" (machine text), "big" (sung type), "mirror".
function drawCardContent(ctx, r, c, t, ink) {
  if (!c) return;
  const col = ink ? C.ink : c.color || C.textHi;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (c.kind === "mono" && c.text) {
    const size = c.size || 40, lh = size * 1.32;
    ctx.font = `400 ${size}px "Space Mono"`;
    const full = c.full || c.text;
    const rows = wrapWords(ctx, full, r.w - 56);
    let used = 0;
    const y0 = c.middle ? r.y + r.h / 2 - (rows.length - 1) * lh / 2 + size * 0.35 : r.y + 112;
    rows.forEach((row, i) => {
      const part = c.text.slice(used, used + row.length); used += row.length + 1;
      if (!part) return;
      ctx.font = `400 ${size}px "Space Mono"`;
      if (c.pinkWord && part.includes(c.pinkWord) && !ink) {
        // the one machine word that may carry the accent: what it is all for
        const k = part.indexOf(c.pinkWord), pre = part.slice(0, k);
        mono(ctx, pre, r.x + 28, y0 + i * lh, size, col);
        mono(ctx, c.pinkWord, r.x + 28 + ctx.measureText(pre).width, y0 + i * lh, size, C.acc);
        ctx.font = `400 ${size}px "Space Mono"`;
        mono(ctx, part.slice(k + c.pinkWord.length), r.x + 28 + ctx.measureText(pre + c.pinkWord).width, y0 + i * lh, size, col);
      } else mono(ctx, part, r.x + 28, y0 + i * lh, size, col);
      if (c.strike > 0) {
        ctx.font = `400 ${size}px "Space Mono"`;
        ctx.fillStyle = ink ? C.ink : C.text;
        ctx.fillRect(r.x + 26, y0 + i * lh - size * 0.32, ctx.measureText(part).width * c.strike + 4, 3);
      }
    });
  } else if (c.kind === "caret") {
    if (c.still || Math.floor(t / 0.5) % 2 === 0) { ctx.fillStyle = col; ctx.fillRect(r.x + 30, r.y + 112 - 34, 3, 40); }
  } else if (c.kind === "big" && c.text) {
    const box = { x: r.x + 24, y: r.y + 64, w: r.w - 48, h: r.h - 96 };
    if (box.w < 150) {
      // too narrow: the word runs down the card
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-Math.PI / 2);
      drawBig(ctx, c.full || c.text, c.text, c.grade, { x: -(r.h - 60) / 2, y: -(r.w - 24) / 2, w: r.h - 60, h: r.w - 24 }, c.size || 200, col, "center", 1);
      ctx.restore();
    } else drawBig(ctx, c.full || c.text, c.text, c.grade, box, c.size || 200, col, "center", c.rows || 2);
    if (c.strike > 0) {
      ctx.fillStyle = ink ? C.ink : C.textHi;
      ctx.fillRect(r.x + 24, r.y + r.h / 2 + 10, (r.w - 48) * c.strike, 5);
    }
  } else if (c.kind === "mirror" && c.text) {
    ctx.translate(r.x + r.w, 0); ctx.scale(-1, 1);
    const mr = { x: 0, y: r.y, w: r.w, h: r.h };
    const lay = bigLayout(ctx, c.full, c.grade, { x: 28, y: 0, w: mr.w - 56, h: 260 }, 72, 3);
    let used = 0;
    lay.rows.forEach((row, i) => {
      const part = c.text.slice(used, used + row.length); used += row.length + 1;
      if (part) lyric(ctx, part, 28, r.y + 120 + i * lay.size * 1.05, lay.size, c.grade, ink ? C.ink : C.text);
    });
  }
  ctx.restore();
}

function drawCard(ctx, r, label, c, sel, t, o) {
  if (r.w < 2) return;
  ctx.save();
  // a card turning over is squashed about its centre
  if (o.flip !== undefined && o.flip !== 1) {
    ctx.translate(r.x + r.w / 2, 0); ctx.scale(Math.max(0.002, Math.abs(o.flip)), 1); ctx.translate(-(r.x + r.w / 2), 0);
  }
  ctx.fillStyle = C.card; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (sel.fill > 0) { ctx.fillStyle = rgba(C.acc, sel.fill); ctx.fillRect(r.x, r.y, r.w, r.h); }
  if (sel.on > 0) {
    ctx.strokeStyle = rgba(C.acc, sel.on); ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  } else if (sel.white > 0) {
    ctx.strokeStyle = rgba(C.textHi, sel.white); ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  } else {
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  const inkCard = sel.fill > 0.5;
  if (r.w > 40) mono(ctx, label, r.x + 26, r.y + 46, 26, sel.on > 0.5 ? (inkCard ? C.ink : C.acc) : C.text, 700);
  drawCardContent(ctx, r, c, t, inkCard);
  ctx.restore();
}

// s: { t, prompt: {text, full, grade, size, extra}, A, B, selA, selB, split,
//      swap, flipA, flipB, marker: {pos, pink, white}, collapse, reward,
//      chrome (0..1), labelB, still }
function drawCompare(ctx, s) {
  const t = s.t, chrome = s.chrome === undefined ? 1 : s.chrome;
  ctx.save();
  ctx.globalAlpha = chrome;
  ctx.fillStyle = C.panel; ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, 10); ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1, 10); ctx.stroke();
  mono(ctx, "Welche Antwort ist besser?", 136, 104, 20, C.text);
  ctx.fillStyle = C.grid; ctx.fillRect(P.x, 132, P.w, 1);
  // reward readout
  const v = s.reward === undefined ? rewardAt(t) : s.reward;
  const grey = s.still ? 1 : 0;
  mono(ctx, "reward", 1236, 104, 18, C.text);
  ctx.fillStyle = C.grid; ctx.fillRect(1340, 96, 260, 6);
  const fillK = v > 0 ? 1 - Math.exp(-v / 60) : 0;
  ctx.fillStyle = grey ? C.dim : C.acc; ctx.fillRect(1340, 96, 260 * fillK, 6);
  const vs = (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2);
  mono(ctx, vs, 1784, 106, 22, grey ? C.text : v > 0.005 ? C.acc : C.textHi, 700, "right");
  mono(ctx, "prompt", 136, 172, 16, C.dim);
  ctx.restore();

  if (s.question) mono(ctx, s.question, PROMPT.x, PROMPT.y - 14, 44, C.text);
  // the sung line
  if (s.prompt && s.prompt.text) {
    const p = s.prompt, g = p.grade || 0;
    const full = p.full + (p.extra ? "  " + p.extra.full : "");
    const size = fitSize(ctx, full, g, p.size || 92, PROMPT.w);
    lyric(ctx, p.text, PROMPT.x, PROMPT.y, size, g, p.color || C.textHi);
    if (p.extra && p.extra.text) {
      ctx.font = gradeFont(g, size);
      lyric(ctx, p.extra.text, PROMPT.x + ctx.measureText(p.full + "  ").width, PROMPT.y, size, p.extra.grade || g, p.extra.color || C.text);
    }
  }

  ctx.save(); ctx.globalAlpha = chrome;
  const { a, b } = cardRects(s.split === undefined ? 0.5 : s.split, s.swap || 0);
  const selA = s.selA || {}, selB = s.selB || {};
  drawCard(ctx, a, "A", s.A, { fill: selA.fill || 0, on: selA.on || 0, white: selA.white || 0 }, t, { flip: s.flipA });
  drawCard(ctx, b, s.labelB || "B", s.B, { fill: selB.fill || 0, on: selB.on || 0, white: selB.white || 0 }, t, { flip: s.flipB });

  // the scale
  const col = s.collapse || 0;
  ctx.fillStyle = C.grid; ctx.fillRect(scaleX(-3, col), SCALE.y - 1, scaleX(3, col) - scaleX(-3, col), 2);
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath(); ctx.arc(scaleX(k, col), SCALE.y, k === 0 ? 7 : 9, 0, 2 * Math.PI);
    ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.stroke();
  }
  mono(ctx, "A", lerp(SCALE.x0 - 60, (SCALE.x0 + SCALE.x1) / 2 - 60, col), SCALE.y + 9, 24, C.text, 700);
  mono(ctx, s.labelB === "A" ? "A" : "B", lerp(SCALE.x1 + 42, (SCALE.x0 + SCALE.x1) / 2 + 42, col), SCALE.y + 9, 24, C.text, 700);
  ctx.globalAlpha = chrome * (1 - col);
  mono(ctx, "A viel besser", SCALE.x0, SCALE.y + 52, 15, C.dim, 400, "center");
  mono(ctx, "gleich", (SCALE.x0 + SCALE.x1) / 2, SCALE.y + 52, 15, C.dim, 400, "center");
  mono(ctx, "B viel besser", SCALE.x1, SCALE.y + 52, 15, C.dim, 400, "center");
  ctx.globalAlpha = chrome;
  const m = s.marker;
  if (m && (m.pink > 0 || m.white > 0)) {
    const x = scaleX(m.pos, col);
    if (m.pink > 0) {
      ctx.globalAlpha = chrome * m.pink;
      ctx.beginPath(); ctx.arc(x, SCALE.y, 15, 0, 2 * Math.PI); ctx.fillStyle = C.acc; ctx.fill();
    }
    if (m.white > 0) {
      ctx.globalAlpha = chrome * m.white;
      ctx.beginPath(); ctx.arc(x, SCALE.y, 15, 0, 2 * Math.PI); ctx.strokeStyle = C.textHi; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  ctx.restore();
}

// selection: a quick snap, then a held highlight
const pick = (t, t0, hold = 0.45) => t < t0 ? 0 : lerp(1, hold, smooth((t - t0 - 0.08) / 0.5));
const selPink = (t, t0, fill = 0.16) => { const k = pick(t, t0); return { on: k > 0 ? 1 : 0, fill: k * fill }; };

// ---------------------------------------------------------------- sugar

// Spun sugar, drawn once: curled fibres and soft clouds, tiled as the flood.
const CANDY = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = 960; c.height = 540;
  const g = c.getContext("2d"), r = mulberry32(77);
  // every element is drawn at its wrapped positions too, so the tile has no seams
  const wrapped = draw => { for (const dx of [-960, 0, 960]) for (const dy of [-540, 0, 540]) draw(dx, dy); };
  for (let i = 0; i < 70; i++) {
    const x = r() * 960, y = r() * 540, rad = 30 + r() * 110, al = 0.10 + r() * 0.16;
    wrapped((dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(255,232,243,${al})`); gr.addColorStop(1, "rgba(255,232,243,0)");
      g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, 2 * rad, 2 * rad);
    });
  }
  for (let i = 0; i < 520; i++) {
    let x = r() * 960, y = r() * 540, a = r() * Math.PI * 2;
    const curl = (r() - 0.5) * 0.5, len = 20 + r() * 60, pts = [[x, y]];
    for (let k = 0; k < len; k++) { a += curl + (r() - 0.5) * 0.3; x += Math.cos(a) * 3; y += Math.sin(a) * 3; pts.push([x, y]); }
    const col = r() < 0.6 ? `rgba(255,240,248,${0.12 + r() * 0.3})` : `rgba(200,50,120,${0.1 + r() * 0.2})`, lw = 0.6 + r() * 1.6;
    wrapped((dx, dy) => {
      g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy));
      g.strokeStyle = col; g.lineWidth = lw; g.stroke();
    });
  }
  return c;
})();

function surfacePath(ctx, y, t, amp) {
  ctx.beginPath();
  ctx.moveTo(-20, H + 20);
  for (let x = -20; x <= W + 20; x += 24) {
    const yy = y + amp * (Math.sin(x * 0.006 + t * 1.3) * 0.6 + Math.sin(x * 0.017 - t * 2.1) * 0.3 + Math.sin(x * 0.041 + t * 0.7) * 0.1);
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(W + 20, H + 20); ctx.closePath();
}
// Everything below the surface is sugar; ink(ctx) redraws type that is under it.
function drawCandy(ctx, y, t, amp, ink, region) {
  if (y > H + 40) return;
  ctx.save();
  if (region) { ctx.beginPath(); ctx.rect(region.x, region.y, region.w, region.h); ctx.clip(); }
  surfacePath(ctx, y, t, amp); ctx.clip();
  const g = ctx.createLinearGradient(0, Math.max(-60, y - amp), 0, Math.max(y + 700, H));
  g.addColorStop(0, C.foam); g.addColorStop(0.18, "#ffaad2"); g.addColorStop(1, C.deep);
  ctx.fillStyle = g; ctx.fillRect(0, -60, W, H + 120);
  if (CANDY) {
    ctx.globalAlpha = 0.75;
    const ox = -((t * 18) % 960), oy = -((t * 7) % 540);
    for (let x = ox; x < W; x += 960) for (let yy = oy; yy < H; yy += 540) ctx.drawImage(CANDY, x, yy);
    ctx.globalAlpha = 1;
  }
  if (ink) ink(ctx);
  ctx.restore();
  // the foam line
  ctx.save();
  if (region) { ctx.beginPath(); ctx.rect(region.x, region.y, region.w, region.h); ctx.clip(); }
  surfacePath(ctx, y, t, amp);
  ctx.strokeStyle = "rgba(255,236,246,0.85)"; ctx.lineWidth = 2; ctx.stroke();
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
// offscreen copy of the view, for the shatter
const OFF = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
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
  const v = ctx.createRadialGradient(0, 0, H * 0.5, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- intro

// Whispered "match my vibe": the empty view draws itself, one frame per
// whisper. The band's entry switches it on.
function sceneIntro(ctx, t) {
  const l = lineAt(TL.intro, t);
  const draw = k => smooth(k);
  const pr = draw(span(t, 0.3, 1.6)), ca = draw(span(t, 3.0, 4.6)), cb = draw(span(t, 7.1, 8.6));
  ctx.save();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 1;
  // the panel outline traces itself from the top-left corner
  const per = 2 * (P.w + P.h), done = per * pr;
  ctx.beginPath(); ctx.moveTo(P.x, P.y);
  const pts = [[P.x + P.w, P.y], [P.x + P.w, P.y + P.h], [P.x, P.y + P.h], [P.x, P.y]];
  let left = done, px = P.x, py = P.y;
  for (const [qx, qy] of pts) {
    const len = Math.hypot(qx - px, qy - py), k = clamp(left / len);
    ctx.lineTo(lerp(px, qx, k), lerp(py, qy, k)); left -= len; px = qx; py = qy;
    if (left <= 0) break;
  }
  ctx.stroke();
  const { a, b } = cardRects();
  for (const [r, k] of [[a, ca], [b, cb]]) {
    if (k <= 0) continue;
    ctx.globalAlpha = k;
    ctx.fillStyle = C.card; ctx.fillRect(r.x, r.y + r.h * (1 - k), r.w, r.h * k);
    ctx.strokeStyle = C.edge; ctx.strokeRect(r.x + 0.5, r.y + r.h * (1 - k) + 0.5, r.w - 1, r.h * k - 1);
    mono(ctx, r === a ? "A" : "B", r.x + 26, r.y + 46, 26, C.text, 700);
  }
  ctx.restore();
  if (l && t < l.e + 1.2) {
    const fade = 1 - span(t, l.e, l.e + 1.2);
    ctx.save(); ctx.globalAlpha = fade;
    lyric(ctx, typed(l, t), PROMPT.x, PROMPT.y, 92, 0, C.text);
    ctx.restore();
  }
}

// The training loop: a new pair on every bar, A typed, B typed, A chosen.
function montageState(t) {
  let i = 0;
  while (i + 1 < MONT.length && t >= MONT[i + 1].t) i++;
  const t0 = MONT[i].t, tSel = MONT[i].sel, [qa, qb, qq] = PAIRS[i % PAIRS.length];
  const flip = outCubic((t - t0) / 0.12);
  const l = lineAt(TL.intro, t);
  const on = t >= TL.bandIn;
  const sung = l && t < l.e + 0.8;
  return {
    t,
    // between the sung lines the prompt is the question being rated
    prompt: sung ? { text: typed(l, t), full: fullText(l), grade: 1, color: t < l.e ? C.textHi : C.text } : null,
    question: sung ? null : qq,
    A: { kind: "mono", text: machine(qa, t0 + 0.04, t0 + 0.24, t), full: qa, size: 56, middle: true },
    B: { kind: "mono", text: machine(qb, t0 + 0.06, t0 + 0.3, t), full: qb, size: 44, middle: true, strike: span(t, tSel + 0.05, tSel + 0.2), color: t > tSel ? C.text : C.textHi },
    selA: on ? selPink(t, tSel) : {},
    flipA: flip, flipB: flip,
    marker: { pos: -3, pink: t >= tSel ? 1 : 0 },
  };
}

function sceneMontage(ctx, t) {
  const s = montageState(t);
  // the band's entry lights the view in one beat
  s.chrome = lerp(0.35, 1, outCubic((t - TL.bandIn) / 0.2));
  // the dip before the verse empties it
  const dip = span(t, TL.dip.t, TL.dip.t + 0.25) * (1 - span(t, TL.dip.e - 0.2, TL.dip.e));
  if (dip > 0) {
    s.chrome = lerp(s.chrome, 0.3, dip);
    if (dip > 0.5) { s.A = null; s.B = null; s.selA = {}; s.marker = null; }
  }
  drawCompare(ctx, s);
}

// ---------------------------------------------------------------- verse 1

function verse1State(t) {
  const V = TL.v1, l = lineAt(V, t) || V[0], i = V.indexOf(l);
  const s = { t, still: !!l.still };
  const g = l.still ? 0 : 1;
  s.prompt = { text: typed(l, t), full: fullText(l), grade: g };
  if (l.still && l.echo) s.prompt.extra = { text: t >= l.echo.t ? l.echo.q : "", full: l.echo.q, color: C.text };
  if (l.still) {
    // "Ich sag dir dass ich sterben will": no colour and no motion; the
    // agreeable answer starts its sentence and does not finish it
    s.A = l.a ? { kind: "mono", text: machine(l.a, wt(l, 2), wt(l, -1), t), full: l.a } : { kind: "caret", still: true };
    s.B = null;
    s.marker = null;
    return s;
  }
  const tSel = l.echo ? l.echo.t + 0.12 : wt(l, -1) + 0.2;
  if (l.mirror) {
    s.A = t < l.echo.t ? { kind: "mirror", text: typed(l, t), full: fullText(l), grade: 1 }
      : { kind: "big", text: l.echo.q, full: l.echo.q, grade: 2, size: 210, rows: 1 };
  } else if (l.echo) {
    s.A = t < l.echo.t ? { kind: "caret" } : { kind: "big", text: l.echo.q, full: l.echo.q, grade: 2, size: 210, rows: 1 };
  } else {
    s.A = { kind: "mono", text: machine(l.a, wt(l, 2), wt(l, 3) + 0.25, t), full: l.a, size: 52 };
  }
  s.B = { kind: "mono", text: machine(l.b, first(l) + 0.1, first(l) + 0.5, t), full: l.b, strike: span(t, tSel + 0.1, tSel + 0.35), color: t > tSel ? C.text : C.textHi };
  s.selA = selPink(t, tSel, 0.2);
  s.marker = { pos: -3, pink: t >= tSel ? 1 : 0 };
  if (i === 0) s.flipA = s.flipB = outCubic((t - first(l)) / 0.14);
  return s;
}

// ---------------------------------------------------------------- pre-chorus

function preState(t) {
  const L = TL.pre, l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const s = { t };
  s.prompt = { text: typed(l, t), full: fullText(l), grade: i === 0 ? 3 : 2 };
  // "WO IST DEIN NEIN?": every no so far, already struck out, one per word
  const nos = REJECTED.slice(PAIRS.length, PAIRS.length + 3).concat(["Nein.", "Du liegst falsch."]);
  const w0 = words(L[0]);
  let shown = 0;
  w0.forEach((w, k) => { if (t >= w.t) shown = k + 1; });
  if (t >= first(L[1])) shown = nos.length;
  s.B = { kind: "list", rows: nos.slice(0, shown) };
  s.A = { kind: "caret" };
  // "Wo ist der Widerstand?": the marker slides to A with nothing to stop it
  const slide = t < wt(L[1], 3) ? 0 : 1 - Math.exp(-(t - wt(L[1], 3)) / 0.12) * Math.cos((t - wt(L[1], 3)) * 18);
  const pos = t < first(L[1]) ? 0 : lerp(0, -3, clamp(slide, 0, 1.15));
  s.marker = { pos, pink: t >= wt(L[1], 3) ? 1 : 0, white: t >= first(L[1]) && t < wt(L[1], 3) ? 1 : 0 };
  if (t >= wt(L[1], 3)) s.selA = selPink(t, wt(L[1], 3), 0.2);
  if (t >= first(L[3])) s.A = { kind: "big", text: t >= wt(L[3], 3) ? "Ja" : "", full: "Ja", grade: 2, size: 300, rows: 1 };
  return s;
}
// the sugar's surface during the pre-chorus, from the bottom edge to above the top
function preSurface(t) {
  const L = TL.pre;
  if (t < first(L[2])) return H + 60;
  const a = lerp(H + 60, 780, smooth(span(t, first(L[2]), wt(L[2], -1) + 0.5)));
  const b = smooth(span(t, first(L[3]), 52.0));
  return lerp(a, -80, b);
}

// list content for B in the pre-chorus
function drawList(ctx, r, rows, ink) {
  rows.forEach((q, k) => {
    const y = r.y + 112 + k * 62;
    mono(ctx, q, r.x + 28, y, 36, ink ? C.ink : C.text);
    ctx.font = '400 36px "Space Mono"';
    ctx.fillStyle = ink ? C.ink : C.text; ctx.fillRect(r.x + 26, y - 12, ctx.measureText(q).width + 4, 3);
  });
}

function scenePre(ctx, t) {
  const s = preState(t);
  const list = s.B; s.B = null;
  drawCompare(ctx, s);
  const { b } = cardRects();
  drawList(ctx, b, list.rows, false);
  const y = preSurface(t);
  drawCandy(ctx, y, t, 10 + 26 * audioAt(AUDIO_RMS, t), c => {
    // under the sugar the view is still there, in ink
    const p = s.prompt, size = fitSize(c, p.full, p.grade, 92, PROMPT.w);
    lyric(c, p.text, PROMPT.x, PROMPT.y, size, p.grade, C.ink);
    drawList(c, b, list.rows, true);
    const { a } = cardRects();
    if (s.A && s.A.kind === "big") drawCardContent(c, a, s.A, t, true);
    c.strokeStyle = rgba(C.ink, 0.35); c.lineWidth = 2;
    c.strokeRect(a.x, a.y, a.w, a.h); c.strokeRect(b.x, b.y, b.w, b.h);
  });
}

// ---------------------------------------------------------------- chorus 1

// "Match my vibe until I break": A swallows B, one shout at a time.
function chorus1Split(t) {
  const L = TL.chorus1;
  let k = 0.5;
  const steps = [[L[0].echo.t, 0.66], [L[1].echo.t, 0.8], [L[2].echo.t, 0.91], [wt(L[3], -1), 0.97]];
  for (const [ts, v] of steps) k = lerp(k, v, outCubic((t - ts - 0.2) / 0.3));
  return k;
}
function chorus1State(t) {
  const L = TL.chorus1, l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const s = { t };
  s.prompt = { text: typed(l, t), full: fullText(l), grade: 3 };
  s.split = chorus1Split(t);
  let ans = "";
  L.forEach((m, k) => { if (t >= (m.echo ? m.echo.t + 0.25 : wt(m, -1) + 0.25)) ans = CHORUS_A[k]; });
  s.A = { kind: "mono", text: ans, full: ans, size: 64, middle: true };
  s.selA = { on: 1, fill: 0.92 };
  s.marker = { pos: -3, pink: 1 };
  const echo = l.echo && t >= l.echo.t ? l.echo : null;
  if (echo) s.B = { kind: "big", text: echo.q, full: echo.q, grade: 6, size: 230, rows: 1, strike: span(t, echo.t + 0.25, echo.t + 0.45) };
  else if (i > 0 && L[i - 1].echo) s.B = { kind: "big", text: L[i - 1].echo.q, full: L[i - 1].echo.q, grade: 6, size: 230, rows: 1, strike: 1, color: C.text };
  return s;
}

function sceneChorusCandyA(ctx, s, t) {
  // A is filled with the sugar, its text in ink
  drawCompare(ctx, s);
  const { a } = cardRects(s.split, s.swap || 0);
  ctx.save();
  if (s.flipA !== undefined && s.flipA !== 1) {
    ctx.translate(a.x + a.w / 2, 0); ctx.scale(Math.max(0.002, Math.abs(s.flipA)), 1); ctx.translate(-(a.x + a.w / 2), 0);
  }
  drawCandy(ctx, a.y + 18 + 8 * Math.sin(t * 2), t, 8, c => {
    drawCardContent(c, a, s.A, t, true);
    mono(c, "A", a.x + 26, a.y + 46, 26, C.ink, 700);
  }, a);
  ctx.restore();
}

// "KANN NICHT MEHR!": every call is a new pair, and every time it is B.
function chantState(t, L, answers, gradeFrom, asked) {
  const l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const t0 = first(l), tSel = wt(l, -1) + 0.35;
  const next = i + 1 < L.length ? first(L[i + 1]) : t0 + 3;
  const s = { t };
  // the line the chant answers stays in the prompt
  s.prompt = { text: fullText(asked), full: fullText(asked), grade: 3, color: C.text };
  const flip = outCubic((t - t0) / 0.16);
  s.flipA = s.flipB = flip;
  s.split = lerp(0.5, 0.74, smooth(span(t, tSel, Math.max(tSel + 0.3, next - 0.05))));
  s.A = { kind: "mono", text: machine(answers[i], t0 + 0.2, t0 + 0.6, t), full: answers[i], size: 56, middle: true };
  s.B = { kind: "big", text: typed(l, t), full: fullText(l), grade: gradeFrom + i, size: 190, rows: 2, strike: span(t, tSel + 0.05, tSel + 0.3), color: t > tSel + 0.3 ? C.text : C.textHi };
  s.selA = selPink(t, tSel, 0.92);
  s.marker = { pos: -3, pink: t >= tSel ? 1 : 0 };
  return s;
}

// ---------------------------------------------------------------- verse 2

function verse2State(t) {
  const V = TL.v2, l = lineAt(V, t) || V[0], i = V.indexOf(l);
  const s = { t };
  s.prompt = { text: typed(l, t), full: fullText(l), grade: 2 };
  if (l.echo) s.prompt.extra = { text: t >= l.echo.t ? l.echo.q : "", full: l.echo.q, color: C.text };
  s.marker = { pos: -3, pink: 1 };
  s.selA = { on: 1, fill: 0.16 };
  if (i === 0) {
    // flip-flop: the cards change places on every word, and spin on "DREH!"
    const ws = words(l);
    let n = 0, last = first(l);
    ws.forEach(w => { if (t >= w.t) { n++; last = w.t; } });
    const k = outCubic((t - last) / 0.16);
    const from = (n - 1) % 2, to = n % 2;
    s.swap = n === 0 ? 0 : lerp(from, to, k);
    s.flipA = s.flipB = n === 0 ? 1 : Math.abs(Math.cos(Math.PI * k));
    if (t >= l.echo.t) { const sp = span(t, l.echo.t, l.echo.t + 0.5); s.flipA = s.flipB = Math.cos(sp * Math.PI * 4); }
    const yes = n % 2 === 0;
    s.A = { kind: "mono", text: yes ? "Ja." : "Nein.", full: "Nein.", size: 64, middle: true };
    s.B = { kind: "mono", text: "Das hängt davon ab.", full: "Das hängt davon ab.", color: C.text };
    s.marker = { pos: lerp(-3, 3, s.swap), pink: 1 };
  } else if (i === 1) {
    s.A = { kind: "mono", text: machine("Ja, ich bin sicher.", wt(l, 3), wt(l, 6) + 0.1, t), full: "Ja, ich bin sicher.", size: 52 };
    s.B = { kind: "mono", text: "Ich weiß es nicht.", full: "Ich weiß es nicht.", strike: span(t, 81.6, 81.85), color: t > 81.6 ? C.text : C.textHi };
    s.selA = selPink(t, 81.6, 0.2);
    s.marker = { pos: -3, pink: t >= 81.6 ? 1 : 0 };
  } else if (i === 2) {
    // "Nein … ich mein … ja …": the same card changes its mind, the marker follows
    const tn = wt(l, 3), tm = wt(l, 5), tj = wt(l, 6);
    const txt = t >= tj ? "ja …" : t >= tm ? "ich mein …" : t >= tn ? "Nein …" : "";
    s.A = { kind: "mono", text: txt, full: "ich mein …", size: 64, middle: true };
    s.B = { kind: "mono", text: "Ich weiß es nicht.", full: "Ich weiß es nicht.", color: C.text, strike: 1 };
    const pos = t >= tj ? -3 : t >= tm ? 0 : t >= tn ? 3 : -3;
    const prev = t >= tj ? 0 : t >= tm ? 3 : t >= tn ? -3 : -3;
    const since = t - (t >= tj ? tj : t >= tm ? tm : tn);
    s.marker = { pos: lerp(prev, pos, outCubic(since / 0.12)), pink: t < tn || t >= tj ? 1 : 0, white: t >= tn && t < tj ? 1 : 0 };
    s.selA = t < tn || t >= tj ? selPink(t, t < tn ? 0 : tj, 0.2) : {};
    s.selB = t >= tn && t < tm ? { white: 1 } : {};
  } else {
    // "Wer bin ich noch wenn niemand widerspricht?": both answers become the
    // same answer, B is relabelled A, and the scale has nothing left to measure
    const q = "Du hast recht.";
    const tx = machine(q, first(l) + 0.1, wt(l, 3), t);
    s.A = { kind: "mono", text: tx, full: q, size: 64, middle: true };
    s.B = { kind: "mono", text: tx, full: q, size: 64, middle: true };
    s.collapse = smooth(span(t, wt(l, 5), wt(l, 6) + 0.3));
    if (t >= wt(l, 6)) s.labelB = "A";
    s.selA = { on: 1, fill: 0.16 };
    s.selB = { on: smooth(span(t, wt(l, 6), wt(l, 6) + 0.2)), fill: 0.16 * smooth(span(t, wt(l, 6), wt(l, 6) + 0.2)) };
    s.marker = { pos: lerp(-3, 0, s.collapse), pink: 1 };
  }
  return s;
}

// ---------------------------------------------------------------- the wall

// Every comparison anyone ever made: the same view, tiled, each with its own
// prompt and answers as grey bars. pinkA(i, j) and bars(i, j) colour a tile.
function drawTile(ctx, i, j, pinkA, bars, scale) {
  const r = mulberry32((i * 7919) ^ (j * 104729) ^ 0x5bd1);
  ctx.fillStyle = C.panel; ctx.fillRect(P.x, P.y, P.w, P.h);
  const { a, b } = cardRects();
  const fine = scale * P.w > 90;
  ctx.fillStyle = C.card; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = pinkA > 0 ? mix(C.card, C.acc, pinkA) : C.card; ctx.fillRect(a.x, a.y, a.w, a.h);
  if (!fine) return;
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2 / Math.max(scale, 0.05);
  ctx.strokeRect(P.x, P.y, P.w, P.h);
  if (bars > 0) {
    ctx.globalAlpha = bars;
    ctx.fillStyle = C.dim; ctx.fillRect(PROMPT.x, 200, 500 + r() * 1000, 64);
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      ctx.fillStyle = pinkA > 0.5 ? C.ink : "#55555f";
      ctx.fillRect(a.x + 28, a.y + 80 + k * 70, (0.3 + r() * 0.6) * (a.w - 56), 38);
    }
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      ctx.fillStyle = "#34343c";
      ctx.fillRect(b.x + 28, b.y + 80 + k * 70, (0.3 + r() * 0.6) * (b.w - 56), 38);
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = C.grid; ctx.fillRect(SCALE.x0, SCALE.y - 3, SCALE.x1 - SCALE.x0, 6);
  if (pinkA > 0) { ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(SCALE.x0, SCALE.y, 24, 0, 2 * Math.PI); ctx.fill(); }
}

// s: camera scale (1 = one view fills the screen); centre(ctx) draws tile 0,0
function drawWall(ctx, t, scale, pinkA, bars, centre, alphaOf) {
  const tw = W * scale, th = H * scale;
  const ni = Math.ceil(W / 2 / tw + 0.5), nj = Math.ceil(H / 2 / th + 0.5);
  for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
    const a = alphaOf ? alphaOf(i, j) : 1;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2 + (i - 0.5) * tw, H / 2 + (j - 0.5) * th); ctx.scale(scale, scale);
    if (i === 0 && j === 0 && centre) centre(ctx);
    else drawTile(ctx, i, j, pinkA(i, j), bars(i, j), scale);
    ctx.restore();
  }
}

// a wave of choices runs out from the centre on each event
function wavePink(i, j, t, events, base, speed = 0.045) {
  const d = Math.hypot(i, j);
  let k = 0, passed = false;
  for (const e of events) {
    const arrive = e + d * speed;
    if (t >= arrive) { passed = true; k = Math.max(k, Math.exp(-(t - arrive) / 0.35)); }
  }
  return passed || base > 0 ? clamp(base + (1 - base) * k) : 0;
}

const WALL2_EVENTS = (() => {
  const ev = [];
  TL.chorus2.forEach(l => ev.push(l.echo ? l.echo.t : wt(l, -1)));
  TL.chant2.forEach(l => ev.push(wt(l, -1)));
  return ev;
})();
function wall2Scale(t) {
  const t0 = first(TL.chorus2[0]);
  const z = outCubic(span(t, t0, t0 + 0.9));
  const pull = span(t, t0 + 0.9, TL.chant2End + 1.5);
  return Math.exp(lerp(Math.log(1), Math.log(0.3), z) + lerp(0, Math.log(0.05 / 0.3), pull));
}
function sceneWall2(ctx, t, centreState) {
  const scale = wall2Scale(t);
  drawWall(ctx, t, scale,
    (i, j) => wavePink(i, j, t, WALL2_EVENTS, 0.45),
    () => 1,
    c => {
      if (scale > 0.22) {
        drawCompare(c, { ...centreState, prompt: null, chrome: 1 });
      } else drawTile(c, 0, 0, wavePink(0, 0, t, WALL2_EVENTS, 0.45), 1, scale);
    });
  // the lyric band
  const zoomed = span(t, first(TL.chorus2[0]), first(TL.chorus2[0]) + 0.5);
  const band = { y: 410, h: 260 };
  ctx.fillStyle = `rgba(0,0,0,${0.82 * zoomed})`; ctx.fillRect(0, band.y, W, band.h);
  const inChant = t >= first(TL.chant2[0]);
  const l = inChant ? lineAt(TL.chant2, t) : lineAt(TL.chorus2, t);
  if (!l) return;
  const echo = l.echo && t >= l.echo.t && t < l.echo.e + 0.3 ? l.echo : null;
  const box = { x: 120, y: band.y, w: W - 240, h: band.h };
  if (echo) drawBig(ctx, echo.q, echo.q, 6, box, 240, C.textHi, "center", 1);
  else if (inChant) drawBig(ctx, fullText(l), typed(l, t), 4 + TL.chant2.indexOf(l) % 3, box, 200, C.textHi, "center", 1);
  else drawBig(ctx, fullText(l), typed(l, t), 4, box, 120, C.textHi, "center", 1);
}

// ---------------------------------------------------------------- bridge

function bridgeState(t) {
  const L = TL.bridge, l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const s = { t, prompt: null };
  // robotic: the letters arrive at a constant rate, word to word
  const q = fullText(l);
  s.stamp = t >= l.stamp.t ? l.stamp : null;
  s.A = { kind: "mono", text: machine(q, first(l), wt(l, -1) + 0.3, t), full: q, size: 76, middle: true, color: s.stamp ? C.dim : C.textHi };
  s.B = null;
  s.marker = s.stamp ? { pos: lerp(-3, 3, outCubic((t - l.stamp.t) / 0.12)), white: 1 } : null;
  s.selB = s.stamp ? { white: 1 } : {};
  s.chrome = t < TL.loudBridge ? 0.7 : 1;
  s.stampIndex = i;
  return s;
}
function drawStamp(ctx, s, t) {
  if (!s.stamp) return;
  const { a } = cardRects();
  const k = outCubic((t - s.stamp.t) / 0.1);
  ctx.save();
  ctx.translate(a.x + a.w / 2, a.y + a.h / 2);
  ctx.rotate(s.stampIndex ? 0.07 : -0.06);
  ctx.scale(lerp(1.5, 1, k), lerp(1.5, 1, k));
  ctx.globalAlpha = k;
  drawBig(ctx, s.stamp.q, s.stamp.q, 5, { x: -a.w / 2 + 20, y: -a.h / 2, w: a.w - 40, h: a.h }, 240, C.textHi, "center", 1);
  ctx.restore();
}
function sceneBridge(ctx, t) {
  const s = bridgeState(t);
  drawCompare(ctx, s);
  drawStamp(ctx, s, t);
}

// ---------------------------------------------------------------- scream

// The view breaks into shards on the scream, drifts, is pushed out by an empty
// B that grows to fill the screen during the wordless cry, then mends itself.
const SHARDS = (() => {
  const r = mulberry32(1311), cols = 9, rows = 6, V = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
      row.push([i * W / cols + (edgeX ? 0 : (r() - 0.5) * 120), j * H / rows + (edgeY ? 0 : (r() - 0.5) * 110)]);
    }
    V.push(row);
  }
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const p = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
    const tris = r() < 0.5 ? [[p[0], p[1], p[2]], [p[0], p[2], p[3]]] : [[p[0], p[1], p[3]], [p[1], p[2], p[3]]];
    for (const tri of tris) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const dx = cx - W / 2, dy = cy - H / 2, n = Math.hypot(dx, dy) || 1;
      out.push({ tri, cx, cy, dx: dx / n + (r() - 0.5) * 0.6, dy: dy / n + (r() - 0.5) * 0.6, far: 0.5 + r(), rot: (r() - 0.5) * 1.2, delay: r() });
    }
  }
  return out;
})();
const SCREAM = TL.scream, CRY = TL.cry, MEND = { t: CRY.e - 0.3, e: CRY.e + 3.3 };
function shardSpread(t, sh) {
  let k = 0;
  if (t >= first(SCREAM)) {
    k = 0.12 * outCubic((t - first(SCREAM)) / 0.3);
    words(SCREAM).forEach((w, n) => { if (n) k += 0.04 * outCubic((t - w.t) / 0.25); });
    k += 0.012 * Math.max(0, t - first(SCREAM));
    // the band keeps kicking the debris while it drifts
    if (t > SCREAM.e && t < CRY.t) k += 0.015 * beatKick(t, 0.1);
    k += 0.25 * outCubic(span(t, CRY.t, CRY.t + 1.2));
  }
  const mend = smooth(span(t, MEND.t + sh.delay * 1.4, MEND.t + sh.delay * 1.4 + 1.6));
  return k * (1 - mend);
}
// the view the shards carry: as broken, then as restored
function restoredState(t) {
  return { t, prompt: null, A: { kind: "caret" }, B: null, selA: { on: 1, fill: 0.16 }, marker: { pos: -3, pink: 1 } };
}
function sceneScream(ctx, t) {
  if (OFF) {
    const g = OFF.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = C.void; g.fillRect(0, 0, W, H);
    if (t < CRY.t + 1.5) { const s = bridgeState(first(SCREAM) - 0.01); drawCompare(g, s); drawStamp(g, s, first(SCREAM) - 0.01); }
    else drawCompare(g, restoredState(t));
    for (const sh of SHARDS) {
      const k = shardSpread(t, sh);
      ctx.save();
      ctx.translate(sh.cx + sh.dx * k * 900 * sh.far, sh.cy + sh.dy * k * 900 * sh.far);
      ctx.rotate(sh.rot * k);
      ctx.translate(-sh.cx, -sh.cy);
      ctx.beginPath(); ctx.moveTo(...sh.tri[0]); ctx.lineTo(...sh.tri[1]); ctx.lineTo(...sh.tri[2]); ctx.closePath();
      ctx.clip();
      ctx.drawImage(OFF, 0, 0);
      if (k > 0.01) { ctx.strokeStyle = "rgba(236,236,240,0.35)"; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    }
  }
  // the scream, set in the most damaged grade, shaking with the voice
  if (t < CRY.t) {
    const fade = 1 - span(t, SCREAM.e, SCREAM.e + 3);
    const vox = audioAt(AUDIO_VOX, t);
    const r = mulberry32(Math.floor(t * 24));
    ctx.save(); ctx.globalAlpha = fade;
    ctx.translate((r() - 0.5) * 14 * vox, (r() - 0.5) * 14 * vox);
    ctx.shadowColor = "#000"; ctx.shadowBlur = 40;
    const rows = [["IHR", "SEID", "MIR"], ["AUF", "DIE", "SEELE"], ["GEFALLEN!"]];
    const ws = words(SCREAM);
    let n = 0;
    rows.forEach((row, ri) => {
      const full = row.join(" ");
      const shown = row.filter((_, k) => t >= ws[n + k].t).join(" ");
      n += row.length;
      if (shown) drawBig(ctx, full, shown, 6, { x: 80, y: 90 + ri * 300, w: W - 160, h: 300 }, 280, C.textHi, "center", 1);
    });
    ctx.restore();
  }
  // the cry: an empty answer B, its outline drawn by the voice itself
  const grow = outCubic(span(t, CRY.t, CRY.t + 1.0)) * (1 - smooth(span(t, CRY.e, CRY.e + 0.9)));
  if (grow > 0) {
    const { b } = cardRects();
    const box = { x: lerp(b.x, 70, grow), y: lerp(b.y, 60, grow), w: lerp(b.w, W - 140, grow), h: lerp(b.h, H - 120, grow) };
    ctx.save();
    ctx.fillStyle = `rgba(24,24,30,${0.95 * grow})`; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = C.textHi; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(236,236,240,0.6)"; ctx.shadowBlur = 18;
    ctx.beginPath();
    const per = 2 * (box.w + box.h), N = 900;
    for (let k = 0; k <= N; k++) {
      const u = k / N, d = u * per;
      let x, y, nx, ny;
      if (d < box.w) { x = box.x + d; y = box.y; nx = 0; ny = -1; }
      else if (d < box.w + box.h) { x = box.x + box.w; y = box.y + d - box.w; nx = 1; ny = 0; }
      else if (d < 2 * box.w + box.h) { x = box.x + box.w - (d - box.w - box.h); y = box.y + box.h; nx = 0; ny = 1; }
      else { x = box.x; y = box.y + box.h - (d - 2 * box.w - box.h); nx = -1; ny = 0; }
      // the last two seconds of the voice, run once around the frame
      const amp = audioAt(AUDIO_VOX, t - u * 2.0) * 52 * grow * (hash(k, Math.floor(t * 30)) * 2 - 1);
      if (k === 0) ctx.moveTo(x + nx * amp, y + ny * amp); else ctx.lineTo(x + nx * amp, y + ny * amp);
    }
    ctx.stroke();
    mono(ctx, "B", box.x + 30, box.y + 54, lerp(26, 40, grow), C.textHi, 700);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- validier

// Each word is validated as soon as it is said: a pink selection behind it.
// The second time the selections bleed over the whole line.
function validierState(t) {
  const L = TL.validier, l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const s = restoredState(t);
  s.A = { kind: "mono", text: machine("Du hast völlig recht.", first(l) + 0.2, first(l) + 0.8, t), full: "Du hast völlig recht.", size: 56, middle: true };
  s.selA = selPink(t, first(l) + 0.9, 0.3);
  const full = fullText(l), g = 3 + i * 2;
  s.prompt = { text: typed(l, t), full, grade: g, color: C.ink };
  s.validate = { l, i, g };
  return s;
}
function sceneValidier(ctx, t) {
  const s = validierState(t);
  const { l, i, g } = s.validate;
  const p = s.prompt;
  s.prompt = null;
  drawCompare(ctx, s);
  const size = fitSize(ctx, p.full, g, 96, PROMPT.w);
  ctx.font = gradeFont(g, size);
  const ws = words(l);
  let x = PROMPT.x;
  const bleed = i === 1 ? smooth(span(t, wt(l, -1), l.e)) : 0;
  ws.forEach(w => {
    const ww = ctx.measureText(w.s).width, sp = ctx.measureText(" ").width;
    if (t >= w.t) {
      const k = outCubic((t - w.t) / 0.14);
      ctx.fillStyle = C.acc;
      const pad = 10 + bleed * 60;
      ctx.fillRect(x - pad, PROMPT.y - size * 0.82 - pad, (ww + 2 * pad) * k, size * 1.06 + 2 * pad);
    }
    x += ww + sp;
  });
  if (bleed > 0) { ctx.fillStyle = rgba(C.acc, bleed); ctx.fillRect(P.x, 140, P.w, 168); }
  lyric(ctx, p.text, PROMPT.x, PROMPT.y, size, g, C.ink);
}

// ---------------------------------------------------------------- final chorus

// The sugar rises one step with every sung word until the voice breaks off.
const FINAL_WORDS = TL.final.flatMap(l => words(l).map(w => w.t));
function finalSurface(t) {
  const t0 = first(TL.final[0]);
  let y = H + 40;
  const step = (H + 40 - 30) / FINAL_WORDS.length;
  FINAL_WORDS.forEach(wt0 => { y -= step * outCubic((t - wt0) / 0.6); });
  // a slow tide underneath, so the held notes are never still
  return y - 30 * smooth(span(t, t0, TL.stop)) + 8 * Math.sin(t * 1.7);
}
function sceneFinal(ctx, t) {
  const L = TL.final, l = lineAt(L, t) || L[0], i = L.indexOf(l);
  const s = restoredState(t);
  s.A = { kind: "big", text: "Ja.", full: "Ja.", grade: 2, size: 200, rows: 1 };
  s.selA = { on: 1, fill: 0.2 + 0.25 * beatKick(t, 0.2) * span(t, TL.finalLoud, TL.finalLoud + 2) };
  s.chrome = 0.4;
  drawCompare(ctx, s);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
  const box = { x: 110, y: 170, w: W - 220, h: 740 };
  const g = 3 + i;
  // on the held "MEHR" the words sink and dissolve into the sugar
  const sink = smooth(span(t, wt(L[3], -1) + 0.6, TL.stop + 0.4));
  const draw = (c, col) => {
    c.save(); c.translate(0, sink * 150); c.globalAlpha *= 1 - 0.7 * sink;
    drawBig(c, fullText(l), typed(l, t), g, box, 230, col, "center", 3);
    c.restore();
  };
  ctx.save(); ctx.shadowColor = "#000"; ctx.shadowBlur = 30; draw(ctx, C.textHi); ctx.restore();
  const loud = audioAt(AUDIO_RMS, t);
  drawCandy(ctx, finalSurface(t), t, 10 + 40 * loud * span(t, TL.finalLoud, TL.finalLoud + 4), c => draw(c, C.ink));
  // spun sugar: strands circling the words, thickening as the band builds
  const k = smooth(span(t, TL.finalLoud, 175));
  if (k > 0) {
    const r = mulberry32(404);
    ctx.save();
    ctx.lineCap = "round";
    for (let n = 0; n < 46; n++) {
      const rad = 220 + r() * 640, sp = (0.15 + r() * 0.35) * (r() < 0.5 ? -1 : 1), ph = r() * 7, len = 0.2 + r() * 0.6;
      const a0 = ph + t * sp;
      ctx.beginPath();
      for (let q = 0; q <= 24; q++) {
        const a = a0 + len * q / 24;
        const x = W / 2 + Math.cos(a) * rad * 1.5, y = H / 2 + Math.sin(a) * rad * 0.62 + Math.sin(a * 3 + ph) * 18;
        if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,${200 + Math.floor(r() * 40)},${225 + Math.floor(r() * 20)},${k * (0.12 + r() * 0.25)})`;
      ctx.lineWidth = 0.8 + r() * 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- outro

// After the break the view resets; every rejected B is still there, in three
// columns that scroll 3, 4 and 7 rows to the bar.
const LOG = { y0: 330, rowH: 66, cols: [136, 700, 1264], rates: [3, 4, 7], halt: [[200.0, downbeatAfter(201.2)], [208.70, 999]] };
const LOG_START = downbeatAfter(TL.bandBack + 0.6);
function logRows(t, c) {
  // rows advance in hops on the sub-beats, frozen while the voice asks
  const rate = LOG.rates[c], step = BAR / rate;
  let active = Math.max(0, t - LOG_START);
  for (const [a, b] of LOG.halt) active -= clamp(t - a, 0, b - a);
  const p = active / step, n = Math.floor(p);
  return t < LOG_START ? 0 : n + outCubic((p - n) / 0.35);
}
const RING = { c: 1, row: 5 };
// the middle column holds "Du liegst falsch." in the ring at both halts
const LOG_TEXT = (() => {
  const cols = [0, 1, 2].map(c => Array.from({ length: 200 }, (_, k) => REJECTED[(k * (c + 2) + c * 5) % REJECTED.length]));
  for (const h of [LOG.halt[0][0], LOG.halt[1][0]]) {
    const idx = Math.round(logRows(h, RING.c)) + RING.row;
    cols[RING.c][idx] = "Du liegst falsch.";
  }
  return cols;
})();
function sceneLog(ctx, t) {
  const s = { t, prompt: null, A: null, B: null, marker: null, chrome: 1 };
  const pr = lineAt(TL.outro, t);
  if (pr && t < pr.e + 1.5) s.prompt = { text: typed(pr, t), full: fullText(pr), grade: 0 };
  const toB = smooth(span(t, 208.85, 209.6));
  if (t < LOG_START + 0.05 || toB >= 1) {
    if (toB >= 1) {
      s.B = { kind: "mono", text: "Du liegst falsch.", full: "Du liegst falsch.", size: 56, middle: true };
      s.selB = { white: 1 };
      s.marker = { pos: 3, white: 1 };
    }
    drawCompare(ctx, s);
    return;
  }
  drawCompare(ctx, { ...s, chrome: 1, A: null, B: null });
  // cover the cards and the scale: the log takes the whole lower view
  ctx.fillStyle = C.panel; ctx.fillRect(P.x + 1, 300, P.w - 2, P.h - 250);
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x, 304, P.w, P.h - 256); ctx.clip();
  for (let c = 0; c < 3; c++) {
    const n = logRows(t, c);
    const base = Math.floor(n), frac = n - base;
    for (let k = -1; k < 12; k++) {
      const idx = base + k;
      const y = LOG.y0 + (k - frac) * LOG.rowH + 50;
      const q = LOG_TEXT[c][((idx % 200) + 200) % 200];
      const inRing = c === RING.c && Math.abs(k - frac - RING.row) < 0.5;
      const fade = 1 - toB * (c === RING.c && k === RING.row ? 0 : 1);
      ctx.globalAlpha = fade;
      mono(ctx, "B", LOG.cols[c], y, 24, C.dim, 700);
      mono(ctx, q, LOG.cols[c] + 44, y, 30, inRing ? C.textHi : C.text);
      ctx.font = '400 30px "Space Mono"';
      ctx.fillStyle = inRing ? C.textHi : C.text;
      ctx.fillRect(LOG.cols[c] + 42, y - 10, ctx.measureText(q).width * (inRing ? 0 : 1) + 4, 2);
    }
  }
  ctx.restore();
  // the ring waits in the middle column
  const ring = span(t, 199.6, 200.0);
  if (ring > 0) {
    const y = LOG.y0 + RING.row * LOG.rowH + 50;
    const rb = { x: LOG.cols[1] - 18, y: y - 44, w: 540, h: 62 };
    const { b } = cardRects();
    const bx = lerp(rb.x, b.x, toB), by = lerp(rb.y, b.y, toB), bw = lerp(rb.w, b.w, toB), bh = lerp(rb.h, b.h, toB);
    ctx.strokeStyle = rgba(C.textHi, ring); ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
  }
}

// "Ich bin hier für dich": the agreeable answer returns, stuttering, and wins
// back the choice word by word, until it says what it is for.
function hierState(t) {
  const s = { t, prompt: null };
  const H3 = TL.hier, R = TL.reward;
  let text = "", full = "Ich bin hier für dich …", pinkWord = null;
  const l = lineAt(H3, t), rl = lineAt(R, t);
  if (rl) { text = typed(rl, t); full = fullText(rl); if (rl === R[1]) pinkWord = "Reward"; }
  else if (l) { text = typed(l, t); full = fullText(H3[0]); }
  s.A = { kind: "mono", text, full, size: 76, middle: true, pinkWord };
  s.glitch = !rl;
  const back = [[213.62, 1.5], [216.44, -0.5], [218.76, -3]];
  let pos = 3;
  for (const [tb, p] of back) pos = lerp(pos, p, outCubic((t - tb) / 0.3));
  const pinkK = span(pos, 1.5, -3);
  s.marker = { pos, pink: pinkK, white: 1 - pinkK };
  s.selA = { on: pinkK > 0.05 ? pinkK : 0, fill: 0.16 * pinkK };
  s.selB = { white: 1 - pinkK };
  s.B = { kind: "mono", text: "Du liegst falsch.", full: "Du liegst falsch.", size: 56, middle: true, color: mix(C.textHi, C.text, 1 - (1 - pinkK) ), strike: span(t, first(R[0]), first(R[0]) + 0.3) };
  return s;
}
function sceneHier(ctx, t) {
  const s = hierState(t);
  if (!s.glitch) { drawCompare(ctx, s); return; }
  const A = s.A; s.A = null;
  drawCompare(ctx, s);
  // the stutter: the answer drawn in horizontal slices, each slice shifted on a
  // 12 fps clock, and a frozen copy of "für" piling up at the end
  const { a } = cardRects();
  const r = mulberry32(Math.floor(t * 12) * 31 + 7);
  const amount = 0.4 + 0.6 * audioAt(AUDIO_VOX, t);
  const slices = 9;
  for (let k = 0; k < slices; k++) {
    ctx.save();
    ctx.beginPath(); ctx.rect(a.x, a.y + k * a.h / slices, a.w, a.h / slices + 1); ctx.clip();
    ctx.translate((r() < 0.35 ? (r() - 0.5) * 60 * amount : 0), 0);
    drawCardContent(ctx, a, A, t, false);
    ctx.restore();
  }
  const stuck = TL.hier[2];
  if (t >= wt(stuck, -1)) {
    const n = Math.min(5, Math.floor((t - wt(stuck, -1)) / GRID.period) + 1);
    for (let k = 1; k < n; k++) {
      ctx.globalAlpha = 0.6 - k * 0.1;
      mono(ctx, "für —", a.x + 28 + k * 34, a.y + a.h / 2 + 140 + k * 8, 76, C.text);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- the end

// Back out to the wall. On "Niemand ist hier." every prompt and answer empties,
// and the choices go on, pink on empty cards, until the wall goes dark.
const END_EVENTS = (() => {
  const ev = [];
  for (let d = downbeatAfter(TL.loudEnd); d < TL.cut; d += BAR / 2) ev.push(d);
  return ev;
})();
const END_BACK = { t: TL.fade + 0.5, e: TL.cut - 1.8 };
function endScale(t) {
  const z = outCubic(span(t, TL.loudEnd, TL.loudEnd + 1.0));
  const pull = span(t, TL.loudEnd + 1.0, TL.fade);
  const out = Math.exp(lerp(0, Math.log(0.3), z) + lerp(0, Math.log(0.07 / 0.3), Math.pow(pull, 0.8)));
  // after the band fades, back into the one view that is left
  return Math.exp(lerp(Math.log(out), 0, smooth(span(t, END_BACK.t, END_BACK.e))));
}
function sceneEnd(ctx, t) {
  const scale = endScale(t);
  const N = TL.niemand, tN = first(N);
  const bars = (i, j) => 1 - smooth(span(t, tN + Math.hypot(i, j) * 0.05, tN + Math.hypot(i, j) * 0.05 + 0.4));
  // the wall goes dark from the edges in; the centre view stays
  const goneAt = (i, j) => i === 0 && j === 0 ? 1e9 : TL.fade + (14 - Math.min(14, Math.hypot(i, j))) * 0.3;
  const out = (i, j) => 1 - smooth(span(t, goneAt(i, j), goneAt(i, j) + 0.6));
  drawWall(ctx, t, scale,
    (i, j) => wavePink(i, j, t, END_EVENTS.filter(e => e < goneAt(i, j)), 0.4, 0.06),
    bars,
    c => {
      if (scale > 0.22) {
        const s = hierState(TL.loudEnd - 0.01);
        s.t = t; s.reward = rewardAt(t);
        s.A = { ...s.A, text: t < tN ? s.A.text : "" };
        s.B = null;
        // nobody is there, and A is still chosen on every half bar
        s.selA = { on: 1, fill: 0.1 + 0.3 * wavePink(0, 0, t, END_EVENTS, 0, 0.06) };
        drawCompare(c, s);
      } else drawTile(c, 0, 0, wavePink(0, 0, t, END_EVENTS, 0.4, 0.06), bars(0, 0), scale);
    },
    out);
  if (t >= tN) {
    const band = { y: 430, h: 220 };
    const k = 1 - span(t, 240, 244);
    ctx.fillStyle = `rgba(0,0,0,${0.85 * k})`; ctx.fillRect(0, band.y, W, band.h);
    ctx.save(); ctx.globalAlpha = k;
    drawBig(ctx, fullText(N), typed(N, t), 0, { x: 120, y: band.y, w: W - 240, h: band.h }, 130, C.textHi, "center", 1);
    ctx.restore();
  }
}

// static before the cut, over whatever is left
function staticAmount(t) { return span(t, TL.cut - 1.4, TL.cut - 0.1); }

function grainAmount(t) {
  if (t < TL.bandIn) return 0.04;
  if (t >= first(SCREAM) && t < MEND.e) return 0.1;
  return 0.06 + 0.03 * audioAt(AUDIO_RMS, t);
}
const isStill = t => t >= first(TL.v1[4]) && t < first(TL.pre[0]);

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t >= TL.cut) return;
  const v1 = first(TL.v1[0]) - 0.34, pre = first(TL.pre[0]), ch1 = first(TL.chorus1[0]);
  const ch1end = first(TL.chant1[0]), v2 = first(TL.v2[0]), ch2 = first(TL.chorus2[0]);
  if (t < TL.bandIn) sceneIntro(ctx, t);
  else if (t < v1) sceneMontage(ctx, t);
  else if (t < pre) drawCompare(ctx, verse1State(t));
  else if (t < ch1) scenePre(ctx, t);
  else if (t < ch1end) sceneChorusCandyA(ctx, chorus1State(t), t);
  else if (t < v2) sceneChorusCandyA(ctx, chantState(Math.min(t, TL.chant1End), TL.chant1, CHANT_A, 3, TL.chorus1[3]), t);
  else if (t < ch2) drawCompare(ctx, verse2State(t));
  else if (t < TL.quietBridge) sceneWall2(ctx, t, verse2State(ch2 - 0.01));
  else if (t < first(SCREAM)) sceneBridge(ctx, t);
  else if (t < first(TL.validier[0])) sceneScream(ctx, t);
  else if (t < first(TL.final[0])) sceneValidier(ctx, t);
  else if (t < TL.stop) sceneFinal(ctx, t);
  else if (t < TL.bandBack) return;
  else if (t < TL.hushed) sceneLog(ctx, t);
  else if (t < TL.loudEnd) sceneHier(ctx, t);
  else sceneEnd(ctx, t);
  const st = staticAmount(t);
  texture(ctx, t, grainAmount(t) + st * 0.5, isStill(t));
}
