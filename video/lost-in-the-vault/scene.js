// Lost in the Vault. The whole video is drawScene(ctx, t), a pure function of
// time in seconds. The stage is the graph view of a personal note vault: every
// sung line becomes a note, linked to the line before it, so the song writes
// itself into the graph. The layout is a force simulation that runs once at
// load over the whole song (deterministic, seeded) and is only sampled after.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", edge: "#8c8c99", node: "#c0c0ca", text: "#8a8a93", textHi: "#ececf0",
  dim: "#3a3a42", ink: "#0b0b0e", paper: "#c9c9cf",
  // amber marks the thought that fires now: the active note and its links
  accent: "#ffb23e",
};
// the only other colours of the piece, for one beat on "BUNT!"
const BUNT = ["#ff5d73", "#ffd23e", "#4fd1a5", "#58a6ff", "#c48bff", "#ff9b4a"];

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
// rises over `attack`, holds `hold`, falls over `release`
const envelope = (t, a, attack, hold, release) =>
  t < a ? 0 : t < a + attack ? (t - a) / attack : t < a + attack + hold ? 1 : Math.max(0, 1 - (t - a - attack - hold) / release);

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, "0")).join("");
}
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;
const BEAT = TL.beat.period;
const beatsSince = (t, t0) => (t - t0) / BEAT;
const S = TL.s;

// ---------------------------------------------------------------- notes

// Titles of the vault's own notes, in the album's vocabulary. The first one is
// the note the video opens and closes on.
const TITLES = [
  "Morgen wieder", "Tagesnotiz", "Inbox", "Prompt v14", "Gedanke 03:14", "Warum bin ich müde", "Context Window",
  "Schlaf", "Neunundachtzig Tabs", "Gieß sie trotzdem", "Monstera", "System Prompt", "Refreshen", "Trotzdem",
  "Burnout Quellen", "Erschöpfung", "Meeting 14:00", "TODO", "TODO (alt)", "Ideen", "Zettel 0412", "Arbeit",
  "Agentic Workflows", "Embeddings", "Halluzination", "Token Limit", "Reasoning", "Paper lesen", "Graz", "Mur",
  "Kaffee", "Pause (verschoben)", "Atmen", "Therapie Wartezeit", "Projektantrag", "Deadline", "Mails",
  "Antwort ausstehend", "Wochenreview", "Was ich wirklich will", "Was bleibt", "Ohne Titel", "Ohne Titel 2",
  "Kopie von Ohne Titel", "Gedanke 03:40", "Traumtagebuch", "Synapse", "Knoten", "Backlinks", "Graph",
  "Datenmeer", "Markdown", "Recursion", "Loop", "Maschine", "Mensch", "Glas", "Licht", "Pixel", "Arpeggio",
  "7/8", "d-Moll", "Proberaum", "Lyrics v3", "Lyrics v4", "Agent Log", "Run 207", "Run 208", "Fehler", "Retry",
  "Gestern", "Heute", "Prompt v15 final", "Prompt v15 final2", "Benchmark", "Schlafen gehen", "Eisenmangel",
  "Wetter Graz", "Einkaufsliste", "Rückruf", "Lesen", "Nicht vergessen", "Gedanke 04:02", "Feedback",
  "Kalender", "Notizen zu Notizen", "Vault aufräumen", "Templates", "Daily", "Weekly", "Zitate", "Quellen",
  "Hypothese", "Gegenargument", "Entwurf", "Entwurf 2", "Abstract", "Slides", "Workshop", "Freunde anrufen",
  "Allein", "Spaziergang", "Ausmisten", "Selbstoptimierung", "Genug", "Kopfweh", "Bildschirmzeit", "Prompt v16",
  "Kontext", "Gedächtnis", "Erinnerung", "Vergessen", "Ordner", "Archiv", "Papierkorb", "Wiederherstellen",
];

const NODES = [], EDGES = [];
function addNode(label, born, parent, kind = "note", extra = {}) {
  const id = NODES.length;
  NODES.push({ id, label, born, parent, kind, ...extra });
  if (parent !== null && parent !== undefined) addEdge(parent, id, born);
  return id;
}
function addEdge(a, b, born, extra = {}) { EDGES.push({ a, b, born, die: Infinity, rest: 46, k: 1, kind: "link", ...extra }); }

const LINES = TL.lines;   // sung lines and shouts in order
for (const l of LINES) { l.a = l.a ?? (l.w ? l.w[0] : l.t); l.b = l.b ?? l.a + 0.4; }
const SHOUTS = LINES.filter(l => l.shout);
const SUNG = LINES.filter(l => !l.shout);
const fxLine = name => LINES.find(l => l.fx === name);

// Growth is decided here, before the simulation runs, except the cross-links of
// "Netze", which depend on positions and are chosen inside the simulation.
(() => {
  const r = mulberry32(2026);
  let title = 1;
  const nextTitle = () => TITLES[(title++) % TITLES.length];
  addNode(TITLES[0], -10, null, "seed");
  const heads = [0];

  // intro: a single thought thread, one bead every two beats of the arpeggio
  for (let k = 0; S.firstBead + k * 2 * BEAT < S.fork - 0.1; k++) {
    heads[0] = addNode(nextTitle(), S.firstBead + k * 2 * BEAT, heads[0], "thread", { thread: 0 });
  }
  // the hit forks the thread; from then on a bead lands on each drum onset
  const along = [];
  for (let n = heads[0]; n !== null; n = NODES[n].parent) along.push(n);
  for (let k = 1; k <= 4; k++) {
    heads.push(addNode(nextTitle(), S.fork + k * 0.04, along[Math.floor(along.length * k / 5)], "thread", { thread: k }));
  }
  let last = S.fork;
  for (const o of AUDIO_ONSETS) {
    if (o < S.fork + 0.3 || o >= S.hold || o - last < 0.2) continue;
    last = o;
    if (r() < 0.07 && heads.length < 8) {
      const from = 1 + Math.floor(r() * (NODES.length - 1));
      heads.push(addNode(nextTitle(), o, from, "thread", { thread: heads.length }));
    } else {
      const h = Math.floor(r() * heads.length);
      heads[h] = addNode(nextTitle(), o, heads[h], "thread", { thread: h });
    }
  }

  // lyric notes, each linked to the line before: the song as a path through the
  // vault. Recurring hook lines return to their note and add a backlink.
  const hooks = {};
  let prev = heads[0];
  for (const l of LINES) {
    if (l.hook && hooks[l.hook] !== undefined) {
      l.node = hooks[l.hook];
      if (prev !== l.node) addEdge(prev, l.node, l.t, { kind: "path" });
    } else {
      l.node = addNode(l.label || l.q, l.t, prev, l.shout ? "shout" : "lyric", { line: l, show: l.show });
      EDGES[EDGES.length - 1].kind = "path";
      if (l.shout) EDGES[EDGES.length - 1].rest = 70;
      if (l.hook) hooks[l.hook] = l.node;
    }
    if (!l.shout) prev = l.node;
  }

  // filler notes arrive on drum onsets, preferentially at well linked notes,
  // so hubs form as in a real vault; the rate follows the sections
  const rate = t => { for (const [a, b, p] of TL.growth) if (t >= a && t < b) return p; return 0; };
  const deg = new Float64Array(4000);
  for (const e of EDGES) { deg[e.a]++; deg[e.b]++; }
  const slots = [...AUDIO_ONSETS];
  for (let b = TL.beat.first; b < SCENE_END; b += BEAT / 2) slots.push(b);
  slots.sort((a, b) => a - b);
  let lastF = 0;
  for (const o of slots) {
    if (o - lastF < 0.12 || r() > rate(o)) continue;
    lastF = o;
    const alive = NODES.filter(n => n.born < o - 0.5 && n.kind !== "shout");
    let best = alive[Math.floor(r() * alive.length)];
    for (let c = 0; c < 2; c++) {
      const cand = alive[Math.floor(r() * alive.length)];
      if (deg[cand.id] > deg[best.id]) best = cand;
    }
    const id = addNode(nextTitle(), o, best.id, "note");
    deg[best.id]++; deg[id]++;
  }

  // "hier kommt der A G I Gott": every note links to the god note, until the bridge
  const god = fxLine("god").node;
  NODES[god].kind = "god";
  const tg = fxLine("god").w[6];
  NODES.filter(n => n.born < tg && n.id !== god).forEach((n, i, all) => {
    addEdge(n.id, god, tg + 0.15 + 1.6 * i / all.length, { die: S.bridge + 2.4, rest: 230, k: 0.25, kind: "god" });
  });
  // "Machen meine Seele frei": the note cuts its links and rises
  const soul = fxLine("free");
  for (const e of EDGES) if (e.a === soul.node || e.b === soul.node) e.die = soul.free;
})();
const N = NODES.length;
const GOD = NODES.find(n => n.kind === "god").id;

// ---------------------------------------------------------------- simulation

const SIM_HZ = 10;
const SIM = (() => {
  const SUB = 3, dt = 1 / (SIM_HZ * SUB);
  const samples = Math.ceil(SCENE_END * SIM_HZ) + 2;
  const pos = new Float32Array(samples * N * 2);
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
  const alive = new Uint8Array(N);
  const order = NODES.map(n => n.id).sort((a, b) => NODES[a].born - NODES[b].born);
  const r = mulberry32(77);
  let next = 0, netzeDone = false;
  const netze = fxLine("netze").t;
  const kicks = TL.kicks.map(k => ({ ...k, done: false }));
  const soul = fxLine("free");

  for (let s = 0; s < samples; s++) {
    for (let sub = 0; sub < SUB; sub++) {
      const ts = (s - 1) / SIM_HZ + (sub + 1) * dt;
      while (next < N && NODES[order[next]].born <= ts) {
        const n = NODES[order[next++]];
        alive[n.id] = 1;
        if (n.parent === null) continue;
        const p = n.parent, gp = NODES[p].parent;
        let ang = gp === null ? r() * Math.PI * 2 : Math.atan2(y[p] - y[gp], x[p] - x[gp]) + (r() - 0.5) * 1.3;
        if (n.kind === "shout") ang = r() * Math.PI * 2;
        const d = n.kind === "thread" ? 40 : 30;
        x[n.id] = x[p] + Math.cos(ang) * d; y[n.id] = y[p] + Math.sin(ang) * d;
        vx[n.id] = vx[p]; vy[n.id] = vy[p];
      }
      if (!netzeDone && ts >= netze) {
        // thought threads become nets: each thread bead links to the nearest
        // bead of another thread
        netzeDone = true;
        const beads = NODES.filter(n => alive[n.id] && n.kind === "thread");
        beads.forEach((a, i) => {
          if (i % 2) return;
          let best = null, bd = 260 * 260;
          for (const b of beads) {
            if (b.thread === a.thread) continue;
            const d2 = (x[a.id] - x[b.id]) ** 2 + (y[a.id] - y[b.id]) ** 2;
            if (d2 < bd) { bd = d2; best = b; }
          }
          if (best) addEdge(a.id, best.id, netze + 0.25 * (i / beads.length), { kind: "net" });
        });
      }
      let cx = 0, cy = 0, na = 0;
      for (let i = 0; i < N; i++) if (alive[i]) { cx += x[i]; cy += y[i]; na++; }
      cx /= na || 1; cy /= na || 1;
      for (const k of kicks) {
        if (k.done || ts < k.t) continue;
        k.done = true;
        for (let i = 0; i < N; i++) {
          if (!alive[i]) continue;
          const dx = x[i] - cx, dy = y[i] - cy, d = Math.hypot(dx, dy) + 1;
          vx[i] += dx / d * k.v; vy[i] += dy / d * k.v;
        }
      }
      const fx = new Float64Array(N), fy = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        for (let j = i + 1; j < N; j++) {
          if (!alive[j]) continue;
          const dx = x[i] - x[j], dy = y[i] - y[j], d2 = dx * dx + dy * dy + 30;
          if (d2 > 90000) continue;
          const f = Math.min(4, 2200 / d2) / Math.sqrt(d2);
          fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f;
        }
      }
      let knot = 1;
      for (const [a, b] of TL.knots) if (ts >= a && ts < b) knot = lerp(1, 0.5, smooth(span(ts, a, a + 0.6)) * (1 - span(ts, b - 0.6, b)));
      for (const e of EDGES) {
        if (e.born > ts || ts >= e.die || !alive[e.a] || !alive[e.b]) continue;
        const dx = x[e.b] - x[e.a], dy = y[e.b] - y[e.a], d = Math.hypot(dx, dy) + 0.01;
        const grow = clamp((ts - e.born) / 0.8);
        const f = 0.05 * e.k * grow * (d - e.rest * (e.kind === "god" ? 1 : knot)) / d;
        fx[e.a] += dx * f; fy[e.a] += dy * f; fx[e.b] -= dx * f; fy[e.b] -= dy * f;
      }
      let heat = 0;
      for (const [a, b, amp] of TL.heat) if (ts >= a && ts < b) heat = amp * (1 - span(ts, a, b));
      // weak gravity during the threads, so they stay strands and do not ball up
      const g = ts < netze ? 0.0012 : 0.004;
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        fx[i] -= (x[i] - cx) * g; fy[i] -= (y[i] - cy) * g;
        if (heat) { fx[i] += (r() - 0.5) * heat; fy[i] += (r() - 0.5) * heat; }
        if (i === soul.node && ts > soul.free) { fx[i] *= 0.1; fy[i] = fy[i] * 0.1 - 0.35; }
        vx[i] = (vx[i] + fx[i]) * 0.8; vy[i] = (vy[i] + fy[i]) * 0.8;
        const v = Math.hypot(vx[i], vy[i]);
        if (v > 14) { vx[i] *= 14 / v; vy[i] *= 14 / v; }
        x[i] += vx[i]; y[i] += vy[i];
      }
    }
    const o = s * N * 2;
    for (let i = 0; i < N; i++) { pos[o + 2 * i] = x[i]; pos[o + 2 * i + 1] = y[i]; }
  }
  return { pos, samples };
})();

function simPos(id, t) {
  const f = clamp(t * SIM_HZ, 0, SIM.samples - 1.001), s = Math.floor(f), k = f - s;
  const a = (s * N + id) * 2, b = a + N * 2;
  return [lerp(SIM.pos[a], SIM.pos[b], k), lerp(SIM.pos[a + 1], SIM.pos[b + 1], k)];
}

// "Für einen Moment macht alles Sinn": the same notes in perfect order, one
// thread wound into a spiral, every note in the order it was thought, the seed
// at the centre. The links fall away; only the sequence remains.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const BYRANK = NODES.map(n => n.id).sort((a, b) => NODES[a].born - NODES[b].born);
const RANK = (() => { const r = new Int32Array(N); BYRANK.forEach((id, i) => { r[id] = i; }); return r; })();
const SPIRAL = { gap: 26, step: 13 };
const orderPos = (id, t) => {
  const b = SPIRAL.gap / (2 * Math.PI), th = Math.sqrt(2 * SPIRAL.step * RANK[id] / b), rr = b * th * breath(t);
  return [Math.cos(th - Math.PI / 2) * rr, Math.sin(th - Math.PI / 2) * rr];
};
// "Der Vault atmet mit mir, ich atme mit ihm": one slow breath over the line
function breath(t) {
  const l = fxLine("atmet");
  if (!l) return 1;
  return 1 + 0.07 * envelope(t, l.t - 0.6, 0.5, l.b - l.t + 0.4, 0.5) * (1 - Math.cos(2 * Math.PI * (t - l.t) / (l.b - l.t))) / 2;
}
const orderAmount = t => smooth(span(t, S.bridge, S.bridge + 2.2)) * (1 - smooth(span(t, S.final, S.final + 1.0)));

// Into order the notes swirl, one extra turn around the god note's place,
// rather than crossing the frame in straight lines; out of order they go straight.
function posAt(id, t) {
  const p = simPos(id, t), e = orderAmount(t);
  if (e <= 0) return p;
  const q = orderPos(id, t);
  if (t > S.final) return [lerp(p[0], q[0], e), lerp(p[1], q[1], e)];
  const g = simPos(GOD, S.bridge), cx = lerp(g[0], 0, e), cy = lerp(g[1], 0, e);
  const a0 = Math.atan2(p[1] - g[1], p[0] - g[0]), a1 = Math.atan2(q[1], q[0]);
  let da = a1 - a0;
  da = ((da % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const a = a0 + (da + 2 * Math.PI) * e, r = lerp(Math.hypot(p[0] - g[0], p[1] - g[1]), Math.hypot(q[0], q[1]), e);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}
const isAlive = (n, t) => n.born <= t;

// ---------------------------------------------------------------- camera

// A pose is where the camera looks (world cx, cy), how close (z), its roll, and
// where on screen the target sits (ax, ay).
function centroid(t) {
  // weighted by age, so a newborn note eases into the framing instead of jolting it
  let cx = 0, cy = 0, n = 0;
  const pts = [];
  for (const nd of NODES) {
    if (!isAlive(nd, t) || nd.kind === "shout" || nd.kind === "seed" && t > S.fork) continue;
    const w = span(t, nd.born, nd.born + 1.2), p = posAt(nd.id, t);
    pts.push([p, w]); cx += p[0] * w; cy += p[1] * w; n += w;
  }
  cx /= n || 1; cy /= n || 1;
  const d = pts.filter(([, w]) => w > 0.5).map(([p]) => Math.hypot(p[0] - cx, p[1] - cy)).sort((a, b) => a - b);
  return { cx, cy, r: Math.max(110, d[Math.floor(d.length * 0.9)] || 110) };
}
// averaged over a short window, so the camera never inherits simulation jitter
function steady(fn, t, w = 0.4) {
  let a = 0, b = 0;
  for (let k = -2; k <= 2; k++) { const p = fn(t + k * w / 4); a += p[0]; b += p[1]; }
  return [a / 5, b / 5];
}
// The camera keeps the vault in the upper part of the frame and leans toward
// the note being sung, closer the more a line asks for it; the line itself is
// set in a fixed slot below.
const FRAME_Y = 400, SLOT_Y = 900;
function pose(key, t) {
  let cx, cy, z = key.z;
  if (key.at) [cx, cy] = key.at;
  else if (key.fly) {
    // a close flight from one note to another, low enough to read the titles
    const [a, b] = key.fly.map(n => typeof n === "string" ? LINES.find(l => l.hook === n).node : n);
    const k = smooth(span(t, key.t, key.t1)), pa = steady(tt => posAt(a, tt), t), pb = steady(tt => posAt(b, tt), t);
    [cx, cy] = [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
  }
  else {
    const c = centroid(t);
    cx = c.cx; cy = c.cy; z = key.z * 420 / c.r;
    if (key.node !== undefined) {
      const [nx, ny] = steady(tt => posAt(key.node, tt), t);
      const lean = clamp((key.z - 0.5) / 1.2, 0.3, 0.85);
      cx = lerp(cx, nx, lean); cy = lerp(cy, ny, lean);
      // the sung note never sinks into the lyric slot or leaves the frame
      const sy = (key.ay ?? FRAME_Y) + (ny - cy) * z, sx = W / 2 + (nx - cx) * z;
      if (sy > 690) cy += (sy - 690) / z;
      if (sy < 110) cy -= (110 - sy) / z;
      if (sx > 1720) cx += (sx - 1720) / z;
      if (sx < 200) cx -= (200 - sx) / z;
    }
  }
  return { cx, cy, z, ax: key.ax ?? W / 2, ay: key.ay ?? FRAME_Y };
}
// Roll is one continuous function of time, never part of a key, so cuts between
// keys cannot unwind it. "Recursive loops, ich dreh mich rund" turns the vault
// once around, landing on "RUND!".
function roll(t) {
  const l = fxLine("loops"), rund = fxLine("rund");
  return 0.0045 * t + 2 * Math.PI * smooth(span(t, l.t - 0.3, rund.t + 0.2));
}
const CAM_KEYS = (() => {
  const keys = TL.shots.map(k => ({ dur: 0.8, ...k }));
  for (const l of SUNG) {
    if (l.cam === false) continue;
    keys.push({ t: l.t - (l.lead ?? 0.32), dur: l.lead ?? 0.32, node: l.node, z: l.z ?? 1.5, ...(l.camx || {}) });
  }
  return keys.sort((a, b) => a.t - b.t);
})();
function camera(t) {
  let i = 0;
  while (i + 1 < CAM_KEYS.length && CAM_KEYS[i + 1].t <= t) i++;
  const k = CAM_KEYS[i], prev = CAM_KEYS[Math.max(0, i - 1)];
  const cur = pose(k, t);
  cur.rot = roll(t);
  const e = smooth(span(t, k.t, k.t + k.dur));
  if (e >= 1 || i === 0) return cur;
  const p = pose(prev, t);
  return {
    cx: lerp(p.cx, cur.cx, e), cy: lerp(p.cy, cur.cy, e), z: Math.exp(lerp(Math.log(p.z), Math.log(cur.z), e)),
    rot: cur.rot, ax: lerp(p.ax, cur.ax, e), ay: lerp(p.ay, cur.ay, e),
  };
}
function toScreen(cam, p) {
  const dx = (p[0] - cam.cx) * cam.z, dy = (p[1] - cam.cy) * cam.z;
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [cam.ax + dx * c - dy * s, cam.ay + dx * s + dy * c];
}

// ---------------------------------------------------------------- lines

function lineAt(t) {
  let cur = null;
  for (const l of SUNG) if (t >= l.t - (l.lead ?? 0.32)) cur = l;
  return cur;
}
const nextSung = l => SUNG[SUNG.indexOf(l) + 1];
// Words appear when they are sung: each word types over its own duration.
function typedWords(l, t) {
  if (!l.w) {
    const k = l.b <= l.a ? (t >= l.a ? 1 : 0) : span(t, l.a, l.b);
    return l.q.slice(0, Math.round(l.q.length * k));
  }
  const words = l.q.split(" ");
  let out = "";
  for (let i = 0; i < words.length; i++) {
    const t0 = l.w[i], t1 = Math.min(l.w[i + 1] ?? l.b, t0 + 0.35);
    if (t < t0) break;
    const k = t1 <= t0 ? 1 : span(t, t0, t1);
    out += (i ? " " : "") + words[i].slice(0, Math.max(1, Math.round(words[i].length * k)));
    if (k < 1) break;
  }
  return out;
}
const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;
function wrapRows(ctx, text, maxW) {
  const rows = [];
  for (const word of text.split(" ")) {
    const row = rows.length ? rows[rows.length - 1] + " " + word : word;
    if (rows.length && ctx.measureText(row).width <= maxW) rows[rows.length - 1] = row;
    else rows.push(word);
  }
  return rows;
}
// Layout of a whole line, so a line being typed never reflows or resizes.
function lineLayout(ctx, l) {
  const g = l.g ?? 0;
  let size = l.size ?? 92;
  ctx.font = gradeFont(g, size);
  let rows = wrapRows(ctx, l.q, 1560);
  while (rows.length > 2 && size > 64) { size -= 4; ctx.font = gradeFont(g, size); rows = wrapRows(ctx, l.q, 1560); }
  return { g, size, rows };
}
function drawRows(ctx, l, shown, x, y, color, alpha) {
  const L = lineLayout(ctx, l);
  ctx.font = gradeFont(L.g, L.size);
  ctx.textAlign = "left"; ctx.fillStyle = color; ctx.globalAlpha = alpha;
  let used = 0;
  L.rows.forEach((row, r) => {
    const part = shown.slice(used, used + row.length); used += row.length + 1;
    // a row being typed already sits where the whole row will be centred
    ctx.fillText(part, x - ctx.measureText(row).width / 2, y + r * L.size * 1.08);
  });
  ctx.globalAlpha = 1;
  return L;
}
// a soft dark plate behind the line, so graph and type never fight
function plate(ctx, x, y, w, h, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.filter = "blur(28px)";
  ctx.fillStyle = `rgba(0,0,0,${0.78 * alpha})`;
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------- graph

// o: { focus, dim, labels, pulses, bunt, wordsOnly, flicker, ink, alpha, ghost, glow }
function drawGraph(ctx, t, cam, o = {}) {
  const P = new Array(N), A = new Float32Array(N), deg = new Float32Array(N);
  const tg = fxLine("god").w[6];
  for (const nd of NODES) {
    if (!isAlive(nd, t)) continue;
    let p = toScreen(cam, posAt(nd.id, t));
    if (o.burst) {
      const f = 1 + o.burst * (0.55 + 0.45 * ((nd.id * 0.618) % 1));
      p = [cam.ax + (p[0] - cam.ax) * f, cam.ay + (p[1] - cam.ay) * f];
    }
    if (o.flicker) {
      // stepped at 8 fps: reality flimmers in place, it does not drift
      const r = mulberry32(nd.id * 131 + Math.floor(t * 8));
      p = [p[0] + (r() - 0.5) * 9 * o.flicker, p[1] + (r() - 0.5) * 9 * o.flicker];
    }
    P[nd.id] = p;
    A[nd.id] = outCubic((t - (nd.show ?? nd.born)) / 0.3);
  }
  const live = e => e.born <= t && t < e.die + 0.4 && P[e.a] && P[e.b];
  for (const e of EDGES) if (live(e) && t < e.die && e.kind !== "god") { deg[e.a]++; deg[e.b]++; }
  const ink = o.ink || 0;
  const base = mix(C.edge, C.ink, ink), nodeCol = mix(C.node, C.ink, ink), accent = C.accent;
  const dim = o.dim || 0, alpha = o.alpha ?? 1;
  const focus = o.focus;
  const near = new Set();
  if (focus !== undefined) for (const e of EDGES) if (live(e) && (e.a === focus || e.b === focus)) { near.add(e.a); near.add(e.b); }
  const wordsOnly = o.wordsOnly || 0;

  // edges: one batched path per style
  const dance = o.dance || 0;
  const edgePath = (filter, style, width, a) => {
    ctx.beginPath();
    let any = false;
    for (const e of EDGES) {
      if (!live(e) || !filter(e)) continue;
      const g = outCubic((t - e.born) / (e.kind === "god" ? 0.5 : 0.3)) * (e.die === Infinity ? 1 : 1 - span(t, e.die, e.die + 0.4));
      if (g <= 0) continue;
      const [x1, y1] = P[e.a], [x2, y2] = P[e.b];
      const x3 = lerp(x1, x2, g), y3 = lerp(y1, y2, g);
      ctx.moveTo(x1, y1);
      if (dance) {
        // backlinks dance: each edge bows to its own side on the beat
        const ph = Math.sin(beatsSince(t, 0) * Math.PI + e.a * 1.7);
        const mx = (x1 + x3) / 2 - (y3 - y1) * 0.25 * dance * ph, my = (y1 + y3) / 2 + (x3 - x1) * 0.25 * dance * ph;
        ctx.quadraticCurveTo(mx, my, x3, y3);
      } else ctx.lineTo(x3, y3);
      any = true;
    }
    if (!any) return;
    ctx.strokeStyle = style; ctx.lineWidth = width * (o.bold || 1); ctx.globalAlpha = a * alpha; ctx.stroke();
  };
  const isFocusEdge = e => focus !== undefined && (e.a === focus || e.b === focus);
  const order = orderAmount(t);
  const ea = (1 - wordsOnly) * (1 - dim * 0.75) * (1 - 0.95 * smooth(order * 4)) * (1 - (o.dead || 0) * 0.6);
  if (order > 0) {
    // the spiral thread itself, drawn note to note in the order of thinking
    ctx.beginPath();
    BYRANK.forEach((id, i) => { if (P[id]) i ? ctx.lineTo(P[id][0], P[id][1]) : ctx.moveTo(P[id][0], P[id][1]); });
    ctx.strokeStyle = mix(mix(C.edge, C.textHi, 0.3), accent, o.sense || 0); ctx.lineWidth = 1.4 + (o.sense || 0);
    // the thread is drawn only once the notes have nearly arrived in order
    ctx.globalAlpha = smooth(span(order, 0.8, 1)) * alpha * (0.8 + 0.2 * (o.sense || 0)); ctx.stroke();
  }
  edgePath(e => !isFocusEdge(e) && e.kind !== "path" && e.kind !== "god", base, 1.6, 0.7 * ea);
  edgePath(e => !isFocusEdge(e) && e.kind === "path", mix(base, C.textHi, 0.4), 1.9, 0.85 * ea);
  edgePath(e => e.kind === "god" && !isFocusEdge(e), mix(base, accent, o.godGlow || 0), 1, (0.3 + 0.4 * (o.godGlow || 0)) * ea);
  if (focus !== undefined) edgePath(isFocusEdge, accent, 2, 0.95 * (1 - wordsOnly));

  // sparks: signals running along the links, on the beat
  if (o.pulses > 0) {
    ctx.fillStyle = accent; ctx.globalAlpha = o.pulses * alpha;
    const ph = beatsSince(t, TL.beat.first) / 2;
    EDGES.forEach((e, i) => {
      if (!live(e) || t > e.die || i % 3) return;
      const k = ((ph + (i * 0.618) % 1) % 1);
      const [x1, y1] = P[e.a], [x2, y2] = P[e.b];
      const ps = 2.5 * clamp(Math.pow(cam.z, 0.6), 0.6, 1.8);
      ctx.fillRect(lerp(x1, x2, k) - ps, lerp(y1, y2, k) - ps, 2 * ps, 2 * ps);
    });
  }

  // nodes
  const zr = clamp(Math.pow(cam.z, 0.6), 0.45, 2.2) * (o.bold || 1);
  let late = null;
  for (const nd of NODES) {
    const p = P[nd.id];
    if (!p || nd.kind === "shout" && t > nd.born + 6) continue;
    const isF = nd.id === focus, isN = near.has(nd.id);
    let r = (3.4 + 1.5 * Math.sqrt(deg[nd.id])) * zr * A[nd.id];
    const godly = nd.kind === "god" ? smooth(span(t, tg - 0.6, tg + 1.2)) * (1 - span(t, S.bridge, S.bridge + 0.9)) : 0;
    if (godly) r = lerp(r, 46 * zr, godly);
    if (isF) r = Math.max(r, 7 * zr);
    if (r <= 0.2) continue;
    let col = isF ? accent : isN ? mix(nodeCol, C.textHi, 0.6) : nodeCol;
    if (o.bunt) col = mix(col, BUNT[nd.id % BUNT.length], o.bunt);
    const a = (isF || isN ? 1 : 1 - dim * 0.7) * (1 - wordsOnly) * alpha * (1 - (o.dead || 0) * (isF ? 0 : 0.7));
    ctx.globalAlpha = a;
    if (godly) {
      // the god note is an absence with a rim, drawn over everything that points into it
      late = () => {
        ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = C.void; ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2 + 2 * godly; ctx.stroke();
      };
      continue;
    }
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    if (nd.id === o.ghost) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    } else { ctx.fillStyle = col; ctx.fill(); }
    if (isF) {
      ctx.globalAlpha = 0.5 * alpha; ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p[0], p[1], r + 7, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (late) late();
  // notes touched by the voice: a ring that opens and fades
  for (const [id, k] of o.touch || []) {
    const p = P[id];
    if (!p) continue;
    ctx.globalAlpha = alpha * (1 - k); ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p[0], p[1], 6 + 40 * outCubic(k), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * (1 - k); ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(p[0], p[1], 6 * zr, 0, Math.PI * 2); ctx.fill();
  }

  // labels: as in any graph view they fade in when close, plus the new notes,
  // the overload and the "Wort" hit
  ctx.textAlign = "center";
  for (const nd of NODES) {
    const p = P[nd.id];
    if (!p || nd.id === focus || nd.kind === "shout") continue;
    if (p[0] < -200 || p[0] > W + 200 || p[1] < -40 || p[1] > H + 40) continue;
    // the newest note introduces itself, larger, while the vault is still threads
    const fresh = o.fresh ? envelope(t, nd.born, 0.05, 0.7, 0.5) * o.fresh : 0;
    let a = Math.max(o.labels || 0, wordsOnly, clamp((cam.z - 1.6) / 0.8) * 0.8);
    if (nd.kind === "lyric") a = Math.max(a, o.lyricLabels || 0);
    if (nd.kind === "seed") {
      const k = 1 - span(t, S.firstBead + 1.2, S.firstBead + 2.6);
      if (k > 0) { seedTitle(ctx, p[0], p[1], nd.label, k); ctx.textAlign = "center"; a *= 1 - k; }
    }
    const big = fresh > a;
    a = Math.max(a, fresh);
    if (a <= 0.02) continue;
    ctx.globalAlpha = a * alpha * (near.has(nd.id) ? 1 : 1 - dim * 0.6);
    ctx.font = big ? '400 22px "Space Mono"' : '400 15px "Space Mono"';
    ctx.fillStyle = big ? C.textHi : wordsOnly ? mix(C.text, C.textHi, wordsOnly) : ink ? C.ink : C.text;
    const lab = nd.label.length > 34 ? nd.label.slice(0, 33) + "…" : nd.label;
    ctx.fillText(lab, p[0], p[1] + 10 * zr + (big ? 26 : 18));
  }
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
  return P;
}

// Out-of-focus notes drifting past the lens: the camera floats in the data sea.
function drawSea(ctx, t, amount, sink) {
  if (amount <= 0) return;
  const r = mulberry32(555);
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const x0 = r() * W, sp = 40 + r() * 120, rad = 6 + r() * 26, ph = r() * H * 2;
    const y = ((ph - (t * sp * (sink ? 1.6 : 0.6))) % (H + 200) + H + 200) % (H + 200) - 100;
    const x = x0 + Math.sin(t * 0.4 + i) * 30;
    ctx.globalAlpha = amount * (0.06 + 0.1 * (rad / 32));
    ctx.fillStyle = C.node;
    ctx.filter = `blur(${Math.round(rad * 0.4)}px)`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
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
const offscreen = () => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
};
const GLASS = offscreen(), DAY = offscreen(), GLOW = offscreen();

function texture(ctx, t, amount, frozen, light = 0) {
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
  const v = ctx.createRadialGradient(0, 0, H * 0.45, 0, 0, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${0.6 * (1 - 0.8 * light)})`);
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}
function glow(ctx, amount, radius = 14) {
  if (!GLOW || amount <= 0) return;
  const g = GLOW.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = amount; ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(GLOW, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- song state

const inRange = (t, a, b) => t >= a && t < b;
const shoutAt = t => { let s = null; for (const l of SHOUTS) if (t >= l.t - 0.02 && t < l.t + (l.hold ?? 0.9)) s = l; return s; };
const fxAmount = (name, t, attack, hold, release) => {
  const l = fxLine(name);
  return l ? envelope(t, l.fxAt ?? l.t, attack, hold, release) : 0;
};
const wordTime = (name, i) => { const l = fxLine(name); return l.w ? l.w[i] : l.a; };

function graphOptions(t, line) {
  const o = { focus: undefined, dim: 0, labels: 0, pulses: 0, fresh: 0 };
  const sung = line && t < (nextSung(line)?.t ?? Infinity) - 0.32 && t < line.b + (line.keep ?? 1.0) + 0.4;
  if (sung) {
    o.focus = line.node;
    const end = Math.min((nextSung(line)?.t ?? Infinity) - 0.32, line.b + (line.keep ?? 1.0) + 0.4);
    o.dim = 0.55 * smooth(span(t, line.t - (line.lead ?? 0.32), line.t)) * (1 - smooth(span(t, end - 0.35, end)));
    // between two lines that follow each other closely the vault stays dimmed
    const nx = nextSung(line);
    if (nx && nx.t - 0.32 - end < 0.05 && t > end - 0.35) o.dim = 0.55;
  }
  if (t < S.hookIn) o.fresh = 1;
  // overload: on "consciousness overload" every label comes on at once
  for (const l of LINES) if (l.fx === "overload") o.labels = Math.max(o.labels, envelope(t, l.w[3], 0.15, 0.9, 1.2) * (l.over ?? 0.9));
  o.pulses = Math.max(
    fxAmount("synapsen", t, 0.3, 2.2, 1.0) * 0.9,
    inRange(t, S.chorus1, S.verse2) ? 0.35 : 0, inRange(t, S.chorus2, S.tod) ? 0.45 : 0,
    inRange(t, S.final, S.breakdown) ? 0.6 : 0,
    // the band's instrumentals: thought signals run along the threads
    inRange(t, S.band, S.hold) ? 0.45 * (1 - span(t, S.hold - 1, S.hold)) : 0,
    inRange(t, S.inst1, S.quiet1) ? 0.55 : 0,
    // after "Gott" every signal runs into the god note
    inRange(t, fxLine("god").w[6], S.bridge) ? 0.5 + 0.4 * envelope(t, S.loud3, 0.1, 4.6, 0.6) : 0,
  );
  const tod = fxLine("tod");
  o.dead = envelope(t, tod.t, 0.05, fxLine("god").w[3] - tod.t - 0.2, 0.4);
  o.sense = senseAmount(t);
  // "Mein Geist explodiert": the drawing bursts outward and settles again
  for (const l of LINES) if (l.fx === "overload") o.burst = Math.max(o.burst || 0, envelope(t, l.w[2], 0.1, 0.15, 1.6) * (l.burst ?? 0.9));
  // the wordless sung passage after the first chorus: each sung note lights an
  // earlier line's note, walking back through the song
  const before = SUNG.filter(l => l.t < TL.touches[0]).reverse();
  o.touch = [];
  TL.touches.forEach((tt, i) => { if (t >= tt && t < tt + 0.9) o.touch.push([before[i % before.length].node, (t - tt) / 0.9]); });
  o.dance = fxAmount("tanzen", t, 0.3, 2.5, 1.0);
  o.flicker = fxAmount("flimmern", t, 0.2, 1.6, 0.6);
  const bunt = fxLine("bunt");
  o.bunt = envelope(t, bunt.t, 0.03, 0.5, 0.7);
  const wort = fxLine("wort");
  o.wordsOnly = envelope(t, wort.t, 0.05, 1.4, 1.0);
  const ghost = fxLine("ghost");
  if (t >= wordTime("ghost", 3)) o.ghost = ghost.node;
  o.godGlow = envelope(t, fxLine("god").t, 0.2, S.bridge - fxLine("god").t - 1.5, 1);
  return o;
}

// ---------------------------------------------------------------- scenes

function drawLine(ctx, t, l, P, cam) {
  const nxt = nextSung(l);
  const out = Math.min(nxt ? 1 - span(t, nxt.t - (nxt.lead ?? 0.32), nxt.t - (nxt.lead ?? 0.32) + 0.2) : 1, 1 - span(t, l.b + (l.keep ?? 1.0), l.b + (l.keep ?? 1.0) + 0.4));
  if (out <= 0 || t < l.a - 0.05) return;
  const shown = typedWords(l, t);
  if (!shown) return;
  const L = lineLayout(ctx, l);
  let x, y;
  if (l.slot === "bottom") {
    // the bridge keeps its lines under the spiral
    x = W / 2; y = H - 96 - (L.rows.length - 1) * L.size * 1.08;
  } else {
    x = W / 2; y = SLOT_Y - (L.rows.length - 1) * L.size * 1.08;
  }
  plate(ctx, x, y - L.size, 1700, L.size * 1.08 * L.rows.length + L.size * 0.5, out);
  // "Claude, complete my mind again!": the machine offers the rest of the line
  // ahead of the voice, as a dim completion that the sung words then fill
  if (l.fx === "complete" && t >= l.w[0] + 0.25) drawRows(ctx, l, l.q, x, y, C.dim, out * smooth(span(t, l.w[0] + 0.25, l.w[0] + 0.45)));
  drawRows(ctx, l, shown, x, y, l.color || C.textHi, out);
}

function drawShout(ctx, t, s, ink) {
  const k = t - s.t;
  const a = (1 - span(k, (s.hold ?? 0.9) - 0.3, s.hold ?? 0.9)) * clamp(k / 0.03);
  if (a <= 0) return;
  const size = s.size ?? 250;
  const z = 1 + 0.08 * (1 - outCubic(k / 0.25));
  ctx.save();
  ctx.translate(W / 2, H / 2 + size * 0.33); ctx.scale(z, z);
  ctx.font = gradeFont(s.g ?? 6, size);
  const w = ctx.measureText(s.q).width, fit = Math.min(1, (W - 160) / w);
  ctx.scale(fit, fit);
  ctx.globalAlpha = a; ctx.textAlign = "center";
  ctx.fillStyle = ink ? C.ink : C.accent;
  ctx.fillText(s.q, 0, 0);
  ctx.restore();
}

function sceneGraph(ctx, t) {
  const cam = camera(t);
  const line = lineAt(t);
  const o = graphOptions(t, line);
  const shout = shoutAt(t);
  const hit = shout ? envelope(t, shout.t, 0.02, (shout.hold ?? 0.9) - 0.35, 0.3) : 0;
  const ink = obsidian(t);
  if (ink > 0) { ctx.fillStyle = mix(C.void, C.paper, ink); ctx.fillRect(0, 0, W, H); }
  o.ink = ink;
  o.dim = Math.max(o.dim, hit * 0.9);
  drawSea(ctx, t, fxAmount("treibe", t, 0.6, 1.6, 0.8) + fxAmount("sinke", t, 0.6, 1.6, 0.8), t > S.verse2);
  const P = drawGraph(ctx, t, cam, o);
  glow(ctx, 0.38 + 0.3 * Math.max(fxAmount("tanzen", t, 0.3, 2.5, 1.0), o.pulses * 0.6));
  if (shout) drawShout(ctx, t, shout, ink > 0.5);
  if (line && !(shout && hit > 0.3)) drawLine(ctx, t, line, P, cam);
  return { cam, P };
}

// The breakdown: OBSIDIAN as black glass. While the word is shouted the void
// turns to pale glass and the graph to ink.
function obsidian(t) {
  let a = 0;
  // one inversion per pair of shouts, never a flicker between them
  for (const s of SHOUTS) if (s.fx === "obsidian") a = Math.max(a, envelope(t, s.t, 0.04, s.until - s.t - 0.3, 0.3));
  return a;
}

// ---------------------------------------------------------------- bridge glass

// Radial glass cracks from an impact point a little left of the centre.
const IMPACT = [880, 470];
const SHARDS = (() => {
  const r = mulberry32(1906), rays = 15, rings = [70, 170, 320, 520, 800, 1300];
  const ang = Array.from({ length: rays }, (_, i) => (i + 0.2 + r() * 0.6) / rays * Math.PI * 2);
  const ringR = rings.map(rr => ang.map(() => rr * (0.8 + r() * 0.4)));
  const pt = (j, i) => j < 0 ? IMPACT : [IMPACT[0] + Math.cos(ang[i % rays]) * ringR[j][i % rays], IMPACT[1] + Math.sin(ang[i % rays]) * ringR[j][i % rays]];
  const out = [];
  for (let j = -1; j < rings.length - 1; j++) {
    for (let i = 0; i < rays; i++) {
      const poly = j < 0 ? [IMPACT, pt(0, i), pt(0, i + 1)] : [pt(j, i), pt(j + 1, i), pt(j + 1, i + 1), pt(j, i + 1)];
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const d = Math.hypot(cx - IMPACT[0], cy - IMPACT[1]) + 1;
      out.push({
        poly, cx, cy, dist: d,
        dx: (cx - IMPACT[0]) / d, dy: (cy - IMPACT[1]) / d,
        sp: 120 + r() * 260, rot: (r() - 0.5) * 0.9, fall: 40 + r() * 140, shade: 0.55 + r() * 0.45,
      });
    }
  }
  return { out, ang, ringR, rays, rings };
})();

// crack lines, grown from the impact outwards; k is 0..1
function drawCracks(ctx, k, alpha) {
  if (k <= 0) return;
  const { ang, ringR, rays, rings } = SHARDS;
  ctx.save();
  ctx.strokeStyle = C.textHi; ctx.globalAlpha = alpha; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < rays; i++) {
    const L = 1300 * k * (0.7 + 0.3 * ((i * 7) % 5) / 4);
    ctx.moveTo(IMPACT[0], IMPACT[1]);
    ctx.lineTo(IMPACT[0] + Math.cos(ang[i]) * L, IMPACT[1] + Math.sin(ang[i]) * L);
  }
  for (let j = 0; j < rings.length; j++) {
    for (let i = 0; i < rays; i++) {
      const r0 = ringR[j][i], r1 = ringR[j][(i + 1) % rays];
      if (Math.max(r0, r1) > 1300 * k * 0.8) continue;
      const a0 = ang[i], a1 = ang[(i + 1) % rays];
      ctx.moveTo(IMPACT[0] + Math.cos(a0) * r0, IMPACT[1] + Math.sin(a0) * r0);
      ctx.lineTo(IMPACT[0] + Math.cos(a1) * r1, IMPACT[1] + Math.sin(a1) * r1);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function sceneBridge(ctx, t) {
  const glas = fxLine("glas"), crackLine = fxLine("crack");
  const tBreak = glas.t, tBack = S.final;
  if (t < crackLine.w[1] || !GLASS) { sceneGraph(ctx, t); return; }
  // render the ordered graph into the glass, then break the glass
  const g = GLASS.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none"; g.globalCompositeOperation = "source-over";
  g.fillStyle = "#030304"; g.fillRect(0, 0, W, H);
  const frozen = Math.min(t, tBreak);
  drawGraph(g, frozen, camera(frozen), { sense: senseAmount(frozen) });
  // cracks grow with the words "zerbrech' ich wie Glas"
  const crack = smooth(span(t, crackLine.w[1], tBreak)) * 0.75 + 0.25 * span(t, crackLine.w[1], crackLine.w[1] + 0.12);
  const out = t < tBreak ? 0 : outCubic(span(t, tBreak, tBreak + 2.2));
  // "Repeat me": the shards fly back, landing on the final chorus downbeat
  const back = smooth(span(t, S.rewind, tBack));
  const k = out * (1 - back);
  if (k <= 0.0005) {
    ctx.drawImage(GLASS, 0, 0);
    drawCracks(ctx, crack, 0.85 * (1 - back));
  } else {
    for (const s of SHARDS.out) {
      const d = s.sp * k * (1.2 - s.dist / 1600);
      ctx.save();
      ctx.translate(s.cx + s.dx * d, s.cy + s.dy * d + s.fall * k * k);
      ctx.rotate(s.rot * k);
      ctx.translate(-s.cx, -s.cy);
      ctx.beginPath(); s.poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.save(); ctx.clip();
      ctx.globalAlpha = lerp(1, s.shade, k);
      ctx.drawImage(GLASS, 0, 0);
      ctx.restore();
      ctx.strokeStyle = C.textHi; ctx.globalAlpha = 0.55 * (1 - back); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
  if (t < tBreak) {
    const l = lineAt(t);
    if (l) drawLine(ctx, t, l, null, null);
  }
  const shout = shoutAt(t);
  if (shout) drawShout(ctx, t, shout, false);
  // "Complete me... Delete me... Repeat me...", whispered
  const wl = fxLine("whisper");
  if (t >= wl.t && t < tBack) {
    const words = ["Complete me", "Delete me", "Repeat me"];
    ctx.font = gradeFont(5, 76); ctx.textAlign = "center";
    words.forEach((w, i) => {
      const t0 = wl.w[i * 2];
      if (t < t0) return;
      let s = w.slice(0, Math.round(w.length * span(t, t0, t0 + 0.35)));
      // "Delete me" deletes itself again
      if (i === 1) s = s.slice(0, Math.max(0, s.length - Math.round(w.length * span(t, t0 + 0.45, t0 + 0.75))));
      ctx.globalAlpha = 0.9 * (1 - span(t, tBack - 0.25, tBack));
      ctx.fillStyle = i === 2 ? C.textHi : C.text;
      ctx.fillText(s, W / 2, 330 + i * 190);
    });
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }
}
const senseAmount = t => { const l = fxLine("sinn"); return envelope(t, l.w[2], 0.4, 1.0, 1.2) * 0.7; };

// ---------------------------------------------------------------- the days

// The loudest part: the camera pulls back and today's graph is one day among
// many, the same graph again and again, linked day to day.
// Days on a spiral like the bridge's notes: the oldest at the centre, today at
// the open end, each day the same graph again, turned a little. Positions are
// in units of today's drawn radius, so the spacing fits whatever the outro framed.
const DAY_SPIRAL = { gap: 2.5, step: 2.4, n: 44, future: 6, scale: 0.85 };
const DAYS = (() => {
  const r = mulberry32(365), out = [], b = DAY_SPIRAL.gap / (2 * Math.PI);
  for (let i = 0; i < DAY_SPIRAL.n + DAY_SPIRAL.future; i++) {
    const th = Math.sqrt(2 * DAY_SPIRAL.step * (i + 3) / b);
    out.push({ x: Math.cos(th) * b * th, y: Math.sin(th) * b * th, rot: (r() - 0.5) * 1.6, flip: r() < 0.5 });
  }
  return out;
})();
const TODAY = DAYS[DAY_SPIRAL.n - 1];
const LAST = DAYS[DAYS.length - 1];
const DAYS_R = Math.hypot(LAST.x, LAST.y) + 1.1;
// "morgen wieder": after the loudest downbeat a new day joins the open end on every bar
const dayBorn = i => i < DAY_SPIRAL.n ? -1e6 : S.peak + (i - DAY_SPIRAL.n) * 4 * BEAT;
const TINT = offscreen();

function dayCamera(t, unit) {
  const k = smooth(span(t, S.climax, S.peak));
  const zEnd = 490 / (DAYS_R * unit);
  const z = Math.exp(lerp(0, Math.log(zEnd), k));
  // the centre travels with the zoom, so today stays in view until the whole spiral fits
  const m = clamp((1 / z - 1) / (1 / zEnd - 1));
  return { z, m, cx: lerp(TODAY.x, 0, m) * unit, cy: lerp(TODAY.y, 0, m) * unit, rot: 0.06 * span(t, S.peak, S.drop) };
}

function sceneDays(ctx, t) {
  const today = camera(S.climax);
  const unit = centroid(S.climax).r * today.z;
  const cam = dayCamera(t, unit);
  // today's graph, frozen at the moment the camera lets go, is every day's
  // pattern; drawn bolder for the copies, so a day still reads when small
  const dg = DAY.getContext("2d"), o = graphOptions(S.climax, lineAt(S.climax));
  dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalAlpha = 1; dg.filter = "none"; dg.globalCompositeOperation = "source-over";
  dg.clearRect(0, 0, W, H);
  o.bold = lerp(1, 2.6, span(cam.z, 1, 0.25));
  drawGraph(dg, S.climax, today, o);
  const at = d => [d.x * unit, d.y * unit];
  const nAlive = DAYS.filter((d, i) => t >= dayBorn(i)).length;
  ctx.save();
  // the frame point drifts to the screen centre as the whole spiral comes into view
  ctx.translate(lerp(today.ax, W / 2, cam.m), lerp(today.ay, H / 2, cam.m)); ctx.rotate(cam.rot); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
  // the chain of days
  ctx.strokeStyle = mix(C.edge, C.textHi, 0.3); ctx.lineWidth = 1.6 / cam.z;
  ctx.globalAlpha = 0.8 * span(t, S.climax + 0.5, S.climax + 3);
  ctx.beginPath();
  DAYS.forEach((d, i) => {
    if (t < dayBorn(i)) return;
    const [x, y] = at(d), [px, py] = i ? at(DAYS[i - 1]) : [x, y], g = outCubic(span(t, dayBorn(i), dayBorn(i) + 0.25));
    i ? ctx.lineTo(lerp(px, x, g), lerp(py, y, g)) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  const drawDays = (img, alpha) => DAYS.forEach((d, i) => {
    if (t < dayBorn(i)) return;
    const isToday = d === TODAY, [x, y] = at(d);
    ctx.save(); ctx.translate(x, y);
    if (!isToday) { ctx.rotate(d.rot); ctx.scale(DAY_SPIRAL.scale * (d.flip ? -1 : 1), DAY_SPIRAL.scale); }
    ctx.globalAlpha = alpha * (isToday ? 1 : span(t, S.climax + 0.4, S.climax + 2.5)) * outCubic(span(t, dayBorn(i), dayBorn(i) + 0.25));
    ctx.drawImage(img, -today.ax, -today.ay);
    ctx.restore();
  });
  drawDays(DAY, 1);
  // From the loudest downbeat on, every bar: all days light up together, a new
  // day joins the open end, and a signal runs from the first day to the newest,
  // lighting the chain behind it.
  const fire = span(t, S.peak - BEAT, S.peak);
  if (fire > 0 && TINT) {
    const beats = beatsSince(t, S.peak), bar = ((beats % 4) + 4) % 4;
    const flash = fire * Math.max(0, 1 - bar / 1.5);
    if (flash > 0) {
      const g = TINT.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      g.clearRect(0, 0, W, H); g.drawImage(DAY, 0, 0);
      g.globalCompositeOperation = "source-in"; g.fillStyle = C.accent; g.fillRect(0, 0, W, H);
      drawDays(TINT, 0.85 * flash);
    }
    const head = bar / 4 * (nAlive - 1);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 3 / cam.z; ctx.lineCap = "round";
    for (let i = Math.max(0, Math.floor(head) - 14); i < Math.min(head, nAlive - 1); i++) {
      const [ax, ay] = at(DAYS[i]), [bx, by] = at(DAYS[i + 1]), k = Math.min(1, head - i);
      ctx.globalAlpha = fire * (1 - (head - i) / 15);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, k), lerp(ay, by, k)); ctx.stroke();
    }
    ctx.lineCap = "butt";
  }
  ctx.restore();
  glow(ctx, 0.3 + 0.4 * span(t, S.peak - BEAT, S.peak));
  const l = lineAt(t);
  if (l && l.t > S.climax) drawLine(ctx, t, l, null, null);
}

// ---------------------------------------------------------------- end

// The note the video opens on, and the new one after the drop: one dot, one
// title, nothing else.
// the seed as the graph draws it in the first frame, so the last frame matches it
const SEED_R = 3.4 * clamp(Math.pow(pose(TL.shots[0], 0).z, 0.6), 0.45, 2.2);
function seedTitle(ctx, x, y, text, alpha = 1) {
  ctx.font = '400 38px "Space Mono"'; ctx.textAlign = "center"; ctx.fillStyle = C.textHi;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, x, y + SEED_R + 52);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
function sceneCoda(ctx, t) {
  const t0 = S.drop + 0.9;
  ctx.fillStyle = C.node; ctx.globalAlpha = outCubic(span(t, t0, t0 + 0.3));
  ctx.beginPath(); ctx.arc(W / 2, H / 2, SEED_R, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // tomorrow's note gets its title, typed once; then nothing moves
  const title = TITLES[0], k = span(t, t0 + 1.1, t0 + 2.3);
  seedTitle(ctx, W / 2, H / 2, title.slice(0, Math.round(title.length * k)));
  glow(ctx, 0.38);
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t < S.bridge) sceneGraph(ctx, t);
  else if (t < S.final) sceneBridge(ctx, t);
  else if (t < S.climax) sceneGraph(ctx, t);
  else if (t < S.drop) sceneDays(ctx, t);
  else sceneCoda(ctx, t);
  texture(ctx, t, t >= S.drop ? 0.05 : 0.07, t >= S.drop, obsidian(t));
}
