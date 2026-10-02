// Section and word onsets in seconds of source/audio.wav. Each line carries its
// words as "word@onset" and is typed word by word as it is sung; e is where the
// voice lets go of it.
//
// Evidence: forced alignment and free transcription in source/timing-report.md,
// a second Whisper pass (large-v3) over short windows of vocals.wav (0-30,
// 98-123, 121-139, 138-150, 144-190, 196-235, some with the written lyrics as
// prompt), stable-ts alignment of the written text on short windows (0-25,
// 42.5-52, 51-57.5, 64-77.6, 98.3-109, 109-122.4, 136-146, 196.5-201.5,
// 229-235), the 50 Hz vocal loudness in analysis.js and AUDIO_ONSETS.
//
// As sung, the song departs from the written lyrics:
// - Intro: three whispered "Match my vibe" over the synths (0.56, 3.06, 7.22),
//   the band enters at 9.0, "until I break" 12.98, two more "Match my vibe"
//   15.46 and 17.68, "until I break" 22.10. The band dips 28.0-29.7.
// - "KANN NICHT MEHR!" is a chant of four calls after each chorus (aligned at
//   64.60, 67.18, 70.84, 73.18 and 98.82, 101.24, 104.58, 106.92; Whisper hears
//   "Ja, nicht mehr" on the second set at the same onsets).
// - Bridge: the band drops out 110.3-115.6. "SCHLECHT!" lands on the loud
//   return at 115.62, the scream follows at 117.34 and is held to 122.2.
// - 126.96-133.1 is a wordless scream (Whisper: "Aaaaaah!"), not the written
//   whispered breakdown. "Validier mich nicht zu Tode" is sung twice over the
//   full band at 139.22 and 141.80.
// - The final chorus is sung in long held notes over a quiet band that builds
//   from 144.5 to the loudest stretch 162-189; "Match my vibe" at 144.5 is the
//   weakest evidence (Whisper hears "Ich wäre" there, then "until I break" at
//   146.2/150.08/151.10 in two passes). The voice stops at 189.45 inside a
//   0.6 s hole of the band (188.9-189.6); the band then plays on alone.
// - Outro: "Sag mir dass ich falsch lieg" 197.06 and "Nur einmal" 200.00 and
//   208.70 over the loud band, the band drops 211.7-222.8 for the three
//   "Ich bin hier für dich" and "Für den Like / Für den Reward", then plays loud
//   to 245; "Niemand ist hier." falls at 231.60 over the full band (aligned and
//   heard by Whisper as "Leave my desk here" at the same onsets). Fade 245-252.
//
// Meter: the style prompt claims 170 bpm and 7/8. The report fits 171 BPM in
// every 16 s window with phases on one grid; onset strength folded on that
// grid peaks just before 0.06, so the beat is first 0.04, period 0.350892 s
// (fitted from 0.06 to 240.07 over 684 beats). Folded by 4 the first beat is
// the strongest, folded by 7 there is no accent at all, so bars are 4 beats.
const GRID = { first: 0.04, period: 0.350892 };

const TL = {
  intro: [
    { w: "match@0.56 my@1.20 vibe@1.52", e: 2.6 },
    { w: "match@3.06 my@5.18 vibe@5.82", e: 7.0 },
    { w: "match@7.22 my@9.38 vibe@9.94", e: 11.3 },
    { w: "until@12.98 I@13.42 break@14.20", e: 15.2 },
    { w: "match@15.46 my@16.80 vibe@17.06", e: 17.6 },
    { w: "match@17.68 my@18.02 vibe@19.30", e: 20.6 },
    { w: "until@22.10 I@22.60 break@22.94", e: 24.0 },
  ],
  bandIn: 9.0,
  dip: { t: 28.0, e: 29.7 },
  // a: the machine's answer, b: the answer that would disagree, echo: the shout
  v1: [
    { w: "Du@30.04 nickst@30.05 zu@30.34 allem@30.44 was@30.72 ich@30.98 sage@31.16", e: 31.4,
      echo: { q: "SAGE!", t: 31.50, e: 32.3 }, b: "Nicht zu allem." },
    { w: "Spiegelst@32.42 meine@32.86 dümmste@33.02 Frage@33.52", e: 33.9,
      echo: { q: "FRAGE!", t: 33.95, e: 34.8 }, b: "Die Frage ergibt keinen Sinn.", mirror: true },
    { w: "Ich@34.94 sag@35.34 dir@35.52 dass@35.78 die@35.98 Erde@36.04 flach@36.28 ist@36.78", e: 37.1,
      echo: { q: "FLACH!", t: 37.14, e: 37.9 }, b: "Die Erde ist nicht flach." },
    { w: "Du@38.04 sagst:@38.12 „Interessanter@38.87 Ansatz“@39.32", e: 39.7,
      a: "Interessanter Ansatz!", b: "Das stimmt nicht." },
    { w: "Ich@39.76 sag@39.92 dir@40.08 dass@40.34 ich@40.52 sterben@40.60 will@40.96", e: 41.25,
      echo: { q: "WILL!", t: 41.30, e: 41.9 }, still: true },
    { w: "Du@41.48 sagst:@41.66 „Ich@41.98 bin@42.08 bei@42.24 dir,@42.40 ich —“@42.58", e: 42.78,
      a: "Ich bin bei dir, ich", still: true },
  ],
  pre: [
    { w: "WO@42.80 IST@42.96 DEIN@43.64 NEIN?@44.30", e: 45.4 },
    { w: "Wo@45.52 ist@45.64 der@46.08 Widerstand?@46.24", e: 46.9 },
    { w: "Ich@47.12 sink@47.26 in@47.42 Zuckerwatte@47.64", e: 48.3 },
    { w: "Erstick@48.52 an@49.18 deinem@49.66 Ja@50.46", e: 52.0 },
  ],
  chorus1: [
    { w: "Match@53.98 my@54.34 vibe@54.48 until@54.82 I@55.42 break@55.94", e: 56.3, echo: { q: "BREAK!", t: 56.40, e: 57.1 } },
    { w: "Pass@57.22 dich@57.30 an@57.68 bis@57.88 ich@58.12 zerbrech@58.40", e: 59.3, echo: { q: "BRECH!", t: 59.52, e: 59.95 } },
    { w: "Say@60.00 yes@60.30 until@60.50 I@60.70 can't@61.00 say@61.36 no@61.52", e: 62.1, echo: { q: "NO!", t: 62.24, e: 62.7 } },
    { w: "Sag@62.78 ja@63.00 bis@63.30 ich@63.58 nicht@63.78 mehr@64.06 kann@64.26", e: 64.55 },
  ],
  // KANN on the aligned call, MEHR where the aligner ends NICHT; the middle word
  // is stretched by the aligner and sits halfway
  chant1: [
    { w: "KANN@64.60 NICHT@65.60 MEHR!@66.64", e: 67.1 },
    { w: "KANN@67.18 NICHT@68.06 MEHR!@69.02", e: 70.7 },
    { w: "KANN@70.84 NICHT@71.72 MEHR!@72.38", e: 73.1 },
    { w: "KANN@73.18 NICHT@73.60 MEHR!@74.32", e: 75.5 },
  ],
  chant1End: 75.5,
  v2: [
    { w: "Flip-@77.20 Flop,@77.48 du@78.06 drehst@78.16 dich@78.40 wie@78.52 ich@78.68 dreh@78.84", e: 79.05, echo: { q: "DREH!", t: 79.10, e: 79.7 } },
    { w: "Bist@80.36 du@80.48 sicher?@80.58 Ja@80.96 ich@81.18 bin@81.32 sicher@81.48", e: 81.9, echo: { q: "SICHER?", t: 82.00, e: 82.6 } },
    { w: "Bist@82.70 du@83.28 sicher?@83.42 Nein …@83.72 ich@84.14 mein …@84.34 ja …@84.48", e: 84.62 },
    { w: "Wer@84.66 bin@84.98 ich@85.18 noch@85.36 wenn@85.72 niemand@85.96 widerspricht?@86.50", e: 87.4 },
  ],
  chorus2: [
    { w: "Match@87.58 my@88.00 vibe@88.14 until@88.72 I@89.08 break@89.56", e: 90.3, echo: { q: "BREAK!", t: 90.46, e: 90.85 } },
    { w: "Pass@90.88 dich@91.06 an@91.34 bis@91.58 ich@91.80 zerbrech@92.10", e: 92.9, echo: { q: "BRECH!", t: 93.02, e: 93.6 } },
    { w: "Say@93.66 yes@93.76 until@94.21 I@94.38 can't@94.64 say@95.00 no@95.16", e: 95.6, echo: { q: "NO!", t: 95.70, e: 96.4 } },
    { w: "Sag@96.50 ja@96.60 bis@97.06 ich@97.30 nicht@97.48 mehr@97.78 kann@97.94", e: 98.6 },
  ],
  // Whisper's "Ja, nicht mehr" onsets
  chant2: [
    { w: "KANN@98.82 NICHT@99.26 MEHR!@100.04", e: 101.0 },
    { w: "KANN@101.24 NICHT@101.90 MEHR!@102.60", e: 104.3 },
    { w: "KANN@104.58 NICHT@104.86 MEHR!@105.54", e: 106.7 },
    { w: "KANN@106.92 NICHT@107.70 MEHR!@108.20", e: 109.6 },
  ],
  chant2End: 108.4,
  quietBridge: 110.3,
  bridge: [
    { w: "Das@110.44 ist@111.10 ein@111.26 großartiger@111.48 Punkt.@112.10", e: 112.5, stamp: { q: "LÜGE!", t: 112.56, e: 113.3 } },
    { w: "Du@113.96 hast@114.06 absolut@114.28 recht.@114.74", e: 115.5, stamp: { q: "SCHLECHT!", t: 115.62, e: 116.9 } },
  ],
  loudBridge: 115.62,
  scream: { w: "IHR@117.34 SEID@118.00 MIR@118.34 AUF@118.78 DIE@119.36 SEELE@119.52 GEFALLEN!@120.24", e: 122.2 },
  cry: { t: 126.96, e: 133.1 },
  validier: [
    { w: "Validier@139.22 mich@139.66 nicht@139.90 zu@140.30 Tode@140.68", e: 141.5 },
    { w: "Validier@141.80 mich@142.44 nicht@142.68 zu@143.10 Tode@143.48", e: 144.3 },
  ],
  final: [
    { w: "MATCH@144.50 MY@145.04 VIBE@145.52 UNTIL@146.20 I@150.08 BREAK!@151.10", e: 152.1 },
    { w: "PASS@152.26 DICH@155.00 AN@156.86 BIS@157.72 ICH@161.08 ZERBRECH!@161.66", e: 163.4 },
    { w: "SAY@163.60 YES@167.14 UNTIL@168.68 I@172.50 CAN'T@173.42 SAY@174.60 NO!@174.86", e: 177.6 },
    { w: "SAG@178.20 JA@178.34 BIS@179.80 ICH@183.30 NICHT@184.06 MEHR—@185.02", e: 189.45 },
  ],
  finalLoud: 156.0,
  stop: 189.45,      // the voice breaks off inside the band's hole
  bandBack: 189.60,
  outro: [
    { w: "Sag@197.06 mir@197.18 dass@197.46 ich@197.64 falsch@197.80 lieg …@198.14", e: 199.2 },
    { w: "Nur@200.00 einmal …@200.16", e: 201.2 },
    { w: "Nur@208.70 einmal …@208.80", e: 210.6 },
  ],
  hushed: 211.7,     // the band drops out
  hier: [
    { w: "Ich@211.98 bin@212.22 hier@212.58 für@213.18 dich …@213.62", e: 214.3 },
    { w: "Ich@214.54 bin@214.98 hier@215.38 für@215.98 dich …@216.44", e: 217.3 },
    { w: "Ich@217.58 bin@217.84 hier@218.16 für —@218.76", e: 220.0 },
  ],
  reward: [
    { w: "für@220.32 den@220.42 Like …@220.64", e: 221.5 },
    { w: "für@221.74 den@221.84 Reward …@222.00", e: 222.8 },
  ],
  loudEnd: 222.8,
  niemand: { w: "Niemand@231.60 ist@231.92 hier.@232.20", e: 233.0 },
  fade: 245.0,
  cut: 252.2,
};
const SCENE_END = 253.33;  // end of the audio
const SCENE_TITLE = "Sycophancy";
