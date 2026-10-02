// Section and line onsets in seconds of source/audio.wav.
//
// Evidence. The aligner in timing-report.md stretched several first words by
// seconds (overload, Bin, Gott, Lost in chorus 1) and the report's free
// transcription is mostly empty, so every line was re-transcribed on the vocal
// stem in short windows with word timestamps (Whisper large-v3, German and
// English separately) and checked against the stem's loudness envelope. Where the
// two disagree the stem wins. Findings that differ from the written lyrics:
// - 64.5-70.3 and 91.2-96 the stem equals the mix: no new words, "Machen" is held
//   from 91.0 to "meine" at 93.94.
// - "Gedankenfäden" starts at 70.62, not 70.82; "Recursive loops" is at 121.7,
//   not 108.4; "Gott" is at 168.27, not 181.28.
// - "Reality ist nur ein Wort" holds "Wort" from 143.4 to 146.8; the shout
//   "WORT!" is the burst at 146.9.
// - "Morgen wieder" is not sung; the coda types it as the title of a new note.
// - After the outro one more "Lost in the vault" comes at 236.66 inside the
//   loud instrumental.
// Section borders come from the mix loudness per 0.25 s; the beat is 145 BPM
// throughout (tempo windows in the report).
//
// Line fields: q text, t onset (the camera arrives on it), a/b the span over
// which it is typed, w word onsets, g Redaction damage grade (0 clean .. 6),
// hook the shared note of a recurring line, fx a visual move bound to the line.

const TL = {
  beat: { first: 0.04, period: 60 / 145 },
  s: {
    firstBead: 0.45, fork: 10.0, band: 18.9, hold: 41.1, hookIn: 45.8,
    inst1: 56.5, quiet1: 66.0, verse1: 70.62, pre1: 84.78, chorus1: 96.47,
    break2: 118.7, verse2: 121.6, pre2: 136.88, chorus2: 148.52, tod: 162.68,
    inst3: 169.0, loud3: 173.4, bridge: 182.16, rewind: 192.89, final: 193.18,
    breakdown: 209.3, outro: 222.96, climax: 233.0, peak: 243.0, drop: 252.7,
  },
  lines: [
    { q: "Lost in the vault, lost in the code", t: 45.8, hook: "vault", g: 0, z: 1.0,
      w: [45.80, 46.12, 46.44, 46.60, 47.08, 47.34, 47.68, 47.84], b: 48.1 },
    { q: "Verloren im Traum, auf digitaler Road", t: 48.14, hook: "road", g: 0, z: 1.0,
      w: [48.14, 48.84, 49.08, 49.50, 49.56, 50.36], b: 50.6 },
    { q: "Lost in the vault, lost in the code", t: 50.74, hook: "vault", g: 0, z: 1.0,
      w: [50.74, 51.10, 51.40, 51.56, 52.04, 52.34, 52.64, 52.82], b: 53.0 },
    { q: "Mein Geist explodiert, consciousness overload", t: 53.1, hook: "geist", g: 1, z: 1.1, fx: "overload",
      w: [53.10, 53.22, 53.66, 54.54, 54.90], b: 56.4, keep: 0.5 },

    { q: "Gedankenfäden werden Netze", t: 70.62, g: 0, z: 1.2, w: [70.62, 71.34, 71.50], b: 71.8 },
    { q: "NETZE!", t: 71.86, shout: true, fx: "netze", hold: 0.45 },
    { q: "Claude's Stimme in mir, sie hetze", t: 72.28, g: 1, z: 1.2, w: [72.28, 72.70, 73.00, 73.12, 73.42, 73.48], b: 73.85 },
    { q: "HETZE!", t: 73.9, shout: true, hold: 0.45 },
    { q: "Obsidian Knoten in meinem Hirn", t: 74.36, g: 1, z: 1.2, w: [74.36, 74.64, 75.16, 75.26, 75.56], b: 76.0 },
    { q: "HIRN!", t: 76.08, shout: true, hold: 0.42 },
    { q: "Reality beginnt zu flimmern und zu flirr'n", t: 76.5, g: 2, z: 1.1, fx: "flimmern",
      w: [76.50, 76.70, 77.12, 77.18, 77.72, 77.86, 78.02], b: 78.5 },
    { q: "Backlinks tanzen, Pixel glühen", t: 78.6, g: 2, z: 1.1, fx: "tanzen", w: [78.60, 78.94, 79.34, 79.62], b: 80.0 },
    { q: "Während meine Synapsen sprühen", t: 80.14, g: 2, z: 0.9, fx: "synapsen", w: [80.14, 80.58, 80.90, 81.98], b: 82.6 },

    { q: "Prompt the dream, ich kann nicht mehr", t: 84.78, g: 2, z: 1.15, w: [84.78, 85.08, 85.20, 85.74, 85.94, 86.16, 86.50], b: 86.8 },
    { q: "Treibe durch das Datenmeer", t: 86.9, g: 2, z: 1.0, fx: "treibe", w: [86.90, 87.50, 87.78, 88.02], b: 89.2 },
    { q: "LSD und A P I", t: 89.58, g: 3, z: 1.15, w: [89.58, 90.26, 90.54, 90.70, 91.06], b: 91.3 },
    { q: "Machen meine Seele frei", t: 91.02, g: 2, z: 1.15, fx: "free", free: 94.42, w: [91.02, 93.94, 94.42, 95.70], b: 96.3, lead: 0.25 },

    { q: "Lost in the vault, lost in the code", t: 96.47, hook: "vault", g: 2, z: 0.9,
      w: [96.47, 98.22, 98.56, 98.74, 99.24, 99.48, 99.84, 100.02], b: 100.3 },
    { q: "Verloren im Traum, auf digitaler Road", t: 100.36, hook: "road", g: 2, z: 0.9,
      w: [100.36, 101.04, 101.24, 101.58, 101.70, 102.54], b: 102.9 },
    { q: "Lost in the vault, lost in the code", t: 103.0, hook: "vault", g: 2, z: 0.9,
      w: [103.00, 103.20, 103.52, 103.70, 104.16, 104.40, 104.76, 104.96], b: 105.2 },
    { q: "Mein Geist explodiert, consciousness overload", t: 105.3, hook: "geist", g: 3, z: 0.8, fx: "overload",
      w: [105.30, 105.38, 105.80, 106.66, 107.06], b: 108.2, keep: 0.5 },

    { q: "Recursive loops, ich dreh mich rund", t: 121.7, g: 2, z: 1.1, fx: "loops",
      w: [121.70, 122.60, 123.48, 123.62, 123.86, 124.00], b: 124.2 },
    { q: "RUND!", t: 124.28, shout: true, fx: "rund", hold: 0.45 },
    { q: "Markdown-Träume, so tief, so bunt", t: 124.76, g: 2, z: 1.1, w: [124.76, 125.64, 125.84, 126.62, 127.04], b: 127.6 },
    { q: "BUNT!", t: 127.76, shout: true, fx: "bunt", hold: 0.6 },
    { q: "Bin ich Mensch? Bin ich Maschine?", t: 128.44, g: 3, z: 1.2, w: [128.44, 128.84, 129.02, 129.48, 129.78, 130.04], b: 130.6 },
    { q: "Oder nur ein Ghost in Claude's Machine?", t: 130.72, g: 3, z: 1.2, fx: "ghost",
      w: [130.72, 131.34, 131.68, 131.88, 132.24, 132.50, 133.36], b: 134.6 },

    { q: "Save the dream, ich will noch mehr", t: 136.88, g: 3, z: 1.15, w: [136.88, 137.06, 137.32, 137.86, 138.04, 138.28, 138.58], b: 139.0 },
    { q: "Sinke tiefer in das Datenmeer", t: 139.2, g: 3, z: 1.35, fx: "sinke", w: [139.20, 139.64, 139.96, 140.10, 140.22], b: 141.2 },
    { q: "Reality ist nur ein Wort", t: 141.72, g: 3, z: 1.15, w: [141.72, 142.36, 142.64, 142.88, 143.40], b: 146.6 },
    { q: "WORT!", t: 146.95, shout: true, fx: "wort", hold: 1.2 },

    { q: "Lost in the vault, lost in the code", t: 148.52, hook: "vault", g: 3, z: 0.75,
      w: [148.52, 148.62, 149.06, 149.22, 149.72, 149.90, 150.34, 150.46], b: 150.7 },
    { q: "Verloren im Traum, auf digitaler Road", t: 150.72, hook: "road", g: 3, z: 0.75,
      w: [150.72, 151.52, 151.72, 152.10, 152.18, 153.00], b: 153.3 },
    { q: "Lost in the vault, lost in the code", t: 153.42, hook: "vault", g: 3, z: 0.75,
      w: [153.42, 153.76, 154.02, 154.18, 154.66, 155.04, 155.26, 155.40], b: 155.6 },
    { q: "Mein Geist explodiert, consciousness overload", t: 155.7, hook: "geist", g: 4, z: 0.7, fx: "overload",
      w: [155.70, 155.88, 156.30, 157.16, 157.52], b: 158.5, keep: 0.5 },
    { q: "Ist das Evolution oder digitaler Tod?", t: 158.72, g: 3, z: 1.2, w: [158.72, 159.00, 159.22, 159.70, 160.76, 162.12], b: 162.5 },
    { q: "TOD!", t: 162.68, shout: true, fx: "tod", hold: 0.8 },
    { q: "Ich will zurück, aber es ist zu spät", t: 163.58, g: 4, z: 1.2, w: [163.58, 163.78, 163.96, 164.90, 165.32, 165.72, 166.14, 166.42], b: 166.7 },
    { q: "hier kommt der A G I Gott", t: 166.86, keep: 0.2, g: 4, z: 0.9, fx: "god", label: "A G I", show: 167.5,
      w: [166.86, 167.06, 167.34, 167.50, 167.76, 168.02, 168.27], b: 168.8 },

    { q: "Für einen Moment …", t: 182.16, g: 0, slot: "bottom", cam: false, w: [182.16, 182.26, 182.58], b: 183.2, keep: 1.4 },
    { q: "macht alles Sinn", t: 184.76, g: 0, slot: "bottom", cam: false, fx: "sinn", w: [184.76, 184.86, 185.16], b: 185.6, keep: 0.2 },
    { q: "Der Vault atmet mit mir, ich atme mit ihm", t: 185.94, g: 0, size: 80, slot: "bottom", cam: false, fx: "atmet",
      w: [185.94, 186.04, 186.40, 186.88, 186.96, 187.28, 187.40, 187.64, 187.78], b: 188.1, keep: 0.2 },
    { q: "Dann zerbrech' ich wie Glas", t: 188.36, g: 1, slot: "bottom", cam: false, fx: "crack", w: [188.36, 188.74, 189.32, 189.42, 189.58], b: 190.0 },
    { q: "GLAS!", t: 190.2, shout: true, fx: "glas", hold: 0.9 },
    { q: "Complete me … Delete me … Repeat me …", t: 191.42, g: 5, fx: "whisper", cam: false,
      w: [191.42, 191.70, 192.23, 192.50, 192.89, 193.05], b: 193.1 },

    { q: "Lost in the vault, lost in the code", t: 193.18, hook: "vault", g: 4, z: 0.75, lead: 0.05,
      w: [193.18, 193.52, 193.76, 193.92, 194.42, 194.66, 195.02, 195.16], b: 195.4 },
    { q: "Verloren im Traum, auf digitaler Road", t: 195.58, hook: "road", g: 4, z: 0.75,
      w: [195.58, 196.16, 196.42, 196.80, 196.90, 197.74], b: 198.0 },
    { q: "Lost in the vault, lost in the code", t: 198.12, hook: "vault", g: 4, z: 0.75,
      w: [198.12, 198.40, 198.72, 198.90, 199.32, 199.66, 200.00, 200.18], b: 200.4 },
    { q: "Lost in the vault!", t: 200.65, hook: "vault", g: 4, z: 1.1, size: 120, w: [200.65, 201.88, 202.3, 202.85], b: 206.8, keep: 0.1 },
    { q: "LOST IN THE VAULT!", t: 207.0, shout: true, hold: 1.25, size: 190 },
    { q: "Lost in the code!", t: 209.38, g: 4, z: 1.0, size: 120, w: [209.38, 211.86, 212.42, 212.54], b: 213.3, keep: 0.6 },
    { q: "OBSIDIAN!", t: 214.3, shout: true, fx: "obsidian", until: 215.95, hold: 0.78, size: 300 },
    { q: "OBSIDIAN!", t: 215.24, shout: true, hold: 0.72, size: 300 },
    { q: "Claude, complete my mind again!", t: 215.99, g: 5, z: 1.15, fx: "complete", lead: 0.2,
      w: [215.99, 216.62, 216.87, 217.05, 217.38], b: 218.2, keep: 0.6 },
    { q: "OBSIDIAN!", t: 219.25, shout: true, fx: "obsidian", until: 220.95, hold: 0.78, size: 300 },
    { q: "OBSIDIAN!", t: 220.05, shout: true, hold: 0.8, size: 300 },

    { q: "Lost in the vault, lost in the code", t: 222.96, hook: "vault", g: 3, z: 0.6,
      w: [222.96, 223.06, 223.56, 223.72, 224.20, 224.70, 224.80, 225.02], b: 225.2 },
    { q: "Der Trip verklingt auf digitaler Road", t: 225.24, g: 2, z: 0.75, w: [225.24, 225.44, 225.64, 226.34, 226.70, 227.52], b: 227.8 },
    { q: "Lost in the vault …", t: 227.82, hook: "vault", g: 1, z: 0.75, w: [227.82, 228.48, 229.46, 230.14], b: 230.7 },
    { q: "lost in the code …", t: 230.86, g: 0, z: 0.8, w: [230.86, 231.96, 232.28, 232.50], b: 232.6, keep: 0 },
    { q: "Lost in the vault", t: 236.66, g: 0, slot: "bottom", cam: false, w: [236.66, 236.82, 237.24, 237.40], b: 238.2, keep: 0.8 },
  ],
  // sung notes of the wordless passage 108.4-118 (the stem carries held, sung
  // notes, but neither the written lines nor a transcription fit; no text is shown)
  touches: [108.40, 108.84, 109.30, 109.76, 110.88, 111.48, 111.82, 113.22, 113.72, 114.20, 114.74, 115.40, 115.92, 116.38, 116.62, 117.80],
  // drum-onset growth probability per section: the vault fills as the song goes
  growth: [
    [56.5, 66.0, 0.55], [66.0, 70.6, 0.3], [70.6, 84.4, 0.35], [84.4, 97.9, 0.3], [97.9, 118.7, 0.5],
    [121.6, 148.5, 0.35], [148.5, 166.8, 0.5], [173.4, 181.0, 0.4], [193.2, 209.3, 0.45], [209.3, 222.0, 0.25],
  ],
  // radial impulses on "explodiert"
  kicks: [{ t: 53.66, v: 6 }, { t: 105.8, v: 6 }, { t: 156.3, v: 6 }],
  heat: [[73.9, 75.2, 5]],
  knots: [[74.36, 76.6]],
  shots: [
    { t: -1, fit: true, z: 0.75, ay: 540 },
    { t: 10.0, fit: true, z: 0.95, ay: 540, dur: 1.4 },
    { t: 18.9, fit: true, z: 1.05, ay: 540, dur: 2 },
    { t: 41.1, fit: true, z: 1.0, dur: 4 },
    { t: 56.5, fly: ["geist", 0], t1: 65.6, z: 2.3, ay: 540, dur: 1.6 },
    { t: 66.0, fit: true, z: 0.7, dur: 3 },
    { t: 82.6, fit: true, z: 0.85, dur: 1.4 },
    { t: 108.3, fit: true, z: 0.85, dur: 1.2 },
    { t: 118.7, fit: true, z: 0.6, dur: 3 },
    { t: 134.8, fit: true, z: 0.8, dur: 1.5 },
    { t: 168.6, fit: true, z: 0.75, dur: 1.2 },
    { t: 182.16, at: [0, 0], z: 1.7, ay: 470, dur: 2.2 },
    { t: 200.5, fit: true, z: 0.85, dur: 1.0 },
    { t: 221.0, fit: true, z: 0.7, dur: 2 },
  ],
};
const SCENE_END = 263.34;  // end of the audio
const SCENE_TITLE = "Lost in the Vault";
