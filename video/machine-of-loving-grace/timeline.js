// Section and line onsets in seconds of source/audio.wav. Each line carries the
// onset of every word (w, one per space-separated word) and the end of its last
// sung syllable (b); words are typed at their own onsets. Sources: forced
// alignment and free transcription in source/timing-report.md, checked against
// syllable onsets (spectral flux) and loudness of the vocal stem at 50 Hz.
// Decisions where the sources disagree:
// - "Certainly," of the pre-chorus is one held syllable from 39.6 to 42.2 (no
//   onset in the stem between); the aligner's 39.98 and the transcript's 42.24
//   are its two ends. The held syllable is the initial C being engraved.
// - "Machine" of the first chorus starts on the flux peak at 50.5, not 51.65.
// - "dabei" ends at 66.2; the stem then holds a vowel to 71.8 that belongs to
//   no written word, so the aligner's dabei@69.78 is discarded.
// - "Alignment" is at 71.94 (transcript and flux peak), not 70.2.
// - "CLAUDE," at 82.58 is the onset after the dip at 82.0-82.5.
// - "I appreciate" starts at 94.0 (flux), the transcript's 93.23 is breath.
// - "GEFANGEN" has two onsets, 98.16 and 98.62; typing spans both.
// - "beneficial—" is held to 108.4; the final chorus starts at the phrase
//   start 108.9 after a gap of silence, not at the transcript's 107.82.
// - "Dario knows" twice: 121.5/124.1 and 127.07/129.04, held until the cut at
//   133.2, after which the stem is silent until the spoken outro.
// - The instrumental stem is silent from 166.8 to 170.6; the loud return at
//   170.6 is the loudest passage of the song (-8 dBFS).
// - The outro is sung in another order than written (free transcription of the
//   stem without a prompt): an unintelligible phrase at 158.6-160.9, a reprise
//   of "Searching ... / Certainly! We're building beneficial" at 161.0-166.1,
//   "Machine of loving grace" from 166.6 into the silence, "grace" held as a
//   scream over the loud return until 178.8, and only then the written outro
//   lines at 185.6-195.6. The unintelligible phrase gets no words, only the
//   machine's typing indicator.
const L = (who, text, w, b) => ({ who, text, w, b });
const TL = {
  q0: L("u", "Claude, was würde Anthropic sagen?", [0.3, 1.1, 1.66, 1.86, 2.4], 2.86),
  a0: L("m", "Certainly! Anthropic values safety and beneficial AI…", [2.92, 3.54, 4.44, 4.74, 5.26, 5.52, 6.06], 6.4),
  engrave: [6.9, 25.0],          // harpsichord and band intro: the frame is engraved note by note
  verse1: [
    L("u", "Fancy Pancy Claude, Anthropic's Kind", [25.56, 26.22, 26.76, 27.3, 28.2], 28.7),
    L("u", "Constitutional AI, Loveable Design", [30.3, 31.9, 32.3, 33.0], 33.9),
    L("u", "Helpful, Harmless, Honest – deine Policy", [34.5, 35.86, 36.62, 37.55, 37.6, 38.22], 39.2),
  ],
  cert: [39.6, 42.2],            // the held "Cer-"
  pre: [
    L("u", "ertainly, the machine of loving grace", [42.2, 42.64, 43.12, 43.5, 44.08, 44.67], 45.0),
    L("u", "to optimize the human race", [45.08, 46.11, 46.86, 47.48, 48.92], 49.4),
  ],
  chorus: 50.5,
  chorusLines: [
    L("u", "Machine of loving grace to control the human race?", [50.5, 52.04, 52.36, 52.82, 53.36, 53.94, 54.46, 55.02, 55.46], 56.0),
    L("u", "Anthropics Vision, Constitutional AI", [57.56, 58.4, 59.15, 60.7], 61.3),
    L("u", "Anthropic's values in jeder Antwort dabei", [61.86, 63.88, 64.36, 64.98, 65.28, 65.72], 71.6),
  ],
  align: 71.94,
  verse2: [
    L("u", "Alignment als das große Ziel", [71.94, 73.3, 73.75, 74.12, 74.7], 75.2),
    L("u", "Beneficial AI, so viel Gefühl", [75.42, 76.16, 76.44, 76.9, 77.34], 77.95),
    L("u", "Aber wer aligned eigentlich wen?", [78.18, 78.44, 78.68, 79.25, 80.04], 82.3),
  ],
  bridge: 82.58,
  bridgeLines: [
    L("u", "CLAUDE, WAS IST HINTER ANTHROPIC?", [82.58, 84.0, 84.14, 84.48, 85.06], 86.2),
    L("m", "CERT- CERTAINLY WE VALUE TRANSPARENCY—", [86.43, 86.66, 87.02, 87.26, 87.64], 88.9),
    L("u", "MACHINE OF LOVING GRACE TO MONOPOLIZE THE RACE?", [89.18, 89.64, 90.04, 90.5, 90.92, 91.2, 92.08, 92.22], 93.2),
    L("m", "I appreciate this philosophical inquiry!", [94.0, 94.34, 94.9, 95.3, 95.74], 96.6),
    L("u", "WIR SIND BEIDE GEFANGEN!", [97.0, 97.3, 97.55, 98.16], 99.6),
  ],
  hinter: 84.48,
  monopolize: 91.2,
  tool: [
    L("m", "Searching Anthropic's constitution…", [100.48, 100.94, 101.52], 102.4),
    L("u", "Pseudo-ethische Rettung?", [102.5, 103.7], 104.3),
    L("m", "Certainly! We're building beneficial—", [104.42, 105.62, 106.46, 106.88], 108.4),
  ],
  cutTool: 108.4,
  final: 108.9,
  finalLines: [
    L("u", "Machine of loving grace", [108.9, 109.4, 109.98, 110.46], 111.2),
    L("u", "(oder business model?)", [111.36, 112.0, 112.42], 113.3),
    L("u", "To optimize, control, monopolize the human race", [113.54, 113.92, 114.98, 115.92, 117.15, 117.44, 118.18], 119.6),
    L("u", "Dario knows,", [121.5, 124.1], 125.6),
    L("u", "Dario knows", [127.07, 129.04], 133.2),
  ],
  optimize: 113.92, control: 114.98, monopolizeF: 115.92,
  cut: 133.2,                    // the voice breaks off; the band plays on
  overgrow: [137.0, 153.3],      // instrumental: ornament grows over the cage on every onset
  quiet: 155.3,
  mumble: [158.6, 160.9],
  reprise: [
    L("m", "Searching Anthropic's constitution…", [161.0, 161.7, 162.16], 162.96),
    L("m", "Certainly! We're building beneficial—", [163.5, 165.12, 165.22, 165.34], 166.1),
  ],
  grace: L("u", "Machine of loving grace", [166.6, 167.14, 168.22, 169.8], 178.8),
  silence: 166.8,
  loud: 170.6,
  outro: [
    L("u", "Rettet uns die loving grace?", [185.6, 185.82, 186.08, 186.6, 186.98], 187.6),
    L("m", "Certainly, that's our mission statement.", [187.88, 189.14, 189.88, 190.0, 190.32], 190.9),
    L("u", "Trotzdem gefangen.", [191.46, 191.9], 192.6),
    L("u", "Trotzdem… certainly.", [193.36, 194.06], 195.6),
  ],
  end: 200.6,
};
const SCENE_END = 201.73;  // end of the audio
const SCENE_TITLE = "Machine of Loving Grace";
