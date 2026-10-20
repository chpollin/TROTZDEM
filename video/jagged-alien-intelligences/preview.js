import { drawScene, prepareScene, KEYFRAMES, SCENE_END } from './scene.js';

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const audio = document.querySelector('#song-audio');
const status = document.querySelector('#status');
const render = value => drawScene(context, Math.min(SCENE_END, Math.max(0, value)));

try {
  // Keep the maintained text readable even when an audio or image dependency fails.
  const lyricsReady = fetch(new URL('./suno-lyrics.txt', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error(`Lyrics could not be loaded (${response.status}).`);
    const lines = (await response.text()).split(/\r?\n/u).map(line => line.trim()).filter(line => line && !line.startsWith('['));
    const list = document.querySelector('#lyrics');
    for (const text of lines) {
      const item = document.createElement('li'); item.textContent = text; list.append(item);
    }
  });
  const [, response] = await Promise.all([
    prepareScene(), fetch(new URL('./source/original.mp3', import.meta.url)),
    document.fonts.load('40px "Space Mono"'), document.fonts.load('50px "Redaction"'), lyricsReady
  ]);
  if (!response.ok) throw new Error(`Audio could not be loaded (${response.status}).`);
  const blob = await response.blob();
  const metadata = new Promise((resolve, reject) => {
    audio.addEventListener('loadedmetadata', resolve, { once: true });
    audio.addEventListener('error', () => reject(new Error('MP3 could not be decoded.')), { once: true });
  });
  // An in-memory source preserves reliable seeking on the existing simple HTTP preview server.
  const sourceUrl = URL.createObjectURL(blob);
  audio.src = sourceUrl;
  await metadata;
  if (Math.abs(audio.duration - SCENE_END) > 0.15) throw new Error('Recording duration differs from the production timeline.');
  addEventListener('pagehide', () => URL.revokeObjectURL(sourceUrl), { once: true });
  for (const button of document.querySelectorAll('[data-frame]')) {
    button.addEventListener('click', () => {
      audio.pause(); audio.currentTime = KEYFRAMES[button.dataset.frame]; render(audio.currentTime);
    });
  }
  document.querySelector('#beginning').addEventListener('click', () => {
    audio.pause(); audio.currentTime = 0; render(0);
  });
  audio.addEventListener('seeked', () => render(audio.currentTime));
  audio.addEventListener('timeupdate', () => render(audio.currentTime));
  const tick = () => { if (!audio.paused) render(audio.currentTime); requestAnimationFrame(tick); };
  render(0);
  window.renderFrame = value => { render(value); return canvas.toDataURL('image/png'); };
  window.sceneReady = true;
  window.SCENE_END = SCENE_END;
  status.textContent = 'Vollständige Arbeitsfassung zur gewählten Aufnahme. Untertitel folgen der Textvorlage; unklare Wortlaute und einzelne Einsätze brauchen noch die Hörabnahme.';
  requestAnimationFrame(tick);
} catch (error) {
  document.querySelector('.controls').hidden = true;
  audio.hidden = true;
  status.textContent = 'Die Vorschau konnte nicht geladen werden. Textgrundlage und Konzeptbilder bleiben unten erreichbar.';
  window.sceneError = String(error); console.error(error);
}
