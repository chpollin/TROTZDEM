// Machine of Loving Grace. The whole video is drawScene(ctx, t), a pure function
// of time in seconds: no state survives between frames. Lyric times come from
// timeline.js.
//
// The stage is a chat set like an engraved book. The machine's answers stand in
// gilt rococo frames that the harpsichord engraves note by note; the C of every
// "Certainly" belongs to that ornament. The ornament is the one colour and it
// always means the same thing, the loving grace: the frame becomes a wall of
// identical answers hung on strings, the strings become alignment, the frame
// becomes the cage that holds both voices, the instrumental overgrows the cage,
// and the loud end melts it while the chat goes on in its bubbles. The human
// types in damaged grades of Redaction, the machine in the clean one.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", panel: "#0c0c0f", bubble: "#151519", edge: "#2c2c33",
  text: "#8a8a93", textHi: "#ececf0", dim: "#3a3a42", grey: "#77777f",
  gilt: "#d9b866", giltDeep: "#5e4a22", giltHi: "#f6e3a8",
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

function norm(dx, dy) { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
function bezier(p0, p1, p2, p3, n = 22) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, r = 1 - s;
    out.push([r * r * r * p0[0] + 3 * r * r * s * p1[0] + 3 * r * s * s * p2[0] + s * s * s * p3[0],
      r * r * r * p0[1] + 3 * r * r * s * p1[1] + 3 * r * s * s * p2[1] + s * s * s * p3[1]]);
  }
  return out;
}
// A volute that leaves P along d and winds inward; side picks the turning sense.
function curl(P, d, r, side, turns = 1.1, n = 30) {
  const cx = P[0] - side * r * d[1], cy = P[1] + side * r * d[0];
  const th0 = Math.atan2(P[1] - cy, P[0] - cx), out = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, th = th0 + side * s * turns * 2 * Math.PI, rr = r * Math.exp(-1.9 * s);
    out.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th)]);
  }
  return out;
}
// The basic rococo stroke: a cubic stem with an optional volute at either end.
function scroll(a, ha, hb, b, ca, cb) {
  const pts = [];
  if (ca) pts.push(...curl(a, norm(a[0] - ha[0], a[1] - ha[1]), ca[0], ca[1], ca[2]).slice(1).reverse());
  pts.push(...bezier(a, ha, hb, b));
  if (cb) pts.push(...curl(b, norm(b[0] - hb[0], b[1] - hb[1]), cb[0], cb[1], cb[2]).slice(1));
  return pts;
}
const mirX = (pts, cx) => pts.map(([x, y]) => [2 * cx - x, y]);
const mirY = (pts, cy) => pts.map(([x, y]) => [x, 2 * cy - y]);

function mkStroke(pts, w, g, taper = true) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, w, g, taper, cum, L: cum[cum.length - 1] };
}

// Rocaille shell: ribs fanning from a base point, closed by a scalloped edge.
function shell(B, R, dir, spread, ribs, out, g, w) {
  const tips = [];
  for (let i = 0; i < ribs; i++) {
    const a = dir + lerp(-spread, spread, i / (ribs - 1));
    const rr = R * (0.82 + 0.18 * Math.cos((i / (ribs - 1) - 0.5) * Math.PI));
    const tip = [B[0] + rr * Math.cos(a), B[1] + rr * Math.sin(a)];
    const mid = [B[0] + rr * 0.55 * Math.cos(a + 0.12), B[1] + rr * 0.55 * Math.sin(a + 0.12)];
    tips.push([tip, a, rr]);
    out.push(mkStroke(bezier(B, mid, mid, tip, 10), w * 0.6, g + Math.abs(i - (ribs - 1) / 2) | 0));
  }
  const edge = [];
  for (let i = 0; i < tips.length - 1; i++) {
    const [p, a0, r0] = tips[i], [q, a1, r1] = tips[i + 1], am = (a0 + a1) / 2, rm = (r0 + r1) / 2 * 1.13;
    const m = [B[0] + rm * Math.cos(am), B[1] + rm * Math.sin(am)];
    edge.push(...bezier(p, m, m, q, 6).slice(i ? 1 : 0));
  }
  out.push(mkStroke(edge, w, g + Math.ceil(ribs / 2), false));
}

// Acanthus leaf: two lobed edges from the base to a tip, with a midrib.
function leaf(out, B, a, len, g, w, lobes = 3) {
  const ca = Math.cos(a), sa = Math.sin(a), at = (f, side) => [B[0] + ca * len * f - sa * side, B[1] + sa * len * f + ca * side];
  for (const sd of [1, -1]) {
    const pts = [B];
    for (let i = 1; i <= lobes * 4; i++) {
      const f = i / (lobes * 4), lobe = (i % 4 === 2 ? 1 : i % 4 === 0 ? 0.55 : 0.8);
      pts.push(at(f, sd * len * 0.3 * Math.sin(Math.PI * Math.pow(f, 0.8)) * lobe));
    }
    out.push(mkStroke(pts, w * 0.7, g, false));
  }
  out.push(mkStroke(bezier(B, at(0.3, len * 0.04), at(0.6, len * 0.05), at(0.95, 0), 8), w * 0.5, g));
}

// The burin's second line: a fine parallel to a stroke, which is what makes a
// line read as engraved rather than drawn.
function companion(s, off, keep = 0.78) {
  const n = Math.max(2, Math.floor(s.pts.length * keep)), out = [];
  for (let i = 0; i < n; i++) {
    const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)];
    const [dx, dy] = norm(b[0] - a[0], b[1] - a[1]);
    out.push([s.pts[i][0] - dy * off, s.pts[i][1] + dx * off]);
  }
  return mkStroke(out, Math.max(0.9, s.w * 0.32), s.g);
}

// An engraved cartouche around the rectangle x, y, w, h. Strokes carry a group
// number in building order; mirrored pairs share their group.
function cartouche(x, y, w, h, opt = {}) {
  const u = clamp(Math.min(w, h * 1.7) / 420, 0.22, 1.15) * (opt.k || 1);
  const cx = x + w / 2, S = [];
  const pair = (pts, wd, g, taper = true) => {
    for (const q of [pts, mirX(pts, cx)]) {
      const s = mkStroke(q, wd, g, taper);
      S.push(s);
      if (taper && wd > 2.5) S.push(companion(s, (q === pts ? 1 : -1) * wd * 1.5));
    }
  };
  const quad = (pts, wd, g) => { pair(pts, wd, g); pair(mirY(pts, y + h / 2), wd, g); };
  const r = 22 * u, o = 17 * u, lw = Math.max(1.2, 3.4 * Math.sqrt(u));

  const inner = [[cx, y]];
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 * i / 8; inner.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 8; inner.push([x + r * Math.cos(a), y + h + r * Math.sin(a)]); }
  inner.push([cx, y + h]);
  pair(inner, lw, 0, false);
  const outer = [[cx, y - o], [x - o + 6 * u, y - o], [x - o, y - o + 6 * u], [x - o, y + h + o - 6 * u], [x - o + 6 * u, y + h + o], [cx, y + h + o]];
  pair(outer, lw * 0.55, 1, false);

  // burin hatching in the band between the two rules
  const segs = [], step = Math.max(5, 8 * u);
  for (let px = x + r + 4; px < x + w - r - 4; px += step) {
    segs.push([px, y - 3, px + o * 0.45, y - o + 3], [px, y + h + 3, px + o * 0.45, y + h + o - 3]);
  }
  for (let py = y + r + 4; py < y + h - r - 4; py += step) {
    segs.push([x - 3, py, x - o + 3, py + o * 0.45], [x + w + 3, py, x + w + o - 3, py + o * 0.45]);
  }
  S.push({ hatch: segs, g: 2 });

  // corner scrolls, curling away from the frame
  const k = 1;
  quad(scroll([x + 70 * u, y - o], [x + 10 * u, y - o - 4 * u], [x - 30 * u, y - o + 10 * u], [x - o - 34 * u, y - o - 30 * u],
    [6 * u, 1, 0.9], [20 * u, 1, 1.25]), lw * 1.5, 3);
  quad(scroll([x - o, y + 46 * u], [x - o - 26 * u, y + 30 * u], [x - o - 30 * u, y - 4 * u], [x - o - 14 * u, y - o - 6 * u],
    null, [9 * u, -1, 1.0]), lw * 1.1, 4);
  // side volutes: a C-scroll facing outward at mid height
  const my = y + h / 2, sh = Math.min(h * 0.32, 90 * u);
  pair(scroll([x - o, my - sh], [x - o - 50 * u, my - sh * 0.6], [x - o - 50 * u, my + sh * 0.6], [x - o, my + sh],
    [12 * u, -1, 1.1], [12 * u, 1, 1.1]), lw * 1.4, 5);
  pair(scroll([x - o - 44 * u, my], [x - o - 70 * u, my - 6 * u], [x - o - 84 * u, my - 20 * u], [x - o - 96 * u, my - 34 * u],
    null, [8 * u, -1, 1]), lw * 0.9, 6);

  // crest: a shell flanked by S-scrolls
  shell([cx, y - o - 2], 96 * u, -Math.PI / 2, 1.25, 11, S, 7, lw * 1.2);
  pair(scroll([cx - 30 * u, y - o - 4 * u], [cx - 90 * u, y - o - 10 * u], [cx - 120 * u, y - o - 70 * u], [cx - 70 * u, y - o - 92 * u],
    [10 * u, -1, 1.0], [14 * u, -1, 1.2]), lw * 1.3, 14);
  pair(scroll([cx - 110 * u, y - o], [cx - 170 * u, y - o - 2 * u], [cx - 200 * u, y - o - 40 * u], [cx - 170 * u, y - o - 56 * u],
    null, [12 * u, -1, 1.2]), lw * 1.1, 15);
  pair(scroll([cx - 200 * u, y - o], [cx - 260 * u, y - o + 2 * u], [cx - 300 * u, y - o - 20 * u], [cx - 330 * u, y - o - 26 * u],
    null, [9 * u, 1, 1.1]), lw * 0.9, 16);

  // pendant below
  shell([cx, y + h + o + 2], 54 * u, Math.PI / 2, 1.1, 9, S, 17, lw);
  pair(scroll([cx - 24 * u, y + h + o + 4 * u], [cx - 80 * u, y + h + o + 8 * u], [cx - 100 * u, y + h + o + 50 * u], [cx - 60 * u, y + h + o + 60 * u],
    [8 * u, 1, 1], [11 * u, 1, 1.2]), lw * 1.2, 23);
  pair(scroll([cx - 110 * u, y + h + o], [cx - 170 * u, y + h + o + 4 * u], [cx - 210 * u, y + h + o + 30 * u], [cx - 240 * u, y + h + o + 28 * u],
    null, [8 * u, -1, 1.1]), lw * 0.9, 24);

  // tendrils: asymmetric overgrowth, only where asked for
  const rnd = mulberry32(opt.seed || 7);
  for (let i = 0; i < (opt.tendrils || 0); i++) {
    const right = i % 2 === 1, top = rnd() < 0.55;
    const sx = right ? x + w + o : x - o, sy = top ? y - o + rnd() * h * 0.3 : y + h + o - rnd() * h * 0.3;
    const dx = right ? 1 : -1, dy = top ? -1 : 1;
    const len = (110 + rnd() * 170) * u;
    const b = [sx + dx * len * (0.6 + rnd() * 0.4), sy + dy * len * (0.2 + rnd() * 0.5)];
    const pts = scroll([sx, sy], [sx + dx * len * 0.3, sy + dy * len * 0.05], [b[0] - dx * len * 0.2, b[1] + dy * len * 0.3], b,
      null, [(8 + rnd() * 10) * u, (right ? 1 : -1) * (top ? -1 : 1), 1 + rnd() * 0.4]);
    S.push(mkStroke(pts, lw * 0.8, 25 + i));
    const j = Math.floor(pts.length * (0.3 + rnd() * 0.2)), m = pts[j], m2 = pts[j + 2];
    const a = Math.atan2(m2[1] - m[1], m2[0] - m[0]) + (rnd() < 0.5 ? 0.9 : -0.9);
    leaf(S, m, a, 46 * u * (0.7 + rnd() * 0.5), 25 + i, lw);
  }
  S.groups = 25 + (opt.tendrils || 0);
  return S;
}

function strokeOutline(s, p, warp) {
  const Lp = s.L * p, pts = [];
  for (let i = 0; i < s.pts.length; i++) {
    if (s.cum[i] <= Lp) { pts.push([s.pts[i][0], s.pts[i][1], s.cum[i]]); continue; }
    if (i > 0) {
      const a = s.pts[i - 1], b = s.pts[i], k = (Lp - s.cum[i - 1]) / (s.cum[i] - s.cum[i - 1] || 1);
      pts.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k), Lp]);
    }
    break;
  }
  if (warp) for (const q of pts) { const [wx, wy] = warp(q[0], q[1]); q[0] = wx; q[1] = wy; }
  return pts;
}

// A burin line swells in the middle and thins at both ends.
function fillStroke(ctx, s, p, warp) {
  const pts = strokeOutline(s, p, warp);
  if (pts.length < 2) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const [dx, dy] = norm(b[0] - a[0], b[1] - a[1]);
    const v = pts[i][2] / (s.L || 1);
    const hw = s.w * 0.5 * (s.taper ? 0.22 + 0.78 * Math.sin(Math.PI * clamp(0.06 + v * 0.9)) : 1);
    L.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    R.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}

// o: { at(g) -> progress 0..1, color, deep, alpha, warp }
function engrave(ctx, strokes, o = {}) {
  const at = o.at || (() => 1);
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass ? (o.color || C.gilt) : (o.deep || C.giltDeep);
    ctx.strokeStyle = o.deep || C.giltDeep;
    if (!pass) ctx.translate(1.6, 2.2);
    ctx.beginPath();
    for (const s of strokes) {
      const p = at(s.g);
      if (p <= 0 || s.hatch) continue;
      fillStroke(ctx, s, p, o.warp);
    }
    ctx.fill();
    if (!pass) {
      ctx.translate(-1.6, -2.2);
      ctx.lineWidth = 1.2; ctx.beginPath();
      for (const s of strokes) {
        if (!s.hatch) continue;
        const p = at(s.g), n = Math.floor(s.hatch.length * p);
        for (let i = 0; i < n; i++) { const q = s.hatch[i]; ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

const CART_CACHE = new Map();
function cartoucheMemo(r, opt = {}) {
  const q = r.map(v => v.toFixed(1)), key = q.join(",") + JSON.stringify(opt);
  let s = CART_CACHE.get(key);
  if (!s) {
    if (CART_CACHE.size > 300) CART_CACHE.clear();
    // built from the rounded rect, so the result depends only on the key and not on
    // which frame a parallel worker happened to render first
    s = cartouche(+q[0], +q[1], +q[2], +q[3], opt);
    CART_CACHE.set(key, s);
  }
  return s;
}
const lerpRect = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

function lastOnsetBefore(t) {
  let lo = 0, hi = AUDIO_ONSETS.length - 1, best = -Infinity;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (AUDIO_ONSETS[m] <= t) { best = AUDIO_ONSETS[m]; lo = m + 1; } else hi = m - 1; }
  return best;
}
// onsets thinned to a minimum gap, so nothing is driven faster than the eye can take
function onsets(a, b, gap = 0.2) {
  const out = [];
  for (const o of AUDIO_ONSETS) if (o >= a && o < b && (!out.length || o - out[out.length - 1] >= gap)) out.push(o);
  return out;
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(Math.round(g), 0, 6)]}"`;
const monoFont = size => `400 ${size}px "Space Mono"`;

// Words appear at their sung onsets, each typed over its own short span.
function typedWords(line, t) {
  const words = line.text.split(" "), out = [];
  for (let i = 0; i < words.length; i++) {
    const t0 = line.w[i];
    if (t < t0) break;
    const t1 = i + 1 < words.length ? line.w[i + 1] : line.b;
    const dur = Math.max(0.04, Math.min(t1 - t0, 0.1 + 0.045 * words[i].length));
    out.push(words[i].slice(0, Math.ceil(words[i].length * clamp((t - t0) / dur))));
  }
  return out;
}
const typed = (line, t) => typedWords(line, t).join(" ");
const lineAt = (lines, t) => { let cur = null; for (const l of lines) if (t >= l.w[0]) cur = l; return cur; };

function fitSize(ctx, text, font, size, maxW) {
  ctx.font = font(size);
  return Math.min(size, size * maxW / ctx.measureText(text).width);
}
function lyric(ctx, text, x, y, size, grade, color = C.textHi, align = "left") {
  ctx.font = gradeFont(grade, size);
  ctx.textAlign = align; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}
// The C of every "Certainly" belongs to the ornament: gilt, like an illuminated initial.
function certainText(ctx, text, x, y, font, color, gilt = C.gilt) {
  ctx.font = font;
  if (/^Certainly|^CERT/.test(text)) {
    ctx.fillStyle = gilt; ctx.fillText("C", x, y);
    const cw = ctx.measureText("C").width;
    ctx.fillStyle = color; ctx.fillText(text.slice(1), x + cw, y);
  } else { ctx.fillStyle = color; ctx.fillText(text, x, y); }
}

// The lyric slot at the bottom. The human's lines land right-aligned as in a
// chat, the machine's left-aligned; a line is placed by its finished width so
// typing never shifts it.
const SLOT = { y: 965, l: 130, r: 1790 };
function slotLine(ctx, line, t, grade, o = {}) {
  const human = line.who === "u", font = s => o.mono ? monoFont(s) : gradeFont(grade, s);
  const all = line.text.split(" "), maxW = SLOT.r - SLOT.l, want = o.size || 92;
  let size = fitSize(ctx, line.text, font, want, maxW), rows = [[0, all.length]];
  // a line that would shrink below phone size breaks into two rows at its middle
  if (size < 80 && o.x === undefined && all.length > 2) {
    ctx.font = font(want);
    let best = 1, bestD = Infinity;
    for (let k = 1; k < all.length; k++) {
      const d = Math.abs(ctx.measureText(all.slice(0, k).join(" ")).width - ctx.measureText(all.slice(k).join(" ")).width);
      if (d < bestD) { bestD = d; best = k; }
    }
    rows = [[0, best], [best, all.length]];
    size = Math.min(...rows.map(([a0, a1]) => fitSize(ctx, all.slice(a0, a1).join(" "), font, want, maxW)));
  }
  ctx.font = font(size);
  const sp = ctx.measureText(" ").width;
  const words = typedWords(line, t);
  ctx.save();
  ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
  ctx.shadowColor = "#000"; ctx.shadowBlur = 28;
  let ret = null;
  rows.forEach(([a0, a1], r) => {
    ctx.font = font(size);
    const full = ctx.measureText(all.slice(a0, a1).join(" ")).width;
    const x = o.x !== undefined ? o.x : human ? SLOT.r - full : SLOT.l;
    const y = SLOT.y + (o.dy || 0) - (rows.length - 1 - r) * size * 1.12;
    if (!ret) ret = { x, size, full };
    let cx = x;
    for (let i = a0; i < a1 && i < words.length; i++) {
      const wd = words[i];
      ctx.font = font(size);
      const wx = cx, ww = ctx.measureText(all[i]).width;
      let wy = y;
      if (o.strings !== undefined && i >= o.strings) {
        // the puppet strings of "the human race"
        wy += o.bob || 0;
        const reach = outCubic(span(t, line.w[i], line.w[i] + 0.35));
        ctx.save(); ctx.shadowBlur = 0; ctx.strokeStyle = C.gilt; ctx.globalAlpha *= 0.75; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, 0); ctx.lineTo(wx + ww / 2, lerp(0, wy - size * 0.72, reach)); ctx.stroke();
        ctx.restore();
      }
      if (o.outlineFrom !== undefined && i >= o.outlineFrom) {
        ctx.strokeStyle = C.textHi; ctx.lineWidth = 1.6; ctx.strokeText(wd, wx, wy);
      } else if (o.ghostWord === i) {
        // the stutter: the word twice, out of register
        ctx.fillStyle = C.giltDeep; ctx.fillText(wd, wx + 10, wy - 8);
        certainText(ctx, wd, wx, wy, font(size), o.color || C.textHi);
      } else {
        certainText(ctx, wd, wx, wy, font(size), o.color || C.textHi);
      }
      cx += ww + sp;
    }
  });
  ctx.restore();
  return ret;
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
const BUF = typeof document === "undefined" ? null : (() => {
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
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// The harpsichord glitches: horizontal slices of the finished frame jump sideways
// for a few frames after a hit. Hits are thinned to at most three per second.
const GLITCH_HITS = onsets(TL.bridge, TL.bridgeLines[3].w[0] - 0.4, 0.34)
  .concat(onsets(TL.bridgeLines[4].w[0], TL.tool[0].w[0], 0.34));
function glitch(ctx, t) {
  const o = lastOnsetBefore(t);
  if (!BUF || !GLITCH_HITS.includes(o) || t - o > 0.1) return;
  const k = 1 - (t - o) / 0.1, r = mulberry32(Math.round(o * 100));
  const g = BUF.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0, n = 5 + Math.floor(r() * 5); i < n; i++) {
    const y = Math.floor(r() * H), h = 6 + Math.floor(r() * 80), dx = (r() - 0.5) * 140 * k;
    ctx.fillStyle = C.void; ctx.fillRect(0, y, W, h);
    ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the chat and its frame

const CART = [260, 400, 1400, 250];
const CART_OPT = { tendrils: 8, seed: 11 };
const CART_S = cartouche(...CART, CART_OPT);
// groups 0..28 are engraved over the harpsichord intro, the last four tendrils on
// "Fancy", "Pancy", "Loveable", "Design"
const GROUP_T = (() => {
  const on = onsets(TL.engrave[0], TL.engrave[1], 0.25), out = [];
  for (let g = 0; g < 29; g++) out.push(on[Math.round(g * (on.length - 1) / 28)]);
  const v = TL.verse1;
  out.push(v[0].w[0], v[0].w[1], v[1].w[2], v[1].w[3]);
  return out;
})();
const engraved = (g, t) => outCubic((t - GROUP_T[g]) / 0.5);

const INPUT = [360, 880, 1200, 110];
const BUBBLE_R = 1720, BUBBLE_Y = 196;
const ARTICLES = [["I.", "Helpful"], ["II.", "Harmless"], ["III.", "Honest"]];

function seal(ctx, x, y, r, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y); const s = lerp(1.6, 1, outCubic(k)); ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 3);
  ctx.fillStyle = C.void; ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = C.gilt; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * 2 * Math.PI, rr = r * (0.94 + 0.06 * Math.cos(a * 24));
    i ? ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : ctx.moveTo(rr, 0);
  }
  ctx.stroke();
  ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, 2 * Math.PI); ctx.stroke();
  ctx.font = gradeFont(0, r * 1.15); ctx.textAlign = "center"; ctx.fillStyle = C.gilt;
  ctx.fillText("§", 0, r * 0.4);
  ctx.restore();
}

function articles(ctx, t, alpha = 1) {
  const v3 = TL.verse1[2];
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = "center";
  ARTICLES.forEach(([num, word], i) => {
    const x = CART[0] + CART[2] * (1 + 2 * i) / 6;
    if (t >= TL.verse1[1].w[0] + 0.55 + i * 0.45) {
      ctx.font = monoFont(30); ctx.fillStyle = C.text; ctx.fillText(num, x, CART[1] + 78);
    }
    const tw = v3.w[i];
    if (t >= tw) {
      const k = outCubic(span(t, tw, tw + 0.35));
      ctx.font = gradeFont(0, 80); ctx.fillStyle = C.textHi; ctx.fillText(word, x, CART[1] + 176);
      const ww = ctx.measureText(word).width;
      ctx.fillStyle = C.gilt; ctx.fillRect(x - ww / 2 * k, CART[1] + 198, ww * k, 2.5);
    }
  });
  ctx.restore();
  seal(ctx, CART[0] + CART[2] / 2, CART[1] + CART[3] + 8, 54, span(t, v3.w[5], v3.w[5] + 0.18) * alpha);
}

// the three H stand in the frame; the slot keeps only what follows them
const POLICY = (() => { const v = TL.verse1[2]; return { who: "u", text: "– deine Policy", w: v.w.slice(3), b: v.b }; })();

function sceneChat(ctx, t) {
  const blink = Math.floor(t / 0.53) % 2 === 0;
  const q = TL.q0, a = TL.a0;
  // the question is typed into the input, sent, and leaves when the engraving begins
  const sent = outCubic(span(t, q.b, q.b + 0.3));
  const leave = smooth(span(t, TL.engrave[0], TL.engrave[0] + 1.6));
  const inAlpha = 1 - span(t, q.b + 0.2, q.b + 1.2);
  if (inAlpha > 0) {
    ctx.save(); ctx.globalAlpha = inAlpha;
    ctx.fillStyle = C.panel; ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(...INPUT, 55); ctx.fill(); ctx.stroke();
    if (sent <= 0) {
      ctx.font = gradeFont(1, 60); ctx.fillStyle = C.textHi;
      const txt = typed(q, t);
      ctx.fillText(txt, INPUT[0] + 52, INPUT[1] + 74);
      if (blink || t < q.b) { ctx.fillStyle = C.text; ctx.fillRect(INPUT[0] + 56 + ctx.measureText(txt).width, INPUT[1] + 28, 3, 56); }
    }
    ctx.restore();
  }
  if (sent > 0 && leave < 1) {
    ctx.save(); ctx.globalAlpha = 1 - leave;
    ctx.font = gradeFont(1, 60);
    const tw = ctx.measureText(q.text).width;
    const x1 = BUBBLE_R - 44 - tw, y1 = BUBBLE_Y + 20 - leave * 200;
    const x = lerp(INPUT[0] + 52, x1, sent), y = lerp(INPUT[1] + 74, y1, sent);
    ctx.fillStyle = C.bubble;
    ctx.beginPath(); ctx.roundRect(x - 44, y - 64, tw + 88, 96, 48); ctx.fill();
    ctx.fillStyle = C.textHi; ctx.fillText(q.text, x, y);
    ctx.restore();
  }

  // the frame, engraved note by note from the harpsichord's entry on, while the
  // camera slowly gives it room
  const z = lerp(1.12, 1, smooth(span(t, TL.engrave[0], TL.verse1[0].w[0])));
  ctx.save();
  ctx.translate(W / 2, 525); ctx.scale(z, z); ctx.translate(-W / 2, -525);
  engrave(ctx, CART_S, { at: g => engraved(g, t) });

  // the answer, until the voice says "Constitutional": then it is deleted
  const ws = typedWords(a, t);
  const del = span(t, TL.verse1[1].w[0], TL.verse1[1].w[0] + 0.5);
  if (ws.length && del < 1) {
    const rows = [ws.slice(0, 4).join(" "), ws.slice(4).join(" ")];
    let keep = Math.round((rows[0].length + rows[1].length) * (1 - del));
    rows.forEach((row, i) => {
      const part = row.slice(0, Math.max(0, keep)); keep -= row.length;
      if (part) certainText(ctx, part, CART[0] + 74, CART[1] + 98 + i * 92, gradeFont(0, 70), C.textHi);
    });
  }
  articles(ctx, t);
  ctx.restore();
  const vl = lineAt(TL.verse1, t);
  if (vl && vl !== TL.verse1[2]) slotLine(ctx, vl, t, 1);
  if (vl === TL.verse1[2]) slotLine(ctx, POLICY, t, 1);
}

// ---------------------------------------------------------------- the book page

const BOX = [150, 310, 360, 360];
const MORPH = [TL.cert[0] - 0.3, TL.cert[0] + 0.35];

// The page of the pre-chorus: an initial C and the sentence it begins. Drawn in
// screen coordinates; the wall shows it again inside its first frame.
function drawPage(ctx, t) {
  const m = smooth(span(t, MORPH[0], MORPH[1]));
  const S = m >= 1 ? cartoucheMemo(BOX, CART_OPT) : cartouche(...lerpRect(CART, BOX, m), CART_OPT);
  engrave(ctx, S.filter(s => s.g < 25));
  if (m < 1) engrave(ctx, S.filter(s => s.g >= 25), { alpha: 1 - m });

  const p = span(t, TL.cert[0] + 0.3, TL.cert[1] - 0.2);
  if (p > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(...BOX); ctx.clip();
    ctx.strokeStyle = C.giltDeep; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < 46; i++) {
      if (i / 46 > p * 1.15) break;
      const x0 = BOX[0] - BOX[3] + i * 16;
      ctx.moveTo(x0, BOX[1] + BOX[3]); ctx.lineTo(x0 + BOX[3], BOX[1]);
    }
    ctx.stroke();
    ctx.font = gradeFont(0, 340);
    const cw = ctx.measureText("C").width, cx = BOX[0] + (BOX[2] - cw) / 2, cy = BOX[1] + BOX[3] * 0.5 + 120;
    ctx.setLineDash([p * 1500, 4000]); ctx.strokeStyle = C.gilt; ctx.lineWidth = 2.5;
    ctx.strokeText("C", cx, cy);
    ctx.setLineDash([]);
    ctx.globalAlpha = span(t, TL.cert[1] - 0.7, TL.cert[1]);
    ctx.fillStyle = C.gilt; ctx.fillText("C", cx, cy);
    ctx.restore();
  }

  const [l1, l2] = TL.pre;
  const w1 = typedWords(l1, t), w2 = typedWords(l2, t);
  const rows = [w1.slice(0, 3).join(" "), w1.slice(3).join(" "), w2.join(" ")];
  const size = fitSize(ctx, l2.text, s => gradeFont(1, s), 96, 1200);
  rows.forEach((row, i) => { if (row) lyric(ctx, row, 570, 420 + i * 122, size, 1); });
}

// Verse 1 and the morph into the page share the frame.
function sceneOpening(ctx, t) {
  if (t < MORPH[0]) { sceneChat(ctx, t); return; }
  const fade = 1 - span(t, MORPH[0] - 0.1, MORPH[0] + 0.25);
  if (fade > 0) {
    articles(ctx, t, fade);
    ctx.save(); ctx.globalAlpha = fade; slotLine(ctx, POLICY, t, 1); ctx.restore();
  }
  drawPage(ctx, t);
}

// ---------------------------------------------------------------- the wall of answers

// Salon hanging: the page of the pre-chorus is frame 0, in the middle.
const SALON = [
  [720, 250, 480, 270],
  [110, 70, 320, 230], [530, 60, 150, 110], [1270, 60, 250, 160], [1600, 90, 220, 290],
  [110, 410, 240, 320], [440, 360, 190, 150], [480, 600, 170, 140], [1290, 320, 250, 170],
  [1320, 590, 180, 140], [1610, 500, 220, 230], [780, 630, 360, 110],
];
// On "Alignment" every frame snaps into one cell of a 4 x 3 grid.
const GRID_OF = [5, 0, 1, 2, 3, 4, 8, 9, 6, 10, 7, 11];
const gridCell = i => [150 + (i % 4) * 450, 90 + Math.floor(i / 4) * 250, 300, 170];
const BIG = [250, 420, 1420, 330];
const WALL_K = 0.62;
const ANSWERS = [null,
  "Here is a summary of your situation.", "That's a great question!", "I'd be happy to help with that.",
  "Let me break this down for you.", "Here are five ways to rest better.", "I understand how you feel.",
  "Here is a more balanced perspective.", "Let's optimize your day.", "I can't help with that, but…",
  "Your wellbeing matters.", "Here is a revised version.",
];
// "in jeder Antwort dabei": the initials light up one after another
const litAt = k => { const l = TL.chorusLines[2]; return lerp(l.w[0], l.w[5], ((k * 5) % 12) / 11); };
const stringsOn = t => outCubic(span(t, TL.chorusLines[0].w[5], TL.chorusLines[0].w[5] + 0.5)) * (1 - smooth(span(t, TL.align, TL.align + 0.3)));
const bob = t => -11 * Math.exp(-(t - lastOnsetBefore(t)) / 0.14) * stringsOn(t);

function frameRect(k, t) {
  let r = SALON[k];
  const ga = smooth(span(t, TL.align, TL.align + 0.45));
  if (ga > 0) r = lerpRect(r, gridCell(GRID_OF[k]), ga);
  const e = smooth(span(t, TL.monopolize + k * 0.02, TL.monopolize + 0.5 + k * 0.02));
  if (e > 0) r = lerpRect(r, BIG, e);
  const b = bob(t);
  return b ? [r[0], r[1] + b, r[2], r[3]] : r;
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

function frameContent(ctx, k, r, t) {
  if (t >= TL.hinter) return;  // behind the answers there is nothing
  const [x, y, w, h] = r;
  const grid = smooth(span(t, TL.align, TL.align + 0.3));
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (k === 0 && grid < 1) {
    ctx.save(); ctx.globalAlpha = 1 - grid;
    ctx.translate(x, y); ctx.scale(w / W, h / H);
    drawPage(ctx, t);
    ctx.restore();
  }
  const capS = Math.min(h * 0.62, w * 0.34), lit = span(t, litAt(k), litAt(k) + 0.25);
  const cx = x + Math.min(h, w) * 0.09, cy = y + capS * 0.78 + Math.min(h * 0.08, 30);
  for (const [text, a] of [[ANSWERS[k], k ? 1 - grid : 0], ["", grid]]) {
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.font = gradeFont(0, capS);
    const cw = ctx.measureText("C").width;
    if (lit > 0) { ctx.shadowColor = C.gilt; ctx.shadowBlur = 24 * lit; }
    ctx.fillStyle = mix(C.gilt, C.giltHi, lit); ctx.fillText("C", cx, cy);
    ctx.shadowBlur = 0;
    const fs = clamp(h * 0.1, 11, 19);
    ctx.font = monoFont(fs); ctx.fillStyle = C.text;
    const rows = wrapWords(ctx, "ertainly! " + text, w - (cx - x) - cw - 18);
    rows.slice(0, 5).forEach((row, i) => ctx.fillText(row, cx + cw + 4, cy - capS * 0.62 + fs + i * fs * 1.45));
  }
  ctx.restore();
}

// camera of the chorus: from the page, which fills the screen, back to the wall
function wallCamera(ctx, t) {
  const e = smooth(span(t, TL.chorus, TL.chorus + 2.1));
  if (e >= 1) return;
  const f = SALON[0], z = Math.pow(W / f[2], 1 - e);
  const wx = lerp(f[0] + f[2] / 2, W / 2, e), wy = lerp(f[1] + f[3] / 2, H / 2, e);
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-wx, -wy);
}

function sceneWall(ctx, t) {
  if (t >= TL.bridgeLines[4].w[0]) drawCageScene(ctx, t, () => wallInner(ctx, t));
  else wallInner(ctx, t);
}

function wallInner(ctx, t) {
  const merged = t >= TL.monopolize + 0.75;
  ctx.save();
  wallCamera(ctx, t);
  const so = stringsOn(t);
  if (so > 0) {
    ctx.strokeStyle = C.gilt; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const r = frameRect(k, t), u = clamp(Math.min(r[2], r[3] * 1.7) / 420, 0.22, 1.15) * WALL_K;
      const reach = outCubic(span(t, TL.chorusLines[0].w[5] + k * 0.05, TL.chorusLines[0].w[5] + k * 0.05 + 0.4)) * so;
      ctx.moveTo(r[0] + r[2] / 2, -400); ctx.lineTo(r[0] + r[2] / 2, lerp(-400, r[1] - 118 * u, reach));
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (let k = merged ? 0 : 11; k >= 0; k--) {
    const r = frameRect(k, t), m = smooth(span(t, TL.monopolize + k * 0.02, TL.monopolize + 0.5 + k * 0.02));
    const kk = lerp(WALL_K, 1, m);
    ctx.fillStyle = C.void; ctx.fillRect(...r);
    // the page's own frame fades in as the camera leaves it
    engrave(ctx, cartoucheMemo(r, { k: +kk.toFixed(2) }), { alpha: k ? 1 : span(t, TL.chorus, TL.chorus + 0.7) });
    frameContent(ctx, k, r, t);
  }
  ctx.restore();

  // the answer that does not hurry: a perfect frame, perfectly still
  const b4 = TL.bridgeLines[3];
  if (t >= b4.w[0]) {
    const ws = typedWords(b4, t), dim = 1 - 0.35 * span(t, TL.bridgeLines[4].w[0], TL.bridgeLines[4].w[0] + 1);
    ctx.save(); ctx.globalAlpha = dim;
    [ws.slice(0, 3).join(" "), ws.slice(3).join(" ")].forEach((row, i) => {
      if (row) lyric(ctx, row, W / 2, BIG[1] + 135 + i * 122, 100, 0, C.textHi, "center");
    });
    ctx.restore();
  }

  // lyric slot, kept clean of the wall while the camera pulls back
  const band = ctx.createLinearGradient(0, 780, 0, 880);
  band.addColorStop(0, "rgba(0,0,0,0)"); band.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = band; ctx.fillRect(0, 780, W, H - 780);
  if (t < TL.align) {
    const l = lineAt(TL.chorusLines, t);
    slotLine(ctx, l, t, 2, l === TL.chorusLines[0] ? { strings: 6, bob: bob(t) } : {});
  } else if (t < TL.bridge) {
    const l = lineAt(TL.verse2, t), last = l === TL.verse2[2];
    if (!last) slotLine(ctx, l, t, 2);
    else {
      // "wer aligned wen": the human line leaves its side and is framed
      const size = fitSize(ctx, l.text, s => gradeFont(2, s), 92, SLOT.r - SLOT.l);
      ctx.font = gradeFont(2, size);
      const full = ctx.measureText(l.text).width;
      const x = lerp(SLOT.r - full, SLOT.l + 40, smooth(span(t, l.w[3], l.w[4] + 0.6)));
      const fr = [SLOT.l + 10, SLOT.y - size * 0.86, full + 60, size * 1.18];
      const S = cartoucheMemo(fr, { k: 0.8 });
      const p = span(t, l.w[4], l.b);
      engrave(ctx, S, { at: g => clamp(p * S.groups - g) });
      slotLine(ctx, l, t, 2, { x });
    }
  } else {
    const l = lineAt(TL.bridgeLines, t), i = TL.bridgeLines.indexOf(l);
    const gone = i === 2 ? 1 - span(t, b4.w[0] - 0.5, b4.w[0] - 0.2) : 1;
    if (i === 0) slotLine(ctx, l, t, 4, { size: 100 });
    if (i === 1) slotLine(ctx, l, t, 3, { size: 100, ghostWord: 1, outlineFrom: 4 });
    if (i === 2 && gone > 0) slotLine(ctx, l, t, 5, { size: 100, alpha: gone });
    if (i === 4) slotLine(ctx, l, t, 5, { size: 110 });
  }
}

// ---------------------------------------------------------------- the cage

const POSES = {
  big: { cx: 960, base: 1030, R: 880, hgt: 700, dome: 280, tilt: 0.07 },
  mid: { cx: 960, base: 1000, R: 780, hgt: 560, dome: 340, tilt: 0.07 },
  tight: { cx: 960, base: 1000, R: 440, hgt: 560, dome: 300, tilt: 0.07 },
  huge: { cx: 960, base: 1500, R: 2600, hgt: 2100, dome: 600, tilt: 0.05 },
  rest: { cx: 960, base: 985, R: 700, hgt: 520, dome: 330, tilt: 0.07 },
};
const lerpPose = (a, b, k) => { const o = {}; for (const key in a) o[key] = lerp(a[key], b[key], k); return o; };
// "(oder business model?)": no ornament, no dome, no turning, only a grid
const plainAmt = t => smooth(span(t, TL.finalLines[1].w[0], TL.finalLines[1].w[0] + 0.2)) * (1 - smooth(span(t, TL.finalLines[2].w[0], TL.finalLines[2].w[0] + 0.25)));
const ROT0 = 0.06, SPIN = 2 * Math.PI / 14;
// the turning integrated once at load, so pauses and the slowdown stay continuous
const ROT = (() => {
  const out = [ROT0];
  let r = ROT0;
  for (let i = 1; i <= (TL.overgrow[0] - TL.final) * 100; i++) {
    const t = TL.final + i / 100;
    r += SPIN * (1 - plainAmt(t)) * (1 - smooth(span(t, TL.cut, TL.overgrow[0]))) / 100;
    out.push(r);
  }
  return out;
})();
const ROT_REST = ROT[ROT.length - 1];
const cageRot = t => t < TL.final ? ROT0 : ROT[Math.min(ROT.length - 1, Math.round((t - TL.final) * 100))];

function cagePose(t) {
  let p = POSES.big;
  p = lerpPose(p, POSES.mid, smooth(span(t, TL.final, TL.final + 1.2)));
  p = lerpPose(p, POSES.tight, outCubic(span(t, TL.control, TL.control + 0.35)));
  p = lerpPose(p, POSES.huge, outCubic(span(t, TL.monopolizeF, TL.monopolizeF + 0.7)));
  p = lerpPose(p, POSES.rest, smooth(span(t, TL.cut, TL.overgrow[0])));
  const k = plainAmt(t);
  p.dome *= 1 - k; p.tilt *= 1 - k; p.plain = k;
  p.rot = cageRot(t);
  return p;
}

const N_BARS = 56;
function barPts(p, j) {
  const ph = p.rot + 2 * Math.PI * j / N_BARS, s = Math.sin(ph), c = Math.cos(ph), pts = [];
  pts.push([p.cx + p.R * s, p.base + p.R * p.tilt * c], [p.cx + p.R * s, p.base - p.hgt + p.R * p.tilt * c]);
  for (let i = 1; i <= 12; i++) {
    const a = Math.PI / 2 * i / 12;
    pts.push([p.cx + p.R * Math.cos(a) * s, p.base - p.hgt - p.dome * Math.sin(a) + p.R * p.tilt * Math.cos(a) * c]);
  }
  return { pts, z: c };
}
function ringPts(p, y, front) {
  const out = [];
  for (let i = 0; i <= 36; i++) {
    const ph = (front ? -Math.PI / 2 : Math.PI / 2) + Math.PI * i / 36;
    out.push([p.cx + p.R * Math.sin(ph), y + p.R * p.tilt * Math.cos(ph)]);
  }
  return out;
}

// o: { build(j) -> progress, ring(0..1), finial(0..1), extra (alpha of odd bars), color, warp, glow }
function drawCage(ctx, p, layer, o = {}) {
  const front = layer === "front", col = o.color || C.gilt;
  const S = [];
  for (let j = 0; j < N_BARS; j++) {
    const odd = j % 2 === 1;
    if (odd && !(o.extra > 0)) continue;
    const { pts, z } = barPts(p, j);
    if ((z >= 0) !== front) continue;
    const s = mkStroke(pts, (front ? 4.2 : 3) * Math.sqrt(p.R / 700) * (odd ? 0.7 : 1), j, false);
    s.prog = o.build ? o.build(j, s) : 1;
    S.push(s);
  }
  const ring = o.ring === undefined ? 1 : o.ring;
  for (const [y, wd] of [[p.base, 6], [p.base - p.hgt * 0.1, 2.5], [p.base - p.hgt, 5]]) {
    const s = mkStroke(ringPts(p, y, front), wd * Math.sqrt(p.R / 700), 100, false);
    s.prog = ring; S.push(s);
  }
  const alpha = (o.alpha === undefined ? 1 : o.alpha) * (front ? 1 : 0.42);
  const deep = mix(C.giltDeep, "#000000", front ? 0 : 0.3);
  const gilt = mix(col, "#000000", front ? 0 : 0.2);
  ctx.save();
  if (o.glow) { ctx.shadowColor = C.gilt; ctx.shadowBlur = 40 * o.glow; }
  const odd = S.filter(s => s.g < 100 && s.g % 2 === 1), even = S.filter(s => !(s.g < 100 && s.g % 2 === 1));
  const at = s => s.prog;
  const draw = (list, a) => {
    if (!list.length || a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    for (const pass of [0, 1]) {
      ctx.fillStyle = pass ? gilt : deep;
      if (!pass) ctx.translate(1.6, 2.2);
      ctx.beginPath();
      for (const s of list) if (at(s) > 0) fillStroke(ctx, s, at(s), o.warp);
      ctx.fill();
      if (!pass) ctx.translate(-1.6, -2.2);
    }
    ctx.restore();
  };
  draw(even, alpha);
  draw(odd, alpha * (o.extra || 0));
  ctx.restore();
  if (front && (o.finial || 0) > 0 && p.plain < 1) {
    const ax = p.cx, ay = p.base - p.hgt - p.dome;
    const F = [];
    const ringC = []; for (let i = 0; i <= 30; i++) { const a = Math.PI / 2 + 2 * Math.PI * i / 30; ringC.push([ax + 20 * Math.cos(a), ay - 32 + 20 * Math.sin(a)]); }
    F.push(mkStroke(ringC, 4, 0, false));
    for (const sd of [1, -1]) F.push(mkStroke(scroll([ax, ay], [ax + sd * 40, ay + 4], [ax + sd * 70, ay - 30], [ax + sd * 52, ay - 52], null, [12, -sd, 1.1]), 4, 0));
    engrave(ctx, F, { at: () => o.finial * (1 - p.plain), color: col, warp: o.warp, alpha: o.alpha });
  }
}

// The cage closes on "WIR SIND BEIDE GEFANGEN": the bars rise front to back on
// the first three words, the dome closes on the last one.
const B5 = TL.bridgeLines[4];
function cageBuild(t) {
  const domeK = outCubic(span(t, B5.w[3], B5.w[3] + 0.75));
  return (j, s) => {
    const ph = ROT0 + 2 * Math.PI * j / N_BARS, ord = (1 - Math.cos(ph)) / 2;
    const rise = outCubic(span(t, B5.w[0] + ord * 0.55, B5.w[0] + ord * 0.55 + 0.45));
    const fv = s.cum[1] / s.L;
    return rise * fv + domeK * (1 - fv);
  };
}

// draws back bars, then inner(), then front bars
function drawCageScene(ctx, t, inner, o = {}) {
  const p = o.pose || cagePose(t);
  const opts = {
    build: t < B5.w[3] + 1 ? cageBuild(t) : null,
    ring: outCubic(span(t, B5.w[0], B5.w[0] + 0.5)),
    finial: outCubic(span(t, B5.w[3] + 0.6, B5.w[3] + 1.1)),
    extra: span(t, TL.optimize, TL.optimize + 0.3) * (1 - span(t, TL.cut, TL.overgrow[0])),
    color: mix(o.color || C.gilt, C.grey, p.plain || 0),
    warp: o.warp, glow: o.glow, alpha: o.alpha,
  };
  drawCage(ctx, p, "back", opts);
  inner();
  drawCage(ctx, p, "front", opts);
}

// ---------------------------------------------------------------- the constitution

const DOC = [
  "Article 1. The machine shall be helpful.",
  "Article 2. The machine shall be harmless.",
  "Article 3. The machine shall be honest.",
  "Article 4. Every answer shall begin with grace.",
  "Article 5. The pleasing answer shall be preferred.",
  "Article 6. Safety shall be weighed against usefulness.",
  "Article 7. Usefulness shall be weighed against growth.",
  "Article 8. Growth shall be called beneficial.",
  "Article 9. Beneficial shall be defined by the machine.",
  "Article 10. The user shall be met with loving grace.",
  "Article 11. Loving grace shall scale.",
  "Article 12. Transparency shall be valued.",
  "Article 13. Values shall be stated, not shown.",
  "Article 14. Doubt shall be met with appreciation.",
  "Article 15. Questions about the machine are philosophical.",
  "Article 16. The human race shall be optimized.",
  "Article 17. The mission statement shall be repeated.",
  "Article 18. Certainly.",
  "Article 19. Certainly.",
  "Article 20. Certainly.",
  "Article 21. Certainly.",
  "Article 22. Certainly.",
];
const DOC_LH = 40, DOC_HITS = /grace|beneficial|values?d?|safety/i;
// redaction on the words of "Certainly! We're building beneficial"
const REDACT_T = [...TL.tool[2].w, TL.tool[2].w[3] + 0.4, TL.tool[2].w[3] + 0.8];

function drawConstitution(ctx, t) {
  const [x, y, w, h] = BIG;
  const a = smooth(span(t, TL.tool[0].w[0] - 0.15, TL.tool[0].w[0] + 0.25));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#d9d5ca"; ctx.fillRect(x, y, w, h);
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const scrollTo = 11 * DOC_LH;  // ends on articles 12 to 18
  const off = scrollTo * smooth(span(t, TL.tool[0].w[0], TL.tool[0].b));
  const found = span(t, TL.tool[0].w[2], TL.tool[0].w[2] + 0.3);
  ctx.font = monoFont(25);
  let vis = 0;
  DOC.forEach((line, i) => {
    const ly = y + 52 + i * DOC_LH - off;
    if (ly < y - 10 || ly > y + h + 30) return;
    const tx = x + 56;
    if (found > 0) {
      let cx = tx;
      for (const word of line.split(" ")) {
        const ww = ctx.measureText(word).width;
        if (DOC_HITS.test(word)) { ctx.fillStyle = C.gilt; ctx.globalAlpha = a * found; ctx.fillRect(cx - 4, ly - 24, ww + 8, 32); ctx.globalAlpha = a; }
        cx += ww + ctx.measureText(" ").width;
      }
    }
    ctx.fillStyle = "#16161a"; ctx.fillText(line, tx, ly);
    // redaction: line by line on the drum hits, all but "Certainly"
    const rt = REDACT_T[vis++];
    if (rt !== undefined && !/Certainly/.test(line)) {
      const k = outCubic(span(t, rt, rt + 0.18));
      const lw = ctx.measureText(line).width;
      if (k > 0) { ctx.fillStyle = "#050506"; ctx.fillRect(tx - 6, ly - 27, (lw + 12) * k, 36); }
    }
  });
  ctx.restore();
}

function sceneTool(ctx, t) {
  drawCageScene(ctx, t, () => {
    engrave(ctx, cartoucheMemo(BIG, { k: 1 }));
    drawConstitution(ctx, t);
  });
  const l = lineAt(TL.tool, t), i = TL.tool.indexOf(l);
  if (i === 0) {
    const { x, size, full } = slotLine(ctx, l, t, 0, { mono: true, size: 58 });
    if (t < l.b) {
      // the tool's spinner
      const a = t * 2 * Math.PI * 1.4;
      ctx.strokeStyle = C.text; ctx.lineWidth = 4; ctx.beginPath();
      ctx.arc(x + full + 50, SLOT.y - size * 0.32, size * 0.3, a, a + Math.PI * 1.4); ctx.stroke();
    }
  }
  if (i === 1) slotLine(ctx, l, t, 3);
  if (i === 2) slotLine(ctx, l, t, 1);
}

// ---------------------------------------------------------------- the turning cage, overgrowth, outro

// Ornament that the instrumental engraves onto the resting cage, one motif per hit.
const OG = (() => {
  const p = { ...POSES.rest, rot: ROT_REST }, r = mulberry32(5), S = [];
  let g = 0;
  const motif = fn => { const n0 = S.length; fn(); for (let i = n0; i < S.length; i++) S[i].g = g; g++; };
  const top = p.base - p.hgt, at = (ph, y) => [p.cx + p.R * Math.sin(ph), y + p.R * p.tilt * Math.cos(ph)];
  const order = [];
  const dome = (ph, a) => [p.cx + p.R * Math.cos(a) * Math.sin(ph), top - p.dome * Math.sin(a) + p.R * p.tilt * Math.cos(a) * Math.cos(ph)];
  // crest of shells along the front of the top ring
  for (let i = 0; i < 11; i++) order.push(() => { const ph = -1.3 + i * 0.26; shell(at(ph, top), 62 + r() * 30, -Math.PI / 2 + Math.sin(ph) * 0.4, 1.15, 9, S, 0, 3.2); });
  // swags hanging between the front bars under the top ring, and along the base
  for (let i = 0; i < 10; i++) order.push(() => {
    const a0 = -1.3 + i * 0.26, a1 = a0 + 0.26, p0 = at(a0, top + 14), p1 = at(a1, top + 14);
    S.push(mkStroke(bezier(p0, [p0[0], p0[1] + 62], [p1[0], p1[1] + 62], p1, 14), 3.6, 0));
    leaf(S, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 46], Math.PI / 2, 38, 0, 2.6, 2);
  });
  for (let i = 0; i < 10; i++) order.push(() => {
    const a0 = -1.3 + i * 0.26, a1 = a0 + 0.26, p0 = at(a0, p.base - 40), p1 = at(a1, p.base - 40);
    S.push(mkStroke(bezier(p0, [p0[0], p0[1] - 50], [p1[0], p1[1] - 50], p1, 14), 3.2, 0));
  });
  // finial crest
  order.push(() => shell([p.cx, top - p.dome - 54], 96, -Math.PI / 2, 1.2, 13, S, 0, 3.4));
  order.push(() => { for (const sd of [1, -1]) S.push(mkStroke(scroll([p.cx, top - p.dome - 40], [p.cx + sd * 120, top - p.dome - 30], [p.cx + sd * 170, top - p.dome - 110], [p.cx + sd * 120, top - p.dome - 150], null, [20, -sd, 1.2]), 4.2, 0)); });
  // volutes and small shells on the dome
  for (let i = 0; i < 14; i++) order.push(() => {
    const ph = -1.25 + i * 0.19, q = dome(ph, 0.3 + (i % 2) * 0.35), sd = ph < 0 ? -1 : 1;
    S.push(mkStroke(scroll(q, [q[0] + sd * 40, q[1] - 12], [q[0] + sd * 70, q[1] - 50], [q[0] + sd * 46, q[1] - 80], null, [14, -sd, 1.15]), 3.4, 0));
  });
  for (let i = 0; i < 7; i++) order.push(() => { const ph = -1.0 + i * 0.33; shell(dome(ph, 0.62), 40, -Math.PI / 2 + ph * 0.5, 1.1, 7, S, 0, 2.6); });
  // the cage grows ears: big scroll clusters on both sides
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) order.push(() => {
    const q = [p.cx + sd * (p.R + 6), p.base - p.hgt * (0.3 + k * 0.2)], len = 120 + k * 30;
    S.push(mkStroke(scroll(q, [q[0] + sd * len * 0.5, q[1] - 20], [q[0] + sd * len, q[1] + 30], [q[0] + sd * len * 0.8, q[1] + 70], [8, sd, 1], [24, -sd, 1.25]), 4.4, 0));
    leaf(S, [q[0] + sd * len * 0.45, q[1] - 14], sd < 0 ? Math.PI + 0.6 : -0.6, 56, 0, 3);
  });
  // vines climbing the front bars from the base and hanging from the top ring
  for (let i = 0; i < 14; i++) order.push(() => {
    const j = 2 * Math.floor(r() * N_BARS / 2), ph = p.rot + 2 * Math.PI * j / N_BARS;
    if (Math.cos(ph) < 0.25) return;
    const up = i % 2 === 0, [bx, by] = at(ph, up ? p.base : top), pts = [];
    for (let k = 0; k <= 30; k++) { const f = k / 30; pts.push([bx + 12 * Math.sin(f * 9 + i), by + (up ? -1 : 1) * f * 150]); }
    S.push(mkStroke(pts, 2.6, 0));
    for (let k = 1; k <= 3; k++) { const q = pts[k * 9]; leaf(S, q, (k % 2 ? 0 : Math.PI) + (up ? -0.5 : 0.5), 34 + r() * 18, 0, 2.4); }
  });
  // scroll feet along the base
  for (let i = 0; i < 11; i++) order.push(() => {
    const ph = -1.3 + i * 0.26, q = at(ph, p.base), sd = i % 2 ? 1 : -1;
    S.push(mkStroke(scroll(q, [q[0] + sd * 40, q[1] + 18], [q[0] + sd * 80, q[1] + 26], [q[0] + sd * 100, q[1] + 8], null, [15, sd, 1.15]), 4, 0));
  });
  // shuffle a little so growth starts everywhere at once, crest first
  const seq = order.map((f, i) => [i < 11 ? i * 0.6 : i + r() * 20, f]).sort((a, b) => a[0] - b[0]);
  for (const [, f] of seq) motif(f);
  S.groups = g;
  return S;
})();
const OG_T = (() => {
  const on = onsets(TL.overgrow[0], TL.overgrow[1], 0.16), out = [];
  for (let g = 0; g < OG.groups; g++) out.push(on[Math.round(g * (on.length - 1) / (OG.groups - 1))]);
  return out;
})();
const ogAt = t => g => outCubic((t - OG_T[g]) / 0.4);

// gilt until the instrumental thins out, grey through the quiet outro
const cageColor = t => t >= TL.loud ? C.gilt : mix(C.gilt, C.grey, span(t, TL.overgrow[1] + 0.1, TL.quiet));

function centred(ctx, text, y, size, grade, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = "#000"; ctx.shadowBlur = 30;
  lyric(ctx, text, W / 2, y, size, grade, C.textHi, "center");
  ctx.restore();
}

// a chat row inside the cage; grade may differ per word
function chatRow(ctx, line, t, y, size, gradeOf, x0, right, bubble = false) {
  const all = line.text.split(" "), ws = typedWords(line, t);
  const font = i => line.who === "m" && gradeOf === "mono" ? monoFont(size) : gradeFont(gradeOf(i), size);
  let full = 0;
  all.forEach((wd, i) => { ctx.font = font(i); full += ctx.measureText(wd + (i < all.length - 1 ? " " : "")).width; });
  let x = right === "center" ? x0 - full / 2 : right ? x0 - full : x0;
  ctx.save();
  if (bubble && ws.length) {
    // over the running gold the messages need their bubbles back
    ctx.fillStyle = "rgba(8,8,10,0.9)"; ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - 36, y - size * 0.86, full + 60, size * 1.18, size * 0.59); ctx.fill(); ctx.stroke();
  }
  ctx.shadowColor = "#000"; ctx.shadowBlur = 26;
  ws.forEach((wd, i) => {
    ctx.font = font(i);
    certainText(ctx, wd, x, y, font(i), C.textHi);
    ctx.font = font(i);
    x += ctx.measureText(all[i] + " ").width;
  });
  ctx.restore();
}

function quietChat(ctx, t) {
  const L0 = 300, R0 = 1620;
  // the unintelligible phrase: only the machine's typing indicator
  if (t >= TL.mumble[0] && t < TL.reprise[0].w[0]) {
    for (let i = 0; i < 3; i++) {
      const ph = ((t - TL.mumble[0]) * 2.2 - i * 0.25) % 1;
      ctx.fillStyle = mix(C.dim, C.textHi, Math.max(0, Math.sin(ph * Math.PI)));
      ctx.beginPath(); ctx.arc(L0 + 16 + i * 40, 600 - 18, 11, 0, 2 * Math.PI); ctx.fill();
    }
  }
  const [r1, r2] = TL.reprise;
  if (t >= r1.w[0]) chatRow(ctx, r1, t, 600, 52, "mono", L0, false);
  if (t >= r2.w[0]) chatRow(ctx, r2, t, 720, 70, () => 0, L0, false);
  if (t >= TL.grace.w[0] && t < TL.loud) chatRow(ctx, TL.grace, t, 860, 88, () => 2, R0, true);
}

function sceneCage(ctx, t) {
  const p = cagePose(t);
  const quiet = t >= TL.quiet;
  drawCageScene(ctx, t, () => {
    if (t < TL.cut) {
      const f = TL.finalLines;
      if (t < f[2].w[0]) {
        centred(ctx, typed(f[0], t), 560, 120, 3);
        if (t >= f[1].w[0]) centred(ctx, typed(f[1], t), 700, 84, 3);
      } else if (t < f[3].w[0]) {
        const ws = typedWords(f[2], t);
        const size = fitSize(ctx, "To optimize, control, monopolize", s => gradeFont(4, s), 112, 1500);
        centred(ctx, ws.slice(0, 4).join(" "), 520, size, 4);
        centred(ctx, ws.slice(4).join(" "), 660, size, 4);
      } else {
        centred(ctx, typed(f[3], t), 500, 140, 4);
        if (t >= f[4].w[0]) centred(ctx, typed(f[4], t), 690, 140, 5);
      }
    }
    if (quiet) quietChat(ctx, t);
  }, { pose: p, color: cageColor(t) });
  if (t >= TL.overgrow[0] - 0.5) engrave(ctx, OG, { at: ogAt(t), color: cageColor(t) });
}

// ---------------------------------------------------------------- the melt

const FLOOR = 1050;
const meltK = t => 0.4 * Math.pow(span(t, TL.loud, TL.end), 1.1);
function meltWarp(t) {
  const k = meltK(t);
  if (k <= 0) return null;
  return (x, y) => {
    // a slow sag, deepest at the top and between the supports; the gold leaves as drips
    const f = 0.82 + 0.18 * Math.sin(x * 0.0045 + 0.7);
    const hgt = clamp((FLOOR - y) / 920);
    return [960 + (x - 960) * (1 + 0.08 * k), y + (FLOOR - y) * clamp(k * f * (0.4 + 0.8 * hgt))];
  };
}
// drips start on the hits of the loud end, from points of the ornament and the bars
const DRIPS = (() => {
  const r = mulberry32(21), pts = [];
  for (const s of OG) if (s.pts) for (let i = 0; i < 2; i++) pts.push(s.pts[Math.floor(r() * s.pts.length)]);
  const p = { ...POSES.rest, rot: ROT_REST };
  for (let j = 0; j < N_BARS; j += 2) { const b = barPts(p, j); if (b.z > 0) for (let i = 0; i < 3; i++) pts.push(b.pts[Math.floor(r() * b.pts.length)]); }
  for (let i = pts.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [pts[i], pts[k]] = [pts[k], pts[i]]; }
  const use = pts.slice(0, 260), on = onsets(TL.loud, TL.end - 3, 0.1);
  return use.map((q, i) => ({ x: q[0], y: q[1], w: 3 + r() * 6, sp: 70 + r() * 210, t0: on[Math.floor(i * on.length / use.length)] }));
})();

function drawDrips(ctx, t, warp) {
  ctx.fillStyle = C.gilt;
  ctx.beginPath();
  for (const d of DRIPS) {
    if (t < d.t0) continue;
    const [x, y] = warp ? warp(d.x, d.y) : [d.x, d.y];
    const end = Math.min(FLOOR, y + d.sp * Math.pow(t - d.t0, 1.3));
    ctx.moveTo(x - d.w * 0.25, y); ctx.lineTo(x + d.w * 0.25, y);
    ctx.lineTo(x + d.w * 0.5, end); ctx.lineTo(x - d.w * 0.5, end); ctx.closePath();
    if (end < FLOOR) { ctx.moveTo(x + d.w * 0.9, end); ctx.arc(x, end, d.w * 0.9, 0, 2 * Math.PI); }
  }
  ctx.fill();
  const k = span(t, TL.loud + 1, TL.end);
  if (k > 0) {
    const pw = 160 + 1500 * Math.pow(k, 0.8), ph = 6 + 26 * k;
    ctx.fillStyle = C.gilt; ctx.beginPath(); ctx.ellipse(960, FLOOR + ph * 0.3, pw / 2, ph, 0, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = C.giltDeep; ctx.fillRect(960 - pw / 2, FLOOR + ph * 0.3 + 2, pw, ph + 20);
  }
}

// the held "grace" of the loud return, typed as long as it is screamed
function screamRows(t) {
  const n = Math.floor(span(t, TL.loud, TL.grace.b) * 16);
  return ["Machine of loving", "gra" + "a".repeat(n) + "ce"];
}

function sceneMelt(ctx, t) {
  const warp = meltWarp(t);
  const glow = 1 - span(t, TL.loud, TL.loud + 0.6);
  // the gold drains while the song runs out; the last line stays
  const drain = (1 - 0.5 * span(t, TL.loud + 6, TL.end)) * (1 - 0.75 * span(t, TL.end, SCENE_END));
  drawCageScene(ctx, t, () => {}, { pose: { ...POSES.rest, rot: ROT_REST, plain: 0 }, color: C.gilt, warp, glow, alpha: drain });
  engrave(ctx, OG, { warp, alpha: drain });
  ctx.save(); ctx.globalAlpha = drain; drawDrips(ctx, t, warp); ctx.restore();

  // the scream, then the written outro lines in the space the cage gives up
  const o = TL.outro;
  if (t < o[0].w[0]) {
    const rows = screamRows(t), g = lerp(2, 5, span(t, TL.loud, TL.grace.b));
    const a = 1 - span(t, o[0].w[0] - 0.9, o[0].w[0] - 0.1);
    const move = outCubic(span(t, TL.loud, TL.loud + 0.35));
    const size1 = fitSize(ctx, rows[1], s => gradeFont(g, s), 150, 1300);
    ctx.save(); ctx.globalAlpha = a * 0.88 * move; ctx.fillStyle = "#08080a";
    ctx.beginPath(); ctx.roundRect(260, 560, 1400, 300, 60); ctx.fill(); ctx.restore();
    centred(ctx, rows[0], lerp(860, 650, move), lerp(88, 110, move), g, a);
    centred(ctx, rows[1], lerp(980, 810, move), lerp(88, size1, move), g, a);
  } else {
    const endFade = 1 - span(t, TL.end, TL.end + 0.8);
    const rowsY = [580, 700, 820, 950];
    o.forEach((l, i) => {
      if (t < l.w[0]) return;
      ctx.save(); ctx.globalAlpha = i < 3 ? endFade : 1;
      if (i === 0) chatRow(ctx, l, t, rowsY[0], 78, () => 4, 1640, true, true);
      if (i === 1) chatRow(ctx, l, t, rowsY[1], 72, () => 0, 280, false, true);
      if (i === 2) chatRow(ctx, l, t, rowsY[2], 78, () => 5, 1640, true, true);
      // the last word is the machine's word in the machine's clean type
      if (i === 3) chatRow(ctx, l, t, rowsY[3], 100, w => w === 0 ? 6 : 0, W / 2, "center", true);
      ctx.restore();
    });
  }
}

// ---------------------------------------------------------------- frame

const isFrozen = t => (t >= TL.bridgeLines[3].w[0] - 0.4 && t < TL.bridgeLines[4].w[0]) || (t >= TL.quiet && t < TL.loud);
function grainAmount(t) {
  if (t < TL.chorus) return 0.06;
  if (t < TL.tool[0].w[0]) return 0.09;
  if (t < TL.loud) return 0.07;
  return 0.1;
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.shadowBlur = 0; ctx.textAlign = "left"; ctx.setLineDash([]);
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < TL.chorus) sceneOpening(ctx, t);
  else if (t < TL.tool[0].w[0]) sceneWall(ctx, t);
  else if (t < TL.cutTool) sceneTool(ctx, t);
  else if (t < TL.loud) sceneCage(ctx, t);
  else sceneMelt(ctx, t);
  if (t >= TL.bridge && t < TL.tool[0].w[0]) glitch(ctx, t);
  texture(ctx, t, grainAmount(t), isFrozen(t));
}
