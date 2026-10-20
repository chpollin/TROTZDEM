const TAU = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const p = clamp(n); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const wrap = n => n - Math.floor(n);

// Shared analytic courses make schools turn together, without frame history.
// This stages collective agency; it is not a numerical flocking simulation.
function point(u, school, t, strength, target) {
  const side = school % 2 ? 1 : -1, lane = Math.floor(school / 2);
  const phase = u * TAU, turn = Math.sin(t * 0.19 + lane * 0.46) * 0.42;
  const close = ease((strength - 0.18) / 0.72);
  const angle = phase + lane * 0.48 + t * 0.095;
  const orbitX = target.humanX + Math.cos(angle) * (175 + lane * 47);
  const orbitY = target.humanY + Math.sin(angle) * (120 + lane * 34);
  const distance = mix(460, 175, close) + (1 + Math.cos(phase)) * (480 + lane * 44);
  const ribbonY = Math.sin(phase) * (140 + lane * 25);
  return {
    x: mix(orbitX, target.x + side * (Math.cos(turn) * distance - Math.sin(turn) * ribbonY), close),
    y: mix(orbitY, target.y + Math.sin(turn) * distance * side + Math.cos(turn) * ribbonY, close)
  };
}
function glyph(ctx, code, size) {
  ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(-size * 0.22, 0);
  if (code === 0) {
    ctx.lineTo(size * 0.15, -size * 0.6); ctx.lineTo(size * 0.6, 0); ctx.lineTo(size, 0);
  } else if (code === 1) {
    ctx.lineTo(-size * 0.22, -size * 0.42); ctx.lineTo(size * 0.4, -size * 0.42);
    ctx.lineTo(size * 0.4, size * 0.42); ctx.lineTo(size, size * 0.42);
  } else {
    ctx.moveTo(size, 0); ctx.lineTo(size * 0.15, 0);
    ctx.moveTo(0, -size * 0.5); ctx.lineTo(size * 0.5, 0); ctx.lineTo(0, size * 0.5);
  }
  ctx.stroke();
}
/** Artistic pressure fronts in the caller's 1920 x 1080 coordinates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t Absolute song time, or an explicit editorial freeze time.
 * @param {number} strength Intensity in 0..1.
 * @param {{x?:number,y?:number,humanX?:number,humanY?:number,width?:number,height?:number,foreground?:boolean}} options
 */
export function drawSwarm(ctx, t, strength, options = {}) {
  if (!Number.isFinite(t) || !Number.isFinite(strength)) throw new TypeError('Swarm time and strength must be finite.');
  const target = { x: 960, y: 500, humanX: 430, humanY: 550, ...options };
  for (const key of ['x', 'y', 'humanX', 'humanY']) {
    if (!Number.isFinite(target[key])) throw new TypeError('Swarm coordinates must be finite.');
  }
  const intensity = clamp(strength);
  if (!intensity) return;
  const foreground = target.foreground === true, opacity = ease(intensity / 0.15);
  ctx.save(); const inherited = ctx.globalAlpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  for (let school = foreground ? 8 : 0; school < (foreground ? 12 : 8); school++) {
    // Opaque cores occlude the work behind the luminous agents.
    ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = foreground ? 43 : 23;
    ctx.strokeStyle = '#0a1c21'; ctx.globalAlpha = inherited * opacity * (foreground ? 0.92 : 0.72);
    ctx.beginPath();
    for (let step = 0; step <= 88; step++) {
      const p = point(step / 88, school, t, intensity, target);
      if (!step) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke(); ctx.globalCompositeOperation = 'screen';
    for (let filament = 0; filament < 5; filament++) {
      ctx.lineWidth = filament === 2 ? 1.7 : 0.7; ctx.strokeStyle = '#79dce7';
      ctx.globalAlpha = inherited * opacity * (filament === 2 ? 0.30 : 0.12); ctx.beginPath();
      for (let step = 0; step <= 88; step++) {
        const p = point(step / 88, school, t, intensity, target);
        const offset = (filament - 2) * (foreground ? 9 : 5);
        if (!step) ctx.moveTo(p.x, p.y + offset); else ctx.lineTo(p.x, p.y + offset);
      }
      ctx.stroke();
    }
    const speed = 0.027 + hash(school + 71) * 0.008;
    for (let agent = 0; agent < 108; agent++) {
      const id = school * 108 + agent, u = wrap(hash(school + 31) + t * speed + agent * 0.0068);
      const p = point(u, school, t, intensity, target), q = point(u + 0.001, school, t, intensity, target);
      const angle = Math.atan2(q.y - p.y, q.x - p.x), depth = hash(id + 809);
      const spread = (hash(id + 491) - 0.5) * (foreground ? 53 : 32);
      ctx.save(); ctx.translate(p.x - Math.sin(angle) * spread, p.y + Math.cos(angle) * spread); ctx.rotate(angle);
      ctx.globalAlpha = inherited * opacity * (0.28 + depth * 0.67); ctx.strokeStyle = id % 11 ? '#7fd9e3' : '#eee8d8';
      ctx.lineWidth = foreground ? 1.8 : 1.1;
      glyph(ctx, id % 3, (foreground ? 8 : 4) + depth * (foreground ? 8 : 5)); ctx.restore();
    }
  }
  ctx.restore();
}
