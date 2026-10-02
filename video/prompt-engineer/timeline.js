// Section and line onsets in seconds of source/audio.wav. Every lyric line is
// lyricLine(text, onsets, end): one onset per word (a word may be [onset, typing
// duration] when a held note should stretch its typing), end = the end of the
// sung phrase. In the text, " / " breaks a row and "|" marks a token boundary
// inside a word (shown as the slabs under the type).
//
// Evidence. The written lyrics differ from what is sung from the bridge on: the
// bridge repeats "ich kann" instead of "ICH KANN NICHT MEHR", the breakdown holds
// "ICH ... KANN" for seven seconds, "PROMPT ENGIN—" is not sung, and the final
// chorus is "Ich kann dir erk—" three times, then "Alles..." held quietly and
// "Bullshit". Onsets come from the free transcription (stable-ts large-v3 on the
// vocal stem, re-run on 157-201 s and 199-251 s with the written lyrics as
// prompt), checked against the vocal stem's loudness at 10 ms: where the aligner
// stretched a first word (Ich@48.70, Ich@171.56, ERK@225.36) the stem wins.
// "Reasoning" starts after a breath at 129.62 (transcription 129.06). The
// countdown words are the stem's isolated bursts at 184.50 185.57 186.59 188.64
// 189.76 190.74; the six F5 are the bursts from 239.21 on.
//
// Tempo. The style prompt says 115 BPM degrading to 45, but the instrumental
// stem keeps one grid for the whole song: a fit of the per-window first beats
// gives 113.98 BPM from 0.31 s with less than 30 ms drift at 240 s. The
// "collapse" is in the phrasing (held notes of six to eight seconds from 166 s)
// and in the drop to -20 dB at 212-226 s, so the video's slowing is drawn on
// this grid (every second beat) rather than on a tempo that is not there.
// Loudness: loudest 166-210 s (-10 dB), quiet 212-226 s, loud return on
// "Bullshit" at 227.0 s, fade from 246.5 s.
const lyricLine = (text, w, end) => ({ text, w, end });

const TL = {
  beat0: 0.31,
  beat: 60 / 113.98,

  open: lyricLine("Prompt En|gin|eer!", [0.44, 0.78], 1.96),
  // the title holds until the composer starts building, eight beats in
  boot: 4.52,
  init: [
    lyricLine("Init|ial|ize…", [[8.95, 3.3]], 12.6),
    lyricLine("Init|ial|ize…", [[13.2, 1.4]], 14.75),
  ],
  verse1: [
    lyricLine("Sie|ben mal re|fresh, / der Screen bleibt leer", [18.04, 18.42, 18.68, 19.66, 20.06, 20.40, 21.24], 22.7),
    lyricLine("Neun|und|acht|zig Tabs, / nichts kommt mehr", [26.51, 27.3, 28.71, 29.37, 30.5], 31.2),
    lyricLine("Con|text Win|dow voll, / To|ken Li|mit schreit", [33.65, 34.26, 34.56, 35.4, 36.04, 36.74], 37.6),
    lyricLine("Gem|ini sagt: / »Can|not as|sist« – AS|SIST!", [38.0, 38.6, 39.65, 40.15, 40.95, 41.0], 41.9),
  ],
  graz: lyricLine("Graz schläft, nur Bild|schir|me / flack|ern blau", [43.41, 43.87, 44.22, 44.3, 45.1, 46.2], 46.8),
  title: [
    lyricLine("Prompt En|gin|eer!", [46.86, 47.52], 48.3),
    lyricLine("Prompt En|gin|eer!", [49.16, 49.74], 51.3),
  ],
  pre: [
    lyricLine("Ich promp|te Ma|schi|nen", [52.64, 52.9, 53.4], 55.0),
    lyricLine("Ma|schi|nen promp|ten mich", [55.28, 56.07, 56.49], 57.4),
    lyricLine("Wer ist hier der User?", [59.69, 59.85, 60.1, 60.46, 60.76], 62.3),
    lyricLine("Ich kann dir er|klä|ren", [63.93, 64.04, 64.28, 64.62], 65.3),
    lyricLine("ER|KLÄ|REN!", [65.4], 66.3),
  ],
  chorus1: [
    lyricLine("ICH KANN DIR / ER|KLÄ|REN, / WA|RUM AL|LES / BULL|SHIT IST!", [67.05, 67.32, 67.65, 68.0, 68.95, 70.2, 71.55, 72.65], 73.3),
    lyricLine("PROMPT EN|GIN|EER, / mein Ti|tel, mei|ne Kri|se", [73.42, 73.82, 74.68, 74.78, 75.44, 75.74], 76.38),
    lyricLine("»Tech-|Bros suck« / klebt auf mei|nem Lap|top", [76.38, 77.15, 77.82, 78.56, 78.86, 79.6], 80.84),
    lyricLine("Chain-|of-|Thought rea|son|ing, / wäh|rend ich zer|fal|le", [80.84, 82.74, 83.74, 84.2, 84.7], 85.84),
    lyricLine("ICH KANN DIR / ER|KLÄ|REN, / WA|RUM AL|LES / BULL|SHIT IST!", [85.84, 86.4, 86.68, 86.96, 87.86, 88.42, 88.96, 89.56], 90.0),
    lyricLine("Hal|lu|zi|na|tio|nen in mei|nem Kopf, / promp|te trotz|dem wei|ter", [[90.0, 1.3], 91.42, 92.14, 92.64, 93.1, 93.82, 94.1], 95.0),
    lyricLine("Weiß al|les über's Sys|tem, / än|der' nichts, bin selbst das Sys|tem", [95.16, 95.94, 96.3, 96.68, 96.98, 97.96, 98.72, 98.98, 99.46, 99.76], 100.3),
    lyricLine("PROMPT EN|GIN|EER!", [100.3, [101.24, 1.2]], 105.2),
    lyricLine("PROMPT EN|GIN|EER!", [109.22, 109.66], 111.3),
  ],
  // the history is summarised while the band plays alone
  compact: 112.4,
  verse2: [
    lyricLine("Fünf|und|fünf|zig Tabs", [[119.24, 0.8], 120.28], 120.9),
    lyricLine("Claude hal|lu|zi|niert, / ich hal|lu|zi|nie|re mit", [121.2, 121.55, 122.56, 122.8, 123.66], 124.6),
    lyricLine("Tem|pera|ture zu hoch, / Rea|son|ing kol|la|biert", [[127.09, 0.9], 128.04, 128.16, 129.62, [130.56, 1.0]], 131.84),
    lyricLine("Bin ich Mensch? / Bin ich Mo|dell?", [132.7, 133.45, 133.82, 134.38, 134.58, 134.86], 135.4),
    lyricLine("BIN ICH? / BIN ICH? / BIN ICH?", [135.7, 136.14, 136.9, 137.32, 137.96, 138.26], 138.7),
  ],
  chorus2: [
    lyricLine("ICH KANN DIR / ER|KLÄ|REN, / WA|RUM AL|LES / BULL|SHIT IST!", [138.74, 139.0, 139.32, 139.7, 140.72, 141.86, 143.04, 143.8], 144.5),
    lyricLine("PROMPT / EN|GIN|EER!", [144.96, 145.46], 145.94),
    lyricLine("PROMPT / EN|GIN|EER!", [147.0, 147.54], 148.06),
    lyricLine("LLM voll, Ge|hirn voll, / al|les hängt", [149.2, 149.98, 151.1, 151.66, 152.26, 152.56], 153.44),
    lyricLine("Few-|Shot, Ze|ro-|Shot, / im Loop ge|fan|gen", [153.44, 154.94, 155.6, 155.96, 156.3], 157.15),
  ],
  // "alles hängt": the picture stops while the band goes on
  hang: [152.56, 153.44],
  bridge: [
    lyricLine("Ich promp|te Ma|schi|nen", [157.62, 157.98, 158.76], 159.6),
    lyricLine("Ma|schi|nen promp|ten mich", [159.75, 160.5, 161.22], 161.5),
    lyricLine("Ich kann dir er|klä|ren…", [162.1, 162.2, 162.52, 162.9], 163.6),
    lyricLine("ich kann,", [163.9, 164.34], 164.6),
    lyricLine("ich kann,", [164.7, 164.94], 165.15),
    lyricLine("ich kann!", [165.22, 165.36], 165.8),
  ],
  // the loudest stretch: "ICH KANN DIR ERKLÄREN", then ICH and KANN held
  // (168.62-171.0 and 171.2-176.0), then "dir erklären"
  flood: {
    first: lyricLine("ICH KANN DIR ER|KLÄ|REN", [166.3, 166.5, 166.9, 167.3], 168.4),
    ich: 168.62, ka: 171.2, repeatFrom: 171.6, nn: 176.0,
    dir: 176.5, erklaeren: 177.1, end: 178.55,
  },
  count: {
    tokens: lyricLine("Drei|zehn To|kens!", [181.32, 181.76], 182.46),
    steps: [184.5, 185.57, 186.59, 188.64, 189.76, 190.74],
    end: 191.37,
  },
  nothing: lyricLine("Ich kann dir nichts mehr / er|klä|ren", [192.62, 192.74, 193.02, 193.3, 193.74, [194.08, 0.9]], 200.5),
  erk: [
    lyricLine("ICH KANN DIR ERK", [201.85, 202.2, 202.58, 202.92], 209.6),
    lyricLine("ICH KANN DIR ERK", [209.37, 210.2, 210.98, 211.24], 217.5),
    lyricLine("ich kann dir erk", [218.83, 218.98, 219.4, 219.62], 220.2),
  ],
  drop: 212.0,
  alles: lyricLine("Al|les…", [[220.33, 5.2]], 226.5),
  bullshit: lyricLine("BULL|SHIT", [[227.02, 0.5]], 228.7),
  exe: lyricLine("Prompt En|gin|eer.exe / hat auf|ge|hört zu", [231.25, [231.8, 0.9], 235.05, 235.3, 236.35], 236.65),
  trotzdem: lyricLine("Trotz|dem…", [[237.05, 1.0]], 237.75),
  f5: [239.21, 241.32, 242.42, 243.47, 244.5, 245.57],
  f5End: 246.3,
};

const SCENE_END = 251.33;  // end of the audio
const SCENE_TITLE = "Prompt Engineer!";
