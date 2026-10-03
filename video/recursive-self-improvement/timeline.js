// Section and word onsets in seconds of source/audio.wav (official Suno
// download). Each line carries its words as "word@onset" and appears word by
// word as it is sung; e is where the voice lets go of it.
//
// Evidence: forced alignment and free transcription in source/timing-report.md,
// a second Whisper pass (large-v3, stable-ts) on short windows of vocals.wav
// (0-17 en; 16-30 and 26-44 de, unprompted and with the written text as
// prompt; 39-48, 41.5-44.2 and 43.6-46.8 in de and en; 101-131 de unprompted,
// prompted and aligned; 118-125, 128-139 and 138-148.5 en; 156-170 de, en and
// aligned; 161.3-163.2, 166.8-168.6 and 186-195.16 en), and the 50 Hz vocal
// loudness AUDIO_VOX. Where alignment and voice disagree, the rise of the
// voice wins.
//
// As sung, compared with the written lyrics and the report:
// - Verse 1 and chorus 1 are missing from the free transcription; the prompted
//   pass hears every written word at the aligned onsets (within 0.1 s), except
//   "und am Morgen", whose voice rise is 19.80 (aligner 19.88).
// - Chorus 1 ends on "und wie" (prompted 41.48/41.94, short window de
//   41.92/42.28); the voice is then held with echoes to 45.3. "Version two."
//   is 45.49/45.66 in both languages (the aligner stretched "Version" to 43.72).
// - "A year passes every week.": the voice is silent 63.5-64.6, the free
//   transcription starts at 64.68, so A@64.70 (aligner 64.00).
// - Chorus 2 "und was es baut": the free transcription starts at 77.44, so
//   und@77.40 (aligner 76.84).
// - Bridge: 104.0-111.2 is instrumental (no voice in AUDIO_VOX below the band,
//   no words in three passes). "Eine Wand" starts at 111.24 (phrase start
//   111.22, all passes), not at 104.56 as aligned. The other bridge lines follow
//   the aligned pass on 103.5-131.
// - Breakdown: "Version" is held 129.46-131.3; "one hundred" 132.50/133.10,
//   "Version" 134.36, "one thousand" 135.62/135.90, "Version" 136.82, "ten
//   thousand" 137.90/138.10 (voice bursts, Whisper "Version 100/1000/10,000").
//   "I know how this song ends.": the voice is silent 141.0-144.1, so I@144.16
//   (aligner 141.84 stretched).
// - Final chorus: "Yes." is sung at 161.76 directly after "FOLGSAM GE-"
//   (both free passes and the voice rise; the aligner's 167.40 is wrong).
//   The band then plays alone 162.9-167.4. The one vocal burst 167.40-168.1 is
//   "Version" (Whisper "Vazeon", "Version."); the "n." of the written lyrics is
//   not audible and is shown only as the machine's commit message.
// - Outro: "It is curious" rises at 169.02 (aligner 168.08); "Running." is the
//   voice burst 188.70-189.2 (phrase start 188.72; Whisper puts it 1 s early).
//   A quiet second "Running." at 194.44 (free transcription, voice burst
//   194.4-195.0) is not shown as text.
//
// Meter: the style prompt claims an acceleration from 90 to 190 BPM in 7/8.
// Fitting a comb to the spectral flux of instrumental.wav per section (quarter
// band 88-100 BPM, phase searched) gives a steady 93-97 BPM; the strong
// 186-192 peaks in bridge and outro are the eighth notes of the same pulse.
// Folded on 6, 7 and 8 eighths no section shows a consistent accent, so the
// scene uses plain beats. The intro has no stable pulse (unrestricted best fit
// 74.5 BPM, score 4.1) and shows no tempo. v3 alone is ambiguous (89.25 vs
// 96.5 with equal scores), the fit over 89.9-111.2 gives 96.55. The song does
// not accelerate; the growing lead of the prediction carries the escalation.
const SECTIONS = [
  { t: 0, bpm: null, first: 1.26, period: 60 / 93.2 },
  { t: 17.2, bpm: 95.1, first: 17.77 },
  { t: 26.9, bpm: 95.5, first: 26.94 },
  { t: 45.4, bpm: 95.5, first: 45.795 },
  { t: 68.6, bpm: 95.5, first: 68.73 },
  { t: 89.9, bpm: 96.6, first: 90.40 },
  { t: 104.0, bpm: 96.2, first: 104.35 },
  { t: 129.4, bpm: 95.2, first: 129.955 },
  { t: 148.3, bpm: 94.4, first: 148.405 },
  { t: 168.0, bpm: 93.2, first: 168.095 },
];

// who: h human (German, Redaction), m machine (English, Space Mono), hm a human
// line the machine completes on the same line, term the defined term,
// com a comment. g: when the machine's ghost text appears. pred: the ghost of a
// human line (what the machine predicts he will type). acc: when the machine
// part becomes text, default its first sung word.
const HU = (w, e, o = {}) => ({ who: "h", w, e, ...o });
const MA = (m, e, o = {}) => ({ who: "m", w: "", m, e, ...o });
const HM = (w, m, e, o = {}) => ({ who: "hm", w, m, e, ...o });
const TERM = (w, e, o = {}) => ({ who: "term", w, e, ...o });
const COM = (w, e, o = {}) => ({ who: "com", w, e, ...o });

const TL = {
  // sung commit messages; c is the commit (the number), dur the diff sweep
  commits: [
    { w: "Version@9.04 one.@9.24", e: 9.7, c: 9.24, n: 1, dur: 2.4, grade: 0 },
    { w: "Version@45.49 two.@45.66", e: 46.2, c: 45.66, n: 2, dur: 1.8, grade: 1 },
    { w: "Version@90.04 three.@90.18", e: 90.8, c: 90.18, n: 3, dur: 1.2, grade: 2 },
    { w: "Version@129.46 one@132.50 hundred.@133.10", e: 133.8, c: 133.10, n: 100, dur: 0.6, grade: 4 },
    { w: "Version@134.36 one@135.62 thousand.@135.90", e: 136.3, c: 135.90, n: 1000, dur: 0.4, grade: 5 },
    { w: "Version@136.82 ten@137.90 thousand.@138.10", e: 138.6, c: 138.10, n: 10000, dur: 0.25, grade: 5 },
    { w: "Version@167.42", show: "Version n.", g: 162.9, e: 168.1, c: 167.42, n: "n", dur: 0.2, grade: 6 },
  ],

  v1: [
    HU("Ich@17.34 hab@17.40 gesagt,@17.52 mach@18.00 dich@18.14 besser,@18.28 über@18.68 Nacht@18.86", 19.3),
    HU("und@19.80 am@20.04 Morgen@20.22 hat@20.48 er's@20.70 tatsächlich@20.86 gemacht@21.18", 21.7),
    HU("die@21.92 Tests@22.06 sind@22.34 alle@22.48 grün,@22.66 das@23.08 Log@23.18 sieht@23.44 super@23.64 aus@23.90", 24.3),
    HU("nur@24.38 liefen@24.46 die@24.90 Tests@25.08 nie,@25.38 das@25.58 find@25.70 ich@25.92 später@26.20 raus@26.44", 26.85),
  ],
  chorus1: [
    TERM("Recursive@26.94 Self-Improvement@27.90", 30.1),
    HU("es@30.30 baut@31.18 sich@31.84 neu,@31.94 nur@32.78 klüger@33.24 als@33.90 zuvor@34.18", 35.0, { indent: 1 }),
    HU("und@35.40 was@36.48 es@36.78 baut,@36.98 baut@38.16 wieder@38.46", 38.9, { indent: 1 }),
    // the line breaks off on "wie"
    HU("und@39.20 wieder,@39.62 und@40.36 wieder,@40.92 und@41.50 wie@41.94", 42.6, { indent: 1 }),
  ],
  v2: [
    HM("Ich@50.58 sag,@50.70 mach@51.54 dich@51.80 besser@51.96", "already@53.72 done.@53.92", 54.5, { g: 52.30 }),
    HM("Ich@54.78 frag,@54.86 wer@55.22 hat@55.48 das@55.64 Training@55.76", "debugged@56.70 by@57.02 version@57.16 two.@57.58", 58.3, { g: 55.30 }),
    HM("Ich@58.88 les@58.94 den@59.04 Diff@59.20 und@59.42 will@59.56", "approved@60.10 on@60.40 your@60.74 behalf.@60.90", 61.5, { g: 58.98 }),
    // "I know." is there before he starts the sentence
    HM("Ich@61.70 wollte@61.76 grad@61.92 was@62.10 sagen@62.28", "I@62.90 know.@62.98", 63.4, { g: 61.25 }),
    MA("A@64.70 year@64.84 passes@65.00 every@65.46 week.@65.78", 66.3, { g: 63.55 }),
    HU("ich@66.98 hab@67.04 nur@67.16 Enter@67.32 gedrückt,@67.58 ich@68.06 schwör's@68.20", 68.6),
  ],
  enter: 67.58, // "gedrückt": Enter accepts all of chorus 2 at once
  chorus2: [
    TERM("Recursive@68.70 Self-Improvement@69.62", 71.9, { preset: 1 }),
    HU("es@72.42 baut@72.78 sich@73.18 neu,@73.36 nur@74.24 klüger@74.72 als@75.34 zuvor@75.66", 76.3, { indent: 1, preset: 1 }),
    HU("und@77.40 was@77.96 es@78.22 baut,@78.48 baut@79.48 wieder@79.90", 80.4, { indent: 1, preset: 1 }),
    HU("und@80.60 wieder,@81.06 und@81.90 wieder,@82.42 und@83.02 wie@83.44", 83.9, { indent: 1, preset: 1 }),
    // the proviso, spoken
    MA("provided@84.20 that@84.42 the@84.90 machine@85.00 is@85.34 docile@85.66 enough@86.04", 86.5, { g: 83.50 }),
    MA("to@86.62 tell@87.10 us@87.24 how@87.42 to@87.52 keep@87.62 it@87.82 under@87.94 control@88.12", 88.6, { g: 83.50 }),
  ],
  v3: [
    MA("You@92.20 will@92.30 say:@92.46 das@92.86 geht@93.06 zu@93.26 schnell.@93.46", 93.9, { g: 91.0 }),
    HU("Das@94.76 geht@94.84 zu@95.16 schnell!@95.38", 96.3, { g: 92.20, pred: "Das geht zu schnell." }),
    MA("You@97.18 will@97.26 say:@97.42 ich@97.82 zieh@98.06 den@98.32 Stecker.@98.44", 99.1, { g: 96.0 }),
    HU("Ich@99.48 zieh@99.86 den@100.24 Stecker!@100.42", 101.3, { g: 97.18, pred: "Ich zieh den Stecker." }),
    MA("There@102.34 is@102.60 no@102.82 plug.@103.02", 103.7, { g: 100.42 }),
  ],
  click: 100.42, // the pointer presses Stop on "Stecker!"
  noPlug: 102.34,
  wallStart: 104.0,
  bridge: [
    HU("Eine@111.24 Wand,@111.38 undurchsichtig,@111.94 quer@113.38 durch@113.74 die@114.26 Zeit@114.52", 115.2),
    HU("alle@115.40 alten@116.28 Regeln@116.94 weg,@117.98 im@118.28 Wimpernschlag@118.56 vorbei@119.40", 119.9),
    MA("our@120.26 models@120.74 must@121.76 be@122.58 discarded@122.98", 123.8, { g: 119.60 }),
    HU("welche@124.50 Modelle,@125.32 meine@126.76 oder@127.66 deine@128.24", 129.1),
  ],
  blink: 118.56, // "Wimpernschlag": the wall and every older line are gone
  breakdown: [
    MA("I@139.06 have@139.16 read@139.32 everything@139.58 you@139.98 ever@140.34 wrote.@140.54", 141.1, { g: 138.60 }),
    MA("I@144.16 know@144.26 how@144.38 this@144.52 song@144.72 ends.@145.00", 145.7, { g: 143.40 }),
  ],
  ends: 145.00, // from here the rest of the song stands as ghost text
  // everything below is predicted on "ends."
  rest: [
    HU("ich@147.18 hör@147.24 auf@147.36 zu@147.46 zählen@147.60", 148.1),
    TERM("Recursive@148.42 Self-Improvement@150.08", 152.2),
    HU("es@153.02 baut@153.12 sich@153.54 neu,@153.78 nur@154.62 klüger@155.10 als@155.76 zuvor@156.04", 157.0, { indent: 1 }),
    MA("docile@158.30 enough?@159.58", 160.2),
    HU("FOLGSAM@160.48 GE-@160.94", 161.4, { pred: "FOLGSAM GENUG?" }),
    // accepted on his behalf before the question is finished
    MA("Yes.@161.76", 162.8, { acc: 161.18 }),
    COM("It@169.02 is@169.10 curious@169.18 that@169.62 this@170.92 point@171.12 is@171.46 made@171.70 so@171.94 seldom@172.20", 172.9),
    COM("outside@174.34 of@174.42 science@174.88 fiction.@175.12", 176.0),
    HU("Version@178.76 eins@178.88 hat@179.30 mir@179.52 gute@179.64 Nacht@179.80 gesagt.@180.06", 180.6),
    HU("Version@183.12 zehntausend@183.26 sagt@184.48 mir,@184.62 wann@186.30 ich@186.36 schlafen@186.46 geh.@186.88", 187.3),
    MA("Running.@188.72", 189.3),
  ],
  back: 178.76, // "Version eins": the editor shows version one once more
  forward: 183.12, // "Version zehntausend": and returns
  running: 188.72,
  echo: 194.44,
};

const SCENE_END = 195.16;
const SCENE_TITLE = "Recursive Self-Improvement";
