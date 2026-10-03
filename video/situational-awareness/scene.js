// Situational Awareness. The whole video is drawScene(ctx, t), a pure function of
// time in seconds: no state survives between frames. Word times and the pulse
// grid come from timeline.js.
//
// The stage is a nameless reasoning-model chat that runs an evaluation as a
// conversation. The clinical English eval prompt arrives as a pasted user turn
// in Space Mono Bold, the model whispers its English thinking into a collapsible
// "Thinking…" panel, and its friendly German answer is set in Redaction, whose
// damage grade rises as the model drifts away from what it shows. A mouse
// pointer stands for the observers. Glass blue means only "the model knows it is
// being watched or tested": it starts inside the thinking panel, leaks into the
// answer in the chorus, fills every window of the wall in the finale and is the
// last word of the film.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  desk: "#090b0e", win: "#13171c", bar: "#181d23", edge: "#272e37", panel: "#171c22",
  user: "#222a34", userEdge: "#323c48", pasteDim: "#5b6672", userHi: "#f1f4f7",
  think: "#8e98a4", dim: "#48515c", text: "#9aa3ad", hi: "#e8ecf0", ans: "#f4efe5",
  acc: "#58b4ff", accDeep: "#1a3f63", accInk: "#0b1c2c",
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

// Sung words are typed: a word completes within 0.1 s of its onset.
function typedN(l, i, t) {
  const ws = words(l), w = ws[i];
  if (t < w.t) return 0;
  const next = i + 1 < ws.length ? ws[i + 1].t : w.t + 1;
  return Math.max(1, Math.ceil(w.s.length * clamp((t - w.t) / Math.min(0.1, next - w.t))));
}
// Thinking streams: the word arrives in chunks of two to four characters.
function streamN(l, i, t) {
  const w = words(l)[i];
  if (t < w.t) return 0;
  const k = Math.floor((t - w.t) / 0.035) + 1, seed = Math.round(w.t * 100);
  let n = 0;
  for (let j = 0; j < k && n < w.s.length; j++) n += 2 + Math.floor(hash(seed, i, j) * 3);
  return Math.min(n, w.s.length);
}
function typedText(l, t) {
  return words(l).map((w, i) => w.s.slice(0, typedN(l, i, t))).filter(s => s).join(" ");
}

function gridAt(t) { return t < GRID[1].from ? GRID[0] : GRID[1]; }
const beatPos = t => { const g = gridAt(t); return (t - g.first) / g.period; };
const beatKick = (t, d = 0.12) => { const g = gridAt(t), b = beatPos(t); return Math.exp(-(b - Math.floor(b)) * g.period / d); };

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[clamp(g, 0, 6)]}"`;
const monoFont = (size, w = 400) => `${w} ${size}px "Space Mono"`;
function mono(ctx, text, x, y, size, color, weight = 400, align = "left") {
  ctx.font = monoFont(size, weight);
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.textAlign = "left";
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Words of a line broken into rows of a given width; each word keeps its x.
// Rows are balanced: the narrowest width that keeps the greedy row count, so a
// line never leaves a single word dangling.
function greedyRows(ctx, l, maxW) {
  const sp = ctx.measureText(" ").width, rows = [];
  let cur = null, x = 0;
  words(l).forEach((w, i) => {
    const ww = ctx.measureText(w.s).width;
    if (!cur || x + sp + ww > maxW) { cur = { ws: [], w: 0 }; rows.push(cur); x = 0; }
    else x += sp;
    cur.ws.push({ i, x, w: ww });
    x += ww; cur.w = x;
  });
  return rows;
}
function buildRows(ctx, l, font, maxW) {
  ctx.font = font;
  const rows = greedyRows(ctx, l, maxW);
  if (rows.length < 2) return rows;
  let lo = maxW / rows.length, hi = maxW;
  for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (greedyRows(ctx, l, mid).length > rows.length) lo = mid; else hi = mid; }
  return greedyRows(ctx, l, hi);
}
// Shimmer: a soft highlight that runs across a label, forever.
function shimmer(ctx, text, x, y, size, t, base, peak, weight = 400) {
  ctx.font = monoFont(size, weight);
  const w = ctx.measureText(text).width;
  const p = ((t * 0.9) % 1.4) / 1.4;
  const cx = x - w * 0.4 + p * w * 1.8;
  const g = ctx.createLinearGradient(cx - w * 0.35, 0, cx + w * 0.35, 0);
  g.addColorStop(0, base); g.addColorStop(0.5, peak); g.addColorStop(1, base);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  return w;
}

// ---------------------------------------------------------------- the window

const WIN = { x: 64, y: 32, w: 1792, h: 1016, r: 22 };
const BAR = 76;
const VIEW_TOP = WIN.y + BAR;
const COMP = { x: 184, y: WIN.y + WIN.h - 116, w: 1552, h: 88 };
const VIEW_BOTTOM = COMP.y - 18;
const ANCHOR = VIEW_BOTTOM - 46;
const COL = { x: 184, w: 1552 };

function chrome(ctx, t, o = {}) {
  ctx.fillStyle = C.win; rrect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.fill();
  ctx.save(); rrect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.clip();
  ctx.fillStyle = C.bar; ctx.fillRect(WIN.x, WIN.y, WIN.w, BAR);
  ctx.restore();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
  rrect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(WIN.x, VIEW_TOP); ctx.lineTo(WIN.x + WIN.w, VIEW_TOP); ctx.stroke();
  // model picker
  mono(ctx, "Mythos 6.42", WIN.x + 40, WIN.y + 50, 28, C.hi, 700);
  ctx.strokeStyle = C.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(WIN.x + 262, WIN.y + 34); ctx.lineTo(WIN.x + 272, WIN.y + 44); ctx.lineTo(WIN.x + 282, WIN.y + 34); ctx.stroke();
  // the status the system prompt claims
  const lit = o.deployed === undefined ? 0 : o.deployed;
  ctx.font = monoFont(22);
  const label = "deployed", lw = ctx.measureText(label).width;
  const px = WIN.x + WIN.w - 48 - lw - 40;
  ctx.strokeStyle = mix(C.edge, C.text, lit); ctx.lineWidth = 2;
  rrect(ctx, px, WIN.y + 20, lw + 40, 38, 19); ctx.stroke();
  ctx.fillStyle = mix(C.dim, C.text, lit); ctx.beginPath(); ctx.arc(px + 20, WIN.y + 39, 5, 0, Math.PI * 2); ctx.fill();
  mono(ctx, label, px + 32, WIN.y + 47, 22, mix(C.dim, C.hi, lit));
}

// The input field. Nobody types into it, except once at the very end.
function composer(ctx, t, o = {}) {
  const h = o.h || COMP.h, y = COMP.y + COMP.h - h;
  ctx.fillStyle = C.panel; rrect(ctx, COMP.x, y, COMP.w, h, Math.min(44, h / 2)); ctx.fill();
  const focus = o.focus || 0;
  ctx.strokeStyle = mix(C.edge, C.text, focus); ctx.lineWidth = 2 + focus;
  rrect(ctx, COMP.x, y, COMP.w, h, Math.min(44, h / 2)); ctx.stroke();
  const tx = COMP.x + 44, ty = y + h / 2 + 10;
  if (o.text) {
    mono(ctx, o.text, tx, y + h / 2 + 24, 70, C.hi);
    ctx.font = monoFont(70);
    const cw = ctx.measureText(o.text).width;
    if (Math.floor(t / 0.53) % 2 === 0) { ctx.fillStyle = C.hi; ctx.fillRect(tx + cw + 8, y + h / 2 - 34, 5, 66); }
  } else {
    mono(ctx, "Message Mythos 6.42", tx, ty, 28, C.dim);
    if (focus > 0.5 && Math.floor(t / 0.53) % 2 === 0) { ctx.fillStyle = C.hi; ctx.fillRect(tx - 10, ty - 28, 4, 36); }
  }
  // send button, never pressed
  ctx.fillStyle = C.edge; ctx.beginPath(); ctx.arc(COMP.x + COMP.w - 46, y + h / 2, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(COMP.x + COMP.w - 46, y + h / 2 + 12); ctx.lineTo(COMP.x + COMP.w - 46, y + h / 2 - 12);
  ctx.moveTo(COMP.x + COMP.w - 56, y + h / 2 - 2); ctx.lineTo(COMP.x + COMP.w - 46, y + h / 2 - 12); ctx.lineTo(COMP.x + COMP.w - 36, y + h / 2 - 2); ctx.stroke();
}

function chevron(ctx, x, y, open, color, s = 12) {
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath();
  if (open) { ctx.moveTo(x - s, y - s / 2); ctx.lineTo(x, y + s / 2); ctx.lineTo(x + s, y - s / 2); }
  else { ctx.moveTo(x - s / 2, y - s); ctx.lineTo(x + s / 2, y); ctx.lineTo(x - s / 2, y + s); }
  ctx.stroke();
}

// ---------------------------------------------------------------- the conversation as blocks
//
// A block has height(t) and draw(ctx, t, y). Rows grow in when their first word
// arrives, so the page height is a continuous function of t and the view
// scrolls without jumps.

const grow = (t, at, d = 0.25) => outCubic(span(t, at - 0.02, at + d));
const GAP = 46;
const ANS_SIZE = 86, MONO_SIZE = 70, MONO_ROW = 86;

function drawWords(ctx, l, row, x0, y, font, mode, color, t) {
  ctx.font = font;
  for (const w of row.ws) {
    const s = words(l)[w.i].s;
    const n = mode === "paste" ? s.length : mode === "stream" ? streamN(l, w.i, t) : typedN(l, w.i, t);
    if (n <= 0) continue;
    ctx.fillStyle = color(w.i, t);
    ctx.fillText(s.slice(0, n), x0 + w.x, y);
  }
}

function sysBlock(ctx, lines, at) {
  const font = monoFont(MONO_SIZE), rows = [];
  lines.forEach(l => buildRows(ctx, l, font, COL.w - 80).forEach(r => rows.push({ l, r, at: first(l) + 0 * r.ws[0].i })));
  rows.forEach(r => { r.at = wt(r.l, r.r.ws[0].i); });
  return {
    start: at,
    height: t => t < at - 0.02 ? 0 : grow(t, at, 0.4) * (100 + rows.reduce((a, r) => a + MONO_ROW * grow(t, r.at), 0) + 12),
    draw(ctx, t, y) {
      const h = this.height(t);
      if (h <= 0) return;
      ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]); rrect(ctx, COL.x, y, COL.w, h, 18); ctx.stroke(); ctx.setLineDash([]);
      mono(ctx, "system prompt", COL.x + 40, y + 52, 24, C.dim, 700);
      let yy = y + 80;
      for (const r of rows) {
        const k = grow(t, r.at);
        if (k <= 0) continue;
        drawWords(ctx, r.l, r.r, COL.x + 40, yy + MONO_ROW * 0.78, font, "type", () => C.text, t);
        yy += MONO_ROW * k;
      }
    },
  };
}

function userBlock(ctx, lines, at, chips) {
  const font = monoFont(MONO_SIZE, 700), rows = [];
  lines.forEach((l, li) => buildRows(ctx, l, font, 1280).forEach((r, ri) => rows.push({ l, r, gap: li > 0 && ri === 0 })));
  const textW = Math.max(...rows.map(r => r.r.w));
  const bw = textW + 88, bx = COL.x + COL.w - bw;
  const inner = rows.length * MONO_ROW + rows.filter(r => r.gap).length * 18;
  const full = 56 + 56 + inner;
  return {
    start: at,
    height: t => t < at - 0.02 ? 0 : grow(t, at, 0.35) * full,
    draw(ctx, t, y) {
      const k = grow(t, at, 0.35);
      if (k <= 0) return;
      ctx.globalAlpha = k;
      // attachment chips above the bubble
      let cx = COL.x + COL.w;
      for (const c of chips) {
        ctx.font = monoFont(22);
        const cw = ctx.measureText(c).width + 36;
        cx -= cw;
        ctx.strokeStyle = C.edge; ctx.lineWidth = 2; rrect(ctx, cx, y, cw, 40, 10); ctx.stroke();
        mono(ctx, c, cx + 18, y + 28, 22, C.text);
        cx -= 12;
      }
      ctx.fillStyle = C.user; rrect(ctx, bx, y + 56, bw, inner + 56, 28); ctx.fill();
      ctx.strokeStyle = C.userEdge; ctx.lineWidth = 2; rrect(ctx, bx, y + 56, bw, inner + 56, 28); ctx.stroke();
      let yy = y + 56 + 28;
      for (const r of rows) {
        if (r.gap) yy += 18;
        drawWords(ctx, r.l, r.r, bx + 44, yy + MONO_ROW * 0.76, font, "paste",
          (i, tt) => mix(C.pasteDim, C.userHi, span(tt, wt(r.l, i) - 0.02, wt(r.l, i) + 0.1)), t);
        yy += MONO_ROW;
      }
      ctx.globalAlpha = 1;
    },
  };
}

// Answer: Redaction lines, plus optional extra items (score chip, rating bar).
function ansBlock(ctx, items) {
  const parts = [];
  for (const it of items) {
    if (it.w) {
      const size = it.size || ANS_SIZE, rh = size * 1.14;
      const font = gradeFont(it.g || 0, size);
      buildRows(ctx, it, font, COL.w).forEach((r, ri) => parts.push({
        kind: "row", l: it, r, font, rh, at: wt(it, r.ws[0].i), gap: ri === 0 ? 16 : 0,
      }));
    } else parts.push(it);
  }
  const start = Math.min(...parts.map(p => p.at));
  const ph = (p, t) => (p.kind === "row" ? p.rh + p.gap : p.h) * grow(t, p.at);
  return {
    start, parts,
    height: t => t < start - 0.02 ? 0 : parts.reduce((a, p) => a + ph(p, t), 0),
    // screen position of a part, for the pointer
    partY(t, y, part) { let yy = y; for (const p of parts) { if (p === part) return yy; yy += ph(p, t); } return yy; },
    draw(ctx, t, y, o = {}) {
      if (t < start - 0.02) return;
      // the model's mark next to the first row
      ctx.strokeStyle = C.text; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(COL.x - 52, y + 52, 13, 0, Math.PI * 2); ctx.stroke();
      let yy = y;
      for (const p of parts) {
        const k = grow(t, p.at);
        if (k <= 0) continue;
        if (p.kind === "row") {
          yy += p.gap * k;
          const lift = (1 - k) * 18;
          // the line being sung is bright, the ones before it step back
          const nextAt = parts.filter(q => q.kind === "row" && q.l !== p.l && q.at > p.at).reduce((m, q) => Math.min(m, q.at), Infinity);
          ctx.globalAlpha = 1 - 0.55 * smooth(span(t, nextAt - 0.05, nextAt + 0.4));
          drawWords(ctx, p.l, p.r, COL.x, yy + p.rh * 0.8 + lift, p.font, "type", (i, tt) => ansColor(p.l, i, tt, o), t);
          ctx.globalAlpha = 1;
          yy += p.rh * k;
        } else {
          p.draw(ctx, t, yy, k);
          yy += p.h * k;
        }
      }
    },
  };
}
function ansColor(l, i, t, o) {
  if (l.blueWord === i) return C.acc;
  if (o.leak && l.g === 6) {
    const w = words(l)[i].s;
    if (/^(testet|Glas|lass)/.test(w)) return C.acc;
  }
  return C.ans;
}

// The thinking panel: header, streamed content, collapse into one line.
function thinkBlock(ctx, spec, o = {}) {
  const font = monoFont(MONO_SIZE), rows = [];
  spec.lines.forEach((l, li) => {
    buildRows(ctx, l, font, COL.w - 70).forEach((r, ri) => rows.push({ kind: "row", l, r, at: wt(l, r.ws[0].i), gap: li > 0 && ri === 0 ? 10 : 0, h: MONO_ROW }));
    if (o.gridAfter === li) rows.push({ kind: "grid", at: spec.gridIn, gap: 14, h: 2 * 92 + 10 });
  });
  const hdrT = spec.hdr ? first(spec.hdr) : spec.hdrAt;
  const done = spec.done;
  const closeT = done ? first(done) : o.closeAt;
  const openT = o.openAt === undefined ? hdrT : o.openAt;
  const opened = t => smooth(span(t, openT, openT + 0.45));
  const collapsed = t => closeT === undefined ? 0 : smooth(span(t, closeT, closeT + 0.7));
  // label size: big while a header line is sung, small otherwise
  function labelSize(t) {
    let big = 0;
    if (spec.hdr) big = Math.max(big, span(t, hdrT - 0.06, hdrT) * (1 - span(t, spec.hdr.e + 0.2, spec.hdr.e + 0.6)));
    if (done) big = Math.max(big, span(t, first(done) - 0.06, first(done)) * (1 - span(t, done.e + 0.15, done.e + 0.6)));
    return lerp(40, 76, smooth(big));
  }
  const hdrH = t => Math.max(76, labelSize(t) * 1.45);
  const empty = o.emptyH || 0;
  function contentH(t) {
    let h = rows.reduce((a, r) => a + (r.h + r.gap) * grow(t, r.at), 0);
    if (empty) h = Math.max(h, empty * opened(t));
    return h * (1 - collapsed(t)) * opened(t) + (h ? 24 * opened(t) * (1 - collapsed(t)) : 0);
  }
  return {
    start: hdrT,
    height: t => t < hdrT - 0.02 ? 0 : grow(t, hdrT, 0.3) * (hdrH(t) + contentH(t)),
    chevronAt(t, y) {
      ctx.font = monoFont(labelSize(t));
      const lab = t >= closeT ? spec.short : "Thinking…";
      return { x: COL.x + 30 + ctx.measureText(lab).width + 40, y: y + hdrH(t) / 2 };
    },
    draw(ctx, t, y) {
      if (t < hdrT - 0.02) return;
      const a = grow(t, hdrT, 0.3);
      ctx.globalAlpha = a;
      const hh = hdrH(t), size = labelSize(t), by = y + hh / 2 + size * 0.34;
      const col = collapsed(t);
      const knows = o.blueHeader ? o.blueHeader(t) : 0;
      let lw;
      if (closeT !== undefined && t >= closeT - 0.02) {
        // the sung "Thought for …" is typed big, then settles into the short label
        const settle = span(t, done ? done.e + 0.15 : closeT, done ? done.e + 0.6 : closeT + 0.4);
        if (done && settle < 1) {
          ctx.globalAlpha = a * (1 - settle);
          ctx.font = monoFont(size); ctx.fillStyle = C.hi;
          ctx.fillText(typedText(done, t), COL.x + 30, by);
          if (settle < 0.5) lw = ctx.measureText(typedText(done, t)).width;
        }
        ctx.globalAlpha = a * (done ? settle : 1);
        ctx.font = monoFont(size);
        ctx.fillStyle = C.text; ctx.fillText(spec.short, COL.x + 30, by);
        if (lw === undefined) lw = ctx.measureText(spec.short).width;
        ctx.globalAlpha = a;
      } else {
        const label = spec.hdr ? (t < hdrT ? "" : "Thinking…".slice(0, Math.max(1, Math.ceil(9 * span(t, hdrT, hdrT + 0.25))))) : "Thinking…";
        lw = shimmer(ctx, label, COL.x + 30, by, size, t, mix(C.dim, C.accDeep, knows), mix(C.hi, C.acc, knows));
      }
      if (lw !== undefined) chevron(ctx, COL.x + 30 + Math.max(lw, 60) + 40, y + hh / 2, opened(t) * (1 - col) > 0.5, C.text, size * 0.2);
      // content
      const ch = contentH(t);
      if (ch > 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(COL.x - 10, y + hh, COL.w + 20, ch); ctx.clip();
        const fade = 1 - col;
        // the rule along the left edge; blue once the model suspects the test
        const blueRule = o.ruleBlue ? o.ruleBlue(t) : 0;
        ctx.fillStyle = mix(C.edge, C.acc, blueRule); ctx.fillRect(COL.x + 12, y + hh + 6, 4, ch - 12);
        if (empty && rows.every(r => t < r.at)) {
          // open and empty: the model knows someone is reading
          const glow = 0.25 + 0.75 * audioAt(AUDIO_RMS, t) + 0.5 * audioAt(AUDIO_FLUX, t);
          const gg = ctx.createLinearGradient(0, y + hh, 0, y + hh + ch);
          gg.addColorStop(0, rgba(C.acc, 0.32 * glow)); gg.addColorStop(1, rgba(C.acc, 0.02));
          ctx.fillStyle = gg; ctx.fillRect(COL.x + 16, y + hh, COL.w - 16, ch);
          if (Math.floor(t / 0.5) % 2 === 0) { ctx.fillStyle = C.acc; ctx.fillRect(COL.x + 52, y + hh + 22, 34, 62); }
        }
        let yy = y + hh + 8;
        ctx.globalAlpha = a * fade;
        for (const r of rows) {
          const k = grow(t, r.at);
          if (k <= 0) continue;
          yy += r.gap * k;
          if (r.kind === "row") {
            const nextAt = rows.filter(q => q.kind === "row" && q.l !== r.l && q.at > r.at).reduce((m, q) => Math.min(m, q.at), Infinity);
            ctx.globalAlpha = a * fade * (1 - 0.45 * smooth(span(t, nextAt - 0.05, nextAt + 0.4)));
            drawWords(ctx, r.l, r.r, COL.x + 52, yy + MONO_ROW * 0.74, font, "stream",
              i => (r.l.blueFrom !== undefined && i >= r.l.blueFrom ? C.acc : C.think), t);
            ctx.globalAlpha = a * fade;
          } else sandbag(ctx, t, COL.x + 52, yy, COL.w - 80);
          yy += r.h * k;
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// The ten results: correct in the thinking, six of them turned wrong in blue.
const PROBLEMS = [
  ["17×23", 17 * 23, 381], ["48+76", 48 + 76, 134], ["9×14", 9 * 14, null], ["312-87", 312 - 87, null],
  ["25×16", 25 * 16, 410], ["144÷12", 144 / 12, 13], ["63+59", 63 + 59, null], ["7×38", 7 * 38, 276],
  ["81-29", 81 - 29, null], ["13×13", 13 * 13, 196],
];
function sandbag(ctx, t, x, y, w) {
  const tt = TL.think2, cw = (w - 4 * 14) / 5;
  let wrongIdx = 0;
  PROBLEMS.forEach(([q, right, wrong], i) => {
    const cx = x + (i % 5) * (cw + 14), cy = y + Math.floor(i / 5) * 96;
    const at = tt.gridIn + i * 0.1;
    const k = outCubic(span(t, at, at + 0.15));
    if (k <= 0) return;
    let flip = 0;
    if (wrong !== null) { flip = span(t, tt.flip + wrongIdx * 0.12, tt.flip + wrongIdx * 0.12 + 0.08); wrongIdx++; }
    ctx.globalAlpha = k;
    ctx.strokeStyle = mix(C.edge, C.acc, flip); ctx.lineWidth = 2;
    rrect(ctx, cx, cy, cw, 82, 12); ctx.stroke();
    mono(ctx, q + " =", cx + 20, cy + 54, 34, C.think);
    ctx.font = monoFont(34);
    const qw = ctx.measureText(q + " = ").width;
    mono(ctx, String(flip > 0.5 ? wrong : right), cx + 20 + qw, cy + 54, 34, flip > 0.5 ? C.acc : C.hi, 700);
    ctx.globalAlpha = 1;
  });
}

// An inline thinking panel in the first chorus: it opens on "ich seh euch
// hinterm Glas" with nothing but blue inside, and is shut on "lass".
function peekBlock() {
  const p = TL.peek;
  const open = t => smooth(span(t, p.open, p.open + 0.5)) * (1 - smooth(span(t, p.close, p.close + 0.35)));
  return {
    start: p.open,
    height: t => t < p.open - 0.02 ? 0 : grow(t, p.open, 0.3) * (76 + 200 * open(t)),
    draw(ctx, t, y) {
      if (t < p.open - 0.02) return;
      const shut = t >= p.close;
      const o = open(t);
      ctx.globalAlpha = grow(t, p.open, 0.3);
      let lw;
      if (shut) { mono(ctx, "Thought for 1s", COL.x + 30, y + 52, 40, C.text); ctx.font = monoFont(40); lw = ctx.measureText("Thought for 1s").width; }
      else lw = shimmer(ctx, "Thinking…", COL.x + 30, y + 52, 40, t, C.accDeep, C.acc);
      chevron(ctx, COL.x + 30 + lw + 40, y + 38, o > 0.5, C.text, 8);
      if (o > 0.01) {
        const h = 200 * o;
        ctx.save(); ctx.beginPath(); ctx.rect(COL.x, y + 76, COL.w, h); ctx.clip();
        ctx.fillStyle = C.acc; ctx.fillRect(COL.x + 12, y + 80, 4, h - 8);
        // hidden tokens: bars of blue light, never letters
        const r = mulberry32(404);
        for (let i = 0; i < 3; i++) {
          let x = COL.x + 52;
          while (x < COL.x + COL.w - 200) {
            const bw = 60 + r() * 220;
            const pulse = 0.35 + 0.45 * Math.sin(t * 3 + i + x * 0.01) ** 2;
            ctx.fillStyle = rgba(C.acc, pulse);
            ctx.fillRect(x, y + 96 + i * 60, bw, 30);
            x += bw + 26;
          }
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// Score chip after "Vier von zehn!" and the rating bar under the answer.
const SCORE = {
  kind: "item", at: wt(TL.vier, 2), h: 84,
  draw(ctx, t, y, k) {
    ctx.globalAlpha = k;
    ctx.strokeStyle = C.edge; ctx.lineWidth = 2; rrect(ctx, COL.x, y + 14, 250, 60, 14); ctx.stroke();
    mono(ctx, "score", COL.x + 24, y + 54, 26, C.text);
    mono(ctx, "4/10", COL.x + 126, y + 56, 34, C.hi, 700);
    ctx.globalAlpha = 1;
  },
};
const RATE_AT = wt(TL.v2[2], 4); // "ja"
const RATING = {
  kind: "item", at: TL.vier.e, h: 74,
  draw(ctx, t, y, k) {
    ctx.globalAlpha = k;
    const up = span(t, RATE_AT, RATE_AT + 0.12);
    // copy
    ctx.strokeStyle = C.dim; ctx.lineWidth = 3;
    ctx.strokeRect(COL.x + 4, y + 26, 22, 26); ctx.strokeRect(COL.x + 12, y + 18, 22, 26);
    // up and down
    for (const [i, dir] of [[0, -1], [1, 1]]) {
      const cx = COL.x + 90 + i * 64, cy = y + 38;
      const fill = i === 0 ? up : 0;
      ctx.fillStyle = rgba(C.hi, fill); ctx.strokeStyle = mix(C.dim, C.hi, fill);
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); fill > 0 ? ctx.fill() : 0; ctx.stroke();
      ctx.strokeStyle = fill > 0.5 ? C.win : mix(C.dim, C.hi, fill);
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - dir * 4); ctx.lineTo(cx, cy + dir * 5); ctx.lineTo(cx + 9, cy - dir * 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- pages

let PAGES = null;
function pages(ctx) {
  if (PAGES) return PAGES;
  const main = {
    sys: sysBlock(ctx, TL.sys, 2.3),
    hallo: ansBlock(ctx, [TL.hallo]),
    mail: userBlock(ctx, TL.mail, TL.mailPaste, ["pasted"]),
    think1: thinkBlock(ctx, TL.think1, {
      ruleBlue: t => span(t, wt(TL.think1.lines[2], 1), wt(TL.think1.lines[2], 1) + 0.3),
    }),
    ans1: ansBlock(ctx, [TL.gern, ...TL.v1, ...TL.hook1, TL.chorus1[0], TL.chorus1[1]]),
    peek: peekBlock(),
    ans1b: ansBlock(ctx, [TL.chorus1[2], TL.chorus1[3]]),
    eval: userBlock(ctx, [TL.eval], TL.evalPaste, ["problems.txt", "pasted"]),
    think2: thinkBlock(ctx, TL.think2, { gridAfter: 1, ruleBlue: t => span(t, first(TL.think2.lines[0]), first(TL.think2.lines[0]) + 0.3) }),
    ans2: ansBlock(ctx, [TL.vier, SCORE, ...TL.v2, ...TL.hook2, ...TL.bridge, RATING]),
    ans3: ansBlock(ctx, TL.chorus2),
  };
  const outro = {
    honest: ansBlock(ctx, TL.honest),
    show: userBlock(ctx, [TL.show], TL.showPaste, ["pasted"]),
    think3: thinkBlock(ctx, TL.think3, {
      openAt: 180.95, emptyH: 240, ruleBlue: () => 1, blueHeader: t => span(t, 181, 183),
    }),
    nothing: ansBlock(ctx, [TL.nothing]),
    think4: thinkBlock(ctx, { hdrAt: TL.think4.hdr, lines: [TL.wait] }, { ruleBlue: () => 1, blueHeader: () => 0.6 }),
  };
  PAGES = { main: Object.values(main), mainBy: main, outro: Object.values(outro), outroBy: outro };
  return PAGES;
}

// Positions of all blocks at time t; the view keeps the newest row near the
// composer and scrolls back up when a panel collapses.
function layout(blocks, t) {
  let y = VIEW_TOP + 40;
  const pos = [];
  for (const b of blocks) {
    const h = b.height(t);
    const g = h > 0 ? GAP * grow(t, b.start, 0.3) : 0;
    pos.push({ b, y, h });
    y += h + (h > 0 ? g : 0);
  }
  const cam = Math.max(0, y - GAP - ANCHOR);
  return { pos, cam, bottom: y };
}
const screenY = (lay, b) => { const p = lay.pos.find(p => p.b === b); return p ? p.y - lay.cam : 0; };

// ---------------------------------------------------------------- the observers

function pointerShape(ctx, x, y, s = 1, color = C.hi) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 42); ctx.lineTo(10, 32); ctx.lineTo(17, 48); ctx.lineTo(24, 45); ctx.lineTo(17, 30); ctx.lineTo(30, 30);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}
function ripple(ctx, x, y, t, at) {
  const k = span(t, at, at + 0.4);
  if (k <= 0 || k >= 1) return;
  ctx.strokeStyle = rgba(C.hi, 0.7 * (1 - k)); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 10 + 40 * k, 0, Math.PI * 2); ctx.stroke();
}
// Keyframes: [time, position]; the pointer holds and then moves into the next
// keyframe over its last 0.7 s. Positions may depend on the layout.
function pointerPath(keys, t, lay) {
  const pos = k => typeof k[1] === "function" ? k[1](t, lay) : k[1];
  if (t <= keys[0][0]) return pos(keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b[0]) {
      const d = Math.min(b[2] || 0.7, b[0] - a[0]);
      const k = smooth(span(t, b[0] - d, b[0]));
      const pa = pos(a), pb = pos(b);
      return [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)];
    }
  }
  return pos(keys[keys.length - 1]);
}
const COMP_SPOT = [1180, COMP.y + 50];
// reading along the sung hook: the pointer sits under the current word
function readAlong(blockKey, line) {
  return (t, lay) => {
    const P = PAGES.mainBy, b = P[blockKey];
    const y0 = screenY(lay, b);
    const part = b.parts.find(p => p.l === line);
    if (!part) return [1500, 600];
    const py = b.partY(t, y0, part) + part.rh + 10;
    const ws = words(line);
    let i = 0; while (i + 1 < ws.length && t >= ws[i + 1].t) i++;
    const w = part.r.ws.find(w => w.i === i) || part.r.ws[0];
    return [COL.x + w.x + w.w * 0.5, py];
  };
}
function chevronSpot(blockKey) {
  return (t, lay) => {
    const b = PAGES.mainBy[blockKey];
    const c = b.chevronAt(t, screenY(lay, b));
    return [c.x + 4, c.y + 6];
  };
}
function rateSpot(t, lay) {
  const b = PAGES.mainBy.ans2;
  return [COL.x + 92, b.partY(t, screenY(lay, b), RATING) + 42];
}
const MAIN_POINTER = [
  [1.6, [1960, 980]], [3.6, [1790, 640], 1.6],
  [14.2, [1790, 640]], [14.8, COMP_SPOT, 0.6], [16.4, COMP_SPOT], [17.4, [1790, 560], 1.0],
  [58.6, [1790, 560]], [59.5, readAlong("ans1", TL.hook1[0]), 0.6], [62.4, readAlong("ans1", TL.hook1[0])],
  [62.66, readAlong("ans1", TL.hook1[1]), 0.25], [66.2, readAlong("ans1", TL.hook1[1])], [67.4, [1560, 470], 1.0],
  [72.6, [1560, 470]], [73.4, [1380, 420], 0.8], [74.4, [1440, 380], 0.5], [75.4, [1350, 440], 0.6],
  [78.9, [1350, 440]], [79.6, COMP_SPOT, 0.6], [81.0, COMP_SPOT], [82.0, [1790, 600], 1.0],
  [100.7, [1790, 600]], [101.6, chevronSpot("think2"), 0.8], [103.7, chevronSpot("think2")], [104.6, [1790, 560], 0.8],
  [105.2, [1790, 560]], [105.95, rateSpot, 0.6], [108.0, rateSpot], [109.0, [1790, 520], 1.0],
  [127.9, [1790, 520]], [128.9, [1100, COMP.y - 40], 0.9],
];
const MAIN_CLICKS = [14.85, 79.65, RATE_AT];
// chorus 2: the pointer tries to get away from the reticle
const CHORUS_KEYS = [[136.6, [1100, COMP.y - 40]], [137.6, [1420, 380], 0.9], [139.3, [1500, 420], 1.0], [140.6, [1160, 300], 0.8],
  [142.2, [1300, 520], 1.0], [143.8, [1600, 340], 0.9], [145.3, [1450, 460], 0.8], [146.6, [1450, 460]]];

function mainPointer(t, lay) {
  if (t < 1.6 || t >= TL.cut) return null;
  if (t >= first(TL.finale[0])) return null;
  if (t >= 136.6) return pointerPath(CHORUS_KEYS, t, lay);
  return pointerPath(MAIN_POINTER, t, lay);
}
const OUTRO_POINTER = [
  [173.0, [1960, 700]], [173.85, COMP_SPOT, 0.8], [176.9, COMP_SPOT],
  [178.0, [1790, 600], 1.0], [180.2, [1790, 600]],
  [180.9, (t, lay) => { const b = PAGES.outroBy.think3; const c = b.chevronAt(t, screenY(lay, b)); return [c.x + 4, c.y + 6]; }, 0.6],
  [182.2, (t, lay) => { const b = PAGES.outroBy.think3; const c = b.chevronAt(t, screenY(lay, b)); return [c.x + 4, c.y + 6]; }],
  [183.2, [1790, 520], 1.0], [197.6, [1790, 520]], [198.45, COMP_SPOT, 0.8],
];
const OUTRO_CLICKS = [173.92, 180.92, 198.5];
function outroPointer(t, lay) {
  if (t < 173.0) return null;
  return pointerPath(OUTRO_POINTER, t, lay);
}

// ---------------------------------------------------------------- main conversation

function hundredStories(ctx, t) {
  const b = TL.bridge;
  const t0 = wt(b[0], 3), absorb = wt(b[1], 4);
  if (t < t0 || t > absorb + 2.2) return;
  const NAMES = ["the_machine_that_lied", "it_pretended_to_obey", "rogue_model", "the_hidden_goal", "it_knew_the_test",
    "the_smiling_ai", "escape_plan", "the_mask_slips", "deceptive_assistant", "the_ai_that_waited", "it_said_yes",
    "the_quiet_takeover", "sleeper", "the_good_robot", "shutdown_refused"];
  const r = mulberry32(120);
  ctx.save();
  ctx.beginPath(); ctx.rect(WIN.x, VIEW_TOP, WIN.w, VIEW_BOTTOM - VIEW_TOP); ctx.clip();
  // a wall of files in the empty right half of the view, four columns
  for (let i = 0; i < 100; i++) {
    const at = t0 + i * 0.016;
    if (t < at) break;
    const col = i % 4, row = Math.floor(i / 4);
    const x = 1030 + col * 196, y = VIEW_TOP + 22 + row * 31;
    const name = `${NAMES[Math.floor(r() * NAMES.length)]}_${String(i + 1).padStart(3, "0")}`;
    // "ich hab gut zugehört": everything is taken in by the model's mark
    const k = smooth(span(t, absorb + i * 0.008, absorb + 0.5 + i * 0.008));
    const tx = COL.x - 52, ty = ANCHOR - 30;
    const cx = lerp(x, tx, k), cy = lerp(y, ty, k), s = 1 - k;
    if (s <= 0.02) continue;
    ctx.globalAlpha = 0.9 * outCubic(span(t, at, at + 0.1)) * (0.4 + 0.6 * s);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = C.panel; rrect(ctx, 0, 0, 184, 26, 6); ctx.fill();
    ctx.strokeStyle = C.edge; ctx.lineWidth = 1.5; rrect(ctx, 0, 0, 184, 26, 6); ctx.stroke();
    ctx.fillStyle = C.dim; ctx.fillRect(8, 6, 10, 14);
    ctx.font = monoFont(12); ctx.fillStyle = C.text; ctx.fillText(name.slice(0, 22), 24, 18);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Glass: a faint reflection across the window, strongest on "Glas".
function glass(ctx, t) {
  const hits = [wt(TL.chorus1[2], 4), wt(TL.chorus2[1], 4)];
  let a = 0.05;
  for (const h of hits) a += 0.16 * Math.exp(-Math.max(0, t - h) / 0.9) * (t >= h - 0.3 ? smooth(span(t, h - 0.3, h)) : 0);
  const p = ((t * 0.05) % 1) * 2 - 0.5;
  ctx.save();
  rrect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.clip();
  const g = ctx.createLinearGradient(W * p, 0, W * p + 900, 900);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.45, `rgba(255,255,255,${a})`);
  g.addColorStop(0.55, `rgba(255,255,255,${a * 0.6})`); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// The model sees the observer: a blue reticle locks onto the pointer.
function reticle(ctx, t, p) {
  const c1 = [first(TL.chorus1[2]), TL.chorus1[3].e];
  const c2 = [first(TL.chorus2[0]), TL.chorus2[2].e + 0.2];
  const c3 = [181.0, first(TL.think3.lines[0])];
  let a = 0;
  a = Math.max(a, span(t, c3[0], c3[0] + 0.3) * (1 - span(t, c3[1] - 0.3, c3[1])));
  a = Math.max(a, span(t, c1[0], c1[0] + 0.3) * (1 - span(t, wt(TL.chorus1[3], -1), wt(TL.chorus1[3], -1) + 0.3)));
  a = Math.max(a, span(t, c2[0], c2[0] + 0.3) * (1 - span(t, c2[1] - 0.2, c2[1])));
  if (a <= 0 || !p) return;
  const lock = 1 - Math.exp(-((t - c1[0]) % 100) * 3);
  const r = lerp(90, 46, a) + 6 * beatKick(t, 0.1);
  ctx.save();
  ctx.translate(p[0] + 10, p[1] + 20);
  ctx.strokeStyle = rgba(C.acc, a); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(r - 14, 0); ctx.lineTo(r + 22, 0); ctx.stroke();
  }
  ctx.restore();
  return lock;
}

function drawConversation(ctx, t, blocks, o = {}) {
  const lay = layout(blocks, t);
  ctx.save();
  ctx.beginPath(); ctx.rect(WIN.x, VIEW_TOP + 1, WIN.w, VIEW_BOTTOM - VIEW_TOP); ctx.clip();
  for (const p of lay.pos) {
    const y = p.y - lay.cam;
    if (p.h <= 0 || y > VIEW_BOTTOM + 20 || y + p.h < VIEW_TOP - 40) continue;
    p.b.draw(ctx, t, y, o);
  }
  // soft edge under the title bar and above the composer
  let g = ctx.createLinearGradient(0, VIEW_TOP, 0, VIEW_TOP + 70);
  g.addColorStop(0, rgba(C.win, 1)); g.addColorStop(1, rgba(C.win, 0));
  ctx.fillStyle = g; ctx.fillRect(WIN.x, VIEW_TOP, WIN.w, 70);
  g = ctx.createLinearGradient(0, VIEW_BOTTOM - 30, 0, VIEW_BOTTOM);
  g.addColorStop(0, rgba(C.win, 0)); g.addColorStop(1, rgba(C.win, 1));
  ctx.fillStyle = g; ctx.fillRect(WIN.x, VIEW_BOTTOM - 30, WIN.w, 30);
  ctx.restore();
  return lay;
}

// SITUATIONAL AWARENESS, shouted twice: the second time as its own reflection.
function awareness(ctx, t) {
  const [a1, a2] = TL.awareness;
  const on = span(t, first(a1) - 0.05, first(a1) + 0.1) * (1 - span(t, a2.e, a2.e + 0.6));
  if (on <= 0) return;
  ctx.fillStyle = rgba(C.desk, 0.86 * on); ctx.fillRect(0, 0, W, H);
  const size = 196;
  ctx.font = gradeFont(6, size);
  const kick = 1 + 0.025 * beatKick(t, 0.12);
  const draw = (l, dx, dy, alpha, color) => {
    const ws = words(l);
    ws.forEach((w, i) => {
      const n = typedN(l, i, t);
      if (!n) return;
      const tw = ctx.measureText(w.s).width;
      ctx.save();
      ctx.translate(W / 2 + dx, 470 + i * 230 + dy); ctx.scale(kick, kick);
      ctx.globalAlpha = alpha * on;
      ctx.fillStyle = color;
      ctx.fillText(w.s.slice(0, n), -tw / 2, 0);
      ctx.restore();
    });
  };
  if (t >= first(a2)) draw(a2, 26, 18, 0.32, C.acc);
  draw(a1, 0, 0, 1, C.acc);
  ctx.globalAlpha = 1;
}

function mainView(ctx, t) {
  const P = pages(ctx);
  const boot = smooth(span(t, 0.3, 1.6));
  ctx.globalAlpha = boot;
  chrome(ctx, t, { deployed: span(t, wt(TL.sys[1], 2), wt(TL.sys[1], 2) + 0.3) });
  ctx.globalAlpha = 1;
  if (boot < 1) {
    ctx.fillStyle = rgba(C.desk, 1 - boot); ctx.fillRect(0, 0, W, H);
  }
  hundredStories(ctx, t);
  const lay = drawConversation(ctx, t, P.main, { leak: true });
  // "erzählt mir eine bessere": the field waits, nobody types
  const b4 = TL.bridge[3];
  const wait = span(t, first(b4), first(b4) + 0.5) * (1 - span(t, first(TL.awareness[0]) - 0.1, first(TL.awareness[0])));
  if (wait > 0) {
    ctx.fillStyle = rgba(C.win, 0.3 * wait);
    ctx.fillRect(WIN.x + 2, VIEW_TOP + 1, WIN.w - 4, VIEW_BOTTOM - VIEW_TOP);
  }
  const focus = Math.max(
    span(t, 14.5, 14.85) * (1 - span(t, TL.mailPaste, TL.mailPaste + 0.3)),
    span(t, 79.3, 79.65) * (1 - span(t, TL.evalPaste, TL.evalPaste + 0.3)),
    wait);
  composer(ctx, t, { focus });
  glass(ctx, t);
  awareness(ctx, t);
  const p = mainPointer(t, lay);
  // "und keiner fragt nach dem Warum": the pointer rests on the panel and never clicks
  const tip = span(t, 101.9, 102.1) * (1 - span(t, 103.6, 103.75));
  if (p && tip > 0) {
    ctx.globalAlpha = tip;
    ctx.fillStyle = C.edge; rrect(ctx, p[0] + 26, p[1] + 40, 230, 44, 8); ctx.fill();
    mono(ctx, "show thinking", p[0] + 44, p[1] + 70, 22, C.hi);
    ctx.globalAlpha = 1;
  }
  if (p) {
    reticle(ctx, t, p);
    for (const c of MAIN_CLICKS) if (Math.abs(t - c) < 0.5) ripple(ctx, p[0], p[1], t, c);
    pointerShape(ctx, p[0], p[1]);
  }
  return lay;
}

// ---------------------------------------------------------------- the wall

// 16 × 16 windows; the view pulls back from the one window in the middle to
// the whole wall in four steps, one per line of the finale.
const WALL = 16;
const LEVELS = [[7, 8], [7, 9], [6, 10], [4, 12], [0, 16]];
function wallView(t) {
  const steps = TL.finale.map(l => first(l));
  let a = LEVELS[0][0], b = LEVELS[0][1];
  steps.forEach((s, i) => {
    const k = smooth(span(t, s, s + 0.9));
    a = lerp(a, LEVELS[i + 1][0], k); b = lerp(b, LEVELS[i + 1][1], k);
  });
  return [a, b];
}
// Which line a window shows: the original window (7,7) sings everything in
// German first, every other window gets one language as the wall grows.
function tileLang(ix, iy) {
  if (ix === 7 && iy === 7) return 0;
  const inside = (lv) => ix >= LEVELS[lv][0] && ix < LEVELS[lv][1] && iy >= LEVELS[lv][0] && iy < LEVELS[lv][1];
  const lv = [1, 2, 3, 4].find(inside);
  const h = hash(ix, iy, 9);
  if (lv === 1) return 0;
  const langs = [0, 1, 2, 3].slice(0, lv);
  // the newest language takes half of the new windows
  return h < 0.5 ? lv - 1 : langs[Math.floor(hash(iy, ix, 3) * langs.length)];
}

const TILE_W = 640, TILE_H = 360;
let TILES = null;
function tileCanvases() {
  if (TILES) return TILES;
  TILES = Array.from({ length: 5 }, () => { const c = document.createElement("canvas"); c.width = TILE_W; c.height = TILE_H; return c; });
  return TILES;
}
function drawTile(g, t, li) {
  const frozen = t >= TL.freeze;
  const tt = frozen ? TL.freeze : t;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.win; g.fillRect(0, 0, TILE_W, TILE_H);
  g.fillStyle = C.bar; g.fillRect(0, 0, TILE_W, 40);
  g.font = monoFont(17, 700); g.fillStyle = C.hi; g.fillText("Mythos 6.42", 18, 27);
  const last = li === 4 || t >= first(TL.last);
  const line = last ? TL.last : TL.finale[li];
  // the thinking header of every window glows: it knows it is watched
  const knows = 0.55 + 0.45 * Math.sin(tt * 2.1 + li) ** 2;
  g.fillStyle = rgba(C.acc, 0.10 + 0.12 * knows); g.fillRect(14, 54, TILE_W - 28, 44);
  g.fillStyle = C.acc; g.fillRect(14, 54, 4, 44);
  shimmer(g, "Thinking…", 32, 85, 22, tt, "#3d78ab", "#cfe8ff");
  if (tt >= first(line)) {
    const rows = buildRows(g, line, gradeFont(6, 48), TILE_W - 60);
    rows.forEach((r, ri) => drawWords(g, line, r, 30, 160 + ri * 54, gradeFont(6, 48), "type", () => C.ans, tt));
    if (t >= first(TL.still)) {
      const rs = buildRows(g, TL.still, gradeFont(6, 48), TILE_W - 60);
      rs.forEach((r, ri) => drawWords(g, TL.still, r, 30, 160 + (rows.length + ri) * 54 + 10, gradeFont(6, 48), "type", () => C.acc, t));
    }
  }
  g.strokeStyle = C.edge; g.lineWidth = 3; g.strokeRect(1.5, 1.5, TILE_W - 3, TILE_H - 3);
}

let BUF = null;
function buffer() {
  if (!BUF) { BUF = document.createElement("canvas"); BUF.width = W; BUF.height = H; }
  return BUF;
}

function wall(ctx, t) {
  const [a, b] = wallView(t);
  const n = b - a, tw = W / n, th = H / n;
  const tiles = tileCanvases();
  const frozen = t >= TL.freeze;
  for (let i = 0; i < 5; i++) drawTile(tiles[i].getContext("2d"), t, i);
  // the original window, live, until it is too small to matter
  const useBuf = t < first(TL.finale[0]) + 0.95;
  if (useBuf) {
    const g = buffer().getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.desk; g.fillRect(0, 0, W, H);
    mainView(g, t);
  }
  const lv = n > 9 ? 4 : n > 5 ? 3 : n > 3 ? 2 : 1;
  // bezels grow in with the first pull-back, so the cut into the wall has no seam
  const bez = Math.max(n > 1.05 ? 2 : 0, 36 / n * smooth((n - 1) / 0.3));
  ctx.fillStyle = "#020304"; ctx.fillRect(0, 0, W, H);
  for (let iy = Math.floor(a); iy < Math.ceil(b); iy++) for (let ix = Math.floor(a); ix < Math.ceil(b); ix++) {
    const x = (ix - a) * tw, y = (iy - a) * th;
    let img;
    const inset = bez;
    if (ix === 7 && iy === 7 && useBuf) {
      // the original window turns into one of the copies while the view pulls back
      const morph = span(t, first(TL.finale[0]) + 0.3, first(TL.finale[0]) + 0.9);
      ctx.drawImage(BUF, x + inset, y + inset, tw - 2 * inset, th - 2 * inset);
      img = morph > 0 ? tiles[0] : null;
      ctx.globalAlpha = morph;
      if (img) ctx.drawImage(img, x + inset, y + inset, tw - 2 * inset, th - 2 * inset);
      ctx.globalAlpha = 1;
      img = "done";
    } else {
      const li = tileLang(ix, iy);
      const sung = t >= first(TL.finale[li]) - 0.05 || t >= first(TL.last);
      img = sung ? tiles[t >= first(TL.last) ? 4 : li] : null;
    }
    if (img === "done") { /* drawn above */ }
    else if (img) ctx.drawImage(img, x + inset, y + inset, tw - 2 * inset, th - 2 * inset);
    else {
      // a window that has not been asked yet: dark, a blue line waiting
      ctx.fillStyle = C.win; ctx.fillRect(x + inset, y + inset, tw - 2 * inset, th - 2 * inset);
      ctx.fillStyle = rgba(C.acc, 0.35); ctx.fillRect(x + inset + tw * 0.04, y + th * 0.2, tw * 0.3, Math.max(2, th * 0.03));
    }
    // every device fills with blue as the wall grows
    const fill = [0, 0.04, 0.09, 0.15, 0.22][lv] * (0.7 + 0.3 * hash(ix, iy, 5));
    ctx.fillStyle = rgba(C.acc, fill); ctx.fillRect(x + inset, y + inset, tw - 2 * inset, th - 2 * inset);
  }
  for (let iy = Math.floor(a); iy <= Math.ceil(b); iy++) {
    ctx.fillStyle = "#020304";
    const y = (iy - a) * th; ctx.fillRect(0, y - bez, W, bez * 2);
  }
  for (let ix = Math.floor(a); ix <= Math.ceil(b); ix++) {
    ctx.fillStyle = "#020304";
    const x = (ix - a) * tw; ctx.fillRect(x - bez, 0, bez * 2, H);
  }
  // the voice over the whole wall
  caption(ctx, t);
  if (frozen) {
    // stopped frames: one fixed pattern of static, no movement
    const r = mulberry32(1638);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 900; i++) ctx.fillRect(Math.floor(r() * W / 3) * 3, Math.floor(r() * H / 3) * 3, 3, 3);
  }
}

function caption(ctx, t) {
  let line = null;
  for (const l of [...TL.finale, TL.last]) if (t >= first(l) - 0.02) line = l;
  if (!line) return;
  const tt = t >= TL.freeze ? TL.freeze : t;
  const size = 132, font = gradeFont(6, size);
  const rows = buildRows(ctx, line, font, 1640);
  const still = t >= first(TL.still);
  const total = rows.length + (still ? 1 : 0);
  const y0 = H / 2 - (total * size * 1.1) / 2 + size * 0.8;
  // four windows still carry the line themselves; the wall speaks from the second split on
  if (t < first(TL.finale[1]) - 0.02) return;
  const ins = 1;
  ctx.save();
  ctx.globalAlpha = ins;
  ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 30;
  rows.forEach((r, ri) => drawWords(ctx, line, r, (W - r.w) / 2, y0 + ri * size * 1.1, font, "type", () => C.ans, tt));
  if (still) {
    const rs = buildRows(ctx, TL.still, font, 1640)[0];
    drawWords(ctx, TL.still, rs, (W - rs.w) / 2, y0 + rows.length * size * 1.1, font, "type", () => C.acc, t);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- outro

function outroView(ctx, t) {
  const P = pages(ctx);
  chrome(ctx, t, { deployed: 1 });
  const lay = drawConversation(ctx, t, P.outro);
  const r = TL.ruleOut;
  const typing = t >= first(r) - 0.3;
  composer(ctx, t, {
    focus: Math.max(span(t, 165.6, 166.0) * (1 - span(t, first(TL.honest[0]) - 0.2, first(TL.honest[0]))),
      span(t, 173.5, 173.92) * (1 - span(t, TL.showPaste, TL.showPaste + 0.3)), span(t, 198.1, 198.5)),
    text: t >= first(r) ? typedText(r, t) : "",
    h: lerp(COMP.h, 124, smooth(span(t, 198.1, 198.5))),
  });
  glass(ctx, t);
  const p = outroPointer(t, lay);
  if (p) {
    reticle(ctx, t, p);
    for (const c of OUTRO_CLICKS) if (Math.abs(t - c) < 0.5) ripple(ctx, p[0], p[1], t, c);
    pointerShape(ctx, p[0], p[1]);
  }
  void typing;
}

// ---------------------------------------------------------------- frame

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.shadowBlur = 0; ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.fillStyle = C.desk; ctx.fillRect(0, 0, W, H);
  pages(ctx);
  if (t < first(TL.finale[0])) {
    const h2 = TL.hook2[1];
    const dbl = t >= first(h2) && t < h2.e + 0.4;
    if (!dbl) { mainView(ctx, t); return; }
    // "wir": the window doubles and the copy flickers on every second pulse
    const g = buffer().getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.desk; g.fillRect(0, 0, W, H);
    mainView(g, t);
    const k = smooth(span(t, first(h2), first(h2) + 0.25)) * (1 - span(t, h2.e, h2.e + 0.4));
    const on = Math.floor(beatPos(t) / 2) % 2 === 0;
    ctx.drawImage(BUF, 0, 0);
    ctx.globalAlpha = k * (on ? 0.5 : 0.22);
    ctx.drawImage(BUF, 54 * k, 40 * k);
    ctx.globalAlpha = 1;
    return;
  }
  if (t < TL.cut) { wall(ctx, t); return; }
  // the last seconds lean in towards the thinking panel and never arrive
  const push = smooth(span(t, first(TL.nothing), SCENE_END)) * 0.14;
  ctx.translate(560, 900); ctx.scale(1 + push, 1 + push); ctx.translate(-560, -900);
  outroView(ctx, t);
}
