/** Derive the scene envelope from the existing measured analysis.js.
 * Run after ../tools/prepare_local.py; no audio is measured or invented here.
 */
import { readFile, writeFile, rename } from 'node:fs/promises';

const input = new URL('./analysis.js', import.meta.url);
const source = await readFile(input, 'utf8');
const rateMatch = source.match(/const AUDIO_RATE = ([\d.]+);/u);
const rmsMatch = source.match(/const AUDIO_RMS = (\[[^\]]*\]);/u);
if (!rateMatch || !rmsMatch) throw new Error('Missing measured AUDIO_RATE/AUDIO_RMS; run tools/prepare_local.py first.');
const rate = Number(rateMatch[1]);
const rms = JSON.parse(rmsMatch[1]);
if (!(rate > 0) || !Array.isArray(rms) || rms.length === 0 || !rms.every(value => Number.isFinite(value) && value >= 0 && value <= 99)) {
  throw new Error('Measured envelope has invalid rate or samples.');
}
const target = new URL('./audio-envelope.json', import.meta.url);
const part = new URL('./audio-envelope.json.part', import.meta.url);
await writeFile(part, JSON.stringify({ rate, rms }) + '\n');
await rename(part, target);
console.log('Scene envelope derived from measured analysis.js.');
