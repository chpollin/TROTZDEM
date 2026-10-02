// Section and line onsets in seconds of source/audio.wav. Line onsets come from
// align.py (forced alignment on the separated vocals), cross-checked against a
// free transcription and the phrase starts in the vocal stem; where the aligner
// stretched a first word, the phrase start wins.
const TL = {
  bandIn: 4.0,
  verse: [
    { n: 1, q: "Therapeuten Graz", t: 13.5 },
    { n: 2, q: "Warum bin ich müde", t: 15.9 },
    { n: 17, q: "Wohnungen unter tausend", t: 22.3 },
    { n: 30, q: "Kündigungsschreiben Vorlagen", t: 25.3 },
    { n: 50, q: "„Harald Schmidt Best Of“", t: 31.4 },
    { n: 80, q: "Wie lösche ich mich selbst", t: 34.2 },
  ],
  chorus: [
    { q: "Jeder Tab ein ungelebtes Leben", t: 40.1 },
    { q: "Jeder Tab ein stummer Schrei", t: 44.3 },
    { q: "Neunundachtzig Parallelfluchtpunkte", t: 49.2 },
    { q: "Keiner führt hier raus, nur tiefer rein", t: 52.6 },
  ],
  bridge: 60.6,
  bridgeLines: [
    { rows: ["Die Summe meiner", "offenen Tabs"], t: 60.8, grade: 4 },
    { rows: ["Ist größer", "als ich selbst"], t: 64.4, grade: 4 },
    { rows: ["Tab neunzig"], t: 69.75, grade: 5 },
    { rows: ["Neunundachtzig Tabs"], t: 70.9, grade: 5 },
    { rows: ["Tab hundert", "Lass uns bleiben"], t: 77.2, grade: 5 },
    { rows: ["Tab hundert und eins", "was wir sind"], t: 79.4, grade: 5 },
    { rows: ["Neunundachtzig Tabs"], t: 84.7, grade: 5, quiet: true },
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
  help: 114.8,
};
const SCENE_END = 125;
