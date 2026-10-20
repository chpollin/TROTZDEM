import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LINES, EVENTS, EVENT_BASIS, SECTIONS, SCENE_END, SCENE_TITLE,
  TIMELINE_STATUS, TIMING_UNCERTAINTIES, captionAt,
} from './timeline.js';

const sourceLines = readFileSync(new URL('./suno-lyrics.txt', import.meta.url), 'utf8')
  .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('['));
const srt = readFileSync(new URL('./lyrics.srt', import.meta.url), 'utf8');

function validInterval(item, label) {
  assert.ok(Number.isFinite(item.start) && Number.isFinite(item.end), label);
  assert.ok(item.start >= 0 && item.start < item.end && item.end <= SCENE_END, label);
}

test('full official take bounds sorted line, word and section intervals', () => {
  assert.equal(SCENE_END, 181.32);
  assert.equal(SCENE_TITLE, 'Jagged Alien Intelligences');
  let previousEnd = 0;
  for (const line of LINES) {
    validInterval(line, line.text);
    assert.ok(line.start >= previousEnd, line.text + ' overlaps preceding line');
    previousEnd = line.end;
    let previousWordEnd = line.start;
    for (const word of line.words) {
      validInterval(word, word.text);
      assert.ok(word.start >= previousWordEnd && word.end <= line.end, word.text);
      previousWordEnd = word.end;
    }
    assert.ok(line.basis.length > 0);
    if (line.coarseTiming) assert.deepEqual(line.words, []);
  }
  assert.equal(SECTIONS[0].start, 0);
  SECTIONS.forEach((section, i) => {
    validInterval(section, section.id);
    if (i) assert.equal(section.start, SECTIONS[i - 1].end);
  });
  assert.equal(SECTIONS.at(-1).end, SCENE_END);
  for (const value of Object.values(EVENTS)) assert.ok(value >= 0 && value <= SCENE_END);
});

test('author source coverage and order survive only the justified combined hooks', () => {
  assert.deepEqual(LINES.flatMap(line => line.sourceLines ?? [line.text]), sourceLines);
  const combined = LINES.filter(line => line.sourceLines);
  assert.equal(combined.length, 2);
  for (const line of combined) {
    assert.equal(line.sourceLines.length, 3);
    assert.equal(line.text, 'JAGGED ALIEN INTELLIGENCES');
    assert.equal(line.coarseTiming, true);
  }
  for (const line of LINES) {
    assert.doesNotMatch(line.text, /[\[\]]/);
    assert.doesNotMatch(line.text, /Intelligenz|Telegancer|Crushing|vocoder/i);
  }
  assert.equal(LINES.filter(line => line.text.includes('Strawberry')).length, 1);
  assert.ok(LINES.some(line => line.text === 'Danke für die Korrektur.'));
});

test('dramatic anchors follow the audio and preserve the correction sequence', () => {
  assert.equal(EVENTS.verseStart, 10.46);
  assert.equal(EVENTS.strawberryStart, 58.60);
  assert.ok(EVENTS.strawberryStart < EVENTS.correctionLineStart);
  assert.ok(EVENTS.correctionLineStart < EVENTS.correctionShout);
  assert.ok(EVENTS.correctionShout < EVENTS.thirdR);
  assert.equal(EVENTS.correctionShout, 67.10);
  assert.equal(EVENTS.thirdR, 68.90);
  assert.equal(EVENTS.swarmStart, 98.88);
  assert.equal(EVENTS.swarmSecond, 102.36);
  assert.equal(EVENTS.machineReply, 146.0);
  assert.ok(EVENTS.crush > EVENTS.domination);
  assert.equal(EVENTS.crush, EVENTS.elimination);
  assert.match(EVENT_BASIS.crush, /Editorial/);
  assert.match(EVENT_BASIS.crush, /not been independently measured/);
  assert.equal(EVENTS.finaleEnd, SCENE_END);
});

test('unresolved tokens and failed alignment never become fabricated precision', () => {
  assert.match(TIMELINE_STATUS, /working-version/);
  assert.ok(TIMING_UNCERTAINTIES.length > 0);
  assert.ok(TIMING_UNCERTAINTIES.some(item => item.text === 'dein' && /ein/.test(item.basis)));
  assert.equal(TIMING_UNCERTAINTIES.filter(item => item.text === 'im').length, 2);
  for (const line of LINES.filter(line => line.text === 'Ich such im Fehler den Beweis,')) {
    assert.ok(!line.words.some(word => word.text === 'im'));
  }
  assert.ok(!LINES.find(line => line.text === 'Du hast recht.').words.some(word => word.text === 'Du'));
  assert.deepEqual(LINES.find(line => line.start === EVENTS.swarmStart).words, []);
  assert.ok(!LINES.some(line => line.start === 95.24));
  assert.ok(TIMING_UNCERTAINTIES.some(item => item.text === 'Es' && item.candidates?.includes('das')));
});

test('caption lookup handles seeks, gaps, boundaries and the instrumental tail', () => {
  for (const line of LINES) {
    assert.equal(captionAt(line.start), line);
    assert.equal(captionAt((line.start + line.end) / 2), line);
    assert.notEqual(captionAt(line.end), line);
  }
  for (const time of [-1, 0, 96, 170, SCENE_END, NaN, Infinity]) assert.equal(captionAt(time), null);
});

test('SRT mirrors the same working caption text and millisecond boundaries', () => {
  const blocks = srt.trim().split(/\n\n/);
  assert.equal(blocks.length, LINES.length);
  const parse = value => {
    const [h, m, seconds] = value.replace(',', '.').split(':').map(Number);
    return Math.round((h * 3600 + m * 60 + seconds) * 1000);
  };
  blocks.forEach((block, i) => {
    const [number, timing, ...text] = block.split('\n');
    assert.equal(Number(number), i + 1);
    const [start, end] = timing.split(' --> ').map(parse);
    assert.equal(start, Math.round(LINES[i].start * 1000));
    assert.equal(end, Math.round(LINES[i].end * 1000));
    assert.equal(text.join('\n'), LINES[i].text);
  });
});
