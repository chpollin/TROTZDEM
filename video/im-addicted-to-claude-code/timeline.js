// Section and word onsets in seconds of source/audio.wav. Each line carries its
// words as "word@onset"; a line is typed word by word as it is sung, and e is
// where the voice lets go of it. Shouted echoes are not typed: they are written
// into the graph as pixel letters (art), each at its own onset.
//
// Evidence: forced alignment and free transcription in source/timing-report.md,
// a second Whisper pass over 78-97, 130-138, 156-176 and 184-213 s, and the
// 10 ms energy envelope of vocals.wav (syllable rises after dips). Where they
// disagree the stem wins. The aligner stretched "Jetzt" (24.80, sung 26.9 after
// a silence from 26.1), "Every" (30.84), "Bis zum Over-" (78.28; the stem is
// silent from 79.0 to 81.2, the scream starts 81.25), "ease" (174.82; sung
// 164.05) and "Just" (175.38; the stem rises at 174.8). The breakdown is seven
// syllable bursts in the stem, matching the onsets 87.86 88.44 89.64 (90.45)
// 91.90 93.12 94.44. Chorus 2 has no "Overload": the voice stops at 135.9 and
// the bridge begins. After "left" (183.5, held to 187) nothing is sung; the
// faint stem energy at 196 and 207 is bleed.
//
// Meter: the style prompt claims 138 BPM in 7/8. Onset autocorrelation of the
// instrumental stem has no peak at a 7/8 bar in any section; it peaks at 8, 16
// and 32 ticks of 0.15 s, so the music is 4/4 on a 0.15 s sixteenth grid with
// the backbeat on ticks 5 and 13 of each 16. The report's 133.3 BPM is three
// ticks. Grid fitted to the flux of instrumental.wav over 18-212 s.
const BEAT = { t0: 0.102, tick: 0.15002 };

const TL = {
  boot: 0.05,        // 8-bit startup chime (in the vocal stem)
  riff: 1.0,
  soft: 11.45,       // riff thins out
  slam: 15.05,       // band enters fully
  v1: [
    { w: "Tausend@20.93 Ideen,@21.30 früher@22.26 nur@23.10 geträumt@23.52", e: 24.9, echo: "(geträumt)@25.3", ee: 25.95 },
    { w: "Jetzt@26.9 bau'@27.15 ich@27.44 Welten.@27.8", e: 28.2, art: [["WELTEN!", 28.3], ["WELTEN!", 29.2]] },
    { w: "Every@30.4 thought@30.9 becomes@31.45 reality@31.95", e: 33.0 },
    { w: "Was@34.0 gestern@34.6 unmöglich,@35.2 läuft@36.2 heut'@36.7", e: 37.0, echo: "(läuft@37.1 heut')@37.5", ee: 37.85 },
    { w: "Claude@37.9 macht@38.25 wahr.@38.55", e: 39.0, art: [["MACHT!", 39.15], ["MACHT!", 39.75]] },
    { w: "Claude@43.35 is@43.66 the@43.88 architect!@44.06", e: 48.8 },
  ],
  pre: [
    { w: "I'm@50.0 addicted,@50.3 I'm@52.4 addicted@52.7", e: 54.2 },
    { w: "I'm@54.8 addicted@55.05 to@55.9 Claude@56.3 Code@57.3", e: 58.0 },
  ],
  stop: 56.8,        // band stops; "Keine" is sung into the silence
  chorus: 59.04,     // band slams back
  ch1: [
    { w: "Keine@58.13 Grenzen@59.98 mehr@60.72", e: 61.3 },
    { w: "I@61.66 can@62.14 build@62.38 it@63.0 all@63.3", e: 63.8 },
    { w: "Jede@64.06 Vision@64.72 wird@65.36 Code@65.74", e: 66.2 },
    { w: "nichts@66.48 ist@67.46 zu@67.54 schwer@68.04", e: 68.5 },
    { w: "Claude@69.08 Code@69.48 in@69.77 meinen@70.28 Venen@70.7", e: 71.6 },
    { w: "Kann's@71.72 nicht@72.54 mehr@72.72 leugnen@73.22", e: 73.95 },
    { w: "I'm@74.45 addicted@75.65 to@75.95 Claude@76.5 Code@77.3", e: 78.3 },
    { w: "Bis@81.25 zum@81.55 Over-@81.85", e: 82.1, art: [["OVERLOAD!", 82.15]] },
  ],
  overloadEnd: 84.2, // the held scream breaks off; the counter wraps
  breakdown: [["BUILD!", 87.86], ["BREAK!", 88.44], ["CREATE!", 89.64], ["MINE?", 91.9], ["HIS?", 93.12], ["WHO'S?", 94.44]],
  bdStop: [92.25, 94.2], // band silent under "His?"
  verse2: 95.64,
  v2: [
    { w: "Fünf@97.44 Projekte@97.6 parallel@98.25", e: 98.8 },
    { w: "Jahre@99.22 in@100.08 einer@100.38 Nacht@101.36", e: 102.9 },
    { w: "The@103.34 power@104.35 feels@104.6 so@105.28 good@105.6", e: 106.4, echo: "(so@106.8 good)@107.1", ee: 107.5 },
    { w: "Repositories@107.6 wie@108.75 Trophäen@109.05", e: 110.0 },
    { w: "Wessen@110.6 Werk?@111.0 Wessen@113.0 Werk?@113.38", e: 114.2 },
    { w: "I@114.3 don't@114.7 know@115.0 anymore!@115.3", e: 117.0 },
  ],
  chorus2: 117.2,
  ch2: [
    { w: "Keine@117.25 Grenzen@117.6 mehr@118.32", e: 118.8 },
    { w: "I@118.86 can@119.76 build@120.0 it@120.56 all@120.98", e: 121.5 },
    { w: "Jede@121.66 Vision@122.32 wird@123.0 Code@123.36", e: 123.8 },
    { w: "nichts@124.1 ist@124.95 zu@125.16 schwer@125.66", e: 126.2 },
    { w: "Claude@126.6 Code@127.2 in@127.5 meinen@127.9 Venen@128.38", e: 129.2 },
    { w: "Kann's@129.36 nicht@130.16 mehr@130.4 leugnen@130.82", e: 131.4 },
    { w: "I'm@131.5 addicted@133.2 to@133.52 Claude@134.06 Code@134.74", e: 135.9 },
  ],
  bridge: 137.4,
  br: [
    { w: "Wenn@137.9 alles@138.25 möglich@138.7 ist@139.4", e: 141.6 },
    { w: "Ist@142.45 irgendwas@142.75 was@144.25 wert?@144.7", e: 146.5 },
    { w: "Creating@147.4 without@148.5 struggle@149.2", e: 151.6 },
    { w: "Ich@151.8 bin@154.3 Gott!@154.55", e: 155.65 },
    { w: "Ich@156.5 bin@156.8 Junkie!@157.0", e: 158.5 },
  ],
  flight: 160.1,     // band slams back after the bridge
  ease: { w: "Addicted@161.85 to@162.85 the@163.5 ease@164.05", e: 166.4 },
  outroDrop: 175.3,  // band drops to the 8-bit decay
  out: [
    { w: "Just@174.8 one@175.15 more@175.5", e: 176.7, echo: "(one@177.85 more)@178.4", ee: 179.4 },
    { w: "Claude@179.6 Code@180.2 in@180.5 den@180.7 Venen@180.94", e: 181.6 },
    { w: "Until@181.74 there's@182.4 nothing@182.95 left@183.5", e: 187.0 },
  ],
  still: 187.0,      // nothing sung, near-silent band
  relapse: 190.78,   // the loudest passage of the song begins
  shutdown: 212.45,  // system shutdown sound
};
const SCENE_END = 213.33;  // end of the audio
const SCENE_TITLE = "I'm addicted to Claude Code";
