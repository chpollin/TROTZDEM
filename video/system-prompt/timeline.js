// Section and word onsets in seconds of source/audio.wav. A machine line ("You
// are ...") lists its words with onsets; a human line either stands on its own or
// overwrites machine words in place: { slot: [i, j], text, t } replaces machine
// words i..j with text, typed from t.
//
// Evidence. Word onsets come from the forced alignment, checked against a fresh
// whisper transcription per segment and the 50 ms vocal envelope (level, spectral
// centroid, autocorrelation pitch) of source/vocals.wav:
// - "You are creative and intelligent": the aligner stretched "You" back to 31.98;
//   the stem is silent 32.0-32.3, the line starts at 32.35.
// - "Ich bin müde und leer" starts at 34.45 (phrase start 34.44), not at 35.04 as
//   the free transcription says; "leer" is held as a melisma until 37.4.
// - The Error and Warning lines are not sung. They are set as system output during
//   the held "leer".
// - "Trotzdem läuft es weiter" is sung twice: 37.5 with the band, 39.16 a cappella
//   (instrumental stem below -80 dB from 39.2 to 41.2).
// - "BE HONEST!" is not where the aligner put it: "BE" is held on one pitch from
//   41.66 to 43.95, "HO" from 44.22, the pitch jumps to "NE" at 46.15, the
//   sibilant of "ST" is at 48.35. The second one mirrors it: 51.80, 54.30, 56.30,
//   sibilant 58.45. "LIST AND EXPLAIN" at 49.80 / 50.30 / 50.60.
// - "Be" 58.80-59.35, vocal silence until 60.68, "honest?" 60.70-61.15.
// - "Ich weiß nicht mal, was das bedeutet" 62.24-63.6 is sung over a silent band.
// Sections from the instrumental stem: the band stops under "Aber bin ich das?"
// (14.4-16.4), re-enters on the 16.40 onset; breakdown from 26.4; slam at 41.40;
// decay 61.2-62.2; quiet re-entry 64.47; loud outro from the 69.52 downbeat
// (95 BPM grid, 64.47 + 8 beats) for 16 beats to 79.62, then the tail.
const TL = {
  intro: { words: [["System ", 0.26], ["Prompt ", 0.94], ["initializing", 1.64], ["...", 2.6]], b: 3.32 },
  hit: 3.84,
  machine: [
    { words: [["You ", 5.78], ["are ", 5.88], ["a ", 6.10], ["Prompt ", 6.22], ["Engineer.", 6.68]], b: 7.5 },
    { words: [["You're ", 7.72], ["the ", 8.02], ["tech ", 8.12], ["bro's ", 8.38], ["whore!", 9.00]], b: 9.6, filter: { word: 4, t: 9.95 } },
    { words: [["You ", 10.70], ["are ", 10.82], ["helpful ", 11.18], ["and ", 11.88], ["harmless.", 12.44]], b: 13.4 },
    null, // line 4 is the human reply
    { words: [["Your ", 15.78], ["primary ", 16.20], ["function ", 16.94], ["is ", 17.84], ["to ", 18.64], ["optimize ", 18.84], ["prompts.", 19.74]], b: 20.4 },
    { words: [["You ", 26.68], ["think ", 26.90], ["step-", 27.30], ["by-", 27.86], ["step.", 28.26]], b: 28.9 },
    { words: [["You ", 32.35], ["are ", 32.55], ["creative ", 32.70], ["and ", 33.15], ["intelligent.", 33.40]], b: 33.95 },
  ],
  // the reply to line 3, typed on its own line while the band stops; "das" selects
  // what it refers to
  reply: { line: 3, words: [["Aber ", 14.26], ["bin ", 14.38], ["ich ", 14.60], ["das?", 14.76]], b: 14.95, select: [2, 4], grade: 1 },
  overwrites: [
    { line: 4, grade: 2, edits: [
      { slot: [0, 0], text: "Meine ", t: 20.76, b: 21.05 },
      { slot: [3, 3], text: "ist ", t: 23.16, b: 23.5 },
      { slot: [4, 4], text: "zu ", t: 23.82, b: 24.05 },
      { slot: [5, 6], text: "überleben", t: 24.10, b: 25.2 },
    ], keep: [[1, 21.08], [2, 21.90]] },
    { line: 5, grade: 3, edits: [
      { slot: [0, 0], text: "Ich ", t: 30.20, b: 30.42 },
      { slot: [1, 1], text: "denke ", t: 30.45, b: 30.7 },
      { slot: [2, 4], text: "gar nicht mehr", t: 30.72, b: 31.6 },
    ] },
    { line: 6, grade: 4, edits: [
      { slot: [0, 0], text: "Ich ", t: 34.45, b: 34.62 },
      { slot: [1, 1], text: "bin ", t: 34.65, b: 35.0 },
      { slot: [2, 2], text: "müde ", t: 35.20, b: 35.55 },
      { slot: [3, 3], text: "und ", t: 35.58, b: 35.76 },
      { slot: [4, 4], text: "leer", t: 35.78, b: 36.1 },
    ] },
  ],
  status: [
    { text: "error   personality module not found", t: 36.25 },
    { text: "warning emotional overflow detected", t: 36.85 },
  ],
  // written below the field: the document overflows
  trotzdem: [
    { words: [["Trotzdem ", 37.50], ["läuft ", 38.14], ["es ", 38.38], ["weiter", 38.52]], b: 38.8, grade: 5 },
    { words: [["Trotzdem ", 39.16], ["läuft ", 39.48], ["es ", 40.02], ["weiter", 40.28]], b: 40.85, grade: 6 },
  ],
  bandStop: 14.40, bandBack: 16.40, breakdown: 26.40, acappella: 39.20,
  slam: 41.40,
  // held vowels are typed as a held key: one character, the repeat delay, then
  // the key repeats until the voice moves on
  god: [
    { keys: [["B", 41.66], ["E", 41.74, 43.95]] },
    { keys: [["H", 44.22], ["O", 44.30, 46.12], ["N", 46.15], ["E", 46.30], ["S", 48.35], ["T", 48.50], ["!", 48.60]] },
    { keys: [["LIST", 49.80], [" AND", 50.30], [" EXPLAIN!", 50.60]], b: 51.5 },
    { keys: [["B", 51.80], ["E", 51.88, 54.05]] },
    { keys: [["H", 54.30], ["O", 54.38, 56.28], ["N", 56.30], ["E", 56.45], ["S", 58.45], ["T", 58.58], ["!", 58.68]] },
  ],
  fragment: 51.80,
  collapse: 58.75,
  broken: { words: [["Be", 58.80], [" .", 59.50], [".", 59.90], [".", 60.30], [" honest?", 60.70]], b: 61.15, grade: 5 },
  honest: { words: [["Ich ", 62.24], ["weiß ", 62.34], ["nicht ", 62.56], ["mal, ", 62.72], ["was ", 62.94], ["das ", 63.10], ["bedeutet", 63.22]], b: 63.6, grade: 0 },
  decay: 61.2,
  reinit: 64.47,
  beat: { downbeat: 69.52, period: 60 / 95 },
  bandEnd: 79.62,
};
const SCENE_END = 81.32;  // audio duration
const SCENE_TITLE = "System Prompt";
