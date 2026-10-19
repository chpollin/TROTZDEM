import { drawScene, KEYFRAMES, STUDY_DURATION } from './scene.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const slider = document.querySelector('#position');
const time = document.querySelector('#clock');
const toggle = document.querySelector('#toggle');
let current = 3;
let playing = false;
let previous = null;

function show(value) {
  current = Math.max(0, Math.min(STUDY_DURATION, value));
  drawScene(context, current);
  slider.value = current;
  time.value = `${current.toFixed(1)} / ${STUDY_DURATION} s`;
}
function setPlaying(value) {
  playing = value;
  toggle.textContent = value ? 'Pause' : 'Abspielen';
  toggle.setAttribute('aria-pressed', String(value));
  previous = null;
}
toggle.addEventListener('click', () => {
  if (current >= STUDY_DURATION) show(0);
  setPlaying(!playing);
});
slider.addEventListener('input', () => { setPlaying(false); show(Number(slider.value)); });
for (const button of document.querySelectorAll('[data-frame]')) {
  button.addEventListener('click', () => { setPlaying(false); show(KEYFRAMES[button.dataset.frame]); });
}
function tick(now) {
  if (playing) {
    const elapsed = previous === null ? 0 : (now - previous) / 1000;
    show(current + elapsed);
    if (current >= STUDY_DURATION) setPlaying(false);
  }
  previous = now;
  requestAnimationFrame(tick);
}
await document.fonts.load('40px "Space Mono"');
show(current);
window.renderFrame = value => { show(value); return canvas.toDataURL('image/png'); };
window.sceneReady = true;
requestAnimationFrame(tick);
