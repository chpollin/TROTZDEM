// Section and word onsets in seconds of source/audio.wav. Each line carries its
// words as "word@onset" and is typed word by word as it is sung; e is where the
// voice lets go of it.
//
// Evidence: forced alignment and free transcription in source/timing-report.md,
// a second Whisper pass over 0-164 s in short windows (with the written words as
// prompt for 21.5-33, 88.5-95.2 and 140.5-151), and the 10 ms energy envelope
// of vocals.wav (syllable rises after dips). Where they disagree the stem wins.
// The aligner stretched "Handcrafted" (stem rises 4.24), the second "Rich"
// (24.38; the stem is silent 24.6-25.4), the shouted "RICH!" (27.76; rise at
// 28.88, then syllables at 29.36 29.64 29.86 29.98 30.40), "THE" of the last
// chorus line (51.48; "alle" is held to 53.7 and "The" comes at 54.36), "Wir"
// (75.86; rise 76.85), "Immer." (91.90; 92.30) and the whole outro after 117.5.
// The outro as sung: "Scale is all you need" a cappella at 115.30 into a band
// hole 115.5-117.0, then "Scale is all you need" (121.98), "Scale is all you"
// (125.02), "Scale is all you" + "Human obsolete" (128.52, 130.00), "Scale is
// all you" + "Human obsolete" (133.91, 136.50), "Compute wins every game"
// (141.52). The band stops dead at 143.2 right after "game"; in the thin tail
// "over" (145.65) and a broken "hu-" (147.65-147.95), then 0.9 s of digital
// silence, then "Get up, get up!" (148.90, not in the written lyrics), and the
// band slams back at 149.75 until 162.92.
//
// Meter: the style prompt claims 145-160 BPM variable. Spectral flux of
// instrumental.wav, fitted per 8 s window, stays between 145.6 and 149.3 BPM;
// a dynamic-programming beat tracker on the same flux gives one continuous
// grid. BEATS holds every 8th tracked beat (two bars); beats in between are
// interpolated linearly. The second list starts at the band's return.
const BEATS = {
  a: [1.63, 4.89, 8.17, 11.43, 14.69, 17.96, 21.22, 24.48, 27.75, 31.00, 34.25, 37.51, 40.76, 44.01,
    47.27, 50.52, 53.78, 57.03, 60.26, 63.49, 66.72, 69.95, 73.19, 76.43, 79.72, 82.99, 86.25, 89.52,
    92.76, 96.01, 99.22, 102.43, 105.65, 108.87, 112.16, 115.45, 118.74, 121.99, 125.25, 128.51,
    131.77, 135.03, 138.28, 141.54],
  b: [149.75, 153.05, 156.35, 159.63, 162.92],
};

const TL = {
  v1: [
    { w: "Clever@0.36 tricks@0.70 und@1.12 smarte@1.44 Heuristiken@2.24", e: 3.4 },
    { w: "Handcrafted@4.24 features,@6.16 human@7.06 knowledge@7.50 –@8.20 fails@8.34", e: 9.4 },
    { w: "Wir@11.16 optimieren,@11.26 theoretisieren,@12.48 trainieren@14.02", e: 14.9 },
    { w: "Aber@15.94 Moore's@16.10 Law@16.60 wird@17.14 uns@17.24 überholen@17.46", e: 18.1 },
    { w: "Alle@19.22 Cleverness@19.36 –@20.28 umsonst@20.30", e: 21.0 },
  ],
  pre: [
    { w: "Rich@22.22 Sutton@22.64 hatte@23.16 recht@23.46", e: 24.0 },
    { w: "Rich@25.50 Sutton@25.80 hatte@26.40 recht@26.70", e: 27.5 },
  ],
  shout: [["RICH!", 28.88], ["SUT-", 29.36], ["TON!", 29.64], ["HAT-", 29.86], ["TE!", 29.98], ["RECHT!", 30.40]],
  shoutEnd: 32.8,
  chorus: [
    { w: "THE@33.24 BITTER@33.50 LESSON!@33.68", e: 34.6, title: true },
    { w: "Mehr@35.10 Compute@35.54 schlägt@36.32 cleverness@36.66", e: 38.1 },
    { w: "THE@39.68 BITTER@39.84 LESSON!@40.16", e: 41.0, title: true },
    { w: "Brute@41.80 Force@42.20 gewinnt@42.72 am@43.36 Schluss@43.58", e: 44.1 },
    { w: "AlphaGo,@44.36 AlphaZero,@45.10 AlphaFold@46.30", e: 47.4 },
    { w: "Alpha-@47.44 WHATEVER@48.32 schlägt@48.92 uns@49.74 alle@50.04", e: 53.7 },
    { w: "THE@54.36 BITTER@54.46 LESSON@54.88 burns@55.50 me@56.28 out!@56.58", e: 57.0, title: true },
  ],
  v2: [
    { w: "Kasparov@57.82 fiel,@58.74 Lee@59.10 Sedol@59.42 fiel@60.02", e: 60.6 },
    { w: "Keine@60.72 Theorie,@61.16 nur@62.02 TPUs@62.36", e: 63.1 },
    { w: "Selbst-spielend,@63.56 selbst-lernend,@64.62 tabula@65.56 rasa@66.38", e: 66.9 },
    { w: "Unsre@67.26 Expertise@67.72 –@68.62 obsolet@68.66", e: 69.8 },
    { w: "COMPUTE@69.86 SCHLÄGT@71.16 JEDEN@71.90 MENSCHEN!@72.58", e: 75.5 },
  ],
  bridge: [
    { w: "Wir@76.85 gegen@77.18 Silizium@77.40", e: 78.6 },
    { w: "Carbon@80.10 gegen@80.38 Silicon@81.06", e: 82.4 },
    { w: "Fleisch@83.35 gegen@83.62 Tensor-Cores@83.95", e: 85.6 },
    { w: "Jahrhunderte@85.64 gegen@86.74 Nanosekunden@87.36", e: 89.1 },
    { w: "Und@89.20 Fleisch@89.84 verliert@90.28", e: 91.6 },
    { w: "Immer.@92.30 Und.@93.20 Immer.@93.54 Wieder@93.98", e: 94.5 },
  ],
  v3: [
    { w: "Parameter@96.42 verdoppeln@97.08 sich@98.10 jährlich@98.28", e: 98.94 },
    { w: "Menschliche@98.94 insights@99.92 verfallen@100.56 täglich@101.20", e: 102.0 },
    { w: "Brain@102.36 Rot!@102.66", e: 103.1, echo: true },
    { w: "Brain@103.30 Rot!@103.56", e: 104.1, echo: true },
    { w: "Optimiere@104.36 für@105.16 Grenzen@105.44 die@106.10 morgen@106.30 fallen@106.72", e: 107.2 },
    { w: "Sisyphus@107.62 mit@108.26 Gradients@108.52", e: 109.5 },
    { w: "Der@109.94 Stein@110.14 rollt@110.58 wieder@111.76 runter@111.98", e: 112.3 },
  ],
  bandHole: [115.5, 117.0],
  outro: [
    { w: "Scale@115.30 is@115.70 all@116.04 you@116.44 need@116.76", e: 117.6 },
    { w: "Scale@121.98 is@122.22 all@122.52 you@122.82 need@123.18", e: 123.62 },
    { w: "Scale@125.02 is@125.44 all@125.86 you@126.30", e: 126.62 },
    { w: "Scale@128.52 is@128.72 all@129.10 you@129.48", e: 129.86 },
    { w: "Human@130.00 obsolete@130.94", e: 132.9, human: true },
    { w: "Scale@133.91 is@134.95 all@135.50 you@135.96", e: 136.4 },
    { w: "Human@136.50 obsolete@137.52", e: 139.4, human: true },
    { w: "Compute@141.52 wins@142.04 every@142.20 game@142.72", e: 143.2 },
  ],
  cut: 143.2,       // the band stops dead after "game"
  over: 145.65,
  hu: [147.65, 147.95],
  getUp: { w: "Get@148.90 up,@149.00 get@149.30 up!@149.45", e: 149.75 },
  bandBack: 149.75,
  bandEnd: 162.92,
};
const SCENE_END = 164.14;  // end of the audio
const SCENE_TITLE = "The Bitter Lesson";
