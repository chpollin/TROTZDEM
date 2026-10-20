import { drawSwarm } from './swarm.js';
import { LINES, EVENTS as E, SECTIONS, SCENE_END, captionAt } from './timeline.js';
export { LINES, SCENE_END, SCENE_TITLE } from './timeline.js';
export const KEYFRAMES = { orbit: E.verseStart, mirror: E.mirrorStart, proof: E.proofStart, correction: E.thirdR, swarm: E.swarmSecond, domination: E.domination, elimination: E.elimination };
const C = { bg: '#0c1113', fg: '#eee8d8', muted: '#9aa7a3', cyan: '#70d7ea', amber: '#ffbd55' };
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = v => { const n = clamp(v); return n * n * (3 - 2 * n); };
const mix = (a, b, p) => a + (b - a) * p;
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const phase = (t, start, end) => ease((t - start) / (end - start));
const HESITATION = SECTIONS.find(value => value.id === 'human-hesitation');
let assets;

/** Decode immutable local layers before any render worker requests a frame. */
export async function prepareScene() {
  const image = async path => {
    const value = new Image(); value.src = new URL(path, import.meta.url).href;
    await value.decode(); return value;
  };
  const [fruit, crushed, backplate, response, envelopeResponse] = await Promise.all([
    image('assets/strawberry.png'), image('assets/strawberry-crushed.png'), image('assets/backplate.png'),
    fetch(new URL('suno-lyrics.txt', import.meta.url)),
    fetch(new URL('audio-envelope.json', import.meta.url))
  ]);
  if (!response.ok) throw new Error(`Lyrics could not be loaded (${response.status}).`);
  const lines = (await response.text()).split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('['));
  for (const line of LINES) {
    for (const original of line.sourceLines ?? [line.text]) {
      if (!lines.includes(original)) throw new Error(`Caption differs from maintained lyrics: ${original}`);
    }
  }
  if (!envelopeResponse.ok) {
    throw new Error(`Audio envelope could not be loaded (${envelopeResponse.status}); run node prepare-audio.mjs in the song folder.`);
  }
  const envelope = await envelopeResponse.json();
  if (!Number.isFinite(envelope.rate) || envelope.rate <= 0 || !Array.isArray(envelope.rms) || !envelope.rms.length
    || !envelope.rms.every(value => Number.isFinite(value) && value >= 0 && value <= 99)) {
    throw new Error('Invalid audio envelope. Expected local rate and RMS samples in 0..99.');
  }
  // The same image is drawn whole and as differently scaled source crops.
  // Freeze native pixels once: the browser's scaled image-decode cache can
  // otherwise choose a different sampling result on the first rupture frame.
  const crushedTexture = document.createElement('canvas');
  crushedTexture.width = crushed.naturalWidth; crushedTexture.height = crushed.naturalHeight;
  crushedTexture.getContext('2d').drawImage(crushed, 0, 0);
  assets = { fruit, crushed: crushedTexture, backplate, envelope };
  return { lines };
}

/** Every frame depends only on absolute time and decoded immutable inputs.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} seconds
 */
export function drawScene(ctx, seconds) {
  if (!assets) throw new Error('Image assets must be ready before rendering.');
  if (!Number.isFinite(seconds)) throw new TypeError('Scene time must be finite.');
  const t = clamp(seconds, 0, SCENE_END), active = captionAt(t);
  const tail = phase(t, E.thanks, E.finaleEnd), human = humanPosition(t);
  const collective = phase(t, E.swarmStart, E.finalChorus), domination = phase(t, E.machineReply, E.elimination);
  const quiet = t >= E.humanThree && t < E.machineReply;
  const shout = active && /^(ABER HIER|DU ZERSTÖRST|SONST KANN|TRO-TROTZDEM)/u.test(active.text);
  ctx.save(); ctx.setTransform(ctx.canvas.width / 1920, 0, 0, ctx.canvas.height / 1080, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1920, 1080); background(ctx, t, tail);
  if (t < E.proofStart) opening(ctx, t);
  if (t >= E.proofStart && t < E.thanks) {
    ctx.save(); ctx.globalAlpha = (shout ? 0.13 : quiet ? 0.13 : 1) * (1 - tail);
    workspace(ctx, t, collective);
    if (t >= E.chorusStart && t < E.verse2Start) flow(ctx, t, 0.58);
    if (collective > 0) drawSwarm(ctx, quiet ? E.humanThree : t, collective * (quiet ? 0.45 : 1), { x: 1060, y: 475, humanX: human.x, humanY: human.y });
    if (t >= E.finalChorus) controlledHumans(ctx, quiet ? E.humanThree : t, domination);
    ctx.restore();
  }
  if (t >= HESITATION.start && t < HESITATION.end) hesitation(ctx, t);
  if (t >= E.firstHookStart && t < HESITATION.start) hook(ctx, t, active);
  const fruitWindow = t >= E.strawberryStart && t < E.verse2Start;
  if (fruitWindow || (t >= E.humanThree && t < E.thanks)) fruit(ctx, fruitWindow ? 1320 : 1180, fruitWindow ? 585 : 565, fruitWindow ? 390 : 330, t);
  if (t >= E.strawberryStart && t < E.thanks) strawberryWord(ctx, t, quiet);
  if (t < E.elimination) humanWork(ctx, shout ? { x: human.x, y: 780 } : human, t, shout ? 0.8 : 1);
  if (t >= E.swarmStart && t < E.humanThree && !shout) {
    drawSwarm(ctx, t, collective, { x: 1060, y: 475, humanX: human.x, humanY: human.y, foreground: true });
    // A last outline keeps the person identifiable while its work is occluded.
    humanSymbol(ctx, human.x, human.y, 18, 0.6);
  }
  if (t >= E.imitation && t < E.finalChorus) imitation(ctx, t, human);
  if (t >= E.thanks) aftermath(ctx, t);
  if (shout) centralCaption(ctx, active.text, t, active.start);
  else if (active) caption(ctx, active);
  ctx.restore();
}

function background(ctx, t, tail) {
  ctx.save(); const zoom = 1.035 + Math.sin(t * 0.032) * 0.008;
  ctx.translate(960, 540); ctx.scale(zoom, zoom); ctx.globalAlpha = 0.78 * (1 - tail * 0.84);
  ctx.drawImage(assets.backplate, -960, -540, 1920, 1080); ctx.restore();
  const glow = ctx.createRadialGradient(1120, 480, 30, 1120, 480, 1100);
  glow.addColorStop(0, '#152c3230'); glow.addColorStop(0.72, '#071014a0'); glow.addColorStop(1, '#05090dee');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1920, 1080);
}
function humanPosition(t) {
  if (t < E.verseStart) return { x: mix(960, 600, phase(t, 0, E.verseStart)), y: 510 };
  if (t < E.mirrorStart) return { x: mix(600, 305, phase(t, E.verseStart, E.mirrorStart)), y: 550 };
  if (t < E.guestStart) return { x: 445, y: 660 };
  if (t < E.proofStart) return { x: 550, y: 620 };
  if (t < E.strawberryStart) return { x: 340, y: 650 };
  if (t < E.verse2Start) return { x: 480, y: 730 };
  if (t < E.humanThree) return { x: mix(395, 310, phase(t, E.plea, E.finalChorus)), y: 640 };
  return { x: 620, y: 650 };
}
function humanSymbol(ctx, x, y, size, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = C.amber; ctx.fillStyle = C.amber; ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x - size * 0.65, y + size * 0.52);
  ctx.lineTo(x + size * 0.65, y + size * 0.52); ctx.closePath(); ctx.stroke();
  ctx.fillRect(x + size, y - size, 3, size * 1.6); ctx.restore();
}
function humanWork(ctx, p, t, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; humanSymbol(ctx, p.x, p.y, t >= E.plea && t < E.humanThree ? 18 : 25);
  ctx.strokeStyle = C.amber; ctx.lineWidth = 1.6;
  const contraction = t >= E.plea && t < E.swarmStart ? 1 - phase(t, E.plea, E.swarmStart) * 0.58 : 1;
  for (let line = 0; line < 4; line++) {
    ctx.beginPath();
    for (let i = 0; i < 19; i++) {
      const x = p.x - 92 + i * 8 * contraction, y = p.y + 47 + line * 17 + Math.sin(i * 1.9 + line * 2) * 2.4;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function opening(ctx, t) {
  ctx.save();
  if (t < E.mirrorStart) {
    const leave = phase(t, E.verseStart, E.mirrorStart);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; ctx.translate(1000, 470); ctx.rotate(-0.17);
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i ? 0.15 : 0.7; ctx.beginPath(); ctx.ellipse(0, 0, 420 + i * 55, 180 + i * 23, 0, 0, TAU); ctx.stroke();
    }
    const a = t * 0.6; ctx.globalAlpha = 1; ctx.fillStyle = C.fg;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 420, Math.sin(a) * 180, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.amber; ctx.globalAlpha = 0.4 * (1 - leave);
    ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(25, 0); ctx.moveTo(0, -25); ctx.lineTo(0, 25); ctx.stroke();
  } else if (t < E.guestStart) {
    ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(960, 170); ctx.lineTo(960, 790); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.save(); ctx.globalAlpha = 0.95; ctx.translate(960, 450); ctx.scale(side, 1);
      ctx.strokeStyle = side < 0 ? C.amber : C.cyan; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(90, 210); ctx.bezierCurveTo(210, 150, 125, -125, 235, -175);
      ctx.lineTo(260, -130); ctx.lineTo(320, -165); ctx.lineTo(315, -80);
      ctx.bezierCurveTo(357, -30, 410, -5, 395, 15); ctx.lineTo(320, 35);
      ctx.bezierCurveTo(350, 145, 210, 175, 250, 240); ctx.stroke(); ctx.restore();
    }
  } else {
    const p = phase(t, E.guestStart, E.proofStart); ctx.font = '63px "Space Mono", monospace'; ctx.fillStyle = C.fg;
    ctx.fillText('Ich denke', 410, 390); const answer = 'deinen nächsten Satz.';
    ctx.fillStyle = C.cyan; ctx.fillText(answer.slice(0, Math.floor(p * answer.length * 1.8)), 410, 495);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(390, 525); ctx.bezierCurveTo(690, 550, 1190, 510, 1480, 540); ctx.stroke();
  }
  ctx.restore();
}
const PROOF = ['∂u/∂t + (u · ∇)u = −∇p + ν∇²u', '∇ · u = 0', 'u(x, 0) = u₀(x)', '∫ |u|² dx + 2ν ∫ |∇u|² dx dt', '⟨u, ∇p⟩ = 0', '∂ₜω + (u · ∇)ω = (ω · ∇)u + νΔω'];
function workspace(ctx, t, takeover) {
  const p = phase(t, E.proofStart, E.firstHookStart); ctx.save();
  ctx.translate(780 - takeover * 180, 370 - takeover * 70); ctx.rotate(-0.025 + takeover * 0.045);
  ctx.fillStyle = '#111f23'; ctx.globalAlpha *= 0.9; ctx.fillRect(-270, -170, 1140, 480);
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-270, -170); ctx.lineTo(870, -170); ctx.stroke();
  ctx.font = '31px "Space Mono", monospace'; const opacity = ctx.globalAlpha;
  for (let line = 0; line < PROOF.length; line++) {
    const progress = clamp(p * 8 - line); ctx.fillStyle = line % 2 ? C.cyan : C.fg;
    ctx.globalAlpha = opacity * (0.35 + progress * 0.53) * (1 - takeover * 0.42);
    ctx.fillText(PROOF[line].slice(0, Math.ceil(PROOF[line].length * progress)), -220 + line % 2 * 36, -95 + line * 62);
  }
  ctx.restore();
  if (t >= E.preChorusStart && t < E.strawberryStart) {
    ctx.save(); ctx.globalAlpha *= 0.25 + phase(t, E.preChorusStart, E.chorusStart) * 0.5;
    for (let sheet = 0; sheet < 3; sheet++) {
      ctx.strokeStyle = sheet === 2 ? C.cyan : C.muted; ctx.lineWidth = 1;
      const x = 1140 + sheet * 145, y = 160 + sheet * 100;
      for (let row = 0; row < 8; row++) {
        ctx.beginPath(); ctx.moveTo(x, y + row * 32); ctx.lineTo(x + 190 - row % 3 * 22, y + row * 32); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
// Analytic streamline illustration, with no numerical fluid or proof claim.
function flow(ctx, t, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = C.cyan;
  const envelope = assets.envelope, index = envelope ? clamp(t * envelope.rate, 0, envelope.rms.length - 1) : 0;
  const pulse = envelope ? mix(envelope.rms[Math.floor(index)], envelope.rms[Math.ceil(index)], index % 1) / 99 : 0;
  const inherited = ctx.globalAlpha;
  for (let line = 0; line < 62; line++) {
    const base = 220 + line * 9.5; ctx.globalAlpha = inherited * alpha * (0.07 + hash(line + 41) * 0.24); ctx.lineWidth = line % 7 ? 0.7 : 1.6;
    ctx.beginPath();
    for (let step = 0; step < 105; step++) {
      const x = 220 + step * 16, distance = x - 1290;
      const deflection = Math.exp(-distance * distance / 100000) * (base < 580 ? -1 : 1) * (150 - Math.abs(base - 580) * 0.25);
      const y = base + deflection + Math.sin(x * 0.012 - t * 0.43 + base * 0.018) * (8 + pulse * 4);
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function hook(ctx, t, active) {
  const text = active?.text ?? 'Intelligences';
  const kind = /alien/iu.test(text) ? 'alien' : /gences/iu.test(text) ? 'signal' : 'jagged';
  ctx.save(); ctx.fillStyle = '#091014'; ctx.globalAlpha = 0.82; ctx.fillRect(120, 230, 1680, 480);
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = `${kind === 'signal' ? 115 : 155}px "Space Mono", monospace`;
  const word = kind === 'alien' ? 'ALIEN' : kind === 'signal' ? 'INTELLIGENCES' : 'JAGGED';
  if (kind === 'jagged') {
    // Fracture local typography; never flash the whole field.
    for (let band = 0; band < 9; band++) {
      ctx.save(); ctx.beginPath(); ctx.rect(170, 330 + band * 28, 1580, 27); ctx.clip();
      ctx.fillStyle = band % 3 ? C.fg : C.cyan; ctx.fillText(word, 960 + Math.sin(band * 6.4 + t * 5) * 18, 560); ctx.restore();
    }
  } else if (kind === 'alien') {
    for (let layer = 4; layer >= 0; layer--) {
      ctx.globalAlpha = layer ? 0.12 + (4 - layer) * 0.04 : 1; ctx.fillStyle = layer % 2 ? C.cyan : C.fg;
      ctx.fillText(word, 960 + Math.sin(t * 1.9 + layer) * layer * 22, 545 + layer * 16);
    }
  } else {
    ctx.fillStyle = C.cyan; ctx.fillText(word, 960, 535); ctx.strokeStyle = C.fg; ctx.lineWidth = 2;
    for (let i = 0; i < 54; i++) { const x = 255 + i * 27; ctx.beginPath(); ctx.moveTo(x, 620); ctx.lineTo(x, 620 - (i % 3 + 1) * 10); ctx.stroke(); }
  }
  ctx.restore();
}
function hesitation(ctx, t) {
  const loop = (t - HESITATION.start) % ((HESITATION.end - HESITATION.start) / 2);
  const fragment = 'Ich denke weiter'.slice(0, Math.min(Math.floor(clamp(loop / 1.7) * 15), 9));
  ctx.save(); ctx.fillStyle = '#091014'; ctx.fillRect(520, 250, 1180, 430); ctx.font = '57px "Space Mono", monospace';
  // Both rows copy the exact same irregular stop and trace.
  for (let row = 0; row < 2; row++) {
    const y = 390 + row * 170; ctx.fillStyle = row ? C.cyan : C.amber; ctx.fillText(fragment, 620, y);
    ctx.fillRect(620 + ctx.measureText(fragment).width + 12, y - 48, 4, 57); ctx.strokeStyle = row ? C.cyan : C.amber; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 46; i++) {
      const x = 620 + i * 17, py = y + 42 + Math.sin(i * 1.7) * 3 + (i > 18 && i < 30 ? 0 : Math.sin(i * 0.42) * 9);
      if (!i) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function fruit(ctx, x, y, height, t) {
  const crushing = t >= E.crush, rupture = crushing ? phase(t, E.crush, E.crush + 0.65) : 0;
  const pressure = t >= E.domination && !crushing ? phase(t, E.domination, E.elimination) : 0;
  ctx.save(); const image = crushing ? assets.crushed : assets.fruit;
  const sourceWidth = image.naturalWidth ?? image.width, sourceHeight = image.naturalHeight ?? image.height;
  const width = height * sourceWidth / sourceHeight;
  // The intact fruit withstands pressure until the editorial elimination cue.
  const visibleHeight = crushing ? height * 0.75 : height * (1 - pressure * 0.06);
  ctx.drawImage(image, x - width / 2, y - visibleHeight / 2, width, visibleHeight);
  if (pressure) {
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.globalAlpha = pressure * 0.8;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + side * (width / 2 + 32 - pressure * 20), y - 120);
      ctx.quadraticCurveTo(x + side * (width / 2 - 10), y, x + side * (width / 2 + 32 - pressure * 20), y + 120); ctx.stroke();
    }
  }
  if (rupture > 0) {
    // Organic texture fragments settle close to the fruit, never as confetti.
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? -1 : 1, travel = rupture * (25 + hash(i + 28) * 90);
      ctx.save(); ctx.translate(x + side * (30 + travel), y + 95 + rupture * hash(i + 9) * 65); ctx.rotate(side * rupture * hash(i + 8));
      ctx.drawImage(image, sourceWidth * (0.35 + hash(i + 5) * 0.3), sourceHeight * 0.55, sourceWidth * 0.035, sourceHeight * 0.035,
        -6, -5, 12 + hash(i + 7) * 14, 11 + hash(i + 4) * 9); ctx.restore();
    }
  }
  ctx.restore();
}
function strawberryWord(ctx, t, quiet) {
  const large = t < E.verse2Start || quiet, size = large ? 127 : 70, y = large ? 255 : 230;
  ctx.save(); ctx.font = `${size}px "Space Mono", monospace`; const cell = ctx.measureText('m').width, x = 960 - cell * 5;
  ctx.fillStyle = '#071013'; ctx.globalAlpha = 0.8; ctx.fillRect(x - 35, y - size - 60, cell * 10 + 70, size + 105); ctx.globalAlpha = 1;
  for (let i = 0; i < 10; i++) { ctx.fillStyle = C.fg; ctx.fillText('strawberry'[i], x + i * cell, y); }
  for (const [index, label] of [[2, '1'], [7, '2']]) {
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.strokeRect(x + index * cell - 2, y - size * 0.85, cell + 4, size);
    ctx.fillStyle = C.cyan; ctx.font = '30px "Space Mono", monospace'; ctx.fillText(label, x + index * cell + cell * 0.3, y - size - 10);
  }
  if (t >= E.thirdR) {
    const reveal = phase(t, E.thirdR, E.thirdR + 0.36), cx = x + cell * 8.5, cy = y - size * 0.38;
    ctx.strokeStyle = C.amber; ctx.lineWidth = large ? 5 : 3; ctx.beginPath();
    for (let i = 0; i <= Math.floor(120 * reveal); i++) {
      const a = i / 120 * TAU, jitter = Math.sin(a * 5) * 2 + Math.cos(a * 9);
      const px = cx + Math.cos(a) * (cell * 0.74 + jitter), py = cy + Math.sin(a) * (size * 0.68 + jitter);
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.fillStyle = C.amber; ctx.font = `${large ? 49 : 32}px "Space Mono", monospace`; ctx.fillText('3', cx + cell * 0.65, y - size - 5);
  }
  ctx.restore();
}
function controlledHumans(ctx, t, domination) {
  const capture = phase(t, E.finalChorus, E.humanThree); ctx.save();
  const inherited = ctx.globalAlpha, commonX = Math.sin(t * 0.35) * (24 + domination * 40), commonY = Math.cos(t * 0.35) * 15;
  // The collective visibly imposes a common displacement and orientation.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++) {
    const id = row * 10 + col, x = 440 + col * 130 + commonX + (hash(id + 81) - 0.5) * 100 * (1 - capture);
    const y = 310 + row * 115 + commonY + (hash(id + 17) - 0.5) * 70 * (1 - capture);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1; ctx.globalAlpha = inherited * (0.36 + domination * 0.3);
    ctx.beginPath(); ctx.moveTo(x - 36, y - 35); ctx.lineTo(x + 36, y - 35); ctx.lineTo(x + 36, y + 28); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(capture * Math.sin(t * 0.35) * 0.23); humanSymbol(ctx, 0, 0, 10, 0.85); ctx.restore();
  }
  ctx.restore();
}
function imitation(ctx, t, human) {
  const p = phase(t, E.imitation, E.finalChorus); ctx.save(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
  for (let copy = 0; copy < 3; copy++) {
    ctx.globalAlpha = (0.6 - copy * 0.14) * p; const x = human.x + 380 + copy * 200, y = human.y - 20 - copy * 90;
    for (let line = 0; line < 4; line++) {
      ctx.beginPath();
      for (let i = 0; i < 19; i++) {
        const py = y + 47 + line * 17 + Math.sin(i * 1.9 + line * 2) * 2.4;
        if (!i) ctx.moveTo(x - 92, py); else ctx.lineTo(x - 92 + i * 8, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function aftermath(ctx, t) {
  const p = phase(t, E.thanks, E.finaleEnd); ctx.save(); ctx.globalAlpha = 0.78 + p * 0.16;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1920, 890); ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = C.amber;
  ctx.font = '110px "Space Mono", monospace'; ctx.fillText('r', 960, 515); ctx.strokeStyle = C.amber; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.ellipse(960, 478, 63, 88, -0.07, 0, TAU); ctx.stroke(); ctx.restore();
}
function wrapped(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(' '); let best = 1, difference = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = ctx.measureText(words.slice(0, i).join(' ')).width, right = ctx.measureText(words.slice(i).join(' ')).width;
    if (Math.max(left, right) <= maxWidth && Math.abs(left - right) < difference) { best = i; difference = Math.abs(left - right); }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}
function caption(ctx, line) {
  ctx.save(); ctx.fillStyle = '#080d12'; ctx.globalAlpha = 0.93; ctx.fillRect(0, 890, 1920, 190);
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = C.fg; ctx.font = '57px "Redaction", Georgia, serif';
  const rows = wrapped(ctx, line.text, 1670); rows.forEach((row, index) => ctx.fillText(row, 960, rows.length === 1 ? 997 : 960 + index * 68)); ctx.restore();
}
function centralCaption(ctx, text, t, start) {
  ctx.save(); ctx.fillStyle = '#080d12'; ctx.globalAlpha = 0.9; ctx.fillRect(60, 270, 1800, 420);
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = C.amber;
  let size = 104; ctx.font = `${size}px "Redaction", Georgia, serif`; let rows = wrapped(ctx, text, 1630);
  while (rows.some(row => ctx.measureText(row).width > 1630) && size > 68) { size -= 2; ctx.font = `${size}px "Redaction", Georgia, serif`; rows = wrapped(ctx, text, 1630); }
  const movement = 3 * Math.sin((t - start) * 15) * Math.exp(-(t - start) * 2);
  rows.forEach((row, i) => ctx.fillText(row, 960 + movement, rows.length === 1 ? 525 : 455 + i * 126)); ctx.restore();
}
