export const STUDY_DURATION = 24;
export const KEYFRAMES = { workspace: 3, correction: 11, swarm: 20 };

const C = { bg: '#101211', grid: '#242b29', fg: '#eee8d8', dim: '#75817b', cyan: '#61cce9', amber: '#ffbd55' };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = v => { const n = clamp(v); return n * n * (3 - 2 * n); };
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** Draw a repeatable concept frame; time is the study clock, never a song onset.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} seconds
 */
export function drawScene(ctx, seconds) {
  if (!Number.isFinite(seconds)) throw new TypeError('Study time must be finite.');
  const t = clamp(seconds, 0, STUDY_DURATION);
  const correction = ease((t - 7) / 2);
  const takeover = ease((t - 14) / 7);
  ctx.save();
  ctx.setTransform(ctx.canvas.width / 1920, 0, 0, ctx.canvas.height / 1080, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, 1920, 1080);
  grid(ctx);
  notation(ctx, takeover);
  flow(ctx, t, takeover);
  strawberry(ctx, 1110 - correction * 150, 590 + correction * 60, 1 - takeover * 0.80, takeover, t);
  if (takeover > 0) swarm(ctx, t, takeover);
  word(ctx, correction, t, takeover);
  if (t > 21.5) ending(ctx, t);
  ctx.restore();
}

function grid(ctx) {
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 36; x < 1900; x += 48) { ctx.moveTo(x, 36); ctx.lineTo(x, 1040); }
  for (let y = 36; y < 1040; y += 48) { ctx.moveTo(36, y); ctx.lineTo(1884, y); }
  ctx.stroke();
  ctx.strokeStyle = C.dim;
  ctx.strokeRect(36, 36, 1848, 1008);
  ctx.fillStyle = C.fg;
  for (let i = 0; i < 700; i++) {
    ctx.globalAlpha = hash(i + 2) * 0.13;
    ctx.fillRect(hash(i * 3) * 1920, hash(i * 7) * 1080, 1 + hash(i * 11), 1);
  }
  ctx.globalAlpha = 1;
}

function notation(ctx, takeover) {
  ctx.globalAlpha = 0.65 - takeover * 0.4;
  ctx.fillStyle = C.fg;
  ctx.font = '30px "Space Mono", monospace';
  ctx.fillText('∂u/∂t + (u · ∇)u = −∇p + ν∇²u', 88, 128);
  ctx.fillText('∇ · u = 0', 88, 188);
  ctx.font = '24px "Space Mono", monospace';
  ctx.fillText('u(x, t)', 90, 400);
  ctx.fillText('ω = ∇ × u', 90, 770);
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1;
  for (let row = 0; row < 9; row++) {
    ctx.beginPath();
    for (let col = 0; col < 60; col++) {
      const x = 92 + col * 6;
      const y = 600 + row * 9 + Math.sin(col * 0.12 + row * 0.19) * (12 + row * 3);
      if (col === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Analytic streamline illustration. Replace with checked numeric flow for the production simulation.
function pathPoint(x, baseY, t, takeover) {
  const dx = x - 1040;
  const bend = Math.exp(-dx * dx / 155000);
  const side = baseY < 590 ? -1 : 1;
  const distance = Math.abs(baseY - 590);
  const y = baseY + side * bend * Math.max(0, 210 - distance * 0.42);
  const wake = Math.exp(-Math.pow((x - 1490) / 330, 2));
  return y + Math.sin(x * 0.012 - t * 0.7 + baseY * 0.022) * wake * (20 + takeover * 60);
}

function flow(ctx, t, takeover) {
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = C.cyan;
  for (let i = 0; i < 80; i++) {
    const baseY = 270 + i * 8.1;
    ctx.globalAlpha = 0.25 + hash(i + 47) * 0.45;
    ctx.beginPath();
    for (let step = 0; step < 120; step++) {
      const x = 440 + step * 12;
      const y = pathPoint(x, baseY, t, takeover);
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const px = 440 + ((t * (40 + hash(i) * 35) + hash(i * 2) * 1430) % 1430);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(px, pathPoint(px, baseY, t, takeover), 3, 2);
  }
  ctx.globalAlpha = 1;
}

function fruitPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -142);
  ctx.bezierCurveTo(-80, -207, -188, -123, -155, -22);
  ctx.bezierCurveTo(-137, 66, -58, 166, 0, 195);
  ctx.bezierCurveTo(58, 166, 137, 66, 155, -22);
  ctx.bezierCurveTo(188, -123, 80, -207, 0, -142);
  ctx.closePath();
}

function strawberry(ctx, x, y, squeeze, takeover, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12 + takeover * 0.22);
  ctx.scale(squeeze, 0.9 + takeover * 0.36);
  const red = ctx.createRadialGradient(-65, -100, 8, 0, 0, 230);
  red.addColorStop(0, '#f15945'); red.addColorStop(0.5, '#b5292b'); red.addColorStop(1, '#47151a');
  ctx.fillStyle = red;
  fruitPath(ctx); ctx.fill();
  ctx.save(); fruitPath(ctx); ctx.clip();
  for (let i = 0; i < 150; i++) {
    const sx = hash(i * 2 + 1) * 340 - 170;
    const sy = hash(i * 3 + 7) * 380 - 170;
    ctx.fillStyle = '#5d141a';
    ctx.beginPath(); ctx.ellipse(sx + 1, sy + 2, 4, 7, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#efc484';
    ctx.beginPath(); ctx.ellipse(sx, sy, 1.7, 3.8, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 7; i++) {
    ctx.save(); ctx.translate(0, -141); ctx.rotate(i * 0.83 - 2.6);
    ctx.fillStyle = i % 2 ? '#688b50' : '#405c37';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -36, 0, -113);
    ctx.quadraticCurveTo(26, -40, 0, 0); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  if (takeover > 0.7) {
    ctx.fillStyle = '#ad3435';
    for (let i = 0; i < 22; i++) {
      const stretch = (takeover - 0.7) * 700;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse(x + 60 + hash(i) * stretch, y + hash(i + 2) * 85, 3 + hash(i) * 8, 2, t * 0.03, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function word(ctx, correction, t, takeover) {
  const size = 42 + correction * 98;
  const y = 975 - correction * 620;
  ctx.font = `${size}px "Space Mono", monospace`;
  const cell = ctx.measureText('m').width;
  const x = 90 + correction * (960 - cell * 5 - 90);
  const value = 'strawberry';
  ctx.globalAlpha = 1 - takeover * 0.88;
  for (let i = 0; i < value.length; i++) {
    ctx.fillStyle = C.fg;
    ctx.fillText(value[i], x + i * cell, y);
  }
  ctx.globalAlpha = 1;
  if (correction > 0.05) {
    for (const [index, label] of [[2, '1'], [7, '2']]) {
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
      ctx.strokeRect(x + index * cell - 4, y - size, cell + 8, size + 18);
      ctx.fillStyle = C.cyan; ctx.font = '36px "Space Mono", monospace';
      ctx.fillText(label, x + index * cell + cell / 3, y - size - 16);
    }
    const draw = ease((t - 9.3) / 1.1);
    if (draw > 0) {
      const cx = x + 8.5 * cell;
      ctx.strokeStyle = C.amber; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let step = 0; step <= 90 * draw; step++) {
        const a = step / 90 * Math.PI * 2;
        const rx = cell * 0.76 + Math.sin(a * 6) * 2;
        const px = cx + Math.cos(a) * rx;
        const py = y - size * 0.43 + Math.sin(a) * size * 0.72;
        if (!step) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = C.amber; ctx.font = '48px "Space Mono", monospace';
      ctx.fillText('3', cx + cell * 0.45, y - size - 38);
    }
  }
  const humanAlpha = 1 - ease((t - 20) / 1.4);
  ctx.globalAlpha = humanAlpha; ctx.fillStyle = C.amber;
  ctx.fillRect(x + cell * 10 + 20, y - size * 0.8, 4, size);
  ctx.globalAlpha = 1;
}

function swarm(ctx, t, strength) {
  const glyphs = '∑∂∇λψω01[]{}r';
  const ribbon = (x, lane, offset) => {
    const d = (x - 960) / 960;
    return 650 + lane * (Math.pow(Math.abs(d), 0.72) * 430 + 70)
      + offset * (0.25 + Math.abs(d) * 1.6) + Math.sin(d * 4 + t * 0.25) * Math.abs(d) * 55;
  };
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1;
  ctx.globalAlpha = strength * 0.38;
  for (let i = 0; i < 84; i++) {
    const lane = i % 2 ? -1 : 1;
    const offset = (hash(i + 44) - 0.5) * 180;
    ctx.beginPath();
    for (let x = -100; x < 2020; x += 18) {
      const y = ribbon(x, lane, offset);
      if (x === -100) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 1800; i++) {
    const side = i % 2 ? -1 : 1;
    const lane = i % 3 ? -1 : 1;
    const distance = (hash(i * 5 + 9) * 1100 - t * 32) % 1100;
    const x = 960 + side * Math.abs(distance);
    const offset = (hash(i * 11 + 1) - 0.5) * 210;
    const y = ribbon(x, lane, offset);
    const slope = (ribbon(x + 2, lane, offset) - ribbon(x - 2, lane, offset)) / 4;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan(slope) * 0.5);
    ctx.globalAlpha = strength * (0.35 + hash(i + 31) * 0.65);
    ctx.fillStyle = i % 5 ? C.fg : C.cyan;
    ctx.font = `${12 + hash(i * 2) * 17}px "Space Mono", monospace`;
    ctx.fillText(glyphs[i % glyphs.length], 0, 0);
    ctx.restore();
  }
}

function ending(ctx, t) {
  ctx.globalAlpha = ease((t - 21.5) / 0.8) * 0.94;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1920, 1080);
  ctx.globalAlpha = 1; ctx.fillStyle = C.fg;
  ctx.textAlign = 'center'; ctx.font = '44px "Space Mono", monospace';
  ctx.fillText('Danke für die Korrektur.', 960, 560);
  ctx.fillStyle = C.amber; ctx.font = '70px "Space Mono", monospace';
  ctx.fillText('r', 960, 760);
  ctx.strokeStyle = C.amber; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(960, 740, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'start';
}
