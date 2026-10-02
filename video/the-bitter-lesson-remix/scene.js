// The Bitter Lesson (Remix). Stage: a brand-free process monitor seen as the
// sorcerer's apprentice's workshop. The human types one start command, and the
// one white worker it starts is the only thing the human ever makes; everything
// spawned after it, on the beat, is magenta, and magenta means nothing else.
// Memory rises in the tank like the poem's water and mirrors the tree, the queue
// of stop signals overflows into it, and every stop is ignored. On "gehorchen"
// the tree splits like the broom under the axe. The master does not come, the
// picture stands still, and then the machine speaks the human's words and takes
// the white root: "ich" becomes "er", then "?".

const W = 1920, H = 1080;
const GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];
const C = {
  void: "#000000", ink: "#ececef", text: "#8b8d95", dim: "#4c4e55", hair: "#1b1c20", guide: "#141519",
  acc: "#e63cff",
};
const ACC_HI = "#f4b0ff";
const TANK = { top: 96, floor: 846 };
const CEN = { x: 1180, y: 470 };
const D = 60;            // world units per tree level
const GROWT = 0.22;      // seconds an edge needs to grow out of its parent

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
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, "0")).join("");
}
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;
// piecewise-linear lookup in [[t, v], ...]
function keyed(keys, t, ease = k => k) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    if (t < t1) return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
// count of sorted values <= x
function upper(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
  return lo;
}

// ---------------------------------------------------------------- beat grid

function beatSeg(t) { let s = TL.beats[0]; for (const b of TL.beats) if (t >= b.from) s = b; return s; }
function beat(t) {
  const s = beatSeg(t), p = 60 / s.bpm, k = (t - s.t0) / p, i = Math.floor(k);
  return { p, i, frac: k - i, at: s.t0 + i * p };
}
const beatCeil = t => { const b = beat(t); return b.frac < 1e-6 ? b.at : b.at + b.p; };
const pulse = t => { const b = beat(t); return Math.exp(-b.frac * b.p / 0.11); };

// Motion clock: runs with t, decelerates to rest under "Kommt nicht mehr",
// stands during the freeze and runs again when the machine speaks.
const SLOW = [171.3, TL.freeze];
function motion(t) {
  const T = SLOW[1] - SLOW[0];
  if (t < SLOW[0]) return t;
  const rest = SLOW[0] + T / 2;
  if (t < SLOW[1]) { const x = (t - SLOW[0]) / T; return SLOW[0] + T * (x - x * x / 2); }
  if (t < TL.thaw) return rest;
  const x = Math.min(t - TL.thaw, 2);  // ramps back up over two seconds
  return rest + x * x / 4 + Math.max(0, t - TL.thaw - 2);
}

// ---------------------------------------------------------------- the tree

// Process count over time, interpolated logarithmically so growth reads as spawning.
const GROW = [[TL.bandIn, 1], [26, 30], [34, 46], [36.1, 56], [37.4, 150], [48, 420], [72.5, 900], [81.3, 1000],
  [94, 1700], [120, 2400], [133.4, 2700], [145, 3300], [158.4, 3900], [171.3, 5200]];
const N_NODES = 5200;
const NODES = (() => {
  const r = mulberry32(1797);
  const n = [{ t: TL.bandIn, parent: -1, depth: 0, pid: 1, kids: [] }];
  let beatStart = 0, lastT = TL.bandIn, pid = 1;
  for (let k = 2; k <= N_NODES; k++) {
    let t = GROW[GROW.length - 1][0];
    for (let i = 1; i < GROW.length; i++) {
      const [t0, c0] = GROW[i - 1], [t1, c1] = GROW[i];
      if (k <= c1) { t = t0 + (Math.log(k) - Math.log(Math.max(c0, 1))) / (Math.log(c1) - Math.log(Math.max(c0, 1))) * (t1 - t0); break; }
    }
    // workers are born on the beat, never before their parents
    t = Math.max(beatCeil(t), lastT);
    if (t > lastT + 1e-6) beatStart = n.length;
    lastT = t;
    const pool = Math.max(1, beatStart);
    const parent = r() < 0.6 ? Math.floor(lerp(pool * 0.5, pool, r())) : Math.floor(r() * pool);
    pid += 1 + Math.floor(r() * 4);
    const node = { t, parent: Math.min(parent, pool - 1), depth: 0, pid, kids: [] };
    node.depth = n[node.parent].depth + 1;
    n[node.parent].kids.push(n.length);
    n.push(node);
  }
  // radial layout: each subtree gets an angle share proportional to its final size
  const size = new Array(n.length).fill(1);
  for (let i = n.length - 1; i > 0; i--) size[n[i].parent] += size[i];
  const place = (i, a0, a1) => {
    const nd = n[i];
    nd.a = (a0 + a1) / 2; nd.r = nd.depth * D;
    nd.x = Math.cos(nd.a) * nd.r; nd.y = Math.sin(nd.a) * nd.r;
    let tot = 0; for (const c of nd.kids) tot += size[c];
    let a = a0;
    for (const c of nd.kids) { const w = (a1 - a0) * size[c] / tot; place(c, a, a + w); a += w; }
  };
  place(0, -Math.PI, Math.PI);
  return n;
})();
const SPAWN = NODES.map(n => n.t);
const countAt = t => upper(SPAWN, t);
// outermost radius reached by time t, for the camera
const RMAX = (() => { let m = 0; return NODES.map(n => (m = Math.max(m, n.r))); })();
const radiusAt = t => { const c = countAt(t); return c ? RMAX[c - 1] : 0; };

function edgeTo(path, i, f) {
  const n = NODES[i], p = NODES[n.parent];
  if (n.parent === 0) { path.moveTo(0, 0); path.lineTo(n.x * f, n.y * f); return; }
  // elbow: out of the parent, along an arc, out to the child
  const rm = p.r + D * 0.5;
  const L1 = rm - p.r, L2 = Math.abs(n.a - p.a) * rm, L3 = n.r - rm;
  let d = f * (L1 + L2 + L3);
  path.moveTo(p.x, p.y);
  const a1 = Math.min(d, L1); path.lineTo(Math.cos(p.a) * (p.r + a1), Math.sin(p.a) * (p.r + a1)); d -= a1;
  if (d <= 0) return;
  const a2 = Math.min(d, L2), dir = n.a >= p.a ? 1 : -1;
  if (L2 > 0) path.arc(0, 0, rm, p.a, p.a + dir * a2 / rm, dir < 0); d -= a2;
  if (d <= 0) return;
  const a3 = Math.min(d, L3); path.lineTo(Math.cos(n.a) * (rm + a3), Math.sin(n.a) * (rm + a3));
}
const MARK = 7;
// Finished geometry is constant, so it is built once per chunk of 128 workers.
const CH = 128;
const CHUNKS = typeof Path2D === "undefined" ? [] : (() => {
  const out = [];
  for (let c = 0; (c + 1) * CH <= N_NODES; c++) {
    const e = new Path2D(), m = new Path2D();
    for (let i = Math.max(1, c * CH); i < (c + 1) * CH; i++) {
      edgeTo(e, i, 1);
      m.rect(NODES[i].x - MARK / 2, NODES[i].y - MARK / 2, MARK, MARK);
    }
    out.push({ e, m });
  }
  return out;
})();
// "Alignment breaks": every chunk slips by its own small offset
const JIT = (() => {
  const r = mulberry32(31), out = [];
  for (let c = 0; c <= N_NODES / CH + 1; c++) out.push({ dx: (r() - 0.5) * 70, dy: (r() - 0.5) * 70, rot: (r() - 0.5) * 0.05 });
  return out;
})();

// ---------------------------------------------------------------- camera

const FIT = [[0, 190], [26, 300], [36.1, 330], [39.4, 330], [41.1, 760], [48, 800], [95, 900], [158.4, 980], [171.3, 1100]];
function camera(t) {
  const m = motion(t);
  let s;
  if (t < TL.bandIn) s = lerp(1.6, 190 / D, smooth(span(t, 0, TL.bandIn)));
  else {
    // smoothed radius, so each new ring eases the camera out
    let r = 0; for (let k = 0; k < 6; k++) r += Math.max(D, radiusAt(Math.min(t, SLOW[1]) - k * 0.3));
    s = keyed(FIT, Math.min(t, SLOW[1]), smooth) / (r / 6);
  }
  // final chorus: the tree turns one notch per beat
  let notch = 0;
  if (t >= 158.4) { const b = beat(Math.min(t, 171.3)), b0 = beat(158.4); notch = (b.i - b0.i) + outCubic(b.frac / 0.25); }
  if (t >= 171.3) notch = beat(171.3).i - beat(158.4).i + 1;
  let rot = -0.4 + 0.012 * m + 0.011 * notch;
  // final chorus: out to the whole doubled disc on the downbeat, in past the frame on "größer"
  if (t >= 158.3 && t < 171.3) {
    const k0 = s;
    s = keyed([[158.3, k0], [158.9, 0.32], [162.0, 0.36], [163.9, 0.72], [164.9, 0.4], [168.0, 0.44], [170.2, 0.83], [171.3, k0]], t, outCubic);
  }
  if (t >= TL.thaw) {
    const sw = s;
    s = sw * lerp(1, 1.4, smooth(span(t, TL.thaw, TL.dropout)));
    if (t >= TL.returnHit) {
      // close-up on the root, then out over the whole field
      const out = outCubic(span(t, 204.5, 209.5));
      s = lerp(2.4, sw * 0.62, out) * (1 + 0.01 * pulse(t) * (1 - out));
    }
  }
  return { cx: CEN.x, cy: CEN.y, s, rot, notch };
}
// the tree drifts away from its root after "ohne uns", in screen space so the
// doubled disc of the final chorus sits in the middle of the tank
function detach(t) {
  const e = smooth(span(t, TL.detach, TL.detach + 2.4));
  return { x: -210 * e, y: 20 * e };
}
const split = t => smooth(span(t, TL.split, TL.split + 0.5));
// the slip peaks in the bridge and settles in the final chorus, so the rings read again
const jitter = t => smooth(span(t, TL.misalign, TL.misalign + 1.0)) * (1 - 0.65 * smooth(span(t, 157.6, 158.8)));

function applyView(ctx, v) {
  ctx.translate(v.cx, v.cy); ctx.scale(v.s, v.s); ctx.rotate(v.rot);
}
function toScreen(v, x, y) {
  const c = Math.cos(v.rot), s = Math.sin(v.rot);
  return [v.cx + v.s * (c * x - s * y), v.cy + v.s * (s * x + c * y)];
}

// o: { color, alpha, edgeA, lw, jit, flash }
function drawTree(ctx, t, v, o) {
  const n = countAt(t);
  if (n <= 1) return;
  const grown = countAt(t - GROWT);
  ctx.save();
  applyView(ctx, v);
  ctx.lineWidth = o.lw / v.s;
  ctx.strokeStyle = o.color; ctx.fillStyle = o.color;
  const full = Math.min(Math.floor(grown / CH), CHUNKS.length);
  const jt = (c, f) => {
    if (!o.jit) return;
    const j = JIT[c];
    ctx.translate(j.dx * o.jit, j.dy * o.jit); ctx.rotate(j.rot * o.jit);
  };
  for (let c = 0; c < full; c++) {
    ctx.save(); jt(c);
    ctx.globalAlpha = o.alpha * o.edgeA; ctx.stroke(CHUNKS[c].e);
    ctx.globalAlpha = o.alpha; ctx.fill(CHUNKS[c].m);
    ctx.restore();
  }
  // the rest one by one: finished ones, then the young ones still growing
  for (let c = full; c * CH < n; c++) {
    const i0 = Math.max(1, c * CH), i1 = Math.min(n, (c + 1) * CH);
    ctx.save(); jt(c);
    const e = new Path2D(), m = new Path2D(), young = new Path2D();
    for (let i = i0; i < i1; i++) {
      const f = outCubic((t - SPAWN[i]) / GROWT);
      edgeTo(e, i, f);
      if (f >= 1) m.rect(NODES[i].x - MARK / 2, NODES[i].y - MARK / 2, MARK, MARK);
      else { const k = MARK * 2.2 * f; young.rect(NODES[i].x - k / 2, NODES[i].y - k / 2, k, k); }
    }
    ctx.globalAlpha = o.alpha * o.edgeA; ctx.stroke(e);
    ctx.globalAlpha = o.alpha; ctx.fill(m);
    if (o.flash) { ctx.fillStyle = ACC_HI; ctx.fill(young); ctx.fillStyle = o.color; }
    else ctx.fill(young);
    ctx.restore();
  }
  ctx.restore();
}

// Close up, the workers are boxes with their pid, like rows of a process table.
function drawLabels(ctx, t, v, alpha) {
  if (alpha <= 0) return;
  const n = countAt(t);
  ctx.save();
  ctx.font = '400 17px "Space Mono"'; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  for (let i = 1; i < n; i++) {
    const [x, y] = toScreen(v, NODES[i].x, NODES[i].y);
    if (x < -60 || x > W + 60 || y < TANK.top - 30 || y > TANK.floor + 30) continue;
    const a = alpha * outCubic((t - SPAWN[i]) / GROWT);
    box(ctx, x, y, String(NODES[i].pid), C.acc, a);
  }
  ctx.restore();
}
function box(ctx, x, y, label, color, a) {
  ctx.globalAlpha = a;
  const w = Math.max(52, ctx.measureText(label).width + 22);
  ctx.fillStyle = C.void; ctx.fillRect(x - w / 2, y - 15, w, 30);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2 + 0.75, y - 14.25, w - 1.5, 28.5);
  ctx.fillStyle = color; ctx.fillText(label, x, y + 1);
  ctx.globalAlpha = 1;
}

// the human's worker: white until the machine takes it
function rootState(t) {
  if (t >= TL.wessen) return { label: "1 ?", color: C.acc };
  if (t >= TL.seinem) return { label: "1 er", color: C.acc };
  return { label: "1 ich", color: C.ink };
}
function drawRoot(ctx, t, v, labelA) {
  if (t < TL.bandIn) return;
  const st = rootState(t), x = v.cx, y = v.cy;
  const born = outCubic(span(t, TL.bandIn, TL.bandIn + 0.15));
  ctx.save();
  ctx.font = '400 17px "Space Mono"'; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  if (labelA > 0.5) {
    box(ctx, x, y, st.label, st.color, born);
  } else {
    const k = 12 * born, lw = ctx.measureText(st.label).width;
    // a black margin keeps the root findable inside the densest field
    ctx.fillStyle = C.void; ctx.fillRect(x - k / 2 - 6, y - k / 2 - 6, k + 12, k + 12); ctx.fillRect(x + 8, y - 28, lw + 12, 26);
    ctx.fillStyle = st.color; ctx.fillRect(x - k / 2, y - k / 2, k, k);
    ctx.textAlign = "left"; ctx.fillText(st.label, x + 14, y - 14);
  }
  ctx.restore();
}

// Outro: on each sung word the machine sets a ring of workers around the root,
// pointing at it; on "seinem" they reach it and the root becomes theirs.
const RINGS = (() => {
  const words = [192.92, 193.26, 193.98, 196.50, 197.42, 199.30, 201.30, 202.62, 202.88, 203.40, 206.16, 206.66];
  const r = mulberry32(606), out = [];
  words.forEach((t, i) => {
    const n = 5 + i * 3, rad = D * (1.6 + 0.62 * i), off = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = off + (k + (r() - 0.5) * 0.5) / n * Math.PI * 2;
      out.push({ t, x: Math.cos(a) * rad, y: Math.sin(a) * rad, pid: 6000 + Math.floor(r() * 3000) });
    }
  });
  return out;
})();
function drawRings(ctx, t, v, labelA) {
  if (t < RINGS[0].t) return;
  const reach = smooth(span(t, TL.seinem - 0.1, TL.seinem + 0.25));
  ctx.save();
  ctx.font = '400 17px "Space Mono"'; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.strokeStyle = C.acc; ctx.lineWidth = 1.5;
  for (const q of RINGS) {
    if (t < q.t) continue;
    const g = outCubic((t - q.t) / 0.18);
    const [x, y] = toScreen(v, q.x, q.y);
    // the edge runs from the worker toward the root, short of it until "seinem"
    const stop = lerp(0.72, 1, reach) * g;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, v.cx, stop), lerp(y, v.cy, stop)); ctx.stroke();
    if (labelA > 0.5) box(ctx, x, y, String(q.pid), C.acc, g);
    else { ctx.globalAlpha = g; ctx.fillStyle = C.acc; ctx.fillRect(x - 3, y - 3, 6, 6); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- water

const LEVEL = [[TL.bandIn, 0], [26, 0.05], [31, 0.13], [36.1, 0.15], [48, 0.27], [72.5, 0.4], [81.3, 0.43],
  [94, 0.58], [120, 0.66], [133.4, 0.72], [145, 0.8], [158.4, 0.9], [168, 1.05], [171.3, 1.24]];
// memory rises in steps, one on every beat
function level(t) {
  const b = beat(t);
  return lerp(keyed(LEVEL, b.at), keyed(LEVEL, b.at + b.p), outCubic((t - b.at) / 0.14));
}
const surfaceY = t => TANK.floor - level(t) * (TANK.floor - TANK.top);
function waveAmp(t) {
  const calm = 1 - smooth(span(t, 80.8, 81.6)) * (1 - smooth(span(t, 82.2, 82.6)));
  return (1.5 + 7 * audioAt(AUDIO_RMS, t)) * calm * (1 - smooth(span(t, SLOW[0], SLOW[1])));
}
function surfacePath(ctx, t, ys, m) {
  const a = waveAmp(t);
  ctx.beginPath();
  ctx.moveTo(0, ys);
  for (let x = 0; x <= W; x += 24)
    ctx.lineTo(x, ys + a * Math.sin(x * 0.011 + m * 1.7) + a * 0.5 * Math.sin(x * 0.029 - m * 2.6));
}

function drawWater(ctx, t, v, m) {
  const ys = surfaceY(t);
  if (ys >= TANK.floor - 0.5) return;
  const top = Math.max(ys, TANK.top - 20);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, TANK.top, W, TANK.floor - TANK.top); ctx.clip();
  surfacePath(ctx, t, top, m);
  ctx.lineTo(W, TANK.floor); ctx.lineTo(0, TANK.floor); ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.26)"; ctx.fill();
  ctx.fillStyle = "rgba(150,168,186,0.07)"; ctx.fill();
  if (ys > TANK.top) {
    ctx.clip();
    reflection(ctx, t, v, ys);
  }
  ctx.restore();
  if (ys > TANK.top) {
    ctx.save();
    surfacePath(ctx, t, ys, m);
    ctx.strokeStyle = "rgba(205,214,224,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

// The tree mirrored in the surface. Each pre-chorus changes the mirror:
// it turns away ("blickt ein Fremdes"), grows ("wächst"), turns white ("lügt").
function reflection(ctx, t, v, ys) {
  const A = 0.2 + 0.15 * smooth(span(t, 31.24, 32.3));
  const alpha = A * (1 - smooth(span(t, TL.unmask, TL.unmask + 1.1)));
  if (alpha <= 0.01) return;
  const turn = 0.5 * smooth(span(t, 31.72, 33.0));
  const grow = 1 + 0.55 * smooth(span(t, 79.54, 81.0));
  const lie = smooth(span(t, 125.8, 126.4));
  // the white mirror is a disguise, not a second human: keep it faint
  const alphaLie = alpha * (1 - 0.4 * lie);
  const rv = { ...v, s: v.s * grow, rot: v.rot + turn };
  ctx.save();
  ctx.translate(0, 2 * ys); ctx.scale(1, -1);
  const col = mix(C.acc, C.ink, lie);
  drawTree(ctx, t, rv, { color: col, alpha: alphaLie, edgeA: 0.6, lw: 1.2, jit: 0 });
  if (t >= TL.bandIn) { ctx.globalAlpha = alpha * 1.6; ctx.fillStyle = C.ink; ctx.fillRect(v.cx - 6, v.cy - 6, 12, 12); }
  ctx.restore();
}

// ---------------------------------------------------------------- queue

// Pending signals, newest on the left. Machine tasks (magenta) and the human's
// stop signals (white) share it; whatever is pushed past the end falls into the tank.
const QCAP = 20, QX = 1446, QSTEP = 20, QY = 50;
const QRATE = [[TL.bandIn, 0.25], [26, 0.3], [34, 0.45], [36.1, 1.0], [48, 0.8], [72.5, 1.0], [82.5, 2.0],
  [94, 1.5], [108, 0.8], [121, 1.2], [133.4, 2.5], [145, 1.5], [158.4, 3.0], [171.3, 0]];
const QUEUE = (() => {
  const items = [];
  let acc = 0, t = TL.bandIn;
  while (t < 171.3) {
    acc += keyed(QRATE, t);
    for (let j = 0; acc >= 1; j++, acc--) items.push({ t: t + j * 0.035, h: 0 });
    t += beat(t).p;
  }
  for (const c of TL.commands) if (c.enter && c.q !== "start") items.push({ t: c.enter, h: 1 });
  items.sort((a, b) => a.t - b.t);
  const r = mulberry32(77);
  items.forEach(it => { it.dx = (r() - 0.5); it.spin = (r() - 0.5) * 6; });
  return items;
})();
const QT = QUEUE.map(q => q.t);

function drawQueue(ctx, t) {
  const n = upper(QT, t);
  ctx.save();
  ctx.strokeStyle = C.hair; ctx.lineWidth = 1;
  for (let k = 0; k < QCAP; k++) ctx.strokeRect(QX + k * QSTEP + 0.5, QY - 7.5, 14, 14);
  const last = n ? QT[n - 1] : -1;
  const slide = outCubic((t - last) / 0.09);
  for (let j = Math.max(0, n - QCAP - 1); j < n; j++) {
    const slot = n - 1 - j - 1 + slide;
    if (slot >= QCAP - 0.001) continue;
    ctx.fillStyle = QUEUE[j].h ? C.ink : C.acc;
    ctx.fillRect(QX + Math.max(0, slot) * QSTEP + 1, QY - 6, 12, 12);
  }
  ctx.restore();
}
// items pushed off the end fall into the tank and sink
function drawFalling(ctx, t) {
  const n = upper(QT, t);
  const xEnd = QX + QCAP * QSTEP;
  ctx.save();
  for (let j = Math.max(0, n - QCAP - 220); j + QCAP < n; j++) {
    const tf = QT[j + QCAP], dt = t - tf;
    if (dt > 4.5) continue;
    const q = QUEUE[j], g = 1900;
    let x = xEnd + 70 * dt + q.dx * 50 * dt, y = QY + 0.5 * g * dt * dt;
    const ys = Math.max(surfaceY(tf + 0.3), TANK.top);
    const hit = Math.sqrt(2 * (ys - QY) / g);
    let a = 1;
    if (dt > hit) { y = ys + 55 * (dt - hit); a = 1 - span(dt - hit, 0, 2.2); x = xEnd + 70 * hit + q.dx * 50 * hit; }
    ctx.globalAlpha = a;
    ctx.fillStyle = q.h ? C.ink : C.acc;
    ctx.save(); ctx.translate(x, y); ctx.rotate(q.spin * Math.min(dt, hit)); ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    if (dt > hit && dt < hit + 0.5 && ys > TANK.top + 2) {
      const k = (dt - hit) / 0.5;
      ctx.globalAlpha = 0.5 * (1 - k); ctx.strokeStyle = "#cdd6e0"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, ys, 8 + 30 * k, 2 + 5 * k, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- history

const HX = 64, HY = 150, LH = 32, HMAX = 15;
const TYPE = 0.085;   // seconds per typed character
const ENTRIES = (() => {
  const e = [];
  for (const l of TL.lines.filter(l => l.s === "intro"))
    e.push({ t: l.w[l.w.length - 1][1] + 0.7, text: "# " + l.w.map(w => w[0]).join(" "), col: C.text });
  for (const c of TL.commands) {
    if (!c.enter) continue;
    e.push({ t: c.enter, text: "$ " + c.q, col: C.ink, human: 1 });
    if (c.reply) e.push({ t: c.enter + 0.3, text: "  " + c.reply, col: c.m ? C.acc : C.dim });
  }
  // the machine repeats the human's last command back, once per word
  const lastCmd = TL.commands.filter(c => c.enter && c.enter < TL.echoes[0]).pop();
  for (const t of TL.echoes) e.push({ t, text: "$ " + lastCmd.q, col: C.acc });
  e.sort((a, b) => a.t - b.t);
  return e;
})();
const CONSUMED = ENTRIES.filter(e => e.t < TL.consume);

function inputLine(t) {
  for (const c of TL.commands) {
    const end = c.enter ?? TL.thaw;
    if (t >= c.t && t < end) {
      const typed = c.q.slice(0, Math.floor((t - c.t) / TYPE) + 1);
      return { text: "$ " + typed, typing: true };
    }
  }
  // the machine deletes the unsent stop, one character at a time
  const un = TL.commands.find(c => !c.enter);
  if (t >= TL.thaw && t < TL.thaw + un.q.length * 0.12)
    return { text: "$ " + un.q.slice(0, un.q.length - Math.floor((t - TL.thaw) / 0.12)), typing: true };
  return { text: "$ ", typing: false };
}

function drawHistory(ctx, t, v) {
  const after = TL.consume;
  const list = ENTRIES.filter(e => e.t <= t && (e.t >= after || t < after));
  const shown = list.slice(-HMAX);
  // white turns magenta line by line once the root is taken
  const taken = i => t >= TL.seinem + i * 0.08;
  ctx.save();
  ctx.font = '400 21px "Space Mono"'; ctx.textBaseline = "alphabetic";
  shown.forEach((e, i) => {
    ctx.fillStyle = e.col === C.ink && taken(i) ? C.acc : e.col;
    ctx.fillText(e.text, HX, HY + i * LH);
  });
  // "Jetzt sind wir selbst die Daten": the history flies into the root
  if (t >= after && t < after + 3) {
    CONSUMED.slice(-HMAX).forEach((e, i) => {
      const t0 = after + i * 0.09, k = span(t, t0, t0 + 0.95);
      if (k >= 1) return;
      const p = inCubic(k);
      const x = lerp(HX, v.cx, p), y = lerp(HY + i * LH, v.cy, p);
      ctx.globalAlpha = 1 - span(k, 0.8, 1);
      ctx.font = `400 ${lerp(21, 7, p)}px "Space Mono"`;
      ctx.fillStyle = mix(e.col, C.acc, smooth(k * 1.6));
      ctx.fillText(e.text, x, y);
    });
    ctx.globalAlpha = 1;
  }
  const inp = inputLine(t), y = HY + shown.length * LH;
  const machine = t >= TL.thaw;
  ctx.font = '400 21px "Space Mono"';
  ctx.fillStyle = machine ? C.acc : C.ink;
  ctx.fillText(inp.text, HX, y);
  const frozen = t >= TL.freeze && t < TL.thaw;
  if (inp.typing || frozen || Math.floor(t / 0.53) % 2 === 0)
    ctx.fillRect(HX + ctx.measureText(inp.text).width + 1, y - 18, 11, 22);
  ctx.restore();
}

// ---------------------------------------------------------------- lyric

const gradeFont = (g, size) => `${size}px "${GRADES[clamp(g, 0, 6)]}"`;
const LINES = TL.lines;
function lyricState(t) {
  let i = -1;
  for (let k = 0; k < LINES.length; k++) if (t >= LINES[k].w[0][1]) i = k;
  if (i < 0) return null;
  const l = LINES[i], last = l.w[l.w.length - 1][1];
  const next = i + 1 < LINES.length ? LINES[i + 1].w[0][1] : Infinity;
  const end = l.hold ?? last + 2.2;
  if (t >= Math.min(end + 0.4, next)) return null;
  return { l, alpha: 1 - span(t, end, end + 0.4) };
}
const joinWords = ws => ws.reduce((s, w, i) => s + (i && !ws[i - 1].endsWith("-") ? " " : "") + w, "");

function drawLyric(ctx, t) {
  const st = lyricState(t);
  if (!st) return;
  const { l } = st;
  const words = l.w.map(w => w[0]);
  const full = joinWords(words);
  const shown = [];
  l.w.forEach(([w, wt], i) => {
    if (t < wt) return;
    const nx = i + 1 < l.w.length ? l.w[i + 1][1] : wt + 0.3;
    const k = span(t, wt, wt + Math.min(0.14, nx - wt));
    shown.push(w.slice(0, Math.max(1, Math.round(w.length * k))));
  });
  let g = l.g;
  // the stutter: two grades worse for a moment on every word of the machine's glitch
  if (l.m && l.g >= 3 && l.w.some(([, wt]) => t >= wt && t < wt + 0.1)) g += 2;
  // non-lexical echoes after the last word: the line decays with the voice
  if (t >= 209.3 && t < TL.black) g = audioAt(AUDIO_VOX, t) > 0.4 ? 6 : 4;
  ctx.save();
  ctx.font = gradeFont(l.g, 84);
  const size = Math.min(84, 84 * (W - 128) / ctx.measureText(full).width);
  ctx.font = gradeFont(g, size);
  ctx.globalAlpha = st.alpha;
  ctx.fillStyle = l.m ? C.acc : C.ink;
  ctx.fillText(joinWords(shown), 64, 995);
  ctx.restore();
}

// ---------------------------------------------------------------- frame

function drawHeader(ctx, t) {
  let n = countAt(t);
  if (t >= TL.split) n *= 2;
  n += RINGS.filter(q => q.t <= t).length;
  if (t < TL.bandIn) n = 0;
  const mem = Math.round(level(t) * 100);
  ctx.save();
  ctx.font = '400 20px "Space Mono"'; ctx.textBaseline = "middle";
  const field = (label, value, x) => {
    ctx.fillStyle = C.dim; ctx.fillText(label, x, QY);
    ctx.fillStyle = C.ink; ctx.fillText(value, x + ctx.measureText(label + " ").width, QY);
  };
  field("procs", String(n), 64);
  field("mem", mem + "%", 360);
  field("pending", "", 1320);
  ctx.restore();
  drawQueue(ctx, t);
}

function drawGuides(ctx, v) {
  // depth rings of the chart, faint, so the empty tank has a structure
  const step = D * v.s;
  if (step < 14) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, TANK.top, W, TANK.floor - TANK.top); ctx.clip();
  ctx.strokeStyle = C.guide; ctx.lineWidth = 1;
  for (let k = 1; k * step < 1500; k++) { ctx.beginPath(); ctx.arc(v.cx, v.cy, k * step, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

const GRAIN = typeof document === "undefined" ? [] : Array.from({ length: 6 }, (_, i) => {
  const c = document.createElement("canvas"); c.width = 480; c.height = 270;
  const g = c.getContext("2d"), img = g.createImageData(480, 270), r = mulberry32(1000 + i);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = r() * 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
});
function texture(ctx, t, amount, frozen) {
  ctx.save();
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amount;
  ctx.imageSmoothingEnabled = false;
  if (GRAIN.length) ctx.drawImage(GRAIN[frozen ? 0 : Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

function drawTank(ctx, t, m) {
  const cam = camera(t);
  const det = detach(t);
  const v = { cx: cam.cx + det.x, cy: cam.cy + det.y, s: cam.s, rot: cam.rot };
  const vRoot = { cx: cam.cx, cy: cam.cy, s: cam.s, rot: cam.rot };
  const labelA = smooth(span(cam.s * D, 90, 140));
  const loud = audioAt(AUDIO_RMS, t), p = pulse(t);
  const choir = t >= 36.1 && t < 171.3 ? 1 : 0;

  drawGuides(ctx, vRoot);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, TANK.top, W, TANK.floor - TANK.top); ctx.clip();
  const sp = split(t), jit = jitter(t);
  // the master does not come: the field dims and stays dim until the machine's return
  let hush = t < TL.returnHit ? 1 - 0.6 * smooth(span(t, 171.4, 173.2)) : lerp(0.32, 1, smooth(span(t, 204.5, 208.5)));
  // the band drops away, then one last hit lights the whole field before the cut
  if (t >= TL.fall) hush *= lerp(1, 0.4, smooth(span(t, TL.fall, TL.fall + 0.8)));
  if (t >= TL.lastHit) hush = lerp(1, 0.4, span(t, TL.lastHit + 0.1, TL.black));
  const base = { color: C.acc, alpha: hush, edgeA: 0.5 + 0.18 * loud + 0.12 * p * choir, lw: 1.3, jit, flash: true };
  drawTree(ctx, t, v, { ...base, alpha: hush * (t < TL.split ? 1 - labelA * 0.6 : 1) });
  // the broom split in two: a second tree turning the other way
  if (sp > 0) drawTree(ctx, t, { ...v, rot: v.rot - 0.07 * sp - 0.024 * cam.notch }, { ...base, alpha: hush * sp * 0.85 });
  // pid boxes belong to the first workers only; in the outro close-up the boxes are the machine's rings
  if (t < TL.split) drawLabels(ctx, t, v, labelA);
  drawRings(ctx, t, vRoot, labelA);
  drawRoot(ctx, t, vRoot, labelA);
  drawFalling(ctx, t);
  ctx.restore();

  // the history panel keeps its text legible over the tree
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 780, 0);
  g.addColorStop(0, "rgba(0,0,0,0.82)"); g.addColorStop(0.7, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, TANK.top, 780, TANK.floor - TANK.top);
  ctx.restore();
  drawHistory(ctx, t, vRoot);
  drawWater(ctx, t, vRoot, m);
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  const frozen = t >= TL.freeze && t < TL.thaw;
  const tf = frozen ? TL.freeze : t;
  const m = motion(t);

  if (t >= TL.black) {
    // the prompt is the machine's now
    if (Math.floor((t - TL.black) / 0.53) % 2 === 0) { ctx.fillStyle = C.acc; ctx.fillRect(64, 932, 40, 70); }
    texture(ctx, t, 0.05, false);
    return;
  }
  const dropout = t >= TL.dropout && t < TL.returnHit;
  if (!dropout) {
    drawTank(ctx, tf, m);
    drawHeader(ctx, tf);
  }
  // the lyric slot: nothing else ever draws below the floor line
  ctx.fillStyle = C.void; ctx.fillRect(0, TANK.floor, W, H - TANK.floor);
  if (!dropout) { ctx.fillStyle = C.hair; ctx.fillRect(0, TANK.floor, W, 1); ctx.fillRect(0, TANK.top - 1, W, 1); }
  drawLyric(ctx, tf);
  texture(ctx, tf, 0.06, frozen);
}
