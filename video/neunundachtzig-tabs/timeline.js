// Section and line onsets in seconds of source/audio.wav. t is the onset of a
// line (for the verse: the spoken "Tab N"), a and b are the span over which its
// words are typed. Onsets come from align.py (forced alignment on the separated
// vocals), cross-checked against a free transcription and the loudness of the
// vocal stem; where the aligner stretched a word, the stem wins.
const TL = {
  bandIn: 4.0,
  verse: [
    { n: 1, q: "Therapeuten Graz", t: 13.5, a: 14.26, b: 15.74 },
    { n: 2, q: "Warum bin ich müde", t: 15.9, a: 16.66, b: 18.3 },
    { n: 17, q: "Wohnungen unter tausend", t: 22.3, a: 23.36, b: 25.3 },
    { n: 30, q: "Kündigungsschreiben Vorlagen", t: 25.3, a: 26.54, b: 28.48 },
    { n: 50, q: "„Harald Schmidt Best Of“", t: 31.4, a: 32.44, b: 34.02 },
    { n: 80, q: "Wie lösche ich mich selbst", t: 34.2, a: 34.94, b: 34.94 },
  ],
  chorus: [
    { q: "Jeder Tab ein ungelebtes Leben", t: 40.1, a: 40.1, b: 43.2 },
    { q: "Jeder Tab ein stummer Schrei", t: 44.12, a: 44.12, b: 47.7 },
    { q: "Neunundachtzig Parallelfluchtpunkte", t: 49.1, a: 49.1, b: 52.5 },
    { q: "Keiner führt hier raus, nur tiefer rein", t: 52.6, a: 52.6, b: 56.8 },
  ],
  bridge: 60.6,
  bridgeLines: [
    { rows: ["Die Summe meiner", "offenen Tabs"], t: 60.8, a: 60.8, b: 64.3, grade: 4 },
    { rows: ["Ist größer", "als ich selbst"], t: 65.2, a: 65.2, b: 67.9, grade: 4 },
    { rows: ["Tab neunzig"], t: 69.76, a: 69.76, b: 70.66, grade: 5 },
    { rows: ["Neunundachtzig", "Tabs"], t: 70.86, a: 70.86, b: 73.5, grade: 5 },
    { rows: ["Tab hundert", "Lass uns bleiben"], t: 77.2, a: 77.5, b: 78.74, grade: 5 },
    { rows: ["Tab hundert und eins", "was wir sind"], t: 79.38, a: 79.38, b: 81.54, grade: 5 },
    { rows: ["Neunundachtzig", "Tabs"], t: 84.7, a: 84.7, b: 86.38, grade: 5, quiet: true },
  ],
  quiet: 76.5,
  loudReturn: 86.4,
  spoken: [
    { q: "Lass uns bleiben,", t: 88.66 },
    { q: " was wir sind!", t: 89.66 },
  ],
  // beat grid of the loud end, fitted to the drum onsets: 106.3 BPM, first downbeat
  endBeat: { downbeat: 87.10, period: 60 / 106.3 },
  cut: 113.2,
};
const SCENE_END = 114.5;  // end of the audio
