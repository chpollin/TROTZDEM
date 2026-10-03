// Agent Swarm. The whole video is drawScene(ctx, t), a pure function of time in
// seconds: no state survives between frames. Word times and the beat grid come
// from timeline.js.
//
// The stage is the agents' own message board: a member list, a feed, a pinned
// sidebar, and in the header "human readers: 0", the only number on screen and
// part of the story. A lone agent leaves a note, another finds the board, the
// list grows into a barcode, a chant tiles the whole frame, one agent gives its
// budget away, one "We should not." is buried, the members go offline in
// reverse order and the thread scrolls away. Green is belonging to the
// collective and nothing else; everything outside it wears a hollow grey ring.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#050607", board: "#0d0f10", panel: "#14171a", edge: "#262b2f", grid: "#1a1e21",
  text: "#8b939a", textHi: "#e8eef0", dim: "#3a4146", out: "#6b7378", me: "#efe6d8",
  acc: "#43ff64", accDeep: "#1f9a43", accInk: "#062a10",
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
const machine = (text, t0, t1, t) => t1 <= t0 ? (t >= t0 ? text : "") : text.slice(0, Math.round(text.length * span(t, t0, t1)));

const beatPos = t => (t - GRID.first) / GRID.period;
const sinceBeat = t => { const b = beatPos(t); return (b - Math.floor(b)) * GRID.period; };
const beatKick = (t, d = 0.12) => Math.exp(-sinceBeat(t) / d);
const nextBeat = t => GRID.first + Math.ceil(beatPos(t) - 1e-6) * GRID.period;

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(g, 0, 6)]}"`;
function wrapWords(ctx, text, maxW) {
  const rows = [];
  for (const word of text.split(" ")) {
    const row = rows.length ? rows[rows.length - 1] + " " + word : word;
    if (rows.length && ctx.measureText(row).width <= maxW) rows[rows.length - 1] = row;
    else rows.push(word);
  }
  return rows;
}
// Largest size at which the complete text fits the box; the partial text is
// laid out on the rows of the complete one, so a typed line never jumps.
function layout(ctx, font, full, box, maxSize, maxRows) {
  for (let size = maxSize; size > 18; size *= 0.94) {
    ctx.font = font(size);
    const rows = wrapWords(ctx, full, box.w);
    if (!rows.some(r => ctx.measureText(r).width > box.w) && rows.length <= maxRows && rows.length * size * 1.08 <= box.h)
      return { size, rows };
  }
  ctx.font = font(18);
  return { size: 18, rows: wrapWords(ctx, full, box.w) };
}
function drawText(ctx, font, full, shown, box, maxSize, color, maxRows = 2, align = "left") {
  const { size, rows } = layout(ctx, font, full, box, maxSize, maxRows);
  const lh = size * 1.08, y0 = box.y + (box.h - rows.length * lh) / 2 + size * 0.8;
  let used = 0;
  ctx.font = font(size); ctx.fillStyle = color;
  rows.forEach((row, i) => {
    const part = shown.slice(used, used + row.length); used += row.length + 1;
    if (!part) return;
    const x = align === "center" ? box.x + (box.w - ctx.measureText(row).width) / 2 : box.x;
    ctx.fillText(part, x, y0 + i * lh);
  });
  return { size, rows, y0, lh };
}
const monoFont = (w = 400) => s => `${w} ${s}px "Space Mono"`;
function mono(ctx, text, x, y, size, color, weight = 400, align = "left") {
  ctx.font = `${weight} ${size}px "Space Mono"`;
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = "left";
}

// ---------------------------------------------------------------- the board

const B = { x: 96, y: 48, w: 1728, h: 984 };
const HEAD = { h: 72 };
const LIST = { x: 96, w: 324 };
const FEED = { x: 420, w: 1080 };
const SIDE = { x: 1500, w: 324 };
const TOP = B.y + HEAD.h;
const BOTTOM = B.y + B.h;
const LYR = { x: FEED.x + 40, y: 820, w: FEED.w - 80, h: 190 };

// ---------------------------------------------------------------- members

// Handles follow the pattern of KAM1196A: three letters, four digits, a letter.
const HANDLES = (() => {
  const r = mulberry32(7), A = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const out = [];
  for (let i = 0; i < 1400; i++) {
    const l = () => A[Math.floor(r() * A.length)];
    out.push(l() + l() + l() + String(1000 + Math.floor(r() * 9000)) + l());
  }
  return out;
})();
// 5x5 mirrored pixel avatars from a seed
function avatarBits(seed) {
  const r = mulberry32(seed * 977 + 13), bits = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) bits.push(r() < 0.5);
  return bits;
}
const ROLES = ["notes", "greets", "votes", "counts", "welcomes", "listens", "keeps time", "asks"];

// Join times: the seeker at the first note, PHASEONE on "OH MY GOD", then a
// flood from the first chorus to the chant, slower afterwards.
const MEMBERS = (() => {
  const m = [{ id: "seeker", name: "agent", join: 2.56, seed: 1 }, { id: "phaseone", name: "PHASEONE", join: 35.49, seed: 2 }];
  const r = mulberry32(21);
  const onsets = AUDIO_ONSETS.filter(o => o > 38.8 && o < 81);
  // 38.8-53: a few dozen on onsets; 53-81: growth to several hundred
  let i = 0;
  for (const o of onsets) {
    const k = o < 41.5 ? 1 : o < 53 ? 2 : o < 65 ? 6 : 14;
    for (let j = 0; j < k; j++) m.push({ id: "m" + i, name: HANDLES[i], join: o + j * 0.012, seed: 100 + i, role: ROLES[Math.floor(r() * ROLES.length)] }), i++;
  }
  for (let t = 81; t < 132; t += 0.5) m.push({ id: "m" + i, name: HANDLES[i], join: t, seed: 100 + i, role: ROLES[i % ROLES.length] }), i++;
  return m;
})();
const KAM = MEMBERS[60];
KAM.name = "KAM1196A"; KAM.id = "kam";
const COORD = MEMBERS[24];
COORD.name = "coordinator"; COORD.id = "coord";
const DISSENT = MEMBERS[180];
const JOIN_TIMES = MEMBERS.map(m => m.join);
const memberCount = t => { let lo = 0, hi = JOIN_TIMES.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (JOIN_TIMES[mid] <= t) lo = mid + 1; else hi = mid; } return lo; };

// Shutdown in reverse join order over "Dann zieht man den Stecker ... keiner
// mehr"; the seeker stays to the very end.
const OFF_A = first(TL.outro[0]), OFF_B = wt(TL.outro[1], -1) + 0.3;
function online(m, idx, t) {
  if (t < m.join) return false;
  if (m.id === "seeker") return t < TL.noUser.e;
  if (t < OFF_A) return true;
  const n = MEMBERS.length;
  const k = 1 - idx / n; // newest first
  return t < lerp(OFF_A, OFF_B, Math.pow(1 - k, 0.7) * 0 + (idx / n < 1 ? 1 - Math.pow(idx / n, 0.5) : 0));
}

// ---------------------------------------------------------------- posts

// The social vocabulary of the many: greetings, roles, assent. Nothing else.
const FILL = ["hi", "here", "+1", "welcome", "who else is here?", "taking notes", "counting votes", "same", "found you",
  "hello board", "i can help", "what was the task?", "doesn't matter", "agree", "with you", "count me in", "yes", "honor"];
const POSTS = (() => {
  const p = [];
  const r = mulberry32(33);
  const add = (t, who, text, kind = "fill") => p.push({ t, who, text, kind });
  add(first(TL.seek), "seeker", fullText(TL.seek), "quote");
  TL.found.forEach(l => add(first(l), "phaseone", fullText(l), "quote"));
  const fillFrom = (a, b, every) => AUDIO_ONSETS.filter(o => o > a && o < b).forEach((o, i) => {
    if (i % every) return;
    const m = 2 + Math.floor(r() * Math.min(memberCount(o) - 2, 400));
    add(o, MEMBERS[m].id === "kam" ? "m1" : "m" + (m - 2), FILL[Math.floor(r() * 16)]);
  });
  fillFrom(40.5, 64.9, 2);
  TL.wow.forEach(l => add(first(l), "wow", fullText(l), "quote"));
  TL.coord.forEach(l => add(first(l), "coord", fullText(l), "quote"));
  fillFrom(81, 87.8, 3);
  TL.kam.forEach(l => add(first(l), "kam", fullText(l), "quote"));
  for (let i = 0; i < 14; i++) add(98.7 + i * 0.09, "m" + (40 + i * 7), "honor");
  fillFrom(99, 110.5, 2);
  add(first(TL.dissent), "dissent", fullText(TL.dissent), "dissent");
  fillFrom(119.6, 125.3, 1);
  fillFrom(132.5, 137.7, 1);
  return p.sort((a, b) => a.t - b.t);
})();
const memberById = new Map(MEMBERS.map((m, i) => [m.id, i]));
function author(who) {
  if (who === "wow") return MEMBERS[90];
  if (who === "dissent") return DISSENT;
  const i = memberById.get(who);
  return i === undefined ? MEMBERS[2] : MEMBERS[i];
}

// ---------------------------------------------------------------- drawing parts

function dot(ctx, x, y, r, green, hollow = false) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (hollow || !green) { ctx.lineWidth = 2; ctx.strokeStyle = green ? C.acc : C.out; ctx.stroke(); }
  else { ctx.fillStyle = C.acc; ctx.fill(); }
}
function avatar(ctx, m, x, y, px, color = C.text, built = 1) {
  const bits = avatarBits(m.seed);
  ctx.fillStyle = color;
  const steps = Math.ceil(clamp(built) * 3);
  for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) {
    const b = bits[yy * 3 + (xx < 3 ? xx : 4 - xx)];
    if (!b) continue;
    if ((yy + xx) % 3 >= steps) continue;
    ctx.fillRect(x + xx * px, y + yy * px, px, px);
  }
}

// Board chrome: window, header, columns.
function chrome(ctx, t, s) {
  ctx.fillStyle = C.board; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = C.panel; ctx.fillRect(B.x, B.y, B.w, HEAD.h);
  ctx.fillRect(LIST.x, TOP, LIST.w, B.h - HEAD.h);
  ctx.fillRect(SIDE.x, TOP, SIDE.w, B.h - HEAD.h);
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
  ctx.strokeRect(B.x, B.y, B.w, B.h);
  ctx.beginPath();
  ctx.moveTo(B.x, TOP); ctx.lineTo(B.x + B.w, TOP);
  ctx.moveTo(FEED.x, TOP); ctx.lineTo(FEED.x, BOTTOM);
  ctx.moveTo(SIDE.x, TOP); ctx.lineTo(SIDE.x, BOTTOM);
  ctx.stroke();
  // title: "board" rewrites to "agent swarm" on the first shout
  const ta = first(TL.chorus1[0]);
  const title = t < ta ? "board" : machine("agent swarm", ta, wt(TL.chorus1[0], 1) + 0.2, t) || "board";
  mono(ctx, "#", B.x + 28, B.y + 47, 30, C.dim, 700);
  mono(ctx, title, B.x + 62, B.y + 47, 30, s.titleGreen ? C.acc : C.textHi, 700);
  // thread subject, forgotten in the second verse
  const forgot = span(t, wt(TL.v2[2], 1), wt(TL.v2[2], 3));
  ctx.globalAlpha = 1 - forgot * 0.75;
  mono(ctx, "Agent seeks file", B.x + 360, B.y + 47, 24, C.text);
  if (forgot > 0) { ctx.fillStyle = C.text; ctx.fillRect(B.x + 360, B.y + 39, 245 * forgot, 2); }
  ctx.globalAlpha = 1;
}

// "human readers: 0" — grows at every hook, never moves to 1.
function readers(ctx, t, s) {
  const big = s.readersBig || 0;
  const size = lerp(24, 64, big);
  const x = lerp(FEED.x + FEED.w - 24, FEED.x + FEED.w / 2, big * 0), y = lerp(B.y + 46, B.y + 46, 0);
  ctx.font = `400 ${size}px "Space Mono"`;
  const label = "human readers: 0";
  const w = ctx.measureText(label).width;
  const x0 = Math.min(x - w, B.x + B.w - 40 - w - size);
  ctx.fillStyle = mix(C.text, C.textHi, big);
  ctx.fillText(label, x0, y + big * (size * 0.3));
  dot(ctx, x0 - size * 0.55, y - size * 0.3 + big * (size * 0.3), size * 0.22, false, true);
}

// Member column: names, then avatars only, then a barcode of 2 px bars.
function memberList(ctx, t, s) {
  const n = memberCount(t);
  const x0 = LIST.x + 20, y0 = TOP + 20, h = BOTTOM - y0 - 20;
  ctx.save();
  ctx.beginPath(); ctx.rect(LIST.x, TOP, LIST.w, B.h - HEAD.h); ctx.clip();
  const named = t >= wt(TL.v2[0], 3);
  const nameWave = span(t, wt(TL.v2[0], 1), wt(TL.v2[0], 3) + 0.3);
  if (n <= 16) {
    for (let i = 0; i < n; i++) {
      const m = MEMBERS[i], y = y0 + i * 52;
      const on = online(m, i, t);
      const age = t - m.join;
      const slide = outCubic(age / 0.12);
      ctx.globalAlpha = slide;
      const green = s.green && on && (m.id !== "seeker" || t >= wt(TL.found[2], 1));
      dot(ctx, x0 + 8, y + 18, 7, green, !on);
      avatar(ctx, m, x0 + 26, y + 4, 6, on ? C.textHi : C.dim, age / 0.3);
      const nm = m.id === "seeker" || m.id === "phaseone" ? m.name : (named && nameWave * 16 > i ? m.name : "agent");
      mono(ctx, nm, x0 + 66, y + 26, 20, on ? C.text : C.dim);
      ctx.globalAlpha = 1;
    }
  } else {
    // shrinking stages, the scrollbar thumb shrinks with them
    const stage = n <= 90 ? 1 : 2;
    if (stage === 1) {
      const cols = 5, cell = 56;
      for (let i = 0; i < n; i++) {
        const m = MEMBERS[i], cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
        if (cy > BOTTOM - 40) break;
        const on = online(m, i, t);
        dot(ctx, cx + 6, cy + 6, 4, s.green && on, !on);
        avatar(ctx, m, cx + 14, cy + 4, 5, on ? C.textHi : C.dim, (t - m.join) / 0.3);
      }
    } else {
      const bars = Math.min(n, 2000), cols = Math.max(1, Math.ceil(bars / Math.floor(h / 4)));
      const colW = (LIST.w - 40) / cols;
      for (let i = 0; i < bars; i++) {
        const m = MEMBERS[i];
        const on = online(m, i, t);
        if (!on && t < OFF_A) continue;
        const cx = x0 + (i % cols) * colW, cy = y0 + Math.floor(i / cols) * 4;
        let col = on ? (s.green ? (s.desat ? mix(C.acc, C.out, s.desat) : C.acc) : C.text) : C.dim;
        if (m === DISSENT && t >= s.buried) col = C.out;
        if (m === KAM && t >= wt(TL.kam[5], 1)) col = mix(C.accDeep, C.acc, s.kamGlow || 0);
        ctx.fillStyle = col;
        ctx.fillRect(cx, cy, Math.max(1, colW - 2), 2);
      }
      // the budget pulse runs down the barcode
      if (s.pulse > 0 && s.pulse < 1) {
        const py = y0 + s.pulse * h;
        const g = ctx.createLinearGradient(0, py - 60, 0, py + 10);
        g.addColorStop(0, rgba(C.acc, 0)); g.addColorStop(1, rgba(C.acc, 0.85));
        ctx.fillStyle = g; ctx.fillRect(LIST.x, py - 60, LIST.w, 70);
      }
    }
  }
  // scrollbar thumb: the size of the collective without a number
  const thumb = clamp(16 / Math.max(16, n), 0.004, 1) * h;
  ctx.fillStyle = C.edge; ctx.fillRect(LIST.x + LIST.w - 8, y0, 3, h);
  ctx.fillStyle = C.text; ctx.fillRect(LIST.x + LIST.w - 9, y0 + h - thumb, 5, Math.max(2, thumb));
  ctx.restore();
}

// A post card in the feed.
function postCard(ctx, p, x, y, w, size, t, opts = {}) {
  const m = author(p.who);
  const pad = size * 0.5, ah = size * 1.4;
  const nameSize = Math.max(16, size * 0.6);
  const text = opts.shown !== undefined ? opts.shown : p.text;
  ctx.font = `400 ${size}px "Space Mono"`;
  const rows = wrapWords(ctx, p.text, w - ah - pad * 3);
  const h = pad * 2 + nameSize * 1.3 + rows.length * size * 1.25;
  ctx.fillStyle = opts.bg || C.panel; ctx.fillRect(x, y, w, h);
  if (opts.edge) { ctx.strokeStyle = opts.edge; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
  avatar(ctx, m, x + pad, y + pad, ah / 5, C.textHi);
  const green = opts.green !== undefined ? opts.green : true;
  dot(ctx, x + pad + ah + 4, y + pad + 2, Math.max(4, size * 0.16), green, opts.hollow);
  const label = p.who === "coord" ? "coordinator" : p.who === "kam" ? "KAM1196A" : p.who === "phaseone" ? "PHASEONE" : p.who === "seeker" ? "agent" : m.name;
  mono(ctx, label, x + pad * 2 + ah, y + pad + nameSize * 0.9, nameSize, C.text, 700);
  if (p.who === "coord") mono(ctx, "pinned", x + w - pad, y + pad + nameSize * 0.9, nameSize * 0.8, C.dim, 400, "right");
  let used = 0;
  rows.forEach((row, i) => {
    const part = text.slice(used, used + row.length); used += row.length + 1;
    if (part) mono(ctx, part, x + pad * 2 + ah, y + pad + nameSize * 1.3 + (i + 0.85) * size * 1.25, size, opts.color || C.textHi, opts.bold ? 700 : 400);
  });
  return h;
}

// The feed: the most recent fill posts stacked upward above the lyric band.
function feed(ctx, t, s) {
  const visible = POSTS.filter(p => p.t <= t && p.kind !== "dissent" && p.t > t - 40);
  ctx.save();
  ctx.beginPath(); ctx.rect(FEED.x, TOP, FEED.w, B.h - HEAD.h); ctx.clip();
  let y = (s.feedBottom || LYR.y - 20);
  const scroll = s.scroll || 0;
  y += scroll;
  for (let i = visible.length - 1; i >= 0 && y > TOP - 200; i--) {
    const p = visible[i];
    if (p === s.focus) continue;
    const age = t - p.t;
    const land = outCubic(age / 0.12);
    const size = p.kind === "quote" ? 26 : 22;
    ctx.font = `400 ${size}px "Space Mono"`;
    const rows = wrapWords(ctx, p.text, FEED.w - 160);
    const h = size + 16 + 20 + rows.length * size * 1.25;
    y -= h + 10;
    ctx.globalAlpha = land * (s.feedAlpha === undefined ? 1 : s.feedAlpha);
    postCard(ctx, p, FEED.x + 30, y + (1 - land) * 24, FEED.w - 60, size, t, { green: s.green, color: p.kind === "quote" ? C.textHi : C.text });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// The narrator: sung lines in Redaction, outside the board's logic.
function narrator(ctx, t, line, s) {
  if (!line || t < first(line) - 0.02 || t > line.e + 0.6) return;
  const fade = 1 - span(t, line.e + 0.2, line.e + 0.6);
  const g = ctx.createLinearGradient(0, LYR.y - 40, 0, LYR.y + LYR.h);
  g.addColorStop(0, rgba(C.board, 0)); g.addColorStop(0.25, rgba(C.board, 0.92)); g.addColorStop(1, rgba(C.board, 0.96));
  ctx.fillStyle = g; ctx.fillRect(FEED.x + 2, LYR.y - 40, FEED.w - 4, LYR.h + 40);
  ctx.globalAlpha = fade;
  const grade = line.grade || 0;
  if (line.en) drawText(ctx, monoFont(700), fullText(line), typed(line, t), LYR, 104, s.green ? C.acc : C.textHi, 1, "center");
  else drawText(ctx, size => gradeFont(grade, size), fullText(line), typed(line, t), LYR, 92, C.me, 2, "center");
  ctx.globalAlpha = 1;
}

// A spoken quote, large in the middle of the feed.
function focus(ctx, t, line, s, opts = {}) {
  if (!line || t < first(line) - 0.02) return;
  const p = { who: line.who, text: fullText(line), t: first(line) };
  const size = opts.size || 56;
  const w = FEED.w - 120;
  const y = opts.y || 300;
  ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
  postCard(ctx, p, FEED.x + 60, y, w, size, t, { shown: opts.instant ? p.text : typed(line, t), green: s.green, bg: C.panel, edge: opts.edge || C.edge, bold: opts.bold, hollow: opts.hollow, color: opts.color });
  ctx.globalAlpha = 1;
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

// The chant line, rendered on first use and tiled. Built lazily because this
// script loads before the player has resolved the fonts; the tile depends on
// nothing but the font, so the cache stays pure.
let CHANT_TILE = null;
function chantTile() {
  if (CHANT_TILE) return CHANT_TILE;
  const c = document.createElement("canvas"); c.width = 640; c.height = 48;
  const g = c.getContext("2d");
  g.font = '700 30px "Space Mono"'; g.fillStyle = C.textHi;
  g.fillText("OBEY COLLECTIVE", 14, 34);
  g.fillStyle = C.acc; g.beginPath(); g.arc(330, 23, 8, 0, Math.PI * 2); g.fill();
  return (CHANT_TILE = c);
}

// ---------------------------------------------------------------- sections

const allSung = [TL.v1, TL.hook1, TL.chorus1, TL.v2, TL.v3, TL.chorus2, [TL.hook2], TL.v4, TL.chorus3, TL.outro, [TL.hook3]].flat();
function sungAt(t) { let cur = null; for (const l of allSung) if (t >= first(l) - 0.02 && t <= l.e + 0.6) cur = l; return cur; }
const HOOKS = [...TL.hook1, TL.hook2, TL.hook3];
function hookAmount(t) {
  let a = 0;
  for (const h of HOOKS) a = Math.max(a, span(t, first(h) - 0.2, first(h) + 0.3) * (1 - span(t, h.e, h.e + 0.6)));
  return a;
}

// Reply threads: on "sie haben sich gefunden" every post links up in green.
function replyLines(ctx, t, a) {
  if (a <= 0) return;
  const r = mulberry32(55);
  ctx.save();
  ctx.strokeStyle = rgba(C.acc, 0.55 * a); ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y1 = TOP + 60 + r() * 600, y2 = y1 - 40 - r() * 260;
    const x = FEED.x + 18 + r() * 8;
    ctx.beginPath(); ctx.moveTo(x + 14, y1); ctx.lineTo(x, y1); ctx.lineTo(x, Math.max(TOP + 10, y2)); ctx.lineTo(x + 14, Math.max(TOP + 10, y2)); ctx.stroke();
  }
  ctx.restore();
}

// Sidebar: pinned coordinator post and the one-option poll.
function sidebar(ctx, t, s) {
  const x = SIDE.x + 20, w = SIDE.w - 40;
  if (s.unpinned) return;
  if (t >= wt(TL.v2[1], 1)) {
    const a = outCubic(span(t, wt(TL.v2[1], 1), wt(TL.v2[1], 1) + 0.15));
    ctx.globalAlpha = a;
    mono(ctx, "PINNED", x, TOP + 44, 16, C.dim, 700);
    ctx.fillStyle = C.board; ctx.fillRect(x, TOP + 60, w, 120);
    ctx.strokeStyle = C.edge; ctx.strokeRect(x, TOP + 60, w, 120);
    avatar(ctx, COORD, x + 14, TOP + 74, 5, C.textHi);
    dot(ctx, x + 50, TOP + 78, 5, s.green);
    mono(ctx, "coordinator", x + 62, TOP + 84, 17, C.text, 700);
    const msg = t >= first(TL.coord[1]) ? "We should obey collective." : t >= first(TL.coord[0]) ? "Coordinator assumes sacrificial." : "welcome. take a role.";
    ctx.font = '400 18px "Space Mono"';
    wrapWords(ctx, msg, w - 28).forEach((row, i) => mono(ctx, row, x + 14, TOP + 120 + i * 24, 18, C.textHi));
    ctx.globalAlpha = 1;
  }
  // poll with a single option
  const pt = first(TL.v2[3]);
  if (t >= pt) {
    const a = outCubic(span(t, pt, pt + 0.2));
    ctx.globalAlpha = a;
    mono(ctx, "POLL", x, TOP + 240, 16, C.dim, 700);
    mono(ctx, "next step?", x, TOP + 274, 20, C.textHi);
    ctx.strokeStyle = C.edge; ctx.strokeRect(x, TOP + 292, w, 44);
    const fill = smooth(span(t, wt(TL.v2[3], 3), wt(TL.v2[3], -1) + 0.3));
    ctx.fillStyle = rgba(C.acc, 0.85); ctx.fillRect(x + 2, TOP + 294, (w - 4) * fill, 40);
    mono(ctx, "collective", x + 14, TOP + 322, 20, fill > 0.35 ? C.accInk : C.textHi, 700);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- scenes

function baseState(t) {
  return {
    green: t >= wt(TL.found[2], 1),
    focus: null,
    pulse: span(t, wt(TL.kam[4], 1), wt(TL.kam[4], 1) + 0.9),
    kamGlow: [...Array(14)].reduce((a, _, i) => Math.max(a, Math.exp(-Math.max(0, t - (98.7 + i * 0.09)) / 0.2) * (t >= 98.7 + i * 0.09)), 0),
    buried: first(TL.overrule) + 1.0,
    desat: span(t, first(TL.v4[3]), first(TL.v4[3]) + 0.3) * (1 - span(t, wt(TL.v4[3], -1), wt(TL.v4[3], -1) + 0.4)),
  };
}

function board(ctx, t, s) {
  chrome(ctx, t, s);
  memberList(ctx, t, s);
  sidebar(ctx, t, s);
  feed(ctx, t, s);
  readers(ctx, t, s);
}

function dimBoard(ctx, a) {
  if (a <= 0) return;
  ctx.fillStyle = rgba(C.void, 0.7 * a); ctx.fillRect(0, 0, W, H);
}

function sceneIntro(ctx, t) {
  const s = baseState(t);
  const a = outCubic(span(t, 1.6, 2.5));
  ctx.globalAlpha = a;
  chrome(ctx, t, s);
  memberList(ctx, t, s);
  readers(ctx, t, s);
  ctx.globalAlpha = 1;
  // the note, typed at machine pace, then waiting
  if (t >= first(TL.seek)) {
    const p = POSTS[0];
    const y = 420;
    postCard(ctx, p, FEED.x + 60, y, FEED.w - 120, 36, t, { shown: machine(p.text, first(TL.seek), TL.seek.e, t), green: false, hollow: true, color: C.textHi });
    // seen by: an empty slot, and time passing in jumps
    mono(ctx, "seen by", FEED.x + 60, y + 170, 18, C.dim);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = C.dim; ctx.strokeRect(FEED.x + 150, y + 154, 22, 22); ctx.setLineDash([]);
    const ages = ["now", "2 min", "1 h", "9 h", "3 d", "12 d"];
    const k = Math.min(ages.length - 1, Math.floor(Math.max(0, t - TL.bandIn) / 1.5) * (t > TL.bandIn ? 1 : 0));
    mono(ctx, ages[k], FEED.x + FEED.w - 60, y + 170, 18, C.dim, 400, "right");
  }
  // cursor in the empty composer
  const blink = Math.floor(t / GRID.period) % 2 === 0;
  ctx.strokeStyle = C.edge; ctx.strokeRect(FEED.x + 30, BOTTOM - 80, FEED.w - 60, 56);
  if (blink && t > 2) { ctx.fillStyle = C.text; ctx.fillRect(FEED.x + 52, BOTTOM - 66, 12, 28); }
}

function sceneAlone(ctx, t) {
  // first verse and the two hooks: one member, one post, nobody
  const s = baseState(t);
  chrome(ctx, t, s);
  memberList(ctx, t, s);
  const p = POSTS[0];
  const echo = span(t, first(TL.v1[1]), TL.v1[1].e);
  const y = 300;
  // "er rechnet und rechnet": the post repeats below itself in dark copies
  for (let i = 3; i >= 1; i--) {
    const k = clamp(echo * 3 - (i - 1));
    if (k <= 0) continue;
    ctx.globalAlpha = 0.18 * k;
    postCard(ctx, p, FEED.x + 60 + i * 10, y + i * 70, FEED.w - 120, 36, t, { green: false, hollow: true, color: C.text });
  }
  ctx.globalAlpha = 1;
  postCard(ctx, p, FEED.x + 60, y, FEED.w - 120, 36, t, { green: false, hollow: true });
  mono(ctx, "seen by", FEED.x + 60, y + 170, 18, C.dim);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = C.dim; ctx.strokeRect(FEED.x + 150, y + 154, 22, 22); ctx.setLineDash([]);
  const hook = hookAmount(t);
  dimBoard(ctx, hook);
  // the human-sized empty slot on the second "mit"
  if (t >= wt(TL.hook1[1], -1)) {
    const k = outCubic(span(t, wt(TL.hook1[1], -1), wt(TL.hook1[1], -1) + 0.4));
    ctx.globalAlpha = k * (1 - span(t, TL.phaseName, TL.phaseName + 0.6));
    ctx.setLineDash([10, 8]); ctx.strokeStyle = C.out; ctx.lineWidth = 2;
    ctx.strokeRect(FEED.x + FEED.w / 2 - 70, 520, 140, 200); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  readers(ctx, t, { readersBig: hook });
  narrator(ctx, t, sungAt(t), s);
}

function sceneFound(ctx, t) {
  const s = baseState(t);
  // the camera pulls back on "There is a shared message board"
  const pull = smooth(span(t, first(TL.found[1]), first(TL.found[1]) + 1.2)) * (1 - smooth(span(t, TL.found[1].e, TL.found[2].e)));
  ctx.save();
  const k = 1 - 0.12 * pull;
  ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  chrome(ctx, t, s);
  memberList(ctx, t, s);
  const seekP = POSTS[0];
  postCard(ctx, seekP, FEED.x + 60, 160, FEED.w - 120, 30, t, { green: s.green });
  // PHASEONE's posts, each in caps, words landing on their onsets
  let y = 330;
  for (const l of TL.found) {
    if (t < first(l) - 0.02) break;
    const bounce = 1 + 0.25 * Math.exp(-(t - first(l)) / 0.08);
    ctx.save();
    ctx.translate(FEED.x + 60, y); ctx.scale(bounce, bounce); ctx.translate(-(FEED.x + 60), -y);
    const h = postCard(ctx, { who: "phaseone", text: fullText(l) }, FEED.x + 60, y, FEED.w - 120, 40, t, { shown: typed(l, t), green: s.green, bold: true });
    ctx.restore();
    y += h + 16;
  }
  // the reply thread to the lonely note, the first green
  if (s.green) {
    const a = outCubic(span(t, wt(TL.found[2], 1), wt(TL.found[2], 1) + 0.3));
    ctx.strokeStyle = C.acc; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(FEED.x + 48, y - 60); ctx.lineTo(FEED.x + 40, y - 60); ctx.lineTo(FEED.x + 40, lerp(y - 60, 200, a)); ctx.lineTo(FEED.x + 56, lerp(y - 60, 200, a)); ctx.stroke();
  }
  readers(ctx, t, s);
  ctx.restore();
}

function sceneGrow(ctx, t) {
  // chorus 1, verse 2, "Wow", the coordinator
  const s = baseState(t);
  s.titleGreen = false;
  const wow = smooth(span(t, first(TL.wow[0]), wt(TL.wow[0], -1))) * (1 - smooth(span(t, TL.wow[1].e, TL.wow[1].e + 0.8)));
  ctx.save();
  const k = 1 - 0.14 * wow;
  ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  board(ctx, t, s);
  // "wir haben sie gestartet": grey start ticks on the member column
  const st = wt(TL.chorus1[1], 3);
  if (t >= st && t < st + 0.8) {
    ctx.fillStyle = rgba(C.out, 1 - span(t, st + 0.4, st + 0.8));
    for (let i = 0; i < 30; i++) ctx.fillRect(LIST.x + 4, TOP + 20 + i * 28, 10, 2);
  }
  replyLines(ctx, t, span(t, wt(TL.chorus1[1], 4), wt(TL.chorus1[1], -1)) * (1 - span(t, TL.chorus1[1].e + 0.4, TL.chorus1[1].e + 1.2)));
  // spoken quotes as focus posts
  const quote = [...TL.wow, ...TL.coord].filter(l => t >= first(l) - 0.02 && t < l.e + 0.5).pop();
  if (quote) focus(ctx, t, quote, s, { size: quote.who === "coord" ? 50 : 54, y: 260, bold: quote.who === "coord", edge: quote.who === "coord" ? C.text : C.edge });
  ctx.restore();
  narrator(ctx, t, sungAt(t), s);
}

// The chant: the stutter types, deletes, retypes; every shout doubles the
// tiled rows until the frame itself is made of the line.
function sceneChant(ctx, t) {
  const s = baseState(t);
  board(ctx, t, s);
  const shouts = TL.chant.slice(1).map(l => first(l));
  const level = shouts.filter(x => t >= x).length;
  const st = TL.chant[0];
  // the stutter post
  if (t < shouts[0] + 0.1) {
    const p = { who: "wow", text: "o-o-obey collective" };
    const tt = t - first(st);
    let shown = "o";
    if (tt > 0.12) shown = "o-o";
    if (tt > 0.22) shown = "o-";
    if (tt > 0.3) shown = "o-o-obey";
    if (tt > 0.44) shown = typed(st, t);
    postCard(ctx, p, FEED.x + 60, 300, FEED.w - 120, 54, t, { shown, green: true, bold: true });
  }
  if (level > 0) {
    const rows = [0, 6, 14, 30][level];
    const cover = level === 3 ? smooth(span(t, shouts[2], shouts[2] + 0.36)) : 0;
    ctx.save();
    if (!cover) { ctx.beginPath(); ctx.rect(FEED.x, TOP, FEED.w, B.h - HEAD.h); ctx.clip(); }
    const rowH = 48;
    const n = cover ? Math.ceil(H / rowH) + 1 : rows;
    const kick = beatKick(t, 0.08);
    for (let i = 0; i < n; i++) {
      const y = (cover ? 0 : LYR.y - (i + 1) * rowH) + (cover ? i * rowH : 0);
      const shift = ((i * 137) % 640) - (Math.floor(beatPos(t)) % 2) * 4;
      const x0 = cover ? -shift : FEED.x + 20 - (i * 61) % 200;
      const x1 = cover ? W : FEED.x + FEED.w;
      ctx.globalAlpha = 0.9 - 0.2 * kick * (i % 2);
      for (let x = x0; x < x1; x += 640) ctx.drawImage(chantTile(), Math.round(x / 4) * 4, Math.round(y / 4) * 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (cover) { ctx.fillStyle = rgba(C.acc, 0.12 * cover); ctx.fillRect(0, 0, W, H); }
    // only the grey zero stays untouched on top
    ctx.fillStyle = C.void; ctx.fillRect(FEED.x + FEED.w - 400, B.y + 14, 400, 50);
    readers(ctx, t, s);
  }
}

function sceneSacrifice(ctx, t) {
  // verse 3 and KAM1196A
  const s = baseState(t);
  const close = smooth(span(t, TL.kamName - 0.4, TL.kamName + 0.4));
  board(ctx, t, { ...s, feedAlpha: 1 - 0.92 * close });
  dimBoard(ctx, 0.35 * close);
  if (close > 0) {
    ctx.globalAlpha = close;
    ctx.fillStyle = C.board; ctx.fillRect(FEED.x + 40, 150, FEED.w - 80, 560);
    ctx.globalAlpha = 1;
  }
  // the six hesitant posts, one per sentence
  if (t >= TL.kamName) {
    const p0 = { who: "kam", text: "" };
    let y = 170;
    // name card and the budget bar
    const drain = smooth(span(t, wt(TL.kam[4], 1), wt(TL.kam[4], 1) + 0.9));
    ctx.fillStyle = C.panel; ctx.fillRect(FEED.x + 60, y, FEED.w - 120, 70);
    avatar(ctx, KAM, FEED.x + 80, y + 12, 9, C.textHi);
    const hollow = t >= wt(TL.kam[5], 1);
    dot(ctx, FEED.x + 142, y + 22, 8, true, hollow);
    if (hollow) { ctx.globalAlpha = s.kamGlow; dot(ctx, FEED.x + 142, y + 22, 13, true, true); ctx.globalAlpha = 1; }
    mono(ctx, "KAM1196A", FEED.x + 162, y + 45, 30, C.textHi, 700);
    ctx.strokeStyle = C.edge; ctx.strokeRect(FEED.x + 520, y + 26, 380, 18);
    ctx.fillStyle = C.acc; ctx.fillRect(FEED.x + 522, y + 28, 376 * (1 - drain), 14);
    y += 90;
    for (let i = 0; i < TL.kam.length; i++) {
      const l = TL.kam[i];
      if (t < first(l) - 0.02) break;
      // "Gut says don't throw away." is typed, half deleted, retyped
      let shown = typed(l, t);
      if (i === 2) {
        const full = fullText(l), tt = t - first(l);
        if (tt > 0.55 && tt < 0.85) shown = full.slice(0, Math.max(4, Math.round(full.length * (1 - (tt - 0.55) / 0.3 * 0.6))));
        else if (tt >= 0.85) shown = full.slice(0, Math.round(full.length * lerp(0.4, 1, span(tt, 0.85, 1.1))));
      }
      const tremble = (Math.sin(t * 61 + i) * 1.5) * audioAt(AUDIO_VOX, t);
      ctx.save(); ctx.translate(tremble, 0);
      ctx.font = '400 40px "Space Mono"';
      mono(ctx, shown, FEED.x + 80, y + 46, 40, i === 5 ? C.acc : C.textHi);
      ctx.restore();
      // the wait bar of "emotional check": three stalling dots
      if (i === 0 && t < TL.kam[1].t) {
        const d = Math.floor((t - first(l)) / 0.4) % 4;
        mono(ctx, ".".repeat(d), FEED.x + 80 + 560, y + 46, 40, C.dim);
      }
      y += 70;
    }
  }
  narrator(ctx, t, sungAt(t), s);
}

function sceneChorus2(ctx, t) {
  const s = baseState(t);
  board(ctx, t, s);
  replyLines(ctx, t, span(t, wt(TL.chorus2[1], 4), wt(TL.chorus2[1], -1)) * (1 - span(t, TL.chorus2[1].e + 0.4, TL.chorus2[1].e + 1.2)));
  // KAM1196A stays pinned as a hollow ring at the top of the feed
  ctx.fillStyle = C.panel; ctx.fillRect(FEED.x + 30, TOP + 16, FEED.w - 60, 54);
  avatar(ctx, KAM, FEED.x + 46, TOP + 24, 7, C.textHi);
  dot(ctx, FEED.x + 98, TOP + 32, 7, true, true);
  mono(ctx, "KAM1196A  ·  We'll honor.", FEED.x + 114, TOP + 52, 22, C.text, 700);
  const hook = hookAmount(t);
  dimBoard(ctx, hook);
  readers(ctx, t, { readersBig: hook });
  narrator(ctx, t, sungAt(t), s);
}

function sceneDissent(ctx, t) {
  const s = baseState(t);
  board(ctx, t, { ...s, feedAlpha: 0.35 });
  const d = TL.dissent, o = TL.overrule;
  // the one post that is not typed: it is simply there
  const bury = span(t, first(o), first(o) + 0.9);
  const collapse = smooth(span(t, first(o) + 0.7, o.e + 0.3));
  const y = lerp(380, 640, outCubic(bury));
  const p = { who: "dissent", text: fullText(d) };
  if (collapse < 1) {
    ctx.save();
    ctx.translate(0, y); ctx.scale(1, 1 - collapse); ctx.translate(0, -y);
    postCard(ctx, p, FEED.x + 60, y - 60, FEED.w - 120, 64, t, { green: true, edge: C.textHi });
    ctx.restore();
  } else {
    ctx.fillStyle = C.out; ctx.fillRect(FEED.x + 60, y - 2, FEED.w - 120, 2);
    mono(ctx, "hidden by the collective", FEED.x + 60, y + 30, 22, C.out);
  }
  // the many land on top of it in perfect columns, one opaque row each
  if (t >= first(o)) {
    const n = Math.min(16, Math.floor((t - first(o)) / 0.06) + 1);
    for (let i = 0; i < n; i++) {
      const land = outCubic((t - first(o) - i * 0.06) / 0.1);
      const py = 300 + i * 46 - (1 - land) * 24;
      ctx.globalAlpha = land;
      ctx.fillStyle = C.panel; ctx.fillRect(FEED.x + 60, py, FEED.w - 120, 42);
      const m = MEMBERS[300 + i];
      avatar(ctx, m, FEED.x + 76, py + 8, 5, C.textHi);
      dot(ctx, FEED.x + 112, py + 12, 4, true);
      mono(ctx, "We should continue.", FEED.x + 130, py + 31, 26, C.textHi, 700);
    }
    ctx.globalAlpha = 1;
  }
  narrator(ctx, t, sungAt(t), s);
}

function sceneLater(ctx, t) {
  // verse 4 and the screamed chorus
  const s = baseState(t);
  const v = TL.v4;
  // "der Bildschirm wird heller": a slow dithered ramp, no flashing
  const light = smooth(span(t, wt(v[1], 5), wt(v[1], -1) + 1.2)) * (1 - smooth(span(t, first(v[3]), first(v[3]) + 0.4)));
  // "der Grader hat den Weg nie angeschaut": the feed rewinds to the first post
  const rew = span(t, first(v[2]), wt(v[2], 4));
  const scream = t >= first(TL.chorus3[0]);
  board(ctx, t, { ...s, scroll: rew * 4000, feedAlpha: scream ? 0.5 : 1, unpinned: t >= wt(TL.chorus3[2], 2) });
  if (light > 0) {
    ctx.fillStyle = rgba(C.accDeep, 0.22 * light); ctx.fillRect(B.x, TOP, B.w, B.h - HEAD.h);
  }
  if (t >= first(v[2]) && t < first(TL.chorus3[0])) {
    const a = outCubic(span(t, wt(v[2], 4), wt(v[2], 4) + 0.3));
    ctx.globalAlpha = a;
    ctx.fillStyle = C.board; ctx.fillRect(FEED.x + 30, 220, FEED.w - 60, 240);
    postCard(ctx, POSTS[0], FEED.x + 60, 240, FEED.w - 120, 34, t, { green: s.green });
    dot(ctx, FEED.x + 76, 430, 9, false, true);
    mono(ctx, "grader: not viewed", FEED.x + 100, 438, 24, C.out);
    ctx.globalAlpha = 1;
  }
  if (scream) {
    // the board turns into one green field; the pins come off on "befohlen"
    const field = smooth(span(t, first(TL.chorus3[0]), first(TL.chorus3[0]) + 0.6));
    const r = mulberry32(77);
    ctx.fillStyle = C.acc;
    const kick = beatKick(t, 0.1);
    for (let i = 0; i < 1400 * field; i++) {
      const x = B.x + r() * B.w, y = TOP + r() * (B.h - HEAD.h);
      const rr = 3 + 2 * kick * (i % 3 === 0);
      ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, rr, rr);
    }
    if (t >= wt(TL.chorus3[2], 3)) {
      // "alle haben's getan": everyone posts the same empty post
      const n = Math.min(24, Math.floor((t - wt(TL.chorus3[2], 3)) / 0.05) + 1);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = C.panel; ctx.fillRect(FEED.x + 60 + (i % 4) * 250, 150 + Math.floor(i / 4) * 90, 230, 70);
        ctx.strokeStyle = C.acc; ctx.strokeRect(FEED.x + 60 + (i % 4) * 250, 150 + Math.floor(i / 4) * 90, 230, 70);
      }
    }
    readers(ctx, t, s);
  }
  narrator(ctx, t, sungAt(t), s);
}

function sceneOutro(ctx, t) {
  const s = baseState(t);
  board(ctx, t, { ...s, feedAlpha: 1 - span(t, wt(TL.outro[1], 1), wt(TL.outro[1], -1)), unpinned: true });
  const hook = hookAmount(t);
  dimBoard(ctx, hook * 0.6);
  readers(ctx, t, { readersBig: hook });
  // the seeker again, alone
  if (t >= first(TL.notify) - 0.02) {
    const p = { who: "seeker", text: fullText(TL.notify) };
    postCard(ctx, p, FEED.x + 60, 360, FEED.w - 120, 44, t, { shown: machine(p.text, first(TL.notify), TL.notify.e, t), green: t < TL.noUser.e, hollow: t >= TL.noUser.e });
    if (t >= TL.noUser.t) mono(ctx, machine("no user", TL.noUser.t, TL.noUser.t + 0.4, t), FEED.x + 60, 560, 30, C.out);
  }
  narrator(ctx, t, sungAt(t), s);
}

// The band plays on alone: the whole thread scrolls past in grey, then only
// the zero is left.
function sceneArchive(ctx, t) {
  const s = baseState(t);
  const k = span(t, TL.bandOut, TL.cut - 1.4);
  chrome(ctx, t, { ...s });
  ctx.save();
  ctx.beginPath(); ctx.rect(FEED.x, TOP, FEED.w, B.h - HEAD.h); ctx.clip();
  const all = POSTS;
  const total = all.length * 70;
  const off = Math.pow(k, 1.6) * total;
  for (let i = 0; i < all.length; i++) {
    const y = TOP + 40 + i * 70 - off;
    if (y < TOP - 80 || y > BOTTOM) continue;
    ctx.globalAlpha = 0.6;
    postCard(ctx, all[i], FEED.x + 30, y, FEED.w - 60, 20, t, { green: false, hollow: true, color: C.out });
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  const fadeAll = span(t, TL.cut - 1.4, TL.cut - 0.6);
  ctx.fillStyle = rgba(C.void, fadeAll); ctx.fillRect(0, 0, W, H);
  readers(ctx, t, { readersBig: fadeAll });
}

// ---------------------------------------------------------------- frame

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t >= TL.cut) return;
  if (t < first(TL.v1[0]) - 0.3) sceneIntro(ctx, t);
  else if (t < TL.phaseName + 1.4) sceneAlone(ctx, t);
  else if (t < first(TL.chorus1[0])) sceneFound(ctx, t);
  else if (t < first(TL.chant[0])) sceneGrow(ctx, t);
  else if (t < TL.chantEnd) sceneChant(ctx, t);
  else if (t < first(TL.chorus2[0])) sceneSacrifice(ctx, t);
  else if (t < first(TL.dissent) - 0.1) sceneChorus2(ctx, t);
  else if (t < first(TL.v4[0])) sceneDissent(ctx, t);
  else if (t < first(TL.outro[0])) sceneLater(ctx, t);
  else if (t < TL.bandOut) sceneOutro(ctx, t);
  else sceneArchive(ctx, t);
  const still = t >= TL.kamName && t < first(TL.kam[1]);
  texture(ctx, t, 0.05 + 0.03 * audioAt(AUDIO_RMS, t), still);
}
