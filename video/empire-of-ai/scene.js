// Empire of AI. The whole video is drawScene(ctx, t), a pure function of time in
// seconds: no state survives between frames. Lyric times come from timeline.js.
//
// The stage is a livestream nobody watches (LIVE, 0 zuschauer). The image is an
// org chart. The singer's machine grows as a tree under the box "ich"; every
// chorus pulls back until that tree is one leaf of the empire, which is the same
// tree at another scale. Red means live and nothing else.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", fill: "#0e0e11", fillHi: "#1d1d22", box: "#9a9aa4", line: "#74747e",
  wire: "#3c3c44", text: "#eeeef2", mid: "#a8a8b2", dim: "#55555e", red: "#ff4332",
};

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function hash(d, g, salt = 0) {
  let h = Math.imul(g | 0, 0x9E3779B1) ^ Math.imul(d + 31 + salt * 131, 0x85EBCA77);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const outCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));
const within = (t, a, b) => t >= a && t < b;
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;
const beatPhase = t => ((t - TL.beat0) / TL.beat % 1 + 1) % 1;
const lastOnset = (t, after = -1) => {
  let o = -1;
  for (const x of AUDIO_ONSETS) { if (x > t) break; if (x > after) o = x; }
  return o;
};
function typed(text, a, b, t) {
  if (b <= a) return t >= a ? text : "";
  return text.slice(0, Math.round(text.length * span(t, a, b)));
}

// ---------------------------------------------------------------- the tree

// Every node has span s = 3^-depth and three children; its box sits at the top
// of its span, its children one gap lower. Gaps shrink by R per level, slower
// than spans, so the empire reads as a pyramid of rows and not as a comb; the
// camera scales x and y separately to keep the shapes alike at every depth. The
// empire and the singer's own machine are drawn by the same code.
// Depth 0 is the empire; K levels above it are the unnamed ones ("Götter").
const K = 6, BW = 0.6, BHF = 0.42, R = 0.55, MAXD = 14;
const P3 = d => Math.pow(3, d);
const spanAt = d => P3(-d);
const gapAt = d => Math.pow(R, d);
const X0 = -(P3(K) - 1) / 2;
const nodeX = (d, g) => X0 + g * spanAt(d);
const YD = (() => {
  const y = {}; y[0] = 0;
  for (let d = 0; d < MAXD + 2; d++) y[d + 1] = y[d] + gapAt(d);
  for (let d = -1; d >= -K; d--) y[d] = y[d + 1] - gapAt(d);
  return y;
})();
const anc = (d, g, c) => Math.floor(g / P3(d - c));
const G_E = (P3(K) - 1) / 2;
// his place: under the middle name, then a zigzag, so the zoom drifts a little
const PATH = [1, 0, 2, 1, 2];
const D_H = PATH.length;
const G_H = PATH.reduce((g, i) => g * 3 + i, G_E);
const inE = (d, g) => d >= 0 && anc(d, g, 0) === G_E;
const inH = (d, g) => d >= D_H && anc(d, g, D_H) === G_H;
const isAncOfH = (d, g) => d < D_H && anc(D_H, G_H, d) === g;
const relIndex = (d, g) => g - G_H * P3(d - D_H);

const NAMES = ["Google", "Anthropic", "OpenAI"];
const ROLES = ["lektorat", "übersetzung", "recherche", "archiv", "lehre", "satz", "grafik", "redaktion",
  "review", "edition", "transkription", "korrektorat", "doku", "support", "layout", "statistik"];
const KIDS = ["paper", "forschung", "scheiß"];

function frame(d, g, spanPx, topPx, gapPx) {
  const kx = spanPx / spanAt(d), ky = gapPx / gapAt(d);
  return { cx: nodeX(d, g) + spanAt(d) / 2, cy: YD[d] + (H / 2 - topPx) / ky, kx, ky };
}
const FH = frame(D_H, G_H, 1600, 130, 310);
const F4 = frame(4, anc(D_H, G_H, 4), 1700, 130, 300);
const F3 = frame(3, anc(D_H, G_H, 3), 1700, 130, 300);
const FE = frame(0, G_E, 1700, 130, 300);
const FE2 = frame(-2, anc(0, G_E, -2), 1700, 130, 300);
const FHW = { ...FH, kx: FH.kx * 0.72, ky: FH.ky * 0.72 };
// the held chorus framing keeps receding a little, about the top of the empire
function recede(F, f) {
  const ya = F.cy + (130 - H / 2) / F.ky;
  return { cx: F.cx, cy: ya - (130 - H / 2) / (F.ky * f), kx: F.kx * f, ky: F.ky * f };
}
const FE1 = recede(FE, 0.88), FE2a = recede(FE, 0.94), FE2b = recede(FE, 0.93);
const H_CX = nodeX(D_H, G_H) + spanAt(D_H) / 2, H_CY = YD[D_H] + BHF * gapAt(D_H) / 2;

// Zoom about the one world point that has the same screen position in both
// framings, in log scale, so a pull-back reads as a pure zoom, not a pan.
function zoomAxis(ca, ka, cb, kb, e) {
  const k = Math.pow(ka, 1 - e) * Math.pow(kb, e);
  if (Math.abs(ka - kb) < 1e-9 * ka) return [lerp(ca, cb, e), k];
  const p = (ca * ka - cb * kb) / (ka - kb);
  return [p - (p - ca) * ka / k, k];
}
function zoomCam(A, B, e) {
  if (A === B || e <= 0) return A;
  if (e >= 1) return B;
  const [cx, kx] = zoomAxis(A.cx, A.kx, B.cx, B.kx, e), [cy, ky] = zoomAxis(A.cy, A.ky, B.cy, B.ky, e);
  return { cx, cy, kx, ky };
}
const CAM = [
  [0, FH],
  [45.22, FH], [47.6, FE],
  [47.6, FE], [62.9, FE1, k => k],
  [62.9, FE1], [65.42, FH],
  [68.16, FH], [69.5, F4],
  [70.3, F4], [71.6, F3],
  [84.4, F3], [87.9, FH],
  [90.9, FH], [97.62, FHW, k => k],
  [97.62, FHW], [99.7, FE],
  [99.7, FE], [104.68, FE2a, k => k],
  [104.68, FE2a], [107.0, FE2],
  [109.46, FE2], [111.6, FE],
  [111.6, FE], [117.3, FE2b, k => k],
  [117.3, FE2b], [118.82, FH, inCubic],
  [169.22, FH], [171.4, FE],
];
function camAt(t) {
  if (t >= 171.4) {
    // "Immer trotzdem": the empire turns out to be a leaf as well, level after level
    const p = span(t, 188.78, 196.5);
    const z = 0.12 * span(t, 171.4, 188.78) + 3.88 * (0.55 * (1 - Math.pow(1 - p, 2)) + 0.45 * smooth(p));
    // horizontally about his leaf; vertically the frame keeps a top row at the
    // top of the stage, so the named empire sinks into the rows below
    const kx = FE.kx * Math.pow(3, -z), ky = FE.ky * Math.pow(R, z);
    const n = Math.floor(z), f = z - n;
    const top = lerp(YD[-n], YD[-n - 1], f);
    return { cx: H_CX - (H_CX - FE.cx) * FE.kx / kx, cy: top + (H / 2 - 130) / ky, kx, ky };
  }
  for (let i = CAM.length - 1; i >= 0; i--) {
    if (t < CAM[i][0]) continue;
    const next = CAM[i + 1];
    if (!next || next[0] === CAM[i][0]) return CAM[i][1];
    const ease = next[2] || smooth;
    return zoomCam(CAM[i][1], next[1], ease(span(t, CAM[i][0], next[0])));
  }
  return FH;
}

// When each node of his own tree comes into being (verse 1). Nodes outside it
// always exist, but stay hidden until the first chorus reveals them.
function appearAt(d, g) {
  if (!inH(d, g)) return 0;
  const r = d - D_H, j = relIndex(d, g);
  if (r === 0) return TL.verse1;
  if (r === 1) return 15.24 + j * 0.12;
  if (r === 2) return 22.62 + j * 0.27;
  if (r === 3) return 35.22 + j * (1.0 / 27);
  if (r === 4) return 36.2 + j * (0.85 / 81);
  return 37.1;
}
const grow = (d, g, t) => d === D_H && inH(d, g) ? 1 : outCubic(span(t, appearAt(d, g), appearAt(d, g) + 0.16));

function hopsFromH(d, g) {
  let c = Math.min(d, D_H);
  while (anc(d, g, c) !== anc(D_H, G_H, c)) c--;
  return (d - c) + (D_H - c);
}
const PUSH = 180.7;
function isLive(d, g, t, ghost) {
  if (ghost) return false;
  if (t >= PUSH) return t >= PUSH + hopsFromH(d, g) * 0.11;
  const self = d === D_H && g === G_H;
  return self && (within(t, 39.88, 159.02) || t >= 179.14);
}

const dashedH = t => within(t, 90.3, TL.verse3);

function labelOf(d, g, t) {
  if (d === 0 && g === G_E) return t >= 45.24 ? typed("Empire of AI", 45.24, 46.9, t) : null;
  if (d === 1 && anc(1, g, 0) === G_E) {
    const i = g - G_E * 3, p = TL.lines[12].parts[i];
    return t >= p.a ? typed(NAMES[i], p.a, p.b, t) : null;
  }
  if (d === D_H && g === G_H) {
    if (t < 14.32) return null;
    if (t < 159.02) return typed("ich", 14.32, 14.5, t);
    if (t < 160.04) return typed("agent", 159.02, 159.3, t);
    return typed("agent.yaml", 160.04, 160.6, t) || "agent";
  }
  if (inH(d, g) && d === D_H + 1) {
    const j = relIndex(d, g), at = [20.28, 20.96, 21.78][j];
    if (t < at) return null;
    if (t >= 160.04) return KIDS[j] + typed(".yaml", 160.2 + j * 0.15, 160.5 + j * 0.15, t);
    return typed(KIDS[j], at, at + 0.25, t);
  }
  if (d === D_H && inE(d, g)) {
    // the people around him; "Ich ersetz' euch alle" rewrites them outward from him
    const r = 69.6 + Math.abs(g - G_H) * 0.13;
    if (t < r) return ROLES[Math.floor(hash(d, g, 3) * ROLES.length)];
    if (t < r + 0.3) return "̶" + ROLES[Math.floor(hash(d, g, 3) * ROLES.length)];
    return typed("agent", r + 0.3, r + 0.5, t) || " ";
  }
  return null;
}

const talkAmount = t => Math.max(0, ...TL.talk.map(([a, b]) => smooth(span(t, a, a + 0.3)) * (1 - smooth(span(t, b - 0.2, b)))));

// Packets of work run down his tree on the drum hits (multi-agent flow).
function packetPath(o) {
  const out = [];
  let g = G_H;
  for (let r = 1; r <= 4; r++) { g = g * 3 + Math.floor(hash(r, Math.round(o * 1000), 5) * 3); out.push(g); }
  return out;
}
const flowing = t => within(t, 65.42, 68.2) || within(t, TL.verse3, TL.final + 1) || within(t, 37.1, 38.8);

function drawTree(ctx, t, cam, o = {}) {
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0) return;
  const others = o.others === undefined ? 1 : o.others;
  const reveal = t >= TL.chorus1 || o.reveal;
  const margin = o.rot ? 700 : 60;
  const sc = (x, y) => [(x - cam.cx) * cam.kx + W / 2, (y - cam.cy) * cam.ky + H / 2];
  const linesN = [], linesO = [], linesR = [];
  const boxes = [];
  const talk = talkAmount(t);
  const rollout = TL.rollout.find(r => within(t, r, r + 1.6));

  const rec = (d, g) => {
    const s = spanAt(d), sw = s * cam.kx, gs = gapAt(d) * cam.ky;
    if (sw < 1.4) return;
    const [sx, sy] = sc(nodeX(d, g), YD[d]);
    const sh = gs / (1 - R);
    if (sx > W + margin || sx + sw < -margin || sy > H + margin || sy + sh < -margin) return;
    const mine = inH(d, g), above = isAncOfH(d, g);
    if (!reveal && !mine && !above) return;
    const a = mine ? grow(d, g, t) : 1;
    if (a <= 0) return;
    if (!above || reveal) boxes.push({ d, g, sx, sy, sw, gs, a, mine });

    // connectors to the children that exist
    const cs = sw / 3;
    if (d < MAXD && cs >= 1.4) {
      const kids = [];
      for (let i = 0; i < 3; i++) {
        const cg = g * 3 + i;
        const visible = reveal || inH(d + 1, cg) || isAncOfH(d + 1, cg);
        if (visible && (!inH(d + 1, cg) || grow(d + 1, cg, t) > 0)) kids.push(i);
      }
      const bh = Math.max(1, BHF * gs), cx = sx + sw / 2, top = sy + gs;
      const ybar = (sy + bh + top) / 2;
      const live = isLive(d, g, t, o.ghost);
      if (kids.length && (reveal || mine)) {
        const L = mine ? linesN : linesO;
        const target = live ? linesR : L;
        target.push(cx, sy + bh, cx, ybar);
        const x1 = sx + (kids[0] + 0.5) * cs, x2 = sx + (kids[kids.length - 1] + 0.5) * cs;
        target.push(Math.min(x1, cx), ybar, Math.max(x2, cx), ybar);
        for (const i of kids) {
          const cl = isLive(d + 1, g * 3 + i, t, o.ghost) && live;
          (cl ? linesR : L).push(sx + (i + 0.5) * cs, ybar, sx + (i + 0.5) * cs, top);
        }
      } else if (!reveal && above && d === D_H - 1) {
        // "Doch die Empire of AI": a line rises from his box into the dark above
        const p = outCubic(span(t, 29.06, 29.9));
        if (p > 0) linesN.push(sx + (PATH[D_H - 1] + 0.5) * cs, top, sx + (PATH[D_H - 1] + 0.5) * cs, lerp(top, ybar - 400, p));
      }
      for (const i of kids) rec(d + 1, g * 3 + i);
    }
  };

  ctx.save();
  ctx.globalAlpha = alpha;
  if (o.rot) {
    // while it turns over, the tree stays inside the stage and off the lyric slot
    ctx.beginPath(); ctx.rect(0, 100, W, 740); ctx.clip();
    ctx.translate(W / 2, 460); ctx.rotate(o.rot); ctx.translate(-W / 2, -460);
  }
  if (o.shake) ctx.translate(o.shake[0], o.shake[1]);
  rec(-K, 0);

  const stroke = (arr, col, lw, a) => {
    if (!arr.length) return;
    ctx.globalAlpha = alpha * a;
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
    ctx.stroke();
  };
  const pulse = o.ghost ? 0 : beatPulse(t);
  const grey = o.ghost ? C.dim : mix(C.line, C.text, pulse * 0.6);
  stroke(linesO, grey, 1.2, others);
  stroke(linesN, grey, 1.4, 1);
  stroke(linesR, mix(C.red, "#ff9a90", pulse * 0.5), 1.4 + pulse, 1);

  if (o.links) o.links(ctx, sc, alpha);

  for (const b of boxes) drawBox(ctx, t, b, { alpha: alpha * (b.mine || b.d < D_H ? 1 : others), talk, rollout, ghost: o.ghost, cam, pulse });
  if (o.packets && flowing(t)) drawPackets(ctx, t, sc, alpha);
  ctx.restore();
}

// Quarter-note pulse in the loud sections; 2.5 Hz of thin lines, no large flashes.
const LOUD = [[TL.chorus1, 62.6, 0.6], [TL.chorus2, 117.3, 0.7], [TL.verse3, TL.final, 0.9], [TL.final, TL.outro, 0.8]];
function beatPulse(t) {
  const l = LOUD.find(([a, b]) => within(t, a, b));
  return l ? l[2] * Math.exp(-beatPhase(t) * TL.beat / 0.12) : 0;
}

function drawBox(ctx, t, b, o) {
  const { d, g, sx, sy, sw, gs } = b;
  const bw = BW * sw, bh = Math.max(1, BHF * gs * b.a);
  const bx = sx + (sw - bw) / 2, by = sy;
  const self = d === D_H && g === G_H;
  const live = isLive(d, g, t, o.ghost);
  let wave = (o.pulse || 0) * 0.55;
  if (o.rollout !== undefined) wave += Math.exp(-Math.pow((by - lerp(100, 820, span(t, o.rollout, o.rollout + 1.3))) / 50, 2));
  ctx.globalAlpha = o.alpha;
  if (bw < 3) {
    ctx.fillStyle = live ? C.red : o.ghost ? C.dim : mix(C.box, C.text, wave);
    ctx.fillRect(bx, by, Math.max(1, bw), Math.max(1, bh));
    if (self && !o.ghost && t >= TL.chorus1) { ctx.fillStyle = live ? C.red : C.text; ctx.fillRect(bx + bw / 2 - 2, by - 1, 4, 4); }
    return;
  }
  ctx.fillStyle = mix(C.fill, C.fillHi, wave);
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = live ? C.red : o.ghost ? C.dim : mix(C.box, C.text, wave);
  ctx.lineWidth = bw > 600 ? 2 : bw > 120 ? 1.5 : 1;
  if (self && dashedH(t)) ctx.setLineDash([10, 8]);
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  ctx.setLineDash([]);
  if (bh < 5 || b.a < 1) return;

  const label = labelOf(d, g, t);
  const pad = Math.max(3, bh * 0.28);
  let x = bx + pad;
  if (label) {
    const struck = label[0] === "̶", text = struck ? label.slice(1) : label;
    const fs = Math.min(bh * 0.46, (bw - 2 * pad) / (Math.max(text.length, 4) * 0.62));
    if (fs >= 7) {
      ctx.font = `400 ${fs}px "Space Mono"`;
      ctx.fillStyle = o.ghost ? C.dim : C.text;
      ctx.fillText(text, x, by + bh * 0.5 + fs * 0.36);
      const tw = ctx.measureText(text).width;
      if (struck) ctx.fillRect(x - 2, by + bh * 0.5, tw + 4, Math.max(1, fs * 0.08));
      x += tw + fs * 0.6;
    }
  } else if (bw > 10 && !(self && t < 14.32)) {
    // unreadable content: placeholder lines for the empire, code for his machine
    const code = inH(d, g) && t >= 22.56;
    const n = code ? 2 : 1, step = code ? Math.floor((t - 22.56) / TL.beat) : 0;
    ctx.fillStyle = o.ghost ? "#26262c" : code ? "#5c5c66" : C.wire;
    for (let i = 0; i < n; i++) {
      const len = code ? 0.25 + 0.6 * hash(d, g, 11 + i + step * 2) : 0.3 + 0.35 * hash(d, g, 7);
      const lh = Math.max(1, bh * 0.1);
      ctx.fillRect(bx + pad, by + bh * (n === 1 ? 0.45 : 0.32 + i * 0.3), (bw - 2 * pad) * len, lh);
    }
  }
  if (o.talk > 0 && !self && !o.ghost) drawDots(ctx, t, d, g, bx, by, bw, bh, x, o.talk, live);
  if (self) drawSelf(ctx, t, bx, by, bw, bh, x);
}

// "Viele reden, niemand sagt was": every box shows that someone is typing.
function drawDots(ctx, t, d, g, bx, by, bw, bh, x, amount, live) {
  const ph = hash(d, g, 21);
  ctx.fillStyle = live ? C.red : C.text;
  if (bw < 24) {
    ctx.globalAlpha *= amount * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin((t * 2.2 + ph) * Math.PI * 2)));
    ctx.fillRect(bx + bw / 2 - 1, by + bh / 2 - 1, 2, 2);
    return;
  }
  const r = Math.max(1, Math.min(bh * 0.09, 6)), gap = r * 3.2;
  const x0 = Math.max(x, bx + bw - 3 * gap - bh * 0.25);
  const base = ctx.globalAlpha;
  for (let i = 0; i < 3; i++) {
    const k = 0.5 + 0.5 * Math.sin((t * 2.2 + ph - i * 0.18) * Math.PI * 2);
    ctx.globalAlpha = base * amount * (0.25 + 0.75 * k);
    ctx.beginPath(); ctx.arc(x0 + i * gap + r, by + bh * 0.5, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = base;
}

// His own box carries the weekend's diff, later the status, later the five years.
function drawSelf(ctx, t, bx, by, bw, bh, afterLabel) {
  if (bw < 60) return;
  const fs = bh * 0.3, right = bx + bw - bh * 0.28, base = by + bh * 0.5 + bh * 0.46 * 0.36;
  ctx.textAlign = "right";
  if (t >= 16.08 && t < 159.02) {
    // counts the weekend up, slowly and then all at once, landing on "zack"
    const n = Math.round(90000 * Math.pow(span(t, 16.08, 18.58), 3));
    const zack = 1 + 0.25 * Math.exp(-Math.max(0, t - 18.58) / 0.12) * (t >= 18.58 ? 1 : 0);
    ctx.font = `700 ${fs * zack}px "Space Mono"`; ctx.fillStyle = C.text;
    ctx.fillText("+" + n.toLocaleString("de-DE"), right, base);
  }
  if (within(t, 90.3, 159.02)) {
    ctx.font = `400 ${fs * 0.75}px "Space Mono"`; ctx.fillStyle = C.mid;
    ctx.textAlign = "left";
    ctx.fillText(typed("deprecated", 90.3, 90.7, t), afterLabel, base);
  }
  if (within(t, 163.04, TL.final + 1.5)) {
    // five years of work, then thirty seconds of it
    const k = smooth(span(t, 164.64, 165.4));
    const full = bw * 0.5, w = Math.max(2, lerp(full, 1, k));
    ctx.fillStyle = C.text;
    ctx.globalAlpha *= smooth(span(t, 163.04, 163.3));
    ctx.fillRect(right - w, by + bh * 0.42, w, bh * 0.16);
    ctx.font = `400 ${fs}px "Space Mono"`; ctx.fillStyle = C.mid;
    ctx.fillText(k < 0.5 ? typed("fünf jahre", 163.04, 163.9, t) : typed("0:30", 165.32, 165.5, t), right, by + bh * 0.33);
  }
  ctx.textAlign = "left";
}

function drawPackets(ctx, t, sc, alpha) {
  ctx.fillStyle = C.text;
  for (const o of AUDIO_ONSETS) {
    if (o > t) break;
    if (o < t - 1.2 || !flowing(o)) continue;
    const pos = (t - o) / 0.2;
    const path = packetPath(o), r = Math.floor(pos);
    if (r >= path.length) continue;
    const f = pos - r;
    const pg = r === 0 ? G_H : path[r - 1], pd = D_H + r, cg = path[r];
    const s = spanAt(pd), [px, py] = sc(nodeX(pd, pg), YD[pd]);
    const sw = s * cc(sc), gs = gapAt(pd) * (sc(0, 1)[1] - sc(0, 0)[1]);
    const bh = BHF * gs, cx = px + sw / 2, top = py + gs, ybar = (py + bh + top) / 2;
    const kx = px + ((cg - pg * 3) + 0.5) * sw / 3;
    const pts = [[cx, py + bh], [cx, ybar], [kx, ybar], [kx, top]];
    let len = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); len += l; }
    let at = f * len, i = 0;
    while (i < seg.length - 1 && at > seg[i]) { at -= seg[i]; i++; }
    const q = seg[i] ? at / seg[i] : 0;
    const x = lerp(pts[i][0], pts[i + 1][0], q), y = lerp(pts[i][1], pts[i + 1][1], q);
    const sz = clamp(sw * 0.01, 2, 9);
    ctx.globalAlpha = alpha * (1 - f * 0.3);
    ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = alpha;
}
// screen scale of a projection, recovered from two points
const cc = sc => sc(1, 0)[0] - sc(0, 0)[0];

// "alles vernetzt": cross links between the boxes of his tree
const LINKS = (() => {
  const r = mulberry32(77), out = [];
  for (let i = 0; i < 46; i++) {
    const pick = () => { const rd = 1 + Math.floor(r() * 3); return [D_H + rd, G_H * P3(rd) + Math.floor(r() * P3(rd))]; };
    out.push([pick(), pick(), i]);
  }
  return out;
})();
function drawLinks(t) {
  return (ctx, sc, alpha) => {
    if (t < 161.44) return;
    ctx.strokeStyle = C.text; ctx.lineWidth = 1.2;
    for (const [[d1, g1], [d2, g2], i] of LINKS) {
      const p = outCubic(span(t, 161.44 + i * 0.019, 161.44 + i * 0.019 + 0.25));
      if (p <= 0) continue;
      const c = (d, g) => { const [x, y] = sc(nodeX(d, g) + spanAt(d) / 2, YD[d] + BHF * gapAt(d) / 2); return [x, y]; };
      const [x1, y1] = c(d1, g1), [x2, y2] = c(d2, g2);
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  };
}

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;
const monoFont = (size, weight = 400) => `${weight} ${size}px "Space Mono"`;
const MONO_RATIO = 0.66;  // Space Mono beside Redaction: matched by eye to the cap height
const SLOT = { x: 96, y: 968, w: W - 192 };

function partFont(p, grade, size) { return p.who === "them" ? monoFont(size * MONO_RATIO) : gradeFont(grade, size); }

// size at which the complete line fits, so a line being typed never changes size
function lineSize(ctx, line, size, maxW) {
  let w = 0;
  for (const p of line.parts) { ctx.font = partFont(p, line.grade, size); w += ctx.measureText(p.q).width; }
  return Math.min(size, size * maxW / w);
}

function drawLine(ctx, line, t, x, y, size, color, align = "left") {
  const s = lineSize(ctx, line, size, SLOT.w);
  let total = 0;
  for (const p of line.parts) { ctx.font = partFont(p, line.grade, s); total += ctx.measureText(p.q).width; }
  let cx = align === "center" ? x - total / 2 : x;
  for (const p of line.parts) {
    ctx.font = partFont(p, line.grade, s);
    const shown = typed(p.q, p.a, p.b, t);
    ctx.fillStyle = p.who === "them" ? C.mid : color;
    ctx.fillText(shown, cx, y);
    cx += ctx.measureText(p.q).width;
  }
}

const LINES = TL.lines;
const lineStart = l => l.parts[0].a;
const lineEnd = l => l.parts[l.parts.length - 1].b;
function slotLine(t) {
  let cur = null, i = -1;
  LINES.forEach((l, j) => { if (!l.still && t >= lineStart(l)) { cur = l; i = j; } });
  if (!cur) return null;
  const next = LINES.slice(i + 1).find(l => !l.still);
  const until = Math.min(next ? lineStart(next) : Infinity, lineEnd(cur) + 2.4);
  return t < until ? cur : null;
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
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- stream chrome

// The stream has been running for hours; nobody has joined.
function drawHUD(ctx, t, frozen) {
  const y = 70;
  const pulse = frozen ? 1 : 0.75 + 0.25 * Math.cos(t * Math.PI);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(74, y - 8, 8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = monoFont(22, 700); ctx.fillStyle = C.text;
  ctx.fillText("LIVE", 92, y);
  // the bracketed answers light up the zero
  const answer = LINES.some(l => l.parts.some(p => p.who === "them" && p.q.startsWith(" (") && within(t, p.a, p.b + 0.9)));
  ctx.font = monoFont(22);
  const zx = 168;
  if (answer) { ctx.fillStyle = C.text; ctx.fillRect(zx - 5, y - 21, 23, 28); ctx.fillStyle = C.void; }
  else ctx.fillStyle = C.mid;
  ctx.fillText("0", zx, y);
  ctx.fillStyle = C.mid;
  ctx.fillText("zuschauer", zx + 26, y);
  const s = Math.floor(4 * 3600 + 11 * 60 + 38 + t);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0"), mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  ctx.textAlign = "right";
  ctx.fillText(`${hh}:${mm}:${String(s % 60).padStart(2, "0")}`, W - 64, y);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- intro

// The context window as 200,000 cells, read like a page of micro text.
const FIELD = { cols: 800, rows: 250, x: 160, y: 236, px: 2 };
const FIELD_DATA = (() => {
  const n = FIELD.cols * FIELD.rows, order = new Float32Array(n), ink = new Uint8Array(n);
  const r = mulberry32(2025);
  for (let row = 0; row < FIELD.rows; row++) {
    const line = Math.floor(row / 5), inLine = row % 5;
    const rr = mulberry32(line * 97 + 3);
    let col = 0;
    const end = FIELD.cols - Math.floor(rr() * 120);
    while (col < FIELD.cols) {
      const word = 2 + Math.floor(rr() * 9), gap = 1 + Math.floor(rr() * 2);
      for (let c = col; c < Math.min(col + word, FIELD.cols); c++) {
        const i = row * FIELD.cols + c;
        ink[i] = inLine < 4 && c < end ? 120 + Math.floor(r() * 110) : 0;
      }
      col += word + gap;
    }
    for (let c = 0; c < FIELD.cols; c++) {
      const i = row * FIELD.cols + c;
      order[i] = (line * FIELD.cols + c) / (FIELD.rows / 5 * FIELD.cols) * 0.9 + r() * 0.1;
    }
  }
  return { order, ink };
})();
const FIELD_CANVAS = typeof document === "undefined" ? null : (() => {
  const c = document.createElement("canvas"); c.width = FIELD.cols; c.height = FIELD.rows; return c;
})();
const fieldFill = t => inCubic(span(t, 9.6, 12.6)) * 0.7 + 0.3 * smooth(span(t, 9.6, 12.6));

function paintField(t) {
  const g = FIELD_CANVAS.getContext("2d"), img = g.createImageData(FIELD.cols, FIELD.rows);
  const f = fieldFill(t), { order, ink } = FIELD_DATA;
  for (let i = 0, p = 0; i < order.length; i++, p += 4) {
    let v = 13;
    if (order[i] < f) v = ink[i] ? ink[i] : 38;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // the intro's hits write bursts of tokens into the empty window, which fade
  if (t < 10.4) {
    for (const on of AUDIO_ONSETS) {
      if (on > t) break;
      const age = t - on;
      if (age > 0.5) continue;
      const rr = mulberry32(Math.round(on * 1000) + 7);
      g.fillStyle = `rgba(235,235,240,${0.85 * (1 - age / 0.5) * (1 - span(t, 9.6, 10.4))})`;
      const n = 18 + Math.floor(audioAt(AUDIO_FLUX, on) * 60);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(rr() * 50) * 5, col = Math.floor(rr() * 780);
        g.fillRect(col, row, 2 + Math.floor(rr() * 10), 4);
      }
    }
  }
}

function selfRect(cam) {
  const s = spanAt(D_H) * cam.kx;
  const x = (nodeX(D_H, G_H) - cam.cx) * cam.kx + W / 2, y = (YD[D_H] - cam.cy) * cam.ky + H / 2;
  return [x + s * (1 - BW) / 2, y, BW * s, BHF * gapAt(D_H) * cam.ky];
}

function sceneIntro(ctx, t) {
  paintField(t);
  const [hx, hy, hw, hh] = selfRect(FH);
  const e = inCubic(span(t, 12.62, TL.verse1));
  const x = lerp(FIELD.x, hx, e), y = lerp(FIELD.y, hy, e);
  const w = lerp(FIELD.cols * FIELD.px, hw, e), h = lerp(FIELD.rows * FIELD.px, hh, e);
  ctx.save();
  ctx.imageSmoothingEnabled = e > 0;
  ctx.globalAlpha = smooth(span(t, 0, 0.6));
  ctx.drawImage(FIELD_CANVAS, x, y, w, h);
  ctx.globalAlpha *= 1 - e;
  ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.strokeRect(x - 8.5, y - 8.5, w + 17, h + 17);
  ctx.restore();
  ctx.globalAlpha = 1 - e;
  ctx.font = monoFont(24); ctx.fillStyle = C.mid;
  ctx.fillText("context window", FIELD.x, FIELD.y - 22);
  ctx.textAlign = "right";
  const n = Math.round(200000 * fieldFill(t));
  ctx.fillText(`${n.toLocaleString("de-DE")} / 200.000`, FIELD.x + FIELD.cols * FIELD.px, FIELD.y - 22);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

// the context still glows inside his box for a moment after it collapsed
function fieldInSelf(ctx, t, cam) {
  const a = 1 - smooth(span(t, TL.verse1, TL.verse1 + 0.9));
  const ce = within(t, 67.08, 68.6) ? smooth(span(t, 67.08, 67.5)) * (1 - smooth(span(t, 68.2, 68.6))) : 0;
  const k = Math.max(a, ce * 0.8);
  if (k <= 0) return;
  if (ce > 0) paintField(9.6 + 3 * span(t, 67.08, 68.0));
  const [x, y, w, h] = selfRect(cam);
  ctx.save(); ctx.globalAlpha = k; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(FIELD_CANVAS, x + 2, y + 2, w - 4, h - 4);
  ctx.restore();
}

// ---------------------------------------------------------------- verse props

// R, A, G and the small models: little boxes with no hierarchy, felled on "fällen"
const SMALL = [
  { q: "R", t: 26.66, x: 96, s: 70 }, { q: "A", t: 26.94, x: 180, s: 70 }, { q: "G", t: 27.1, x: 264, s: 70 },
  { q: "7b", t: 27.5, x: 350, s: 46 }, { q: "3b", t: 27.62, x: 408, s: 34 }, { q: "1b", t: 27.76, x: 454, s: 22 },
];
function drawSmall(ctx, t) {
  if (t < 26.66 || t > 32.6) return;
  for (const [i, m] of SMALL.entries()) {
    const a = outCubic(span(t, m.t, m.t + 0.15));
    if (a <= 0) continue;
    const fall = span(t, 31.18 + i * 0.05, 32.4 + i * 0.05);
    const y = 240 - m.s / 2 + inCubic(fall) * 1000, rot = fall * (i % 2 ? 0.7 : -0.5);
    ctx.save();
    ctx.translate(m.x + m.s / 2, y + m.s / 2); ctx.rotate(rot); ctx.scale(a, a);
    ctx.fillStyle = C.fill; ctx.fillRect(-m.s / 2, -m.s / 2, m.s, m.s);
    ctx.strokeStyle = C.box; ctx.lineWidth = 1.2; ctx.strokeRect(-m.s / 2 + 0.5, -m.s / 2 + 0.5, m.s - 1, m.s - 1);
    ctx.font = monoFont(m.s * 0.42); ctx.fillStyle = C.text; ctx.textAlign = "center";
    ctx.fillText(m.q, 0, m.s * 0.15);
    ctx.textAlign = "left";
    ctx.restore();
  }
}

// "Tweet den Proof – 47 Likes": a post, a count that stops
function drawPost(ctx, t) {
  const inn = outCubic(span(t, 77.92, 78.3)), out = smooth(span(t, 84.26, 84.7));
  if (inn <= 0 || out >= 1) return;
  const x = 520, y = 190 + (1 - inn) * 40, w = 880, h = 540;
  ctx.save();
  ctx.globalAlpha = inn * (1 - out);
  ctx.fillStyle = C.fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.box; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeRect(x + 48.5, y + 46.5, 56, 56);
  ctx.font = monoFont(28, 700); ctx.fillStyle = C.text; ctx.fillText("ich", x + 128, y + 72);
  ctx.font = monoFont(22); ctx.fillStyle = C.mid; ctx.fillText("jetzt", x + 128, y + 100);
  ctx.font = monoFont(30); ctx.fillStyle = C.mid; ctx.fillText(typed("proof:", 78.4, 78.62, t), x + 48, y + 196);
  ctx.font = monoFont(132, 700); ctx.fillStyle = C.text; ctx.fillText(t >= 78.62 ? "+90.000" : "", x + 40, y + 330);
  ctx.font = monoFont(30); ctx.fillStyle = C.mid; ctx.fillText(typed("zeilen an einem wochenende", 78.62, 79.1, t), x + 48, y + 384);
  ctx.fillStyle = C.wire; ctx.fillRect(x + 48, y + 430, w - 96, 1);
  const likes = Math.round(47 * Math.pow(span(t, 79.0, 79.72), 0.6));
  ctx.font = monoFont(40); ctx.fillStyle = t >= 79.72 ? C.text : C.mid;
  ctx.fillText(`${likes} likes`, x + 48, y + 494);
  ctx.textAlign = "right"; ctx.fillStyle = C.mid;
  ctx.fillText(t >= 81.78 ? "1 antwort" : "0 antworten", x + w - 48, y + 494);
  ctx.textAlign = "left";
  ctx.restore();
}

// Neunzig K, keiner will's verstehen: a leader line from his leaf to the number
function drawCallout(ctx, t, cam) {
  const a = smooth(span(t, 52.58, 52.9)) * (1 - smooth(span(t, 56.0, 56.4)));
  if (a <= 0) return;
  const [x, y, w] = selfRect(cam);
  const cx = x + w / 2, ty = 840;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = C.mid; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, y + 6); ctx.lineTo(cx, ty - 28); ctx.lineTo(cx + 40, ty - 28); ctx.stroke();
  ctx.font = monoFont(26); ctx.fillStyle = C.text;
  ctx.fillText(typed("ich  +90.000", 52.6, 53.1, t), cx + 50, ty - 19);
  ctx.restore();
}

// "Die KI hat mich längst gefunden": a find result that keeps hold of him
function drawFound(ctx, t, cam) {
  if (t < 168.66 || t > 182.5) return;
  const [x, y, w, h] = selfRect(cam);
  const snap = outCubic(span(t, 168.66, 168.9));
  const m = lerp(160, 10, snap), mw = Math.max(w + 2 * m, 30), mh = Math.max(h + 2 * m, 30);
  const cx = x + w / 2, cy = y + h / 2, L = Math.min(28, mw / 3);
  ctx.save();
  ctx.globalAlpha = snap * (1 - smooth(span(t, 181.2, 182.5)));
  ctx.strokeStyle = C.text; ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = cx + sx * mw / 2, py = cy + sy * mh / 2;
    ctx.moveTo(px - sx * L, py); ctx.lineTo(px, py); ctx.lineTo(px, py - sy * L);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- scenes

function rollAt(t) {
  return Math.PI * smooth(span(t, 76.74, 77.5)) * (1 - smooth(span(t, 84.4, 85.8)));
}
function shakeAt(t) {
  let amp = 0;
  if (within(t, 42.64, 43.4)) amp = 5;
  if (within(t, 92.1, TL.chorus2)) amp = 2 + 6 * span(t, 92.1, TL.chorus2);
  if (amp === 0) return null;
  const o = lastOnset(t), k = o >= 0 ? Math.exp(-(t - o) / 0.08) : 0;
  const r = mulberry32(Math.round(o * 1000));
  return [(r() - 0.5) * 2 * amp * k, (r() - 0.5) * 2 * amp * k];
}

function othersAlpha(t) {
  if (t < TL.chorus1) return 0;
  if (within(t, TL.verse2, 90.9)) return within(t, 68.16, 87.9) ? 1 : 0.5;
  if (within(t, TL.verse3, TL.final)) return 0.3;
  if (within(t, 62.9, TL.verse2)) return lerp(1, 0.5, span(t, 62.9, TL.verse2));
  if (within(t, 90.9, TL.chorus2)) return 0.5;
  if (within(t, TL.final, TL.final + 2)) return lerp(0.3, 1, span(t, TL.final, TL.final + 2));
  return 1;
}

function sceneTree(ctx, t) {
  const cam = camAt(t);
  const post = smooth(span(t, 77.92, 78.3)) * (1 - smooth(span(t, 84.26, 84.7)));
  drawTree(ctx, t, cam, {
    alpha: 1 - 0.75 * post,
    others: othersAlpha(t),
    rot: rollAt(t),
    shake: shakeAt(t),
    packets: true,
    links: within(t, 160, TL.final + 3) ? drawLinks(t) : null,
  });
  fieldInSelf(ctx, t, cam);
  drawSmall(ctx, t);
  drawCallout(ctx, t, cam);
  drawFound(ctx, t, cam);
  drawPost(ctx, t);
}

const BRIDGE_Y = 560;
function sceneBridge(ctx, t) {
  const S = TL.shouts;
  let si = -1;
  S.forEach((s, i) => { if (t >= s.t) si = i; });
  const s = S[si];
  const jolt = s && s.q ? Math.exp(-(t - s.t) / 0.14) : 0;
  const cam = { ...FH, kx: FH.kx * (1 + 0.035 * jolt), ky: FH.ky * (1 + 0.035 * jolt) };
  drawTree(ctx, t, cam, { alpha: 0.14, others: 0.4 });

  if (s && s.q) {
    ctx.font = gradeFont(6, 100);
    const size = Math.min(320, 100 * 1720 / ctx.measureText(s.q).width);
    const k = 1 + 0.06 * jolt;
    ctx.save();
    ctx.translate(W / 2, BRIDGE_Y); ctx.scale(k, k);
    ctx.font = gradeFont(5, size); ctx.fillStyle = C.text; ctx.textAlign = "center";
    ctx.fillText(s.q, 0, size * 0.32);
    ctx.restore();
  }

  // the slot: keys pressed, the zero, or what the others say
  const nextT = S[si + 1] ? S[si + 1].t : TL.breakdown;
  const keys = TL.keys.filter(k => k.t >= s.t && k.t < nextT && t >= k.t);
  keys.forEach((k, i) => {
    const down = within(t, k.t, k.t + 0.12) ? 6 : 0;
    const x = SLOT.x + i * 330, y = 872 + down;
    ctx.fillStyle = down ? C.fillHi : C.fill; ctx.fillRect(x, y, 300, 112);
    ctx.strokeStyle = C.box; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, 299, 111);
    if (!down) { ctx.fillStyle = C.box; ctx.fillRect(x, y + 112, 300, 5); }
    ctx.font = monoFont(54); ctx.fillStyle = C.text; ctx.textAlign = "center";
    ctx.fillText(k.q, x + 150, y + 74);
    ctx.textAlign = "left";
  });
  const q = TL.bridgeQuotes.find(b => within(t, b.a, b.until));
  ctx.font = monoFont(64);
  if (q) { ctx.fillStyle = C.mid; ctx.fillText(typed(q.q, q.a, q.b, t), SLOT.x, SLOT.y); }
  if (s && s.q && s.q.startsWith("HÖRT")) { ctx.fillStyle = C.mid; ctx.fillText(typed("(0 zuschauer)", s.t + 0.3, s.t + 0.7, t), SLOT.x, SLOT.y); }
  if (s && s.q === "NEUNZIG K!") { ctx.font = monoFont(64, 700); ctx.fillStyle = C.text; ctx.fillText("+90.000", SLOT.x, SLOT.y); }
  if (s && s.q === "EIN WEEKEND!") { ctx.fillStyle = C.mid; ctx.fillText(typed("sa 00:00 – so 23:59", 143.3, 144.2, t), SLOT.x, SLOT.y); }
}

// Breakdown and after the interrupt: the lines stand alone, centred, stacked.
function stillLines(ctx, t, from, to, y0, color = C.text) {
  const ls = LINES.filter(l => l.still && lineStart(l) >= from && lineStart(l) < to);
  ls.forEach((l, i) => { if (t >= lineStart(l)) drawLine(ctx, l, t, W / 2, y0 + i * 132, 104, color, "center"); });
}

function sceneBreakdown(ctx, t) {
  stillLines(ctx, t, TL.breakdown, TL.verse3, 430);
}

function sceneOutro(ctx, t) {
  const cut = t >= TL.interrupt;
  if (!cut) {
    drawTree(ctx, t, camAt(t), { others: 1 });
  } else {
    // the interrupt stops him, not the empire: it is still there, unlit
    const ghost = smooth(span(t, 201.14, 202.6)) * (1 - smooth(span(t, TL.fade, 208.6)));
    drawTree(ctx, t, camAt(TL.interrupt), { alpha: 0.22 * ghost, ghost: true });
    const a = 1 - smooth(span(t, TL.fade + 0.4, 208.7));
    ctx.globalAlpha = a;
    stillLines(ctx, t, TL.interrupt, SCENE_END, 470);
    ctx.globalAlpha = 1;
  }
  // the prompt: a new context, cut short; then an empty prompt nobody fills
  ctx.font = monoFont(52);
  const caretOn = Math.floor(t / 0.53) % 2 === 0;
  if (!cut) {
    let s = "> ";
    for (const p of TL.prompt) s += typed(p.q, p.a, p.b, t);
    ctx.fillStyle = C.text; ctx.fillText(s, SLOT.x, SLOT.y);
    if (caretOn || t < 199.62) ctx.fillRect(SLOT.x + ctx.measureText(s).width + 4, SLOT.y - 40, 26, 48);
  } else {
    ctx.globalAlpha = 1 - smooth(span(t, 203.0, 203.84));
    ctx.fillStyle = C.mid;
    ctx.fillText("> New context: Why does nobody^C", SLOT.x, SLOT.y);
    ctx.globalAlpha = 1;
    if (t >= 203.84) {
      ctx.fillStyle = C.text;
      ctx.fillText(">", SLOT.x, SLOT.y);
      if (caretOn) ctx.fillRect(SLOT.x + ctx.measureText("> ").width + 4, SLOT.y - 40, 26, 48);
    }
  }
}

function grainAmount(t) {
  if (t < TL.verse1) return 0.05;
  if (within(t, TL.bridge, TL.breakdown)) return 0.1;
  if (within(t, TL.verse3, TL.final)) return 0.035;
  return 0.06;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.setLineDash([]);
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  const still = within(t, TL.breakdown, TL.verse3);
  if (t < TL.verse1) sceneIntro(ctx, t);
  else if (t < TL.bridge) sceneTree(ctx, t);
  else if (t < TL.breakdown) sceneBridge(ctx, t);
  else if (still) sceneBreakdown(ctx, t);
  else if (t < TL.outro) sceneTree(ctx, t);
  else sceneOutro(ctx, t);

  if (!within(t, TL.bridge, TL.breakdown) && !still && t < TL.outro) {
    const l = slotLine(t);
    if (l) drawLine(ctx, l, t, SLOT.x, SLOT.y, 96, l.dim ? C.mid : C.text);
  }
  if (t >= TL.verse1 && !still) {
    // the stream chrome keeps a dark band; the tree fades into it rather than under the text
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, "rgba(0,0,0,0.92)"); g.addColorStop(0.55, "rgba(0,0,0,0.7)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
  }
  drawHUD(ctx, t, still);
  texture(ctx, t, grainAmount(t), still);
}
