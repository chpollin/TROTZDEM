// Section and word onsets in seconds of source/audio.wav. Each line carries its
// words as "word@onset" and is typed word by word as it is sung; e is where the
// voice lets go of it.
//
// Evidence: forced alignment and free transcription in source/timing-report.md,
// a second Whisper pass (large-v3) over short windows of vocals.wav (0-22.6,
// 22.3-33, 77.5-83, 108.3-112.2, 132-187, 204-217), the 10 ms energy envelope
// of vocals.wav (syllable rises after dips) and AUDIO_ONSETS. Where they
// disagree the stem wins.
// The aligner stretched the outro over 133-155 and invented lines there; as
// sung, the second chorus ends on "mehr" (131.9), followed by a wordless held
// cry 133.5-140.0 (no words in two Whisper passes), the band alone to 143.9,
// then the whispered lines at 144.00, 146.42, 149.30, 152.34 and 155.10 over
// the full band. The intro repeats "Ich bin noch" at 16.88 (stem rises 16.85).
// "EXPERT" of the chorus lines sits where the stem rises after the previous
// line, not where the aligner put it: 55.40 (also an onset), 60.95, 71.95,
// 110.60 (confirmed by Whisper), 116.10, 121.98, 127.48. "NACHT!" is shouted at
// 25.95 (the stem holds "Nacht" to 25.55, dips, rises again), "MACHT!" at 31.26
// (onset), "Sie sehen" at 49.42 and "Ich seh die Welle" at 88.60 (phrase starts).
// After the instrumental the voice holds one "Iiich" 177.85-183.3, the band
// drops out 183.4-185.2, "bin." falls into that hole at 184.22, and the band
// returns at 185.20. The end: "Ich bin noch." 205.84, "Aug-" 209.00, "-men-"
// 210.45 (soft), "-tiert." 211.60-213.2, and the final hit at 214.54 (onset),
// ringing out to the end of the file.
//
// Meter: the style prompt claims a 5/4 verse; the report fits 87 BPM in every
// 16 s window up to 176 s. All window phases line up on one half-beat grid
// (eighths at 174 BPM): first 0.62, period 0.68996 s, checked against the onset
// strength of instrumental.wav per section (best phase within 0.04 s every
// time). After the band's drop-out a new tempo starts: 132.4 BPM, first beat
// 185.22, period 0.4533 s, fitted over 185.2-216.4.
const GRID_A = { first: 0.62, period: 0.68996, until: 183.4 };
const GRID_B = { first: 185.22, period: 0.4533 };

const TL = {
  intro: [
    { w: "Ich@0.42 bin@0.58 noch@0.80 der@0.98 Expert.@1.10", e: 2.2 },
    { w: "Ich@3.00 bin@3.32 noch@3.56 im@3.76 Loop.@3.90", e: 4.8 },
    { w: "Ich@5.66 bin@6.08 noch …@6.30", e: 7.0 },
    { w: "Ich@16.88 bin@17.14 noch …@17.34", e: 18.6 },
  ],
  bandIn: 6.78,
  v1: [
    { w: "Ich@22.58 hab@22.70 mir@22.86 ein@23.00 Tool@23.16 gebaut@23.46 in@24.06 einer@24.46 Nacht@24.84", e: 25.55 },
    { w: "Was@27.52 andere@27.98 Jahre@28.28 kostet,@28.60 hab@29.28 ich@29.56 einfach@29.86 gemacht@30.38", e: 31.0 },
    { w: "Und@33.04 jetzt@33.74 steh@33.88 ich@34.10 hier@34.20 mit@34.48 Fähigkeiten@34.72 die@35.96 nicht@36.28 meine@36.72 sind@37.12", e: 37.8 },
    { w: "Bin@38.32 ich@39.18 noch@39.42 der@39.60 Vater@39.70 oder@40.12 schon@40.56 das@41.12 Kind?@41.82", e: 42.6 },
  ],
  // shouts answered by the band; c is the colour of whoever shouts
  shouts: [
    { q: "NACHT!", t: 25.95, e: 26.9, c: "acc" },
    { q: "MACHT!", t: 31.26, e: 32.3, c: "acc" },
    { q: "HÖR ZU!", t: 80.70, e: 82.2, c: "hum" },
  ],
  pre: [
    { w: "Sie@43.88 sagen:@44.14 „Das@44.60 ist@44.72 nur@44.96 ein@45.12 Chatbot“@45.28", e: 46.0, quote: 2 },
    { w: "Sie@46.72 sagen:@46.92 „Der@47.36 macht@47.48 auch@47.72 mal@47.88 Fehler“@48.00", e: 48.6, quote: 2 },
    { w: "Sie@49.42 sehen@50.00 nicht@50.32 die@50.58 Kurve@50.80", e: 51.25 },
    { w: "Sie@51.32 wollen@51.44 nicht@51.76 die@51.96 Kurve@52.18", e: 52.7 },
  ],
  kurve: { w: "ICH@52.80 BIN@53.16 DIE@53.40 KURVE@53.52", e: 55.1 },
  chorus1: [
    { w: "EXPERT@55.40 IN@56.04 THE@56.18 LOOP@56.30", e: 56.9 },
    { w: "Der@57.02 sich@57.12 selbst@57.34 augmentiert@57.82 hat@58.60", e: 59.2 },
    { w: "EXPERT@60.95 IN@61.54 THE@61.68 LOOP@61.78", e: 62.3 },
    { w: "Der@62.50 die@62.66 Zukunft@62.86 schon@63.44 gesehen@63.70 hat@64.00", e: 64.7 },
    { w: "EXPERT@66.45 IN@66.86 THE@67.20 LOOP@67.26", e: 68.0 },
    { w: "Den@68.18 keiner@68.34 mehr@68.90 versteht@69.38", e: 70.8 },
    { w: "EXPERT@71.95 IN@72.36 THE@72.72 LOOP@72.78", e: 73.4 },
    { w: "Der@73.54 nicht@73.72 weiß@73.96 wohin@74.32 er@75.00 geht@75.32", e: 75.9 },
  ],
  v2: [
    { w: "Ich@77.86 erklär@78.18 es@78.64 ihnen,@78.76 doch@79.06 sie@79.32 hören@79.50 nicht@79.94 zu@80.16", e: 80.6 },
    { w: "Cassandra@83.38 hatte@84.18 wenigstens@84.46 noch@85.14 ihre@85.36 Ruh@85.74", e: 86.6 },
    { w: "Ich@88.60 seh@89.00 die@89.28 Welle@89.40 kommen,@89.84 ich@90.40 seh@90.74 sie@91.10 brechen@91.22", e: 91.85 },
    { w: "Und@91.90 sie@92.02 diskutieren@92.14 ob@93.14 Maschinen@93.42 „wirklich“@93.98 sprechen@94.64", e: 95.2 },
  ],
  bridge: [
    { w: "Promptotyping,@97.70 Projektantrag,@98.42 fertig@99.26 bis@99.52 morgen@99.76", e: 100.3 },
    { w: "Kein@100.44 Problem,@100.66 Claude@101.18 und@101.56 ich,@101.74 wir@102.12 machen@102.28 das@102.46 schon@102.72", e: 103.1 },
    { w: "Aber@103.34 wer@103.50 macht@103.70 hier@103.78 wen?@103.92", e: 104.25 },
    { w: "Wer@104.36 denkt@104.56 hier@104.82 wen?@104.98", e: 105.3 },
    { w: "Wenn@105.52 ich@105.62 nicht@105.84 weiß@105.96 wo@106.22 ich@106.50 aufhör@106.68", e: 107.2 },
    { w: "und@107.32 wo@107.46 es@107.60 beginnt@107.80", e: 110.3 },
  ],
  chorus2: [
    { w: "EXPERT@110.60 IN@111.30 THE@111.40 LOOP@111.50", e: 112.0 },
    { w: "Mit@112.08 übermenschlichen@112.18 Händen@113.50", e: 114.4 },
    { w: "EXPERT@116.10 IN@116.74 THE@116.86 LOOP@116.96", e: 117.45 },
    { w: "Kann@117.68 das@117.84 Menschliche@118.12 nicht@118.82 mehr@119.10 verteidigen@119.24", e: 120.9 },
    { w: "EXPERT@121.98 IN@122.36 THE@122.48 LOOP@122.58", e: 123.0 },
    { w: "Allein@123.16 mit@123.68 dem@123.76 was@124.04 ich@124.72 seh@125.06", e: 127.3 },
    { w: "EXPERT@127.48 IN@127.86 THE@128.02 LOOP@128.18", e: 128.6 },
    { w: "Am@128.68 Anfang@128.82 oder@129.16 am@129.74 Ende?@129.98 Ich@130.50 versteh's@131.10 nicht@131.64 mehr@131.90", e: 132.8 },
  ],
  cry: { t: 133.5, e: 140.0 },
  outro: [
    { w: "Ich@144.00 bin@144.10 noch@144.28 der@144.46 Expert …@144.60", e: 145.4 },
    { w: "Ich@146.42 bin@146.80 noch@147.00 im@147.24 Loop …@147.38", e: 148.0 },
    { w: "Ich@149.30 bin@149.62 noch …@149.80", e: 150.6 },
    { w: "Ich@152.34 bin@152.58 noch …@152.88", e: 153.9 },
    { w: "Ich@155.10 bin …@155.24", e: 156.0 },
  ],
  run: 156.0,           // open loop, band alone
  scream: { t: 177.85, e: 183.3 },
  hole: { t: 183.4, e: 185.2 },
  bin: { w: "bin.@184.22", e: 185.1 },
  bypass: 185.2,        // band returns in the new tempo
  calm: 199.0,          // the band thins out
  last: { w: "Ich@205.84 bin@206.14 noch.@206.42", e: 207.2 },
  aug: { w: "Aug@209.00 men@210.45 tiert.@211.60", e: 213.3 },
  hit: 214.54,
};
const SCENE_END = 216.94;  // end of the audio
const SCENE_TITLE = "Bin ich noch der Expert?";
