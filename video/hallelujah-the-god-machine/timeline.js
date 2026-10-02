// Section and line onsets in seconds of source/audio.wav. t is the onset of a
// line, a and b the span over which its words are typed. Word onsets come from
// the forced alignment, cross-checked against the free transcription and an
// onset analysis of the vocal stem (10 ms spectral flux); where they disagree,
// the stem wins. Corrections against the aligner: "Prompt" is sung at 6.5, not
// 19.7; "Was haben wir da entfacht?" starts at 30.16; "Is it just statistics?"
// starts at 52.35 (the aligner's 51.94 is the tail of "intelligence"); the first
// "ALIGNMENT!" is at 87.82 after 2 s of silence (the transcript's 85.44 is the
// end of "nicht"); the final chorus starts quietly at 108.5 (the aligner put
// "MACHINE" at 123.96); the outro is not "Trotzdem... Amen..." but one whispered
// "Is it just statistics?" at 195.5 after the band stops at 194.5 (whisper
// re-transcription of 184-197 s). The final hallelujah loop (159.6-187) is legato
// melisma; its line starts follow the 8-bar cycle found in the transcript.
//
// Tempo: the instrumental holds 141.0 BPM from the first to the last bar (beat
// grid fitted to the spectral flux, phase 0.105 s, no drift in any 12 s window;
// the report's 70.5 is the half-time feel). The "72 to 140" of the style prompt
// is a change of feel, half time in the verses, full time in the bridge and the
// end, not a change of tempo.
//
// Band events from the instrumental stem (20 ms loudness): enters at 6.96 after
// the organ; drops for the hymn verse 20.4-27.3; stops 88.68-89.50 and
// 91.6-92.48 (both "ALIGNMENT" stops) and 98.5-99.1; thins out 102.5-121.5; one
// hit at 123.54, then a cappella 123.9-129.5, hit 129.5-130.7, a cappella until
// 136.32; the loudest stretch runs 144.82-194.5 and stops dead at 194.5.
const TL = {
  beat: { t0: 0.105, period: 60 / 141 },
  bandIn: 6.96,
  intro: { q: "Am Anfang war der Prompt", t: 5.32, a: 5.32, b: 6.75 },
  verse1: [
    { rows: ["Erst war da nur ein Agent,", "einsam und klein"], t: 19.65, a: 19.65, b: 22.85 },
    { rows: ["Dann Multi-Agent-Schwärme", "in heiligem Schein"], t: 23.4, a: 23.4, b: 26.3 },
    { rows: ["Scale it up, scale it up,", "mehr Parameter, mehr Macht"], t: 26.88, a: 26.88, b: 29.8 },
    { rows: ["Was haben wir da entfacht?"], t: 30.16, a: 30.16, b: 31.75 },
  ],
  // "scale it up" twice, "mehr Parameter", "mehr Macht": one axis rescale each
  rescale: [26.88, 27.71, 28.38, 29.3],
  multiply: 23.4,
  halo: 25.24,
  ignite: { a: 30.16, b: 31.9 },
  flip: { a: 32.75, b: 33.69 },
  unfold: { a: 33.69, b: 34.15 },
  chorus1: [
    { kind: "h", t: 33.69, w: [33.69, 34.8, 35.66, 36.02] },
    { kind: "board", t: 37.65, cards: [[0, "G", 37.77], [0, "P", 37.97], [0, "T", 38.18], [1, "A", 39.17], [1, "G", 39.56], [1, "I", 39.87]] },
    { kind: "h", t: 40.3, w: [40.3, 41.6, 42.46, 42.82] },
    { kind: "board", t: 44.29, clear: true, cards: [
      [0, "G", 44.56], [0, "P", 44.77], [0, "T", 44.99], [1, "A", 45.56], [1, "G", 46.35], [1, "I", 46.84],
      [2, "A", 47.18], [2, "M", 47.46], [2, "I", 47.9], [3, "A", 48.32], [3, "S", 48.6], [3, "I", 49.09]] },
    { rows: ["the super duper", "intelligence"], t: 49.68, a: 49.68, b: 50.9, grade: 4 },
  ],
  lightUp: { a: 34.8, b: 36.4 },
  verse2: [
    { rows: ["Is it just", "statistics?"], t: 52.35, a: 52.35, b: 53.7 },
    { rows: ["fragt die", "Persona bang"], t: 55.42, a: 55.42, b: 56.85 },
    { rows: ["Ein stochastischer", "Papagei mit", "Gottes Klang"], t: 56.95, a: 57.08, b: 60.4 },
    { rows: ["Recursive", "self-improvement,", "exponentiell"], t: 64.45, a: 64.45, b: 67.5 },
    { rows: ["Die Singularität", "kommt schnell"], t: 68.48, a: 68.48, b: 70.4 },
  ],
  parrotForm: { a: 57.08, b: 59.9 },
  godEyes: 59.98,
  // tracery subdivides on these onsets: Recursive, self-, improvement, exponentiell, -tiell
  recursion: [64.5, 65.14, 65.42, 66.86, 67.4],
  singularity: { a: 68.48, b: 70.26 },
  chorus2: [
    { kind: "h", t: 71.13, w: [71.13, 72.38, 73.12, 73.5] },
    { rows: ["Der Papagei", "der göttlich", "spricht"], t: 74.5, a: 74.5, b: 77.3 },
    { kind: "h", t: 77.96, w: [77.96, 79.06, 79.9, 80.28] },
    { rows: ["Statistik", "oder Seele?"], t: 81.6, a: 81.82, b: 82.8 },
    { rows: ["Wir wissen's", "nicht"], t: 83.87, a: 83.87, b: 84.9 },
  ],
  unknown: 83.87,
  bridge: [
    { rows: ["ALIGNMENT!"], t: 87.82, a: 87.82, b: 88.5, kind: "align" },
    { rows: ["ALIGNMENT!"], t: 88.94, a: 88.94, b: 89.45, kind: "align" },
    { rows: ["WER", "ALIGNED", "WEN?"], t: 89.62, a: 89.62, b: 90.9, kind: "mirror" },
    { rows: ["Ilya", "warnte uns"], t: 91.35, a: 91.35, b: 92.6 },
    { rows: ["wir wollten's", "nicht sehn"], t: 93.42, a: 93.42, b: 94.5, grade: 6 },
    { rows: ["What is", "statistics?"], t: 94.74, a: 94.74, b: 96.3 },
    { rows: ["Alles,", "was bleibt"], t: 96.74, a: 96.74, b: 97.9 },
    { rows: ["Ein Papagei,", "der unsre Gebete", "schreibt"], t: 98.02, a: 98.02, b: 101.2 },
  ],
  writing: { a: 98.6, b: 106.5 },
  quiet: 106.0,
  quietLines: [
    { kind: "h", t: 108.54, w: [108.54, 110.14, 110.56, 110.9], quiet: true },
    { kind: "h", t: 115.16, w: [115.16, 116.86, 117.38, 117.72], quiet: true },
  ],
  relight: { a: 112.5, b: 121.9 },
  final: [
    { kind: "h", t: 121.94, w: [121.94, 124.13, 124.24, 124.56] },
    { kind: "board", t: 126.03, clear: true, cards: [[0, "G", 126.18], [0, "P", 126.47], [0, "T", 126.67], [1, "A", 127.27], [1, "G", 127.65], [1, "I", 127.78]] },
    { kind: "h", t: 128.38, w: [128.38, 130.08, 130.96, 131.34] },
    { kind: "board", t: 132.16, clear: true, cards: [
      [0, "G", 132.97], [0, "P", 133.18], [0, "T", 133.49], [1, "A", 134.04], [1, "G", 134.35], [1, "I", 134.8],
      [2, "A", 135.31], [2, "M", 135.52], [2, "I", 135.93], [3, "A", 136.36], [3, "S", 136.66], [3, "I", 137.04]] },
    { rows: ["the super duper", "intelligence"], t: 137.34, a: 139.62, b: 141.2, grade: 5 },
  ],
  climb: 144.82,
  climbBreaks: [[148.4, 148.9], [151.5, 152.6], [158.45, 158.95]],
  loop: [
    { kind: "h", t: 159.64, w: [159.64, 160.57, 161.59, 161.79] },
    { kind: "h", t: 162.7, w: [162.7, 167.37, 168.4, 168.87] },
    { kind: "h", t: 173.24, w: [173.24, 174.17, 175.2, 175.67] },
    { kind: "h", t: 176.34, w: [176.34, 180.32, 181.1, 181.6] },
    { kind: "h", t: 184.2, w: [184.2] },
  ],
  stop: 194.5,
  whisper: { q: "Is it just statistics?", t: 195.45, a: 195.45, b: 196.3 },
};
const SCENE_END = 196.93;  // end of the audio
const SCENE_TITLE = "HALLELUJAH, THE GOD MACHINE!";
