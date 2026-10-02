// Neunundachtzig Tabs. The whole video is drawScene(ctx, t), a pure function of
// time in seconds: no state survives between frames, so render.py can render
// frames in any order and in parallel. Lyric times come from timeline.js.

const W = 1920, H = 1080;
const REDACTION_GRADES = ["Redaction", "Redaction10", "Redaction20", "Redaction35", "Redaction50", "Redaction70", "Redaction100"];

const C = {
  void: "#000000", frame: "#0b0b0d", edge: "#26262b", tab: "#141417", tabActive: "#23232a",
  text: "#8a8a93", textHi: "#ececf0", dim: "#34343c", ink: "#121216",
  violet: "#a77bff", yellow: "#d8cf4a",
};

// The window is the stage until the bridge. All browser drawing happens in
// window-local coordinates; callers place it with a transform.
const WIN = { x: 120, y: 96, w: 1680, h: 888 };
const STRIP = 46, CONTENT_Y = 98, CONTENT_H = WIN.h - CONTENT_Y;

// Tab titles 1..89. The sung ones sit at their sung numbers, the rest are the
// searches of the same night, written in the album's vocabulary.
const TITLES = [null,
  "Therapeuten Graz", "Warum bin ich müde", "Neuer Tab", "Posteingang (214)", "Kassenplatz Psychotherapie Wartezeit",
  "Müde trotz acht Stunden Schlaf", "Context Window Vergleich", "Monstera gelbe Blätter", "Prompt Engineering Kurs", "Wetter Graz",
  "Wie lange dauert ein Burnout", "Projektantrag_v7_final_FINAL", "Wohnungen Graz Lend", "Eisenmangel Symptome", "Was macht ein Prompt Engineer",
  "Ist das normal", "Wohnungen unter tausend", "Kaution zurück Mietrecht", "Rückruf Ordination", "Halluzinationen LLM Ursachen",
  "Gieß sie trotzdem", "Kalender KW 41", "Agentic Workflows", "Herzklopfen nachts", "Tech-Bros suck Sticker",
  "Neuer Tab", "Arbeitslosengeld Höhe", "Bildungskarenz Voraussetzungen", "Sabbatical Wissenschaft", "Kündigungsschreiben Vorlagen",
  "Kündigungsfrist Angestellte", "Wie sage ich es meinem Chef", "Neuer Tab", "Token Limit erreicht", "Schlafhygiene",
  "Was bedeutet Erschöpfung", "Lohnt sich das noch", "Reasoning Modelle erklärt", "Waldbaden Steiermark", "Bin ich zu alt für",
  "Einkaufsliste", "Warum vergesse ich alles", "Antwort ausstehend (3)", "Neuer Tab", "Magnesium abends",
  "Ausmisten Methode", "Wie schließt man alle Tabs", "Konzentration verbessern", "Neuer Tab", "„Harald Schmidt Best Of“",
  "Harald Schmidt Schachtelsatz", "Late Night 1999", "Lachen hilft", "Neuer Tab", "Fünfundfünfzig Tabs",
  "Browser frisst Arbeitsspeicher", "Tab-Gruppen anlegen", "Neuer Tab", "Warum kann ich nicht aufhören", "Digital Detox Wochenende",
  "Handy weglegen Tricks", "Neuer Tab", "Wann ist es genug", "Selbstoptimierung Kritik", "Erschöpfte Wachsamkeit",
  "Neuer Tab", "Sieben mal refresh", "Seite reagiert nicht", "Neuer Tab", "Allein oder einsam",
  "Freunde treffen Graz", "Neuer Tab", "Wie ruft man jemanden an", "Nachricht nicht gesendet", "Neuer Tab",
  "Entwurf gespeichert", "Was ist noch übrig", "Neuer Tab", "Seite nicht gefunden", "Wie lösche ich mich selbst",
  "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab", "Neuer Tab",
];
const N_TABS = 89;
// A sung tab is an empty tab until the voice names it.
const titleOf = (k, t) => {
  const line = TL.verse.find(v => v.n === k);
  return line && t < line.t ? "Neuer Tab" : TITLES[k];
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
const inCubic = k => Math.pow(clamp(k), 3);
const span = (t, a, b) => clamp((t - a) / (b - a));

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
// returns hex so results can be mixed again
function mix(h1, h2, k) {
  const a = hexRgb(h1), b = hexRgb(h2);
  return "#" + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, "0")).join("");
}
// Violet at the top of the stack, sick yellow at the bottom, as on the single cover.
const stackColor = (k, light = 0) => mix(mix(C.violet, C.yellow, (k - 1) / (N_TABS - 1)), "#ffffff", light);

// Each tab's page is a flat colour field (after Rozendaal's Abstract Browsing),
// never a real site. Palette stays inside the cover's violet-to-yellow range.
const PALETTE = ["#1d1a2b", "#2c2540", "#3f3460", "#5b4a8c", "#8a74c9", "#b9b06a", "#6f6a38", "#2a2a30", "#cfc8a0", "#463f5c"];
const FIELDS = [null];
const FAVICON = [null];
for (let k = 1; k <= N_TABS; k++) {
  const r = mulberry32(k * 7919);
  const pick = () => PALETTE[Math.floor(r() * PALETTE.length)];
  const blocks = [];
  for (let b = 0, nb = 1 + Math.floor(r() * 3); b < nb; b++) {
    const vertical = r() < 0.5, cut = 0.15 + r() * 0.7;
    blocks.push(vertical ? [cut, 0, 1 - cut, 1, pick()] : [0, cut, 1, 1 - cut, pick()]);
  }
  FIELDS.push({ bg: pick(), blocks, vp: [0.15 + r() * 0.7, 0.15 + r() * 0.7] });
  FAVICON.push(pick());
}

// How many tabs are open at time t. Keyframes pin the sung numbers: when the
// voice says "Tab siebzehn", tab 17 has just opened. During "Tab achtzig" nothing opens.
const COUNT_KEYS = () => [
  // some tabs are kept back for the silence after "müde", so that gap is not static
  [0, 1], [TL.bandIn, 1], [TL.verse[0].t, 9], [TL.verse[1].b, 9], [TL.verse[2].t, 17], [TL.verse[3].t, 30],
  [TL.verse[4].t, 50], [TL.verse[5].t, 80], [TL.chorus[0].t, 80], [TL.chorus[2].t, 89],
];
const OPEN = (() => {
  const keys = COUNT_KEYS(), open = [null, -1];
  for (let k = 2; k <= N_TABS; k++) {
    let t = 0;
    for (let i = 1; i < keys.length; i++) {
      const [t0, c0] = keys[i - 1], [t1, c1] = keys[i];
      if (k > c0 && k <= c1) { t = t0 + (k - c0) / (c1 - c0) * (t1 - t0); break; }
    }
    // Snap to a nearby drum onset so tabs open on hits, without overtaking the previous tab.
    const pinned = keys.some(([kt, kc]) => kc === k && kt === t);
    if (!pinned) {
      const near = AUDIO_ONSETS.reduce((b, o) => Math.abs(o - t) < Math.abs(b - t) ? o : b, Infinity);
      if (Math.abs(near - t) < 0.12 && near > open[k - 1]) t = near;
    }
    open.push(Math.max(t, open[k - 1] + 0.02));
  }
  return open;
})();
const openAmount = (k, t) => outCubic((t - OPEN[k]) / 0.12);
const lastOpen = t => { let n = 1; while (n < N_TABS && t >= OPEN[n + 1]) n++; return n; };

const audioAt = (arr, t) => (arr[clamp(Math.round(t * AUDIO_RATE), 0, arr.length - 1)] || 0) / 99;

function lineAt(lines, t) {
  let cur = null;
  for (const l of lines) if (t >= l.t) cur = l;
  return cur;
}
function typed(text, t0, t1, t) {
  if (t1 <= t0) return t >= t0 ? text : "";
  return text.slice(0, Math.round(text.length * span(t, t0, t1)));
}
// a line is typed while its words are sung
const typedLine = (text, line, t) => typed(text, line.a, line.b, t);

const isStill = t => t >= TL.verse[5].t && t < TL.chorus[0].t;

// ---------------------------------------------------------------- browser

function roundTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawField(ctx, k, x, y, w, h, grey = 0) {
  const f = FIELDS[k];
  ctx.fillStyle = grey ? mix(f.bg, "#202024", grey) : f.bg;
  ctx.fillRect(x, y, w, h);
  for (const [bx, by, bw, bh, col] of f.blocks) {
    ctx.fillStyle = grey ? mix(col, "#2a2a2e", grey) : col;
    ctx.fillRect(x + bx * w, y + by * h, bw * w, bh * h);
  }
}

// s: { t, active, query, caret, accent, muted, content(ctx) }
function drawBrowser(ctx, s) {
  const { t } = s;
  ctx.fillStyle = C.frame;
  ctx.beginPath(); ctx.roundRect(0, 0, WIN.w, WIN.h, 12); ctx.fill();

  // tab strip, shrinking like a real one: title, then favicon, then a sliver
  const tabs = [];
  let total = 0;
  for (let k = 1; k <= N_TABS; k++) { const a = openAmount(k, t); if (a > 0) { tabs.push([k, a]); total += a; } }
  const avail = WIN.w - 24 - 52;
  const unit = Math.min(212, avail / total);
  let x = 12;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, WIN.w, STRIP); ctx.clip();
  for (const [k, a] of tabs) {
    const tw = unit * a, active = k === s.active;
    const fav = s.muted ? C.dim : FAVICON[k];
    if (tw >= 6) {
      roundTop(ctx, x + 0.5, 8, tw - 1, STRIP - 8, Math.min(7, tw / 4));
      ctx.fillStyle = active ? C.tabActive : C.tab; ctx.fill();
      if (active && s.accent) { ctx.fillStyle = C.violet; ctx.fillRect(x + 4, 8, tw - 8, 2); }
      if (tw > 70) {
        ctx.fillStyle = fav; ctx.fillRect(x + 12, 21, 11, 11);
        const title = titleOf(k, t);
        const max = Math.floor((tw - 36 - (active && tw > 110 ? 22 : 8)) / 7.8);
        const shown = title.length > max ? title.slice(0, Math.max(0, max - 1)) + "…" : title;
        ctx.font = '400 13px "Space Mono"'; ctx.fillStyle = active ? C.textHi : C.text;
        ctx.fillText(shown, x + 31, 31);
        if (active && tw > 110) ctx.fillText("×", x + tw - 20, 31);
      } else if (tw > 14) {
        const fs = Math.min(11, tw - 8);
        ctx.fillStyle = fav; ctx.fillRect(x + (tw - fs) / 2, 27 - fs / 2, fs, fs);
      } else {
        ctx.fillStyle = s.muted ? C.dim : stackColor(k); ctx.fillRect(x + tw / 2 - 0.5, 12, 1, STRIP - 16);
      }
    } else {
      ctx.fillStyle = s.muted ? C.dim : stackColor(k); ctx.fillRect(x, 12, Math.max(1, tw), STRIP - 16);
    }
    x += tw;
  }
  ctx.font = '400 18px "Space Mono"'; ctx.fillStyle = C.text;
  ctx.fillText("+", x + 14, 33);
  ctx.restore();

  // address bar
  ctx.fillStyle = C.tabActive; ctx.fillRect(0, STRIP, WIN.w, CONTENT_Y - STRIP);
  ctx.font = '400 17px "Space Mono"'; ctx.fillStyle = C.text;
  ctx.fillText("‹  ›  ↻", 26, 78);
  ctx.fillStyle = C.tab;
  ctx.beginPath(); ctx.roundRect(120, 55, WIN.w - 240, 34, 17); ctx.fill();
  ctx.font = '400 15px "Space Mono"'; ctx.fillStyle = C.textHi;
  const q = s.query || "";
  ctx.fillText(q, 142, 77);
  if (s.caret) ctx.fillRect(142 + ctx.measureText(q).width + 2, 63, 2, 19);

  // content
  ctx.save();
  ctx.beginPath(); ctx.rect(0, CONTENT_Y, WIN.w, CONTENT_H); ctx.clip();
  ctx.fillStyle = C.void; ctx.fillRect(0, CONTENT_Y, WIN.w, CONTENT_H);
  if (s.content) s.content(ctx);
  ctx.restore();

  ctx.strokeStyle = C.edge; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(0.5, 0.5, WIN.w - 1, WIN.h - 1, 12); ctx.stroke();
}

// Tab overview. In the verse a 20 x 4 band at the top keeps the lyric band free;
// on the chorus downbeat it reflows into 13 x 7 over the whole page.
function gridCell(k, layout) {
  const [cols, rows, h] = layout ? [13, 7, CONTENT_H] : [20, 4, 380];
  const pad = 34, gap = 10;
  const cw = (WIN.w - 2 * pad - (cols - 1) * gap) / cols, ch = (h - 2 * pad - (rows - 1) * gap) / rows;
  return [pad + ((k - 1) % cols) * (cw + gap), CONTENT_Y + pad + Math.floor((k - 1) / cols) * (ch + gap), cw, ch];
}
const gridLayout = t => smooth(span(t, TL.chorus[0].t, TL.chorus[0].t + 0.45));
function GRID(k, t) {
  const e = gridLayout(t), a = gridCell(k, 0), b = gridCell(k, 1);
  return e <= 0 ? a : e >= 1 ? b : a.map((v, i) => lerp(v, b[i], e));
}
// From the chorus on, the last grid row is the slot the lyric lives in.
const LYRIC_ROW = 6;
// the cell the camera falls into before the Droste; tab 77 is "Was ist noch übrig"
const DIVE_TAB = 77;
const inLyricSlot = k => Math.floor((k - 1) / 13) === LYRIC_ROW;

function wrapWords(ctx, text, maxW) {
  const rows = [];
  for (const word of text.split(" ")) {
    const row = rows.length ? rows[rows.length - 1] + " " + word : word;
    if (rows.length && ctx.measureText(row).width <= maxW) rows[rows.length - 1] = row;
    else rows.push(word);
  }
  return rows;
}

// o: { alpha, grey, titles (0..1), titleDim (0..1), corridorsFrom, slot }
function drawMosaic(ctx, t, o) {
  if (o.alpha <= 0) return;
  for (let k = 1; k <= N_TABS; k++) {
    const a = openAmount(k, t);
    if (a <= 0 || (o.slot && inLyricSlot(k))) continue;
    const [x, y, w, h] = GRID(k, t), s = lerp(0.6, 1, a);
    const cx = x + w * (1 - s) / 2, cy = y + h * (1 - s) / 2, cw = w * s, chh = h * s;
    ctx.globalAlpha = o.alpha;
    drawField(ctx, k, cx, cy, cw, chh, o.grey || 0);
    if (o.corridorsFrom !== undefined) drawCorridor(ctx, k, cx, cy, cw, chh, t, o.corridorsFrom, o.alpha);
    if (o.titles > 0) {
      ctx.globalAlpha = o.titles;
      ctx.font = '400 12px "Space Mono"';
      ctx.fillStyle = mix(C.textHi, C.dim, o.titleDim || 0);
      ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
      ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, chh); ctx.clip();
      wrapWords(ctx, TITLES[k], cw - 14).slice(0, 3).forEach((r, i) => ctx.fillText(r, cx + 7, cy + 18 + i * 15));
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
}

// "Parallelfluchtpunkte": every tab gets its own one-point perspective inside
// its own cell, each corridor leading somewhere else.
function drawCorridor(ctx, k, x, y, w, h, t, t0, alpha) {
  const appear = span(t, t0 + (k - 1) * 0.03, t0 + (k - 1) * 0.03 + 0.5);
  if (appear <= 0) return;
  const vx = x + FIELDS[k].vp[0] * w, vy = y + FIELDS[k].vp[1] * h;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = alpha * 0.9 * appear;
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stackColor(k, 0.15); ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [cx, cy] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) {
    ctx.moveTo(cx, cy); ctx.lineTo(lerp(cx, vx, appear), lerp(cy, vy, appear));
  }
  for (let j = 1; j <= 5; j++) {
    const m = appear * (1 - Math.pow(0.62, j));
    ctx.rect(lerp(x, vx, m), lerp(y, vy, m), w * (1 - m), h * (1 - m));
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- type

const gradeFont = (g, size) => `${size}px "${REDACTION_GRADES[g]}"`;

function lyric(ctx, text, x, y, size, grade, color = C.textHi, align = "left") {
  ctx.font = gradeFont(grade, size);
  ctx.textAlign = align; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// Size at which the complete line fits, so a line being typed never changes size.
function fitSize(ctx, full, grade, size, maxW) {
  ctx.font = gradeFont(grade, size);
  return Math.min(size, size * maxW / ctx.measureText(full).width);
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
  const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 2, 1, 1);
  return c;
})();
// offscreen layer for the tower's glow
const GLOW = typeof document === "undefined" ? null : (() => {
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
  // elliptical, so the ends of wide lyric lines stay as bright as their middle
  ctx.globalAlpha = 1;
  ctx.translate(W / 2, H / 2); ctx.scale(W / H, 1);
  const v = ctx.createRadialGradient(0, 0, H * 0.42, 0, 0, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = v; ctx.fillRect(-H, -H, 2 * H, 2 * H);
  ctx.restore();
}

// ---------------------------------------------------------------- window scenes

function placeWindow(ctx, scale = 1, cx = WIN.x + WIN.w / 2, cy = WIN.y + WIN.h / 2) {
  ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-WIN.w / 2, -WIN.h / 2);
}

function verseState(t) {
  const V = TL.verse;
  const i = V.findIndex((l, j) => t >= l.t && (j === V.length - 1 || t < V[j + 1].t));
  return i < 0 ? null : { i, line: V[i] };
}

// 0 to band entry: only a caret, centred on black.
function sceneCaret(ctx, t) {
  if (Math.floor(t / 0.53) % 2) return;
  ctx.fillStyle = C.textHi; ctx.fillRect(W / 2 - 2, H / 2 - 30, 4, 60);
}

// Band entry, verse and chorus: one frontal window.
function sceneWindow(ctx, t) {
  const still = isStill(t);
  const vs = t >= TL.verse[0].t && t < TL.chorus[0].t ? verseState(t) : null;
  const newest = lastOpen(t);
  const blink = Math.floor(t / 0.53) % 2 === 0;
  const chorus = t >= TL.chorus[0].t;
  const cl = chorus ? lineAt(TL.chorus, t) : null;
  let query = "", active = newest;
  if (vs) {
    active = vs.line.n;
    query = typedLine(vs.line.q, vs.line, t);
  }
  if (cl) query = typedLine(cl.q, cl, t);
  // between sung lines the newest tab announces itself again
  const next = vs ? (TL.verse[vs.i + 1] || TL.chorus[0]).t : 0;
  const resting = vs && !still && t > vs.line.b + 0.6 && next - t > 0.8;

  // last second of the chorus: fall into one corridor, which becomes the Droste
  const dive = inCubic(span(t, TL.chorus[3].t - 1.0, TL.chorus[3].t));
  ctx.save();
  if (dive > 0) {
    const [gx, gy, gw, gh] = GRID(DIVE_TAB, t);
    const px = WIN.x + gx + gw / 2, py = WIN.y + gy + gh / 2;
    const z = Math.pow(W / gw, dive);
    ctx.translate(lerp(px, W / 2, dive), lerp(py, H / 2, dive)); ctx.scale(z, z); ctx.translate(-px, -py);
  }
  placeWindow(ctx);
  drawBrowser(ctx, {
    t, active, query, accent: !still, muted: still,
    caret: !still && (chorus ? cl && t < cl.b : vs ? t < vs.line.b || blink : blink),
    content: c => {
      if (still) {
        // Stillest moment of the piece: no colour, no motion, no number, no
        // results; the worst sentence in the cleanest type of the whole video.
        if (t >= vs.line.a) lyric(c, vs.line.q, 64, 800, 104, 0);
        return;
      }
      const loud = audioAt(AUDIO_RMS, t);
      if (!chorus) {
        drawMosaic(c, t, { alpha: 0.3 + 0.08 * loud });
        if (!vs || resting) {
          // instrumental: each new tab announces itself, one title card per opening
          const k = newest, a = smooth(span(t, OPEN[k], OPEN[k] + 0.1));
          c.globalAlpha = a; c.font = '400 56px "Space Mono"'; c.fillStyle = C.text;
          c.fillText(titleOf(k, t), 64, 760);
          c.globalAlpha = 1;
        }
      } else {
        const fade = span(t, TL.chorus[0].t, TL.chorus[0].t + 2);
        const silence = smooth(span(t, TL.chorus[1].t, TL.chorus[1].t + 3));
        drawMosaic(c, t, {
          alpha: lerp(0.3, 0.7, fade) * (0.88 + 0.12 * loud), grey: silence * 0.85,
          titles: fade, titleDim: silence * 0.75, slot: true,
          corridorsFrom: TL.chorus[2].t,
        });
      }
      if (vs && !resting) {
        const grade = vs.i < 2 ? 0 : vs.i < 4 ? 1 : 2;
        c.font = '700 150px "Space Mono"'; c.fillStyle = C.dim; c.fillText(String(vs.line.n), 64, 640);
        lyric(c, typedLine(vs.line.q, vs.line, t), 64, 800, 104, grade);
      }
    },
  });
  ctx.restore();
  // the chorus line stays in screen space and fades while the camera dives
  if (cl) {
    const i = TL.chorus.indexOf(cl), g = i < 2 ? 3 : 4;
    ctx.save(); ctx.globalAlpha = 1 - dive;
    lyric(ctx, typedLine(cl.q, cl, t), WIN.x + 40, WIN.y + 846, fitSize(ctx, cl.q, g, 92, WIN.w - 80), g);
    ctx.restore();
  }
}

// "Keiner führt hier raus, nur tiefer rein": the window contains itself (Droste),
// and the camera falls inward, faster and faster, never reaching a way out.
const DROSTE = (() => {
  const k = (CONTENT_H * 0.86) / WIN.h;
  const ix = (WIN.w - WIN.w * k) / 2, iy = CONTENT_Y + (CONTENT_H - WIN.h * k) / 2;
  return { k, ix, iy, fx: ix / (1 - k), fy: iy / (1 - k) };
})();

function sceneDroste(ctx, t) {
  const t0 = TL.chorus[3].t, t1 = TL.bridge;
  // an integer number of levels, so the last frame is exactly the plain window
  const p = 4 * Math.pow(span(t, t0, t1), 1.7);
  const base = Math.floor(p), z = Math.pow(DROSTE.k, -(p - base));
  const shake = audioAt(AUDIO_FLUX, t) > 0.7 ? 2 : 0;
  ctx.save();
  ctx.translate(WIN.x + DROSTE.fx + shake, WIN.y + DROSTE.fy);
  ctx.scale(z, z);
  ctx.translate(-DROSTE.fx, -DROSTE.fy);
  // start two levels outside the frame, so the void never shows at the edges
  for (let out = 0; out < 2; out++) { ctx.scale(1 / DROSTE.k, 1 / DROSTE.k); ctx.translate(-DROSTE.ix, -DROSTE.iy); }
  for (let level = -2; level < 7; level++) {
    const a = ((base + level) % N_TABS + N_TABS) % N_TABS;
    drawBrowser(ctx, {
      t, active: N_TABS, accent: true,
      query: level + base === 0 ? TL.chorus[3].q : TITLES[1 + (a * 13) % N_TABS],
      content: c => drawMosaic(c, t, { alpha: 0.5, grey: 0.85, corridorsFrom: TL.chorus[2].t }),
    });
    ctx.translate(DROSTE.ix, DROSTE.iy);
    ctx.scale(DROSTE.k, DROSTE.k);
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - span(t, t1 - 0.56, t1);
  ctx.shadowColor = "#000"; ctx.shadowBlur = 50;
  lyric(ctx, typedLine(TL.chorus[3].q, TL.chorus[3], t), 184, 900, fitSize(ctx, TL.chorus[3].q, 5, 96, W - 368), 5);
  ctx.restore();
}

// ---------------------------------------------------------------- tower

// The bridge builds the single cover's tower out of the 89 tabs, storey by
// storey, readable, while the camera climbs with it. World units: x from the
// tower axis, y up from the base (negative is higher).
const ST = { step: 40, h: 34, w: 560, x: 1240 };
const storeyTop = k => -(N_TABS - k) * ST.step - ST.h;
const EXTRA = [ // tabs that no longer fit, stacked above a gap
  { n: 90, label: "…", t: () => TL.bridgeLines[2].t, top: storeyTop(1) - 120 },
  { n: 100, label: "Lass uns bleiben", t: () => TL.bridgeLines[4].t, top: storeyTop(1) - 120 - ST.step },
  { n: 101, label: "was wir sind", t: () => TL.bridgeLines[5].t, top: storeyTop(1) - 120 - 2 * ST.step },
];
const BUILD = { from: TL.bridge + 0.3, to: TL.bridgeLines[2].t - 0.3 };
const builtAt = k => lerp(BUILD.from, BUILD.to, (N_TABS - k) / (N_TABS - 1));
const FALL = (() => {
  const r = mulberry32(42), out = [null];
  for (let k = 1; k <= N_TABS; k++) out.push({ dx: (r() - 0.5) * 1500, rot: (r() - 0.5) * 0.6, delay: r() });
  return out;
})();
const HEAP_Y = 200;
// The lower storeys drip off in the quiet part; the rest fall in one beat on the loud return.
const dropStart = k => k > 34 ? TL.quiet + 0.8 + (N_TABS - k) * 0.11 + FALL[k].delay * 0.6 : TL.loudReturn + k * 0.01;
const dropDur = k => k > 34 ? 1.4 : 0.5;
// a stacked pile, not a menu: every storey sits slightly off
const JITTER = (() => {
  const r = mulberry32(99), out = [null];
  for (let k = 1; k <= N_TABS + 3; k++) out.push({ dx: (r() - 0.5) * 16, rot: (r() - 0.5) * 0.021 });
  return out;
})();
const SELF_Y = 40;  // where the shrunken window stays, just under the base
const FULL = { top: EXTRA[2].top - 40, bottom: HEAP_Y + 80 };

// camera: world y at screen centre, and scale
function towerCam(t) {
  const baseCy = -(H * 0.39);
  const follow = tt => {
    const kf = lerp(N_TABS, 1, span(tt, BUILD.from, BUILD.to));
    return Math.min(baseCy, -(N_TABS - kf) * ST.step - ST.h + 240);
  };
  const top90 = EXTRA[0].top + 260;
  const sFull = (H - 60) / (FULL.bottom - FULL.top), cyFull = (FULL.top + FULL.bottom) / 2;
  const t90 = TL.bridgeLines[2].t, tPan = t90 + 1.2, tBack = TL.quiet - 0.4, tFull = TL.quiet + 1.2;
  if (t < t90) return { s: 1, cy: follow(t) };
  if (t < tPan) return { s: 1, cy: lerp(follow(t90), top90, smooth(span(t, t90, t90 + 0.6))) };
  // read the night's searches once more, top to bottom
  if (t < tBack) return { s: 1, cy: lerp(top90, baseCy, smooth(span(t, tPan, tBack))) };
  const e = smooth(span(t, tBack, tFull));
  return { s: Math.pow(sFull, e), cy: lerp(baseCy, cyFull, e) };
}

function storey(ctx, w, h, fill, num, label, s) {
  // the cover's tab profile: a body with a lighter label field and a dark rim
  roundTop(ctx, -w / 2, 0, w, h, Math.min(8, h / 3));
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(-w / 2 + 70, 7, w - 120, h - 12);
  if (s * h < 14) return;
  ctx.fillStyle = C.ink;
  ctx.font = '700 17px "Space Mono"'; ctx.fillText(num, -w / 2 + 14, h - 10);
  ctx.font = '400 16px "Space Mono"'; ctx.fillText(label, -w / 2 + 82, h - 10);
  if (num === "90") ctx.fillText("×", w / 2 - 26, h - 10);
}

function drawTowerWorld(ctx, t, cam, withWindow) {
  const axis = cam.x === undefined ? ST.x : cam.x;
  const toScreen = () => {
    ctx.translate(axis, H / 2); ctx.scale(cam.s, cam.s); ctx.translate(0, -cam.cy);
  };
  ctx.save(); toScreen();

  // the self: shrinks from the full window to less than one storey, left at the base
  if (withWindow) {
    const e = smooth(span(t, TL.bridge, TL.bridge + 1.1));
    if (e < 1) {
      ctx.restore(); ctx.save();
      // screen-space interpolation from the frontal window into world space
      const wx = axis, wy = H / 2 + (SELF_Y - cam.cy) * cam.s, ws = 0.15 * cam.s;
      placeWindow(ctx, lerp(1, ws, e), lerp(WIN.x + WIN.w / 2, wx, e), lerp(WIN.y + WIN.h / 2, wy, e));
      drawBrowser(ctx, { t, active: N_TABS, accent: true, content: c => drawMosaic(c, t, { alpha: 0.5, grey: 0.85 }) });
      ctx.restore(); ctx.save(); toScreen();
    } else {
      ctx.save(); ctx.translate(0, SELF_Y); ctx.scale(0.15, 0.15); ctx.translate(-WIN.w / 2, -WIN.h / 2);
      drawBrowser(ctx, { t, active: N_TABS, accent: true, content: c => drawMosaic(c, t, { alpha: 0.5, grey: 0.85 }) });
      ctx.restore();
    }
  }

  // drips from the lowest storey that stays, behind everything that still hangs
  const drip = span(t, TL.quiet, TL.quiet + 7) * (1 - span(t, TL.loudReturn, TL.loudReturn + 0.3));
  if (drip > 0) {
    let low = 34;
    for (let k = N_TABS; k > 34; k--) if (t < dropStart(k)) { low = k; break; }
    const r = mulberry32(7);
    for (let d = 0; d < 11; d++) {
      const dx = (r() - 0.5) * ST.w * 0.85, len = drip * (300 + r() * 1100);
      ctx.fillStyle = mix(C.yellow, "#000000", 0.1 + r() * 0.4);
      ctx.fillRect(dx, storeyTop(low) + ST.h, 6 + r() * 10, len);
    }
  }

  for (let k = N_TABS; k >= 1; k--) {
    const b = builtAt(k);
    const fly = outCubic(span(t, b - 0.5, b));
    if (fly <= 0) continue;
    // each storey drops onto the one below it
    let x = JITTER[k].dx, y = lerp(storeyTop(k) - 260, storeyTop(k), fly), rot = JITTER[k].rot;
    const f = FALL[k], falling = span(t, dropStart(k), dropStart(k) + dropDur(k));
    if (falling > 0) {
      const g = inCubic(falling);
      y = lerp(y, HEAP_Y - f.delay * 70, g); x += f.dx * outCubic(falling); rot += f.rot * g;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = Math.min(1, fly * 3);
    storey(ctx, ST.w, ST.h, stackColor(k), String(k).padStart(2, "0"), TITLES[k], cam.s);
    ctx.restore();
  }
  EXTRA.forEach((e, i) => {
    const a = outCubic(span(t, e.t(), e.t() + 0.5));
    if (a <= 0) return;
    const f = FALL[i + 1], j = JITTER[N_TABS + 1 + i];
    const g = inCubic(span(t, TL.loudReturn, TL.loudReturn + 0.5));
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(j.dx + f.dx * 0.6 * g, lerp(e.top, HEAP_Y - 60 - i * 30, g)); ctx.rotate(j.rot + f.rot * g);
    storey(ctx, ST.w, ST.h, e.n === 90 ? C.violet : mix(C.violet, "#ffffff", 0.45), String(e.n), e.label, cam.s);
    ctx.restore();
  });
  ctx.restore();
}

function sceneTower(ctx, t) {
  const cam = towerCam(t);
  // a slow 3/4 sway about the base while the tower stands
  ctx.save();
  const sway = 0.004 * Math.sin(2 * Math.PI * (t - TL.bridge) / (3 * TL.endBeat.period)) * span(t, BUILD.to, BUILD.to + 1);
  ctx.translate(ST.x, H / 2 + (0 - cam.cy) * cam.s); ctx.rotate(sway); ctx.translate(-ST.x, -(H / 2 + (0 - cam.cy) * cam.s));
  drawTowerWorld(ctx, t, cam, true);
  ctx.restore();
  // glow: the tower again, blurred and added, like the cover's phosphor
  if (GLOW) {
    const g = GLOW.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.2; ctx.filter = "blur(16px)";
    ctx.drawImage(GLOW, 0, 0);
    ctx.restore();
  }

  const bl = lineAt(TL.bridgeLines, t);
  if (bl) {
    const full = bl.rows.join(" "), shown = typedLine(full, bl, t);
    // the column ends well before the tower
    const size = Math.min(...bl.rows.map(r => fitSize(ctx, r, bl.grade, 92, ST.x - ST.w / 2 - 320)));
    let used = 0;
    bl.rows.forEach((row, r) => {
      const part = shown.slice(used, used + row.length); used += row.length + 1;
      lyric(ctx, part, 140, 430 + r * size * 1.13, size, bl.grade, bl.quiet ? C.text : C.textHi);
    });
  }
}

// ---------------------------------------------------------------- end

// Spoken end: no interface. After the line is said, it stacks itself into a
// tower of rows, one every two beats, yellow at the bottom to violet at the top,
// restoring row by row but never clean. The hard stop cuts it mid-build.
const ROW0 = 985;  // baseline of the first sentence row, just above the heap
function sceneSpoken(ctx, t) {
  const { downbeat, period } = TL.endBeat;
  const rowStart = downbeat + 8 * period;            // third bar after the return
  // on the loud return the rest of the tower falls in one beat; the world then
  // slides to the centre, the heap dims, and the sentence takes the tower's place
  const centre = smooth(span(t, TL.loudReturn, TL.spoken[0].t));
  ctx.save(); ctx.globalAlpha = lerp(1, 0.4, span(t, TL.loudReturn + 0.6, TL.spoken[0].t));
  drawTowerWorld(ctx, t, { ...towerCam(TL.loudReturn), x: lerp(ST.x, W / 2, centre) }, false);
  ctx.restore();

  const a = TL.spoken[0].q, b = TL.spoken[1].q, full = a + b;
  const settle = smooth(span(t, rowStart - period, rowStart));
  // two grades worse for three frames on every bar downbeat
  const sinceBar = (t - downbeat) % (4 * period);
  const relapse = t > downbeat && sinceBar < 0.1 ? 2 : 0;

  if (settle < 1 && t >= TL.spoken[0].t) {
    const size = lerp(118, 44, settle);
    ctx.font = gradeFont(6, size);
    const x = (W - ctx.measureText(full).width) / 2;
    const y = lerp(575, ROW0, settle);
    lyric(ctx, typed(a, TL.spoken[0].t, TL.spoken[0].t + 0.5, t), x, y, size, 6);
    if (t >= TL.spoken[1].t) lyric(ctx, typed(b, TL.spoken[1].t, TL.spoken[1].t + 0.6, t), x + ctx.measureText(a).width, y, size, 6);
    return;
  }
  const rows = Math.floor((t - rowStart) / (2 * period)) + 1;
  for (let r = 0; r < rows; r++) {
    const k = Math.round(lerp(N_TABS, 1, r / 18));
    const grade = clamp(6 - Math.floor(r / 3) + relapse, 1, 6);
    const y = ROW0 - r * 48;
    const appear = smooth(span(t, rowStart + r * 2 * period, rowStart + r * 2 * period + 0.12));
    ctx.font = gradeFont(grade, 44);
    ctx.globalAlpha = appear;
    lyric(ctx, full, W / 2, y, 44, grade, stackColor(k, 0.1), "center");
  }
  ctx.globalAlpha = 1;
}

function grainAmount(t) {
  if (t < TL.chorus[0].t) return 0.05;
  if (t < TL.bridge) return 0.08;
  if (t < TL.loudReturn) return 0.1;
  return lerp(0.1, 0.05, span(t, TL.loudReturn, TL.cut));
}

function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  if (t >= TL.cut) return;
  if (t < TL.bandIn) sceneCaret(ctx, t);
  else if (t < TL.chorus[3].t) sceneWindow(ctx, t);
  else if (t < TL.bridge) sceneDroste(ctx, t);
  else if (t < TL.loudReturn) sceneTower(ctx, t);
  else sceneSpoken(ctx, t);
  texture(ctx, t, grainAmount(t), isStill(t));
}
