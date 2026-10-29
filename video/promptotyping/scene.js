// Promptotyping. The whole video is drawScene(ctx, t), a pure function of time
// in seconds; nothing survives between frames. Line onsets, phases and
// editorial events come from timeline.js.
//
// The aesthetics follow the concept, read with Hegel. The machine is cool light:
// hollow construction lines and monospace status. The human is red pencil: the
// caret (Latin "it is missing", the editor's insertion mark), the deleatur as
// determinate negation, marginal notes and every sung human line. A plan stays
// a hollow outline until it is recognised; then it gains substance as warm
// paper. Every version sublates the previous one: the rejected plans are kept
// and lifted, stacked behind the next. Vertical means sublation, horizontal
// mere repetition.
//
// The song's own lyrics are the research material. The cycle of the paper's
// Figure 1 sits above the knowledge column and shows which form of work is
// happening. In the rush the cycle collapses into implementation looping on
// itself, while the status bar counts built against validated artefacts until
// "Hundert gebaut, geprüft erst eins".

const W = 1920, H = 1080;
const BAR = 52;
const STAGE = { x: 586, y: 150, w: 1294, h: 830 };
const COL = { x: 40, w: 476 };
const AXIS_X = 551;
const BAND_Y = 112;              // baseline of the phase stamps above the stage

const C = {
  bg: "#111216", bg2: "#0b0c0f", bar: "#0a0b0e",
  line: "#e9eef5", pale: "#9aa3ae", faint: "#5d6570", ghost: "#3a414c",
  ink: "#ff8770", mark: "#ff4a3a",
  paper: "#efe9dc", paperInk: "#1b1d22", sheet: "#1d1b17", hand: "#d9cdb4",
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
function spaced(ctx, s, x, y, gap) {
  for (const ch of s) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + gap; }
  return x;
}
function spacedWidth(ctx, s, gap) { let w = 0; for (const ch of s) w += ctx.measureText(ch).width + gap; return w; }

// ---------------------------------------------------------------- lines and phases

const LN = {};
LINES.forEach((l, i) => { LN[l.id] = { ...l, end: l.e ?? (LINES[i + 1] ? LINES[i + 1].t : SCENE_END) }; });
function typed(id, t, cps = 24) {
  const l = LN[id];
  if (t < l.t) return "";
  const rate = Math.max(cps, l.s.length / Math.max(0.2, (l.end - l.t) * 0.7));
  return l.s.slice(0, Math.min(l.s.length, Math.floor((t - l.t) * rate) + 1));
}
const done = (id, t) => typed(id, t).length === LN[id].s.length;
function phaseAt(t) { let p = PHASES[0]; for (const x of PHASES) if (t >= x.t) p = x; return p; }

function wrap(ctx, text, maxW) {
  const out = []; let cur = "";
  for (const w of text.split(" ")) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxW && cur) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------- the rush: spawn order and counts

const MAXN = 99;                 // v1 plus 99 cells: "Hundert gebaut"
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
const TYPES = ["map", "timeline", "network", "facsimile", "ledger", "kgraph"];
const CELL_TYPE = Array.from({ length: MAXN }, (_, i) => i < 3 ? i : Math.floor(mulberry32(i * 53)() * TYPES.length));
const beat = 60 / BPM;
const SPAWN = Array.from({ length: MAXN }, (_, i) => {
  if (i < 3) return LN.v3.t;
  const raw = EV.rushStart + (EV.cut - 0.4 - EV.rushStart) * Math.pow((i - 2) / (MAXN - 3), 1 / 1.6);
  const q = beat / 2;
  return BEAT0 + Math.ceil((raw - BEAT0) / q) * q;
});
// After "Ich." the plans go in reverse order of building: the rush rewinds.
const VANISH = SPAWN.map((_, i) => EV.dissolve + (MAXN - 1 - i) / (MAXN - 1) * (LN.r1.t - 1.0 - EV.dissolve));
const frozenT = t => Math.min(t, EV.cut);
function spawned(t) { let n = 0; while (n < MAXN && SPAWN[n] <= t) n++; return n; }
function built(t) {
  const tf = frozenT(t);
  let n = tf >= LN.v1.t + 1.2 ? 1 : 0;
  if (tf >= LN.v2.t + 0.6) n++;
  if (tf >= LN.c2a.t - 0.4) n++;
  if (tf >= LN.c2b.t) n++;
  return n + Math.max(0, spawned(tf) - 3);
}
const validated = t => (t >= EV.enter + 0.6 ? 1 : 0);

// ---------------------------------------------------------------- background and status

// A plain night ground; the only light in it falls from the mirror axis.
function drawGround(ctx, t) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const k = 1 - smooth(span(t, EV.axisOff, EV.axisOff + 1.4));
  const g = ctx.createLinearGradient(AXIS_X - 260, 0, AXIS_X + 260, 0);
  g.addColorStop(0, rgba(C.line, 0)); g.addColorStop(0.5, rgba(C.line, 0.045 * k)); g.addColorStop(1, rgba(C.line, 0));
  ctx.fillStyle = g; ctx.fillRect(AXIS_X - 260, BAR, 520, H - BAR);
}

function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], span(t, keys[i - 1][0], keys[i][0]));
  }
  return keys[keys.length - 1][1];
}
// The clock creeps through the evening, jumps hours at the new session, races in the rush.
const CLOCK = [[0, 1320], [LN.ctx.t - 0.01, 1393], [LN.ctx.t, 1540], [LN.m1.t, 1590], [EV.rushStart, 1596],
  [EV.cut, 1679], [LN.r1.t - 0.01, 1679], [LN.r1.t, 1680], [SCENE_END, 1681]];
const stepKeys = (start, steps) => { const k = [[0, start]]; for (const [at, v] of steps) k.push([at - 0.01, k[k.length - 1][1]], [at, v]); return k; };
const COFFEE = stepKeys(1, [[LN.nein.t, 2], [LN.v2.t, 3], [LN.ctx.t, 4], [LN.m1.t, 6]]).concat([[EV.rushStart, 6], [EV.cut, 14]]);

function drawStatus(ctx, t) {
  ctx.fillStyle = C.bar; ctx.fillRect(0, 0, W, BAR);
  ctx.fillStyle = rgba(C.line, 0.18); ctx.fillRect(0, BAR - 1, W, 1);
  const m = Math.floor(keyed(CLOCK, t)) % 1440;
  const clock = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const ver = t >= LN.v3.t ? "v3" : t >= LN.v2.t ? "v2" : t >= LN.v1.t ? "v1" : "v0";
  const b = built(t), v = validated(t);
  font(ctx, 22); ctx.textBaseline = "middle";
  ctx.fillStyle = C.pale; ctx.textAlign = "left";
  ctx.fillText("promptotyping", 24, BAR / 2);
  const items = [["Graz", C.pale], [clock, C.line], [`Kaffee ${Math.floor(keyed(COFFEE, frozenT(t)))}`, C.pale],
    [`built ${b}`, t >= EV.rushStart && t < EV.cut ? C.line : C.pale], [`validated ${v}`, v ? C.mark : C.pale], [ver, C.line]];
  let x = W - 24; ctx.textAlign = "right";
  for (let i = items.length - 1; i >= 0; i--) {
    if (i === 4 || i === 3) font(ctx, 22, "Space Mono", 700); else font(ctx, 22);
    ctx.fillStyle = items[i][1]; ctx.fillText(items[i][0], x, BAR / 2);
    x -= ctx.measureText(items[i][0]).width;
    font(ctx, 22);
    if (i) { ctx.fillStyle = C.faint; ctx.fillText("  |  ", x, BAR / 2); x -= ctx.measureText("  |  ").width; }
  }
  drawCup(ctx, x - 30, BAR / 2 + 1, 0.42, C.pale);
}

function drawCup(ctx, x, y, s, col, steam = 0, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 3 / Math.max(s, 0.5); ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-18, 20); ctx.lineTo(18, 20); ctx.lineTo(22, -18); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(26, 0, 9, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  for (let i = 0; i < 3 && steam > 0; i++) {
    ctx.globalAlpha *= steam > 0 ? 1 : 0;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const yy = -26 - k * 3.2, xx = -10 + i * 10 + Math.sin(k * 0.7 + t * 2.4 + i) * 3;
      k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// The caret is the editor's insertion mark: a red bar over a small chevron below the line.
function drawCaret(ctx, x, y, h, t, label) {
  ctx.save();
  ctx.strokeStyle = C.mark; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 2, y + 10); ctx.lineTo(x + 8, y + 2); ctx.lineTo(x + 14, y + 10); ctx.stroke();
  if (Math.floor(t * 2.2) % 2 === 0) { ctx.fillStyle = C.mark; ctx.fillRect(x + 6, y - h * 0.82, 3, h * 0.82); }
  if (label) {
    font(ctx, 16, "Space Mono", 700);
    const w = ctx.measureText(label).width + 16, lx = x + 22, ly = y - h * 0.42;
    ctx.fillStyle = C.mark; ctx.fillRect(lx, ly - 13, w, 26);
    ctx.fillStyle = C.bg; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, lx + 8, ly + 1);
  }
  ctx.restore();
}
const caretLabel = t => (t >= LN.r4.t + 1.6 ? "researcher | developer" : "researcher");

// Handwriting in red pencil: a damaged Redaction cut, slanted.
function hand(ctx, text, x, y, px, col = C.mark, grade = "Redaction50") {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.16, 1, 0, 0);
  font(ctx, px, grade); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 0, 0); ctx.restore();
}
function pencil(ctx, pts, k, col = C.mark, lw = 10) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const n = Math.max(1, Math.floor((pts.length - 1) * clamp(k)));
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let i = 1; i <= n; i++) ctx.lineTo(...pts[i]);
  ctx.stroke(); ctx.restore();
}
// A deleatur: a stroke through the plan that ends in the editor's loop.
function deleaturPts(x0, y0, x1, y1) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * 8) * 8]); }
  for (let i = 0; i <= 30; i++) { const a = -Math.PI / 2 + i / 30 * Math.PI * 1.85; pts.push([x1 + 40 + Math.cos(a) * 40, y1 + 40 + Math.sin(a) * 40]); }
  pts.push([x1 + 30, y1 + 110]);
  return pts;
}
function arrow(ctx, x0, y0, x1, y1, col, lw = 2, cx = null, cy = null, dashed = false) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(x0, y0);
  if (cx === null) ctx.lineTo(x1, y1); else ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke(); ctx.setLineDash([]);
  const fx = cx === null ? x0 : cx, fy = cy === null ? y0 : cy, a = Math.atan2(y1 - fy, x1 - fx), hs = 6 + lw * 2;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.45) * hs, y1 - Math.sin(a - 0.45) * hs);
  ctx.lineTo(x1 - Math.cos(a + 0.45) * hs, y1 - Math.sin(a + 0.45) * hs);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- plans

const RNG = mulberry32(20261029);
const COAST = Array.from({ length: 22 }, (_, i) => {
  const a = i / 22 * Math.PI * 2, r = 0.36 + RNG() * 0.1 + Math.sin(a * 3) * 0.05;
  return [0.5 + Math.cos(a) * r * 1.05, 0.52 + Math.sin(a) * r * 0.9];
});
const DOTS = [[0.3, 0.36], [0.62, 0.3], [0.38, 0.66], [0.7, 0.62], [0.52, 0.48], [0.24, 0.52]];
const ROUTES = [[0, 1], [1, 3], [2, 4], [0, 4], [4, 3], [5, 2]];
const NET = Array.from({ length: 11 }, () => [0.1 + RNG() * 0.8, 0.15 + RNG() * 0.7]);
const NET_E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 5], [5, 6], [6, 7], [7, 2], [8, 3], [9, 8], [10, 9], [10, 5], [6, 9]];

function coastPts(w, h, g) {
  const pts = [];
  for (let i = 0; i < COAST.length; i++) {
    const a = COAST[i], b = COAST[(i + 1) % COAST.length];
    const steps = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h) / g));
    for (let k = 0; k < steps; k++) pts.push([lerp(a[0], b[0], k / steps), lerp(a[1], b[1], k / steps)]);
  }
  return pts;
}
function routeCurve(a, b) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 0.12;
  return u => [lerp(lerp(a[0], mx, u), lerp(mx, b[0], u), u), lerp(lerp(a[1], my, u), lerp(my, b[1], u), u)];
}

// One plan body inside (x, y, w, h); prog 0..1 how much is built.
function drawBody(ctx, type, x, y, w, h, col, prog = 1, pixel = false) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, w / 280);
  if (type === "map") {
    // graticule first, faint, then coast, routes and letter places
    ctx.save(); ctx.globalAlpha *= 0.35;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x, y + h * i / 4); ctx.quadraticCurveTo(x + w / 2, y + h * i / 4 - h * 0.05, x + w, y + h * i / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * i / 4, y); ctx.quadraticCurveTo(x + w * i / 4 + (i - 2) * w * 0.03, y + h / 2, x + w * i / 4, y + h); ctx.stroke();
    }
    ctx.restore();
    if (pixel) {
      const g = Math.max(6, Math.round(w / 52)), pts = coastPts(w, h, g), n = Math.floor(pts.length * prog);
      for (let i = 0; i < n; i++) ctx.fillRect(x + Math.round(pts[i][0] * w / g) * g, y + Math.round(pts[i][1] * h / g) * g, g - 2, g - 2);
      if (prog >= 1) ROUTES.forEach(([a, b]) => {
        const f = routeCurve(DOTS[a], DOTS[b]);
        for (let k = 1; k < 12; k++) { const [u, v] = f(k / 12); ctx.fillRect(x + Math.round(u * w / g) * g + g / 4, y + Math.round(v * h / g) * g + g / 4, g / 2, g / 2); }
      });
    } else {
      const n = Math.max(2, Math.ceil(COAST.length * prog));
      ctx.beginPath();
      for (let i = 0; i <= n && i <= COAST.length; i++) {
        const p = COAST[i % COAST.length];
        i ? ctx.lineTo(x + p[0] * w, y + p[1] * h) : ctx.moveTo(x + p[0] * w, y + p[1] * h);
      }
      ctx.stroke();
      const rn = Math.floor(ROUTES.length * span(prog, 0.5, 1));
      for (let r = 0; r < rn; r++) {
        const f = routeCurve(DOTS[ROUTES[r][0]], DOTS[ROUTES[r][1]]);
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const [u, v] = f(k / 16); k ? ctx.lineTo(x + u * w, y + v * h) : ctx.moveTo(x + u * w, y + v * h); }
        ctx.stroke();
      }
      if (prog >= 0.5) DOTS.forEach(([u, v]) => { ctx.beginPath(); ctx.arc(x + u * w, y + v * h, Math.max(2, w * 0.012), 0, Math.PI * 2); ctx.fill(); });
    }
  } else if (type === "timeline") {
    const yy = y + h * 0.7;
    ctx.beginPath(); ctx.moveTo(x + w * 0.05, yy); ctx.lineTo(x + w * (0.05 + 0.9 * prog), yy); ctx.stroke();
    for (let i = 0; i < 9 && (i + 1) / 9 <= prog; i++) {
      const xx = x + w * (0.08 + i * 0.105), hh = h * (0.18 + (i % 3) * 0.1);
      ctx.beginPath(); ctx.moveTo(xx, yy - h * 0.04); ctx.lineTo(xx, yy + h * 0.04); ctx.stroke();
      if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - hh); ctx.stroke(); ctx.beginPath(); ctx.arc(xx, yy - hh, Math.max(1.5, w * 0.012), 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (type === "network" || type === "kgraph") {
    const pos = type === "network" ? NET : NET.map(p => [1 - p[1] * 0.9, p[0] * 0.9 + 0.05]);
    const n = Math.floor(NET_E.length * prog);
    for (let i = 0; i < n; i++) {
      const [a, b] = NET_E[i];
      ctx.beginPath(); ctx.moveTo(x + pos[a][0] * w, y + pos[a][1] * h); ctx.lineTo(x + pos[b][0] * w, y + pos[b][1] * h); ctx.stroke();
    }
    for (let i = 0; i < Math.ceil(pos.length * prog); i++) {
      const r = Math.max(2, w * (type === "kgraph" && i % 3 === 0 ? 0.03 : 0.016));
      ctx.save(); ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x + pos[i][0] * w, y + pos[i][1] * h, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(x + pos[i][0] * w, y + pos[i][1] * h, r, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (type === "facsimile") {
    ctx.strokeRect(x + w * 0.2, y + h * 0.06, w * 0.6, h * 0.88);
    for (let i = 0; i < 7 * prog; i++) {
      const yy = y + h * (0.16 + i * 0.1);
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) { const xx = x + w * (0.26 + k * 0.03), dy = Math.sin(k * 1.9 + i * 2.3) * h * 0.012; k ? ctx.lineTo(xx, yy + dy) : ctx.moveTo(xx, yy + dy); }
      ctx.stroke();
      if (i % 3 === 1) ctx.strokeRect(x + w * 0.24, yy - h * 0.04, w * 0.52, h * 0.08);
    }
  } else if (type === "ledger") {
    for (let i = 0; i < 7 * prog; i++) {
      const yy = y + h * (0.12 + i * 0.12);
      ctx.beginPath(); ctx.moveTo(x + w * 0.06, yy); ctx.lineTo(x + w * 0.94, yy); ctx.stroke();
      ctx.fillRect(x + w * 0.1, yy + h * 0.035, w * (0.2 + (i * 37 % 20) / 100), Math.max(1, h * 0.022));
      ctx.fillRect(x + w * 0.7, yy + h * 0.035, w * (0.08 + (i * 13 % 9) / 100), Math.max(1, h * 0.022));
    }
    ctx.beginPath(); ctx.moveTo(x + w * 0.62, y + h * 0.08); ctx.lineTo(x + w * 0.62, y + h * (0.08 + 0.84 * prog)); ctx.stroke();
  }
}

// A plan: frame with construction overshoot, a title tab, a body and a check mark.
// state: "open" (hollow ring), "rejected" (red cross), "valid" (red filled mark); expose 0..1 turns it to paper.
function drawPlan(ctx, x, y, w, h, o = {}) {
  const ex = o.expose || 0, col = ex > 0.5 ? C.paperInk : (o.col || C.line);
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
  if (ex > 0) { ctx.fillStyle = rgba(C.paper, ex); ctx.fillRect(x, y, w, h); }
  else if (o.fill !== false) { ctx.fillStyle = rgba(C.bg2, 0.55); ctx.fillRect(x, y, w, h); }
  const lw = Math.max(1, Math.min(2.5, w / 260)), ov = Math.max(3, Math.min(14, w * 0.03));
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x - ov, y); ctx.lineTo(x + w + ov, y); ctx.moveTo(x - ov, y + h); ctx.lineTo(x + w + ov, y + h);
  ctx.moveTo(x, y - ov); ctx.lineTo(x, y + h + ov); ctx.moveTo(x + w, y - ov); ctx.lineTo(x + w + 0, y + h + ov);
  ctx.stroke();
  if (o.title && w > 220) {
    font(ctx, Math.round(clamp(w / 34, 12, 18))); ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(o.title, x + 4, y - 8);
  }
  if (o.type) drawBody(ctx, o.type, x + w * 0.05, y + h * 0.07, w * 0.9, h * 0.84, col, o.prog ?? 1, o.pixel);
  if (o.state) {
    const r = Math.max(4, Math.min(12, w * 0.03)), cx = x + w - r * 2.2, cy = y + h - r * 2.2;
    ctx.lineWidth = Math.max(1.5, r / 4);
    if (o.state === "open") { ctx.strokeStyle = ex > 0.5 ? C.paperInk : C.pale; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    if (o.state === "rejected") {
      ctx.strokeStyle = C.mark; ctx.lineWidth = Math.max(2, r / 3);
      ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
    }
    if (o.state === "valid") {
      ctx.fillStyle = C.mark; ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.paper; ctx.lineWidth = Math.max(2, r / 3);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx - r * 0.1, cy + r * 0.5); ctx.lineTo(cx + r * 0.7, cy - r * 0.5); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the cycle of Figure 1

const CY = { x: COL.x, y: 70 };
const NODES = {
  prep: { x: 190, y: 26, label: "PREPARATION" }, expl: { x: 82, y: 92, label: "EXPLORATION" },
  impl: { x: 300, y: 92, label: "IMPLEMENTATION" }, dist: { x: 190, y: 158, label: "DISTILLATION" },
};
const RES = { x: 436, y: 26 };
const FORMS = ["prep", "expl", "dist", "impl"];
function drawCycle(ctx, t) {
  const ph = phaseAt(t), p = ph.p, since = t - ph.t, ox = CY.x, oy = CY.y;
  const loop = p === "loop", pulse = 0.5 + 0.5 * Math.cos(since * 6);
  const allK = p === "all" ? since : -1;
  const lit = f => p === f || (p === "cur" && f === "dist") || (p === "ctx" && (f === "impl" || f === "dist")) ||
    (allK >= 0 && allK > FORMS.indexOf(f) * 0.35);
  const dimAll = loop ? 0.25 : 1;
  // a circle of circles: every pass leaves its ring below the current one, so the cycle rises as a spiral
  const pass = t < LN.v2.t ? 0 : t < LN.v3.t ? 1 : 2;
  const ring = (dy, col, lw, k = 1) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(ox + 191, oy + 92 + dy, 158, 80, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
  };
  for (let j = 0; j < pass; j++) ring((pass - j) * 10, rgba(C.pale, (allK >= 0 ? 0.6 : 0.22) / (pass - j)), 1.5);
  const closing = span(t, EV.enter, EV.enter + 0.9);
  if (closing > 0) ring(0, closing < 1 ? C.mark : rgba(C.line, allK >= 0 ? 0.9 : 0.5), closing < 1 ? 3 : 2, closing);
  // arrows of the cycle
  const A = (a, b, cx, cy, col, lw, dashed) => arrow(ctx, ox + a[0], oy + a[1], ox + b[0], oy + b[1], col, lw, ox + cx, oy + cy, dashed);
  const ac = rgba(C.pale, 0.55 * dimAll);
  A([132, 34], [92, 70], 100, 34, ac, 1.5);
  A([82, 114], [124, 156], 84, 152, ac, 1.5);
  A([258, 156], [300, 114], 296, 152, ac, 1.5);
  A([300, 70], [252, 34], 296, 34, loop ? rgba(C.pale, 0.15) : ac, 1.5);
  if (p === "ctx") A([190, 140], [258, 104], 230, 120, rgba(C.line, 0.6 + 0.4 * pulse), 3);
  if (p === "cur" || (allK >= 0)) A([300, 114], [250, 150], 300, 150, C.mark, 2.5, true);
  if (p === "val" || allK >= 1.4) A([RES.x - 8, RES.y + 12], [356, 76], 420, 70, C.mark, 2.5);
  for (const f of FORMS) {
    const n = NODES[f], on = lit(f) || (loop && f === "impl");
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ox + n.x, oy + n.y, 82, 22, 0, 0, Math.PI * 2);
    if (on) { ctx.fillStyle = C.line; ctx.fill(); } else { ctx.strokeStyle = rgba(C.pale, 0.6 * dimAll); ctx.lineWidth = 1.5; ctx.stroke(); }
    font(ctx, 13, "Space Mono", 700); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = on ? C.bg : rgba(C.pale, 0.8 * dimAll);
    const sw = spacedWidth(ctx, n.label, 1.2);
    spaced(ctx, n.label, ox + n.x - sw / 2, oy + n.y + 1, 1.2);
    ctx.restore();
  }
  // the bad infinity: in the rush the cycle breaks open and implementation runs off in a straight line,
  // "and so on"; after "Ich." the line is drawn back and the ring closes
  const outK = loop ? smooth(span(t, ph.t, ph.t + 0.6)) : t >= EV.cut ? 1 - smooth(span(t, EV.enter - 0.4, EV.enter + 0.3)) : 0;
  if (outK > 0) {
    const n = NODES.impl, x0 = ox + n.x + 84, x1 = lerp(x0, W + 40, outK), yy = oy + n.y;
    const off = (frozenT(t) * 160) % 28;
    ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 2.5; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -off;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); ctx.setLineDash([]);
    font(ctx, 22, "Space Mono", 700); ctx.fillStyle = C.line; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(`×${Math.max(1, spawned(frozenT(t)) - 2)}`, x0 + 6, yy + 34);
    ctx.restore();
  }
  // the researcher, above the cycle as in the figure
  const resOn = p === "val" || p === "cur" || allK >= 1.4 || (p !== "loop" && t < EV.rushStart);
  ctx.save();
  ctx.beginPath(); ctx.arc(ox + RES.x, oy + RES.y, 14, 0, Math.PI * 2);
  ctx.lineWidth = 3; ctx.strokeStyle = loop ? rgba(C.mark, 0.25) : C.mark; ctx.stroke();
  if (resOn) { ctx.beginPath(); ctx.arc(ox + RES.x, oy + RES.y, 7 + (p === "val" ? 2 * pulse : 0), 0, Math.PI * 2); ctx.fillStyle = C.mark; ctx.fill(); }
  ctx.restore();
}

// Stamps: the name of a form of work, letter-spaced across the band above the stage.
const STAMP = { prep: "PREPARATION", expl: "EXPLORATION", dist: "DISTILLATION", impl: "IMPLEMENTATION",
  val: "VALIDATION", cur: "KNOWLEDGE CURATION", ctx: "CONTEXT", loop: "IMPLEMENTATION ×" };
function drawStamp(ctx, t) {
  const ph = phaseAt(t), s = STAMP[ph.p];
  if (!s || t >= LN.who.t + 0.9 && ph.p === "val") return;
  // on "Who validates this?" the stamp gives way to the count of built against validated
  const short = ph.p === "val" && ph.t === LN.who.t;
  const k = span(t, ph.t, ph.t + 0.18), out = short ? 1 - span(t, ph.t + 0.6, ph.t + 0.9) : 1 - span(t, ph.t + 1.5, ph.t + 1.9);
  if (out <= 0) return;
  const human = ph.p === "val" || ph.p === "cur";
  ctx.save(); ctx.globalAlpha = k * out;
  font(ctx, 40, "Space Mono", 700); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = human ? C.mark : C.line;
  const gap = lerp(26, 10, smooth(span(t, ph.t, ph.t + 0.5)));
  let text = s;
  if (ph.p === "loop") text = s + Math.max(1, spawned(frozenT(t)) - 2);
  spaced(ctx, text, STAGE.x, BAND_Y, gap);
  ctx.restore();
}

// Five quiet glosses name what happens in Hegel's terms, set at the right end of the band.
const GLOSS = [
  { t: LN.nein.t, s: "bestimmte Negation" },
  { t: LN.upd1.t, s: "Er-innerung" },
  { t: EV.rushStart, s: "schlechte Unendlichkeit" },
  { t: LN.ich.t, s: "Anerkennung" },
  { t: EV.axisOff - 0.6, s: "aufgehoben" },
];
function drawGloss(ctx, t) {
  for (const g of GLOSS) {
    const a = smooth(span(t, g.t, g.t + 0.5)) * (1 - smooth(span(t, g.t + 3.0, g.t + 3.6)));
    if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a;
    font(ctx, 34, "Redaction20"); ctx.fillStyle = C.pale; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText(g.s, STAGE.x + STAGE.w, BAND_Y);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the knowledge column

const FILES = [
  { name: "data.md", at: "rc1", entries: [{ id: "rc2" }] },
  { name: "specification.md", at: "rc3", entries: [{ id: "rc4" }, { at: LN.upd2.t, text: "lauter. mehr Wut." }] },
  { name: "journal.md", at: "rc5", entries: [{ id: "rc6" }, { at: LN.upd1.t + 0.2, text: "22:41 Stopp. Das bin nicht ich. Du singst mein Lied, doch du kennst mich nicht." }, { at: LN.gut.t + 1.0, text: "22:52 Fast. Aber gut." }] },
  { name: "CLAUDE.md", at: "rc7", entries: [{ id: "rc8" }] },
];
const rushMode = t => t >= LN.v3.t && t < EV.cut + 0.8;

// Returns the file card boxes, so words can leave from them and verdicts can land in them.
function drawColumn(ctx, t) {
  const x = COL.x, w = COL.w;
  font(ctx, 16); ctx.fillStyle = C.faint; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("knowledge/", x, 286);
  if (t < LN.rc1.t) { font(ctx, 26, "Redaction"); ctx.fillStyle = rgba(C.pale, 0.5); ctx.fillText("(leer)", x, 330); }
  let y = 300; const boxes = {};
  for (const f of FILES) {
    const at = LN[f.at].t;
    if (t < at) { boxes[f.name] = { x, y, w, h: 60 }; continue; }
    const k = smooth(span(t, at, at + 0.35));
    font(ctx, 26, "Redaction");
    const lines = [];
    for (const e of f.entries) {
      const when = e.id ? LN[e.id].t : e.at;
      if (t < when) continue;
      const text = e.id ? typed(e.id, t) : e.text.slice(0, Math.floor((t - when) * 60) + 1);
      for (const l of wrap(ctx, text, w - 40)) lines.push({ l, typing: e.id && !done(e.id, t) });
    }
    const shown = rushMode(t) ? lines.slice(-1) : lines;
    const h = 50 + shown.length * 34 + 6;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = rgba(C.bg2, 0.8); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(C.pale, 0.45); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    font(ctx, 19, "Space Mono", 700); ctx.fillStyle = C.line;
    spaced(ctx, typed(f.at, t, 40).length >= 1 ? f.name : "", x + 16, y + 32, 0);
    font(ctx, 26, "Redaction"); ctx.fillStyle = C.ink;
    shown.forEach((s, i) => {
      ctx.fillText(s.l, x + 18, y + 76 + i * 34);
      if (s.typing) drawCaret(ctx, x + 18 + ctx.measureText(s.l).width, y + 76 + i * 34, 26, t, null);
    });
    ctx.restore();
    boxes[f.name] = { x, y, w, h };
    y += h + 12;
  }
  const logA = rushMode(t) ? 1 - span(t, EV.cut, EV.cut + 0.8) : 0;
  if (logA > 0) { ctx.save(); ctx.globalAlpha = logA; drawCommits(ctx, t, x, y + 26, w); ctx.restore(); }
  return boxes;
}

const FRAGS = ["MARKDOWN! MARKDOWN!", "ICH BRAUCH KEINEN DEVELOPER MEHR!", "ICH BAU MIR ALLES SELBST!", "PROMPTOTYPING!", "Ich brauch keinen Developer mehr!"];
function drawCommits(ctx, t, x, y, w) {
  const n = spawned(frozenT(t));
  font(ctx, 15); ctx.fillStyle = C.faint; ctx.textAlign = "left";
  ctx.fillText("git log", x, y);
  const rows = Math.floor((1060 - y) / 24);
  for (let r = 0; r < rows; r++) {
    const i = n - rows + r;
    if (i < 3) continue;
    const hash = Math.floor(mulberry32(i * 977)() * 0xfffffff).toString(16).padStart(7, "0");
    ctx.fillStyle = r === rows - 1 ? C.line : C.pale;
    ctx.fillText(`${hash}  ${TYPES[CELL_TYPE[i]]}: ${FRAGS[i % FRAGS.length]}`.slice(0, 48), x, y + 28 + r * 24);
  }
}

// ---------------------------------------------------------------- the machine's terminal

const TERM = ["read", "think1", "think2", "think3", "rc1", "rc3", "rc5", "rc7", "v1", "upd1", "v2", "ctx", "v3"];
function drawTerminal(ctx, t) {
  const cur = TERM.filter(id => LN[id].t <= t && t < LN[id].end + 1.6);
  font(ctx, 24); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  cur.slice(-2).forEach((id, i, a) => {
    const fade = 1 - span(t, LN[id].end + 1.0, LN[id].end + 1.6);
    ctx.fillStyle = rgba(i === a.length - 1 ? C.line : C.faint, fade);
    ctx.fillText("> " + typed(id, t, 40), STAGE.x, 1048 - (a.length - 1 - i) * 32);
  });
}

// ---------------------------------------------------------------- material: idea, facsimile, profile

const IDEA = { x: STAGE.x + 30, y: STAGE.y + 30, w: STAGE.w - 60, h: 560 };
const INTRO = ["intro1", "intro2", "intro3", "intro4"];
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
  const gone = smooth(span(t, LN.v1.t, LN.v1.t + 0.7));
  if (gone >= 1) return;
  const ed = 1 - smooth(span(t, LN.read.t - 0.6, LN.read.t + 0.5));
  const fx = smooth(span(t, LN.read.t - 0.5, LN.read.t + 0.7));
  const { x, y, w, h } = IDEA;
  ctx.save(); ctx.globalAlpha = 1 - gone;
  if (ed > 0) {
    drawPlan(ctx, x, y, w, h, { title: "idee.md", col: C.pale, alpha: ed });
    ctx.save(); ctx.globalAlpha *= ed;
    font(ctx, 56, "Redaction"); ctx.fillStyle = C.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let caret = null;
    INTRO.forEach((id, i) => {
      const s = introText(id, t), yy = y + 120 + i * 100;
      ctx.fillText(s, x + 70, yy);
      if (t >= LN[id].t && t < LN[id].end) caret = [x + 70 + ctx.measureText(s).width, yy];
    });
    if (!caret && t < LN.intro1.t) caret = [x + 70, y + 120];
    if (caret) drawCaret(ctx, caret[0], caret[1], 56, t, caretLabel(t));
    drawCup(ctx, x + w - 110, y + h - 80, 1.4, C.pale, 1, t);
    ctx.restore();
  }
  if (fx > 0) {
    ctx.save(); ctx.globalAlpha *= fx;
    ctx.fillStyle = C.sheet; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.hand; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    INTRO.forEach((id, i) => hand(ctx, LN[id].s, x + 70, y + 120 + i * 100, 54, C.hand, "Redaction70"));
    // transcription boxes read the hand back
    font(ctx, 54, "Redaction70");
    INTRO.forEach((id, i) => {
      const k = smooth(span(t, LN.read.t + 0.3 + i * 0.4, LN.read.t + 0.7 + i * 0.4));
      if (!k) return;
      const tw = ctx.measureText(LN[id].s).width + 40, yy = y + 120 + i * 100;
      ctx.strokeStyle = rgba(C.line, k); ctx.lineWidth = 2;
      ctx.strokeRect(x + 50, yy - 58, tw * k, 78);
    });
    ctx.restore();
    drawProfile(ctx, t, x + w - 360, y + 40, 320, h - 80);
  }
  ctx.restore();
}

const PROFILE = [["one voice", 0.35], ["German", 0.8], ["angry", 0.95], ["tired", 0.9]];
function drawProfile(ctx, t, x, y, w, h) {
  const k0 = smooth(span(t, LN.think1.t, LN.think1.t + 0.6));
  if (!k0) return;
  ctx.save(); ctx.globalAlpha *= k0;
  drawPlan(ctx, x, y, w, h, { title: "profile", col: C.line });
  const bw = (w - 60) / 4;
  PROFILE.forEach(([label, v], i) => {
    const kk = outBack(span(t, LN.think2.t + i * 0.45, LN.think2.t + i * 0.45 + 0.7));
    const bh = (h - 140) * v * kk, bx = x + 30 + i * bw, by = y + h - 80;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(bx + 10, by - bh, bw - 20, bh);
    ctx.save(); ctx.translate(bx + bw / 2, by + 18); ctx.rotate(-0.5);
    font(ctx, 16); ctx.fillStyle = C.line; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    if (t >= LN.think2.t + i * 0.45) ctx.fillText(label, 8, 0);
    ctx.restore();
  });
  if (t >= LN.think3.t) { font(ctx, 18, "Space Mono", 700); ctx.fillStyle = C.line; ctx.textAlign = "left"; ctx.fillText("hook: missing", x + 18, y + 34); }
  ctx.restore();
}

// ---------------------------------------------------------------- version one: the 8-bit map

const MAPR = { x: STAGE.x + 30, y: STAGE.y + 20, w: STAGE.w - 60, h: STAGE.h - 210 };
const C1 = ["c1a", "c1b", "c1c", "c1d"];
const V1_DOTS = [[0.18, 0.26], [0.4, 0.42], [0.2, 0.6], [0.48, 0.76]];
function drawV1(ctx, t, boxes) {
  const a = smooth(span(t, LN.v1.t, LN.v1.t + 0.4)) * (1 - smooth(span(t, LN.upd1.t + 0.6, LN.upd1.t + 1.4)));
  if (!a) return;
  const rejected = t >= LN.nein.t + 0.5;
  const { x, y, w, h } = MAPR;
  ctx.save(); ctx.globalAlpha = a;
  drawPlan(ctx, x, y, w, h, { title: "promptotype v1 | map", type: "map", pixel: true, prog: span(t, LN.v1.t + 0.2, LN.c1a.t - 0.1),
    col: rejected ? C.pale : C.line, state: rejected ? "rejected" : "open" });
  const bx = x + w * 0.05, by = y + h * 0.07, bw = w * 0.9, bh = h * 0.84;
  C1.forEach((id, i) => {
    if (t < LN[id].t) return;
    const [dx, dy] = V1_DOTS[i], px = bx + dx * bw, py = by + dy * bh;
    const k = outBack(span(t, LN[id].t, LN[id].t + 0.25));
    ctx.fillStyle = C.line; ctx.fillRect(px - 9 * k, py - 9 * k, 18 * k, 18 * k);
    font(ctx, 38, "Space Mono", 700); ctx.textBaseline = "middle";
    const fits = px + 22 + ctx.measureText(LN[id].s).width < x + w - 24;
    const tw = ctx.measureText(typed(id, t, 30)).width, lx = fits ? px + 22 : px - 22 - tw;
    ctx.fillStyle = C.bg; ctx.fillRect(lx - 6, py - 24, tw + 12, 48);
    ctx.fillStyle = C.line; ctx.textAlign = "left"; ctx.fillText(typed(id, t, 30), lx, py);
  });
  ctx.restore();
  if (t >= LN.nein.t) {
    const fade = 1 - smooth(span(t, LN.upd1.t + 0.4, LN.upd1.t + 1.2));
    ctx.save(); ctx.globalAlpha = fade;
    pencil(ctx, deleaturPts(x + 80, y + h - 70, x + w - 260, y + 100), span(t, LN.nein.t, LN.nein.t + 0.6), C.mark, 12);
    hand(ctx, "Nein.", x + 60, y + 180, 150, C.mark);
    ctx.restore();
    drawVerdict(ctx, t, x + 40, y + h + 80, boxes["journal.md"]);
  }
}

// "Stopp…" is written as a marginal note under the plan, then lands in journal.md.
function drawVerdict(ctx, t, x, y, box) {
  const fly = smooth(span(t, LN.upd1.t - 0.6, LN.upd1.t + 0.2));
  if (fly >= 1) return;
  const tx = box ? box.x + 18 : COL.x + 18, ty = box ? box.y + box.h + 30 : 600;
  ["stopp", "kennst"].forEach((id, i) => {
    const s = typed(id, t); if (!s) return;
    hand(ctx, s, lerp(x, tx, fly), lerp(y + i * 64, ty + i * 30, fly), lerp(50, 24, fly), C.mark);
  });
}

// ---------------------------------------------------------------- distillation

const FILLER = ["im Grunde", "gewissermaßen", "eigentlich", "sozusagen", "in gewisser Weise", "möglicherweise", "quasi", "im Prinzip", "durchaus", "letztlich"];
const DIST = ["d1", "d2", "d3", "d4"].map((id, n) => {
  const r = mulberry32(100 + n), toks = [];
  LN[id].s.split(" ").forEach(wd => {
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
    const p = [cx, cy, tw]; cx += tw + sp; return p;
  });
}
function drawDistill(ctx, t) {
  const a = smooth(span(t, LN.upd1.end, LN.upd1.end + 0.5)) * (1 - smooth(span(t, LN.v2.t - 0.2, LN.v2.t + 0.6)));
  if (!a) return;
  const { x, y, w, h } = STAGE;
  ctx.save(); ctx.globalAlpha = a;
  drawPlan(ctx, x + 20, y + 10, w - 40, h - 20, { title: "distillation", col: C.pale });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  DIST.forEach((d, n) => {
    const l = LN[d.id];
    // the machine drafts the inflated version first, the first one in the instrumental before the verse
    const ds = n === 0 ? LN.upd1.end + 0.6 : l.t - 0.7, de = n === 0 ? l.t - 0.4 : l.t - 0.15;
    if (t < ds) return;
    const draft = span(t, ds, de);
    const strike = span(t, l.t, l.t + 0.6), drop = smooth(span(t, l.t + 0.55, l.t + 1.1));
    const k = smooth(span(t, l.t + 0.5, l.t + 1.35));
    font(ctx, 34, "Redaction100");
    const P0 = layoutTokens(ctx, d.toks, x + 80, y + 470, w - 160, 52);
    const kept = d.toks.filter(tk => tk.keep);
    font(ctx, 50, "Redaction");
    const P1 = layoutTokens(ctx, kept, x + 80, y + 110 + n * 84, w - 160, 60);
    const grade = GRADES[Math.round((1 - k) * (GRADES.length - 1))];
    const shownTok = Math.floor(d.toks.length * draft);
    const fillers = d.toks.map((tk, i) => tk.keep ? -1 : i).filter(i => i >= 0);
    let ki = 0;
    d.toks.forEach((tk, i) => {
      if (i >= shownTok && k === 0) { if (tk.keep) ki++; return; }
      if (tk.keep) {
        const p1 = P1[ki++];
        font(ctx, lerp(34, 50, k), grade); ctx.fillStyle = k > 0.4 ? C.ink : C.line;
        ctx.fillText(tk.s, lerp(P0[i][0], p1[0], k), lerp(P0[i][1], p1[1], k));
      } else if (drop < 1) {
        const yy = P0[i][1] + drop * drop * 260, al = 1 - drop;
        font(ctx, 34, "Redaction100"); ctx.fillStyle = rgba(C.pale, al);
        ctx.fillText(tk.s, P0[i][0], yy);
        // the red pencil strikes each filler in turn
        const order = fillers.indexOf(i), sk = span(strike, order / fillers.length, (order + 1) / fillers.length);
        if (sk > 0) { ctx.fillStyle = rgba(C.mark, al); ctx.fillRect(P0[i][0] - 4, yy - 12, (P0[i][2] + 8) * sk, 4); }
      }
    });
  });
  ctx.restore();
}

// ---------------------------------------------------------------- version two: map, timeline, network

const V2 = {
  big: { x: STAGE.x + 30, y: STAGE.y + 20, w: STAGE.w - 60, h: STAGE.h - 40 },
  map: { x: STAGE.x + 20, y: STAGE.y + 20, w: 600, h: 470 },
  tl: { x: STAGE.x + 660, y: STAGE.y + 20, w: 614, h: 470 },
  net: { x: STAGE.x + 20, y: STAGE.y + 530, w: 1254, h: 290 },
};
const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
// Earlier versions behind a plan, each lifted up and to the right, v1 with its red cross.
function drawSheets(ctx, r, count, alpha = 1) {
  const step = Math.max(8, Math.min(22, r.w * 0.035));
  for (let j = count; j >= 1; j--) {
    const x = r.x + step * j, y = r.y - step * j;
    ctx.save(); ctx.globalAlpha *= alpha * (0.55 - 0.15 * (j - 1));
    ctx.fillStyle = C.bg; ctx.fillRect(x, y, r.w, r.h);
    const v1 = j === count;
    drawPlan(ctx, x, y, r.w, r.h, { type: "map", pixel: v1, col: C.pale, state: v1 ? "rejected" : "open", fill: false });
    ctx.restore();
  }
}
const C2 = ["c2a", "c2b", "c2c", "c2d"];
const C2_TIME = ["22:47", "22:48", "22:49", "22:50"];
function drawV2(ctx, t, rebuilt = 0) {
  const live = t < LN.ctx.t;
  const a = live ? smooth(span(t, LN.v2.t, LN.v2.t + 0.5)) : rebuilt;
  if (!a) return;
  const tf = live ? Math.min(t, LN.fast.t) : 200;     // the build freezes on "Fast."
  const loud = live ? smooth(span(t, LN.lauter.t, LN.lauter.t + 1.2)) : 1;
  const angry = live && t >= LN.wut.t;
  const tile = live ? smooth(span(t, LN.c2a.t - 0.9, LN.c2a.t - 0.2)) : 1;
  ctx.save(); ctx.globalAlpha = a;
  const m = lerpRect(V2.big, V2.map, tile), tl = V2.tl, nt = V2.net;
  // sublated, not deleted: the rejected v1 is kept and lifted behind the new plan
  drawSheets(ctx, m, 1);
  drawPlan(ctx, m.x, m.y, m.w, m.h, { title: "promptotype v2 | map", type: "map", prog: span(tf, LN.v2.t + 0.2, LN.v2.t + 2.2), state: "open", fill: true });
  if (tile > 0) {
    ctx.save(); ctx.globalAlpha *= tile;
    drawPlan(ctx, tl.x, tl.y, tl.w, tl.h, { title: "timeline", state: "open" });
    // the axis carries one tick per chorus line; every row hangs on its tick by a leader
    const ay = tl.y + tl.h - 50, tx0 = tl.x + 40;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx0, ay); ctx.lineTo(tl.x + tl.w - 40, ay); ctx.stroke();
    const size = lerp(26, 34, loud);
    let ey = tl.y + 70;
    C2.forEach((id, i) => {
      const tick = tx0 + 20 + i * 34;
      ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(tick, ay - 8); ctx.lineTo(tick, ay + 8); ctx.stroke();
      font(ctx, 14); ctx.fillStyle = C.pale; ctx.save(); ctx.translate(tick, ay + 14); ctx.rotate(0.9); ctx.textAlign = "left"; ctx.fillText(C2_TIME[i], 0, 0); ctx.restore();
      if (live && t < LN[id].t) return;
      const jx = angry ? (mulberry32(Math.floor(t * 12) + i * 31)() - 0.5) * 8 : 0;
      font(ctx, size, angry ? "Redaction70" : "Redaction");
      const s = live ? typed(id, t) : LN[id].s;
      const lines = wrap(ctx, s, tl.w - 240);
      ctx.strokeStyle = rgba(C.line, 0.6); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tick, ay - 8); ctx.lineTo(tick, ey - size * 0.35); ctx.lineTo(tl.x + 180, ey - size * 0.35); ctx.stroke();
      ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(tick, ey - size * 0.35, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = angry ? C.mark : C.ink; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      lines.forEach((l, j) => ctx.fillText(l, tl.x + 196 + jx, ey + j * size * 1.05));
      if (loud > 0 && live) { ctx.fillStyle = C.mark; ctx.fillRect(tl.x + 196, ey + (lines.length - 1) * size * 1.05 + 8, 160 * loud, 3); }
      ey += Math.max(1, lines.length) * size * 1.05 + 18;
    });
    ctx.restore();
  }
  const nk = live ? span(tf, LN.c2b.t, LN.c2d.t + 1.5) : 1;
  if (nk > 0) drawPlan(ctx, nt.x, nt.y, nt.w, nt.h, { title: "network", type: "network", prog: nk, state: "open" });
  ctx.restore();
}

const FAST = ["fast", "lauter", "gut", "wut"];
function drawFast(ctx, t) {
  if (t < LN.fast.t || t >= LN.ctx.t) return;
  const { x, y, w, h } = V2.net;
  ctx.fillStyle = rgba(C.bg, 0.86); ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  FAST.forEach((id, i) => {
    const s = typed(id, t); if (!s) return;
    const big = id === "fast";
    hand(ctx, s, x + 30 + (i % 2) * 560, y + 110 + Math.floor(i / 2) * 140, big ? 110 : 64, C.mark);
  });
}

// ---------------------------------------------------------------- the new session

const WH = ["w1", "w2", "w3", "w4"];
function drawSession(ctx, t, boxes) {
  if (t < LN.ctx.t || t >= LN.m1.t + 0.3) return;
  const wipe = smooth(span(t, LN.ctx.t, LN.ctx.t + 0.8));
  if (wipe < 1) {
    drawV2(ctx, LN.ctx.t - 0.01);
    drawFast(ctx, LN.ctx.t - 0.01);
    ctx.fillStyle = C.bg; ctx.fillRect(STAGE.x - 20, STAGE.y - 20, STAGE.w + 40, (STAGE.h + 40) * wipe);
    ctx.fillStyle = C.line; ctx.fillRect(STAGE.x - 20, STAGE.y - 20 + (STAGE.h + 40) * wipe, STAGE.w + 40, 2);
    return;
  }
  drawV2(ctx, t, 0.45 * smooth(span(t, LN.w2.t, LN.w4.t + 1)));
  ctx.fillStyle = rgba(C.bg, 0.82); ctx.fillRect(STAGE.x, STAGE.y + 500, STAGE.w, 320);
  const src = Object.values(boxes).map(b => [b.x + b.w * 0.6, b.y + b.h / 2]);
  WH.forEach((id, n) => {
    const l = LN[id]; if (t < l.t - 1) return;
    const words = l.s.split(" ");
    font(ctx, 44, "Redaction"); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const sp = ctx.measureText(" ").width, total = ctx.measureText(l.s).width;
    let cx = STAGE.x + (STAGE.w - total) / 2; const cy = STAGE.y + 570 + n * 72;
    words.forEach((wd, j) => {
      const ta = l.t + (j / words.length) * (l.end - l.t) * 0.8, k = smooth(span(t, ta - 0.9, ta));
      const [sx, sy] = src[(n + j) % src.length];
      const ww = ctx.measureText(wd).width;
      if (k > 0) {
        if (k < 1) {
          const px = lerp(sx, cx, k), py = lerp(sy, cy, k) - Math.sin(k * Math.PI) * 90;
          ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(px + ww / 2, py - 14, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(C.ink, 0.3 + 0.5 * k); ctx.fillText(wd, px, py);
        } else { ctx.fillStyle = C.ink; ctx.fillText(wd, cx, cy); }
      }
      cx += ww + sp;
    });
  });
}

// ---------------------------------------------------------------- the paper

function drawPaper(ctx, t) {
  const a = smooth(span(t, LN.m1.t - 0.3, LN.m1.t + 0.1)) * (1 - smooth(span(t, LN.v3.t - 0.4, LN.v3.t + 0.1)));
  if (!a) return;
  const pw = 680, ph = 800, x = STAGE.x + (STAGE.w - pw) / 2, y = STAGE.y + 15;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = C.paper; ctx.fillRect(x, y, pw, ph);
  ctx.fillStyle = C.paperInk; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  font(ctx, 15); ctx.fillText("Working Paper | 2026", x + 60, y + 66);
  font(ctx, 72, "Redaction"); ctx.fillText(PAPER.title, x + 60, y + 160);
  font(ctx, 28, "Redaction");
  wrap(ctx, PAPER.subtitle, pw - 120).forEach((l, i) => ctx.fillText(l, x + 60, y + 208 + i * 34));
  font(ctx, 18); ctx.fillText(PAPER.author, x + 60, y + 292);
  ctx.fillRect(x + 60, y + 318, pw - 120, 1.5);
  font(ctx, 16, "Space Mono", 700); ctx.fillText("Abstract", x + 60, y + 366);
  let caret = null;
  ["m1", "m2"].forEach((id, i) => {
    font(ctx, 38, "Redaction"); ctx.fillStyle = "#c2332a";
    const ls = wrap(ctx, typed(id, t), pw - 120);
    ls.forEach((l, j) => ctx.fillText(l, x + 60, y + 426 + i * 96 + j * 44));
    if (t >= LN[id].t && !done(id, t) && ls.length) caret = [x + 60 + ctx.measureText(ls[ls.length - 1]).width, y + 426 + i * 96 + (ls.length - 1) * 44];
  });
  if (caret) drawCaret(ctx, caret[0], caret[1], 38, t, null);
  ctx.fillStyle = C.paperInk;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 60, y + 620 + i * 22, (pw - 120) * (i === 5 ? 0.5 : 1), 6);
  if (t >= LN.m2.t + 1.6) { font(ctx, 14); ctx.fillText("¹ Eine Arbeitspraxis, keine evaluierte Methode.", x + 60, y + ph - 34); }
  ctx.restore();
}

// ---------------------------------------------------------------- the rush and the pull-back

const PW = 360, PH = 260;
const BBOX = (() => {
  const xs = SPIRAL.map(p => p[0]), ys = SPIRAL.map(p => p[1]);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
})();
const S_ALL = Math.min(STAGE.w / (BBOX.w * PW), STAGE.h / (BBOX.h * PH)) * 0.96;
// The camera rides the head of the spiral during the rush and only shows everything on "Who validates this?".
function camera(t) {
  const tf = frozenT(t), n = Math.max(3, spawned(tf));
  const nf = n - 1 + (n < MAXN ? span(tf, SPAWN[n - 1], SPAWN[n]) : 0);
  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < n; i++) { const wgt = Math.exp(-(nf - i) / 3); sx += SPIRAL[i][0] * wgt; sy += SPIRAL[i][1] * wgt; sw += wgt; }
  const s = lerp(1.0, 0.55, smooth(span(tf, EV.rushStart, LN.f1.t)));
  const pb = smooth(span(t, LN.who.t, LN.who.t + 2.4));
  return { cx: lerp(sx / sw, BBOX.cx, pb), cy: lerp(sy / sw, BBOX.cy, pb), s: lerp(s, S_ALL, pb) };
}
function cellRect(i, t) {
  const c = camera(t), [gx, gy] = SPIRAL[i];
  const px = STAGE.x + STAGE.w / 2 + (gx - c.cx) * PW * c.s, py = STAGE.y + STAGE.h / 2 + (gy - c.cy) * PH * c.s;
  return { x: px - 150 * c.s, y: py - 105 * c.s, w: 300 * c.s, h: 210 * c.s, s: c.s };
}

function drawRush(ctx, t) {
  if (t < LN.v3.t || t >= LN.r1.t) return;
  const tf = frozenT(t), n = spawned(tf), frozen = t >= EV.cut;
  const dimIch = t >= LN.ich.t && t < EV.enter + 0.8 ? 0.35 : 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(STAGE.x - 16, STAGE.y - 16, STAGE.w + 32, STAGE.h + 32); ctx.clip();
  const a0 = smooth(span(t, LN.v3.t, LN.v3.t + 0.4));
  for (let i = n - 1; i >= 1; i--) {
    const gone = span(t, VANISH[i], VANISH[i] + 0.35);
    if (gone >= 1) continue;
    const r = cellRect(i, t);
    if (r.x > STAGE.x + STAGE.w + 20 || r.x + r.w < STAGE.x - 20 || r.y > STAGE.y + STAGE.h + 20 || r.y + r.h < STAGE.y - 20) continue;
    const pop = frozen ? 1 : outBack(span(tf, SPAWN[i], SPAWN[i] + 0.18));
    const w = r.w * pop, h = r.h * pop;
    // unvalidated plans fade like unfixed prints in the light
    drawPlan(ctx, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, {
      type: TYPES[CELL_TYPE[i]], col: gone > 0 ? C.paper : frozen ? C.pale : C.line,
      alpha: a0 * dimIch * (1 - gone) * (t >= EV.enter ? 0.6 : 1), state: "open",
      title: r.s > 0.7 ? TYPES[CELL_TYPE[i]] : null,
    });
  }
  ctx.restore();
}

// The first artefact, the map he iterated on, is the one he validates and exposes.
const CHOSEN_END = { x: STAGE.x + STAGE.w - 460, y: STAGE.y + 20, w: 440, h: 280 };
function drawChosen(ctx, t) {
  if (t < LN.v3.t) return;
  const r = cellRect(0, t), up = smooth(span(t, EV.enter + 0.6, EV.enter + 1.4)), mv = smooth(span(t, LN.r1.t - 0.8, LN.r1.t + 0.8));
  const sc = lerp(1, 1.4, up);
  let w = r.w * sc, h = r.h * sc, x = r.x + r.w / 2 - w / 2, y = r.y + r.h / 2 - h / 2;
  x = lerp(x, CHOSEN_END.x, mv); y = lerp(y, CHOSEN_END.y, mv); w = lerp(w, CHOSEN_END.w, mv); h = lerp(h, CHOSEN_END.h, mv);
  const ok = t >= EV.enter + 0.6;
  const a0 = smooth(span(t, LN.v3.t, LN.v3.t + 0.4)) * (t >= LN.ich.t && t < EV.enter + 0.6 ? 0.5 : 1);
  if (w > 120) drawSheets(ctx, { x, y, w, h }, 2, a0);
  drawPlan(ctx, x, y, w, h, {
    type: "map", title: w > 240 ? "promptotype v3 | map" : null, alpha: a0, expose: up,
    col: t >= EV.cut ? C.pale : C.line, state: ok ? "valid" : "open",
  });
  return { x: x + w / 2, y: y + h / 2 };
}

function drawShouts(ctx, t) {
  for (const id of ["md1", "md2"]) {
    for (const ts of [LN[id].t, LN[id].second]) {
      if (t < ts || t > ts + 1.2) continue;
      const k = span(t, ts, ts + 0.2), a = 1 - span(t, ts + 0.8, ts + 1.2), first = ts === LN[id].t;
      const cy = STAGE.y + STAGE.h * (first ? 0.3 : 0.62);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = rgba(C.bg2, 0.92); ctx.fillRect(STAGE.x, cy - 95, STAGE.w, 190);
      ctx.translate(STAGE.x + STAGE.w / 2, cy); const sc = lerp(1.3, 1, outBack(k)); ctx.scale(sc, sc);
      ctx.textBaseline = "middle"; ctx.textAlign = "left";
      font(ctx, 150, "Space Mono", 700); const hw = ctx.measureText("# ").width;
      font(ctx, 150, "Redaction50"); const ww = ctx.measureText("MARKDOWN!").width;
      const x0 = -(hw + ww) / 2;
      font(ctx, 150, "Space Mono", 700); ctx.fillStyle = C.line; ctx.fillText("#", x0, 6);
      font(ctx, 150, "Redaction50"); ctx.fillStyle = C.mark; ctx.fillText("MARKDOWN!", x0 + hw, 10);
      ctx.restore();
    }
  }
  for (const id of ["sc1", "sc2"]) {
    const l = LN[id]; if (t < l.t || t >= l.end - 0.05) continue;
    ctx.fillStyle = rgba(C.bg2, 0.92); ctx.fillRect(STAGE.x, STAGE.y + STAGE.h / 2 - 80, STAGE.w, 160);
    font(ctx, 74, "Redaction50");
    const fit = Math.min(74, 74 * (STAGE.w - 80) / ctx.measureText(l.s).width);
    font(ctx, Math.floor(fit), "Redaction50"); ctx.fillStyle = C.mark; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(typed(id, t, 50), STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h / 2 + 6);
  }
}

// The final chorus as a multigraph of its own words: every repetition draws another arc.
const WORDS = ["Ich", "brauch", "keinen", "Developer", "mehr"];
const WPOS = [[0.56, 0.22], [0.8, 0.32], [0.84, 0.6], [0.64, 0.8], [0.4, 0.72]];
function drawChorusNet(ctx, t) {
  if (t < LN.f1.t || t >= LN.who.t + 0.8) return;
  const out = 1 - smooth(span(t, LN.who.t, LN.who.t + 0.8));
  const { x, y, w, h } = STAGE, frozen = t >= EV.cut;
  ctx.save(); ctx.globalAlpha = out * smooth(span(t, LN.f1.t, LN.f1.t + 0.3));
  ctx.fillStyle = rgba(C.bg, 0.62); ctx.fillRect(x - 16, y - 16, w + 32, h + 32);
  const P = [x + w * 0.22, y + h * 0.48];
  const pts = WPOS.map(([u, v]) => [x + u * w, y + v * h]);
  const t2 = [126.82, 126.84, 127.06, 127.40, 128.22], t4 = [132.98, 133.02, 133.22, LN.f4.develo];
  const chain = [P, ...pts, P];
  const col = frozen ? C.pale : C.line;
  const arc = (a, b, bend, k, dashedTail = false) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const cx = mx - dy / L * bend, cy = my + dx / L * bend;
    ctx.beginPath(); ctx.moveTo(...a);
    const n = 24, m = Math.floor(n * k);
    for (let i = 1; i <= m; i++) { const u = i / n; ctx.lineTo(lerp(lerp(a[0], cx, u), lerp(cx, b[0], u), u), lerp(lerp(a[1], cy, u), lerp(cy, b[1], u), u)); }
    ctx.stroke();
    if (dashedTail) {
      ctx.setLineDash([8, 8]); ctx.beginPath();
      for (let i = m; i <= n; i++) { const u = i / n, px = lerp(lerp(a[0], cx, u), lerp(cx, b[0], u), u), py = lerp(lerp(a[1], cy, u), lerp(cy, b[1], u), u); i === m ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  };
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  for (let j = 0; j < chain.length - 1; j++) {
    const first = j < WORDS.length ? t2[j] : LN.f3.t;
    if (t >= first) arc(chain[j], chain[j + 1], 18, span(t, first, first + 0.25));
  }
  // the second pass: "Develo—" never reaches its node
  for (let j = 0; j < 4; j++) {
    if (t < t4[j]) continue;
    const k = span(t, t4[j], t4[j] + 0.25);
    if (j === 3) { arc(chain[3], chain[4], -40, Math.min(k, 0.55), t >= t4[3] + 0.3); continue; }
    arc(chain[j], chain[j + 1], -40, k);
  }
  font(ctx, 66, "Redaction"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const pk = t >= LN.f3.t ? 1 + 0.15 * Math.exp(-(t - LN.f3.t) / 0.4) : 1;
  const node = (label, px, py, size, dashed = false) => {
    font(ctx, size, "Redaction"); const tw = ctx.measureText(label || "per").width + 36;
    ctx.fillStyle = C.bg; ctx.fillRect(px - tw / 2, py - size * 0.75, tw, size * 1.5);
    ctx.strokeStyle = dashed ? C.pale : col; ctx.lineWidth = 2; if (dashed) ctx.setLineDash([8, 8]);
    ctx.strokeRect(px - tw / 2, py - size * 0.75, tw, size * 1.5); ctx.setLineDash([]);
    if (label) { ctx.fillStyle = frozen ? rgba(C.ink, 0.7) : C.ink; ctx.fillText(label, px, py + 4); }
  };
  ctx.save(); ctx.translate(...P); ctx.scale(pk, pk); node("PROMPTOTYPING", 0, 0, 64); ctx.restore();
  WORDS.forEach((wd, j) => {
    if (t < t2[j]) return;
    const [px, py] = pts[j];
    if (wd === "Developer" && t >= LN.f4.develo + 0.3) {
      font(ctx, 54, "Redaction"); const a = ctx.measureText("Develo").width + 36, b = ctx.measureText("per").width + 36;
      node("Develo", px - b / 2, py, 54); node(null, px + a / 2 + 6, py, 54, true);
      return;
    }
    node(wd, px, py, 54);
  });
  ctx.restore();
}

// ---------------------------------------------------------------- validation

function drawValidation(ctx, t, chosen) {
  if (t < LN.who.t || t >= LN.r1.t) return;
  const a = smooth(span(t, LN.who.t + 1.0, LN.who.t + 1.5)) * (1 - smooth(span(t, LN.r1.t - 0.8, LN.r1.t)));
  const v = validated(t);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = C.bg; ctx.fillRect(STAGE.x - 4, 62, STAGE.w + 8, 70);
  font(ctx, 46, "Space Mono", 700); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.line; let xx = spaced(ctx, `built ${built(t)}`, STAGE.x, BAND_Y, 2);
  ctx.fillStyle = C.faint; xx = spaced(ctx, "  |  ", xx, BAND_Y, 2);
  ctx.fillStyle = v ? C.mark : C.line; spaced(ctx, `validated ${v}`, xx, BAND_Y, 2);
  ctx.restore();
  // question and answer at the prompt
  const py = 1048;
  ctx.fillStyle = C.bg; ctx.fillRect(STAGE.x - 20, 992, STAGE.w + 40, 88);
  font(ctx, 26); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.line; ctx.fillText("> " + typed("who", t, 30), STAGE.x, py - 34);
  if (t >= LN.ich.t - 0.4) { ctx.fillStyle = C.mark; ctx.fillText("researcher> ", STAGE.x, py); }
  const px = STAGE.x + 200;
  // "Ich." is the largest moment: alone and huge, then it settles into the prompt and draws a line to the plan
  if (t >= LN.ich.t) {
    const settle = smooth(span(t, EV.enter, EV.enter + 0.6));
    const cx = lerp(STAGE.x + STAGE.w / 2, px + 26, settle), cy = lerp(STAGE.y + STAGE.h / 2 + 60, py, settle);
    const size = lerp(220 * outBack(span(t, LN.ich.t, LN.ich.t + 0.2)), 30, settle);
    if (size > 1) {
      ctx.save(); font(ctx, size, settle > 0.8 ? "Redaction" : "Redaction50"); ctx.fillStyle = C.mark;
      ctx.textAlign = settle > 0.5 ? "left" : "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("Ich.", settle > 0.5 ? px : cx, cy);
      ctx.restore();
    }
    if (chosen && t >= EV.enter + 0.2) {
      const k = span(t, EV.enter + 0.2, EV.enter + 0.7);
      pencil(ctx, [[px + 30, py - 30], [lerp(px + 30, chosen.x, k), lerp(py - 30, chosen.y, k)]], 1, C.mark, 4);
    }
    if (t < EV.enter) drawCaret(ctx, px + 2, py, 28, t, null);
  } else if (t >= LN.ich.t - 0.4) drawCaret(ctx, px, py, 28, t, "researcher");
}

// ---------------------------------------------------------------- the diff

const DIFF = [
  { id: "r1", old: "Ich hab kein Lied, nur eine Idee" },
  { id: "r2", old: null },
  { id: "r3", old: "Kein Geld und kein Developer," },
  { id: "r4", old: "nur Markdown und Kaffee." },
];
function drawDiff(ctx, t) {
  if (t < LN.r1.t - 0.4) return;
  const a = smooth(span(t, LN.r1.t - 0.4, LN.r1.t + 0.4));
  const x = STAGE.x + 20, y = STAGE.y + 310, w = STAGE.w - 40, h = 400;
  ctx.save(); ctx.globalAlpha = a;
  drawPlan(ctx, x, y, w, h, { title: "idee.md | diff", col: C.pale });
  font(ctx, 18); ctx.fillStyle = C.faint; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("@@ idee.md @@", x + 30, y + 46);
  let yy = y + 90, caret = null;
  DIFF.forEach(d => {
    const l = LN[d.id], show = t >= l.t - 0.6;
    if (d.old) {
      font(ctx, 24, "Space Mono", 700); ctx.fillStyle = C.pale; ctx.fillText("-", x + 30, yy);
      font(ctx, 36, "Redaction"); ctx.fillStyle = rgba(C.ink, 0.55); ctx.fillText(d.old, x + 70, yy);
      if (show) { const k = span(t, l.t - 0.6, l.t - 0.1); ctx.fillStyle = C.mark; ctx.fillRect(x + 66, yy - 12, (ctx.measureText(d.old).width + 8) * k, 4); }
      yy += 40;
      if (show) {
        const s = typed(d.id, t);
        font(ctx, 24, "Space Mono", 700); ctx.fillStyle = C.mark; ctx.fillText("+", x + 30, yy);
        font(ctx, 40, "Redaction"); ctx.fillStyle = C.ink; ctx.fillText(s, x + 70, yy);
        if (t < l.end) caret = [x + 70 + ctx.measureText(s).width, yy];
        yy += 50;
      } else yy += 8;
    } else {
      font(ctx, 36, "Redaction"); ctx.fillStyle = rgba(C.ink, 0.8);
      ctx.fillText(show ? typed(d.id, t) : "und alles, was ich versteh.", x + 70, yy);
      yy += 50;
    }
  });
  if (caret) drawCaret(ctx, caret[0], caret[1], 40, t, t >= LN.r4.t ? caretLabel(t) : null);
  ctx.restore();
  if (t >= LN.r4.t + 2.2) {
    const k = smooth(span(t, LN.r4.t + 2.2, LN.r4.t + 2.8));
    font(ctx, 20); ctx.fillStyle = rgba(C.pale, k); ctx.textAlign = "left";
    ctx.fillText("commit e1n5a1d", STAGE.x + 20, 900);
    ctx.fillText("Author: researcher | developer", STAGE.x + 20, 930);
    font(ctx, 30, "Redaction"); ctx.fillStyle = rgba(C.ink, k);
    ctx.fillText("Ich bin jetzt selber einer.", STAGE.x + 20, 970);
    drawCup(ctx, STAGE.x + STAGE.w - 70, 940, 1.2, rgba(C.pale, k), k, t);
  }
}

// ---------------------------------------------------------------- the mirror axis

// Dashed through the video; on "selber einer" it zips shut from both ends and is gone.
function drawAxis(ctx, t) {
  const z = smooth(span(t, EV.axisOff, EV.axisOff + 1.4));
  if (z >= 1) return;
  const top = 64, bot = 1066, mid = (top + bot) / 2;
  const y0 = lerp(top, mid, z), y1 = lerp(bot, mid, z);
  ctx.save(); ctx.strokeStyle = z > 0 ? C.mark : rgba(C.pale, 0.55); ctx.lineWidth = z > 0 ? 3 : 1.5;
  if (!z) ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.moveTo(AXIS_X, y0); ctx.lineTo(AXIS_X, y1); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- frame

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  drawGround(ctx, t);
  drawAxis(ctx, t);
  drawCycle(ctx, t);
  const boxes = drawColumn(ctx, t);

  drawMaterial(ctx, t);
  drawV1(ctx, t, boxes);
  drawDistill(ctx, t);
  if (t < LN.ctx.t) { drawV2(ctx, t); drawFast(ctx, t); }
  drawSession(ctx, t, boxes);
  drawPaper(ctx, t);
  drawRush(ctx, t);
  const chosen = drawChosen(ctx, t);
  drawShouts(ctx, t);
  drawChorusNet(ctx, t);
  drawValidation(ctx, t, chosen);
  drawDiff(ctx, t);
  if (t < LN.who.t) drawTerminal(ctx, t);
  drawStamp(ctx, t);
  drawGloss(ctx, t);

  drawStatus(ctx, t);
  const end = smooth(span(t, EV.fadeOut, SCENE_END));
  if (end > 0) { ctx.fillStyle = rgba(C.bg, end); ctx.fillRect(0, 0, W, H); }
}
