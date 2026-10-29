// Line onsets in seconds of source/audio.wav, the operator's Suno take
// (source/original.mp3, 170.68 s, converted to WAV). The scene reads only the
// names defined here.
//
// Evidence: forced alignment and free transcription in source/timing-report.md
// and the 0.2 s vocal loudness of vocals.wav in disputed windows. Where the
// aligner and the free transcription disagree, a phrase start or a silence in
// the vocal stem decides; where neither exists, the choice is marked here as
// editorial. Listening acceptance is open for every line marked below.
//
// - "Nein." The aligner puts it at 49.36, the free transcription hears "Stop,"
//   at 48.08, and the vocal stem is silent 49.6-49.9 with a phrase start at
//   50.02. Read as Nein@48.08 and Stopp@50.02 (editorial, listen).
// - "Was ich will." The free transcription hears "Was ich hab" a second time at
//   29.74. The written line is shown; listening decides.
// - "Fast." The free transcription has it at 84.02 right after "schwer", the
//   aligner at 85.42; the vocal stem bleeds through. Fast@84.02 (editorial).
// - "Updating specification dot M D." is not sung: the free transcription and
//   the vocal stem are empty 89.7-93.4, and the aligner collapsed the line to
//   93.56. It is not shown as a sung line (sung: false); specification.md is
//   still updated in the gap.
// - "Ich brauch keinen Develo—": Develo@133.56, the voice and band continue to
//   136.4, then the music cuts (vocal silence 136.6-137.1). The freeze sits on
//   that cut.
// - Between "Ich." (139.24) and the reprise the vocal stem is silent except a
//   short burst at 145.4; the band plays 140-150.8. The reprise starts at the
//   phrase start 150.84 (the aligner stretched it back to 139.78).
// - Tempo: the instrumental fits drift between 73 and 100 BPM per window, and
//   152.75 once; no steady pulse confirms the prompted 145. The scene therefore
//   snaps spawns to lyric onsets and to the 77.5 BPM fit of the rush window.

const PROVISIONAL = false;
const BPM = 155;          // twice the 77.5 BPM fit of 112-128 s, for half-beat spawns
const BEAT0 = 112.32;

const LINES = [
  { id: "intro1", t: 3.40, v: "h", s: "Ich hab kein Lied, nur eine Idee" },
  { id: "intro2", t: 6.06, v: "h", s: "und alles, was ich versteh." },
  { id: "intro3", t: 9.70, v: "h", s: "Kein Geld und kein Developer," },
  { id: "intro4", t: 12.54, v: "h", s: "nur Markdown und Kaffee.", e: 16.0 },
  { id: "read", t: 16.54, v: "m", s: "Reading source material." },
  { id: "think1", t: 18.08, v: "m", s: "Thinking…" },
  { id: "think2", t: 18.74, v: "m", s: "exploring: one voice, German, angry, tired." },
  { id: "think3", t: 23.76, v: "m", s: "Thought for twelve seconds. Hook missing.", e: 26.2 },
  { id: "rc1", t: 26.54, v: "m", s: "data dot M D." },
  { id: "rc2", t: 27.64, v: "h", s: "Was ich hab." },
  { id: "rc3", t: 28.18, v: "m", s: "specification dot M D." },
  { id: "rc4", t: 29.74, v: "h", s: "Was ich will." },
  { id: "rc5", t: 30.52, v: "m", s: "journal dot M D." },
  { id: "rc6", t: 31.46, v: "h", s: "Was ich weiß." },
  { id: "rc7", t: 31.90, v: "m", s: "CLAUDE dot M D." },
  { id: "rc8", t: 33.04, v: "h", s: "Was du sollst.", e: 33.8 },
  { id: "v1", t: 33.92, v: "m", s: "Building promptotype. Version one." },
  { id: "c1a", t: 36.34, v: "m", s: "Prompto. Typing." },
  { id: "c1b", t: 38.84, v: "m", s: "Developer. Not required." },
  { id: "c1c", t: 42.76, v: "m", s: "Prompto. Typing." },
  { id: "c1d", t: 46.16, v: "m", s: "Output generated.", e: 47.9 },
  { id: "nein", t: 48.08, v: "h", s: "Nein." },
  { id: "stopp", t: 50.02, v: "h", s: "Stopp. Das bin nicht ich." },
  { id: "kennst", t: 51.52, v: "h", s: "Du singst mein Lied, doch du kennst mich nicht." },
  { id: "upd1", t: 54.96, v: "m", s: "Updating journal dot M D.", e: 56.8 },
  { id: "d1", t: 62.30, v: "h", s: "Ich destillier, ich koch es ein," },
  { id: "d2", t: 64.14, v: "h", s: "bis nur die Unterscheidung bleibt:" },
  { id: "d3", t: 65.70, v: "h", s: "was wahr ist und was unsicher," },
  { id: "d4", t: 67.58, v: "h", s: "und was nur ein Modell mir schreibt.", e: 69.4 },
  { id: "v2", t: 69.56, v: "m", s: "Building promptotype. Version two." },
  { id: "c2a", t: 72.54, v: "h", s: "PROMPTOTYPING," },
  { id: "c2b", t: 74.78, v: "h", s: "ich brauch keinen Developer mehr." },
  { id: "c2c", t: 79.04, v: "h", s: "PROMPTOTYPING," },
  { id: "c2d", t: 80.92, v: "h", s: "ich schreib's in Markdown, ist nicht schwer.", e: 83.9 },
  { id: "fast", t: 84.02, v: "h", s: "Fast." },
  { id: "lauter", t: 85.90, v: "h", s: "Aber lauter." },
  { id: "gut", t: 86.58, v: "h", s: "Fast. Aber gut." },
  { id: "wut", t: 88.40, v: "h", s: "Und wo ist meine Wut?", e: 89.8 },
  { id: "upd2", t: 90.4, v: "m", s: "Updating specification dot M D.", e: 92.8, sung: false },
  { id: "ctx", t: 93.47, v: "m", s: "Context window full. New session." },
  { id: "w1", t: 95.54, v: "h", s: "Du hast vergessen, was wir waren," },
  { id: "w2", t: 97.96, v: "h", s: "doch nichts davon ist fort." },
  { id: "w3", t: 99.20, v: "h", s: "Es steht im Journal und in data," },
  { id: "w4", t: 101.04, v: "h", s: "du liest es, Wort für Wort.", e: 102.2 },
  { id: "m1", t: 102.32, v: "h", s: "Ich nenn es Promptotyping," },
  { id: "m2", t: 105.02, v: "h", s: "damit es nach Methode klingt.", e: 107.4 },
  { id: "v3", t: 108.83, v: "m", s: "Building promptotype. Version three." },
  { id: "md1", t: 111.94, v: "h", s: "MARKDOWN! MARKDOWN!", second: 113.40 },
  { id: "sc1", t: 114.76, v: "h", s: "ICH BRAUCH KEINEN DEVELOPER MEHR!" },
  { id: "md2", t: 118.24, v: "h", s: "MARKDOWN! MARKDOWN!", second: 119.58 },
  { id: "sc2", t: 121.06, v: "h", s: "ICH BAU MIR ALLES SELBST!", e: 124.2 },
  { id: "f1", t: 124.48, v: "h", s: "PROMPTOTYPING!" },
  { id: "f2", t: 126.82, v: "h", s: "Ich brauch keinen Developer mehr!" },
  { id: "f3", t: 131.10, v: "h", s: "PROMPTOTYPING!" },
  { id: "f4", t: 132.98, v: "h", s: "Ich brauch keinen Develo—", e: 136.5, develo: 133.56 },
  { id: "who", t: 137.26, v: "m", s: "Who validates this?" },
  { id: "ich", t: 139.24, v: "h", s: "Ich.", e: 140.4 },
  { id: "r1", t: 150.84, v: "h", s: "Ich hab ein Lied und eine Idee" },
  { id: "r2", t: 153.44, v: "h", s: "und alles, was ich versteh." },
  { id: "r3", t: 157.40, v: "h", s: "Hundert gebaut, geprüft erst eins." },
  { id: "r4", t: 160.72, v: "h", s: "Ich bin jetzt selber einer.", e: 163.6 },
];

// Editorial events that are not sung lines.
const EV = {
  split: 26.54,      // the knowledge column opens with "data dot M D."
  rushStart: 111.94, // artefacts start to spawn on the first MARKDOWN
  cut: 136.5,        // the music cuts after "Develo—", everything freezes
  enter: 139.9,      // "Ich." is confirmed, one artefact is validated
  dissolve: 141.0,   // in the instrumental the unvalidated artefacts go one by one
  axisOff: 161.6,    // the mirror axis disappears on "selber einer"
  fadeOut: 168.4,
};

// The paper's title page shown on the "Methode" lines (operator decision open).
const PAPER = {
  title: "Promptotyping",
  subtitle: "Translating Research Data into Research Artefacts",
  author: "Christopher Pollin",
};

const SCENE_END = 170.68;
const SCENE_TITLE = "Promptotyping";
