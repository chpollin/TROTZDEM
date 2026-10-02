// Section and word onsets in seconds of source/audio.wav. Each line carries its
// words as "word@onset"; a line is typed word by word as it is sung, and e is
// where the voice lets go of it. Onsets come from the free transcription of the
// vocal stem, cross-checked against the forced alignment, the phrase starts in
// source/timing-report.md and syllable onsets measured on vocals.wav (10 ms
// energy rises). Where the aligner stretched a first word ("Vibe" at 63.24,
// "Documentation" at 67.48, "Vibe" at 124.46), the end of the silence before it
// in the stem wins. "clean" runs to 58.85 in the stem, so "History" starts at
// the phrase start 60.00, not at 58.6.
//
// The style prompt asks for 7/8 verses and a 3/4 chorus; the audio is 4/4
// throughout (onset autocorrelation peaks at 2, 4 and 8 beats in every section,
// none at 3 or 7). The beat grid is one straight line fitted to the per-window
// tempo of the report and nudged onto the drum transients: 117.3 BPM.
const BEAT = { t0: 0.212, period: 0.5114 };

const TL = {
  intro: [
    { w: "Forget@0.56 the@0.70 code@1.12 exists@1.66", e: 2.68 },
    { w: "Forget@4.48 the@4.80 code@5.22", e: 5.74 },
  ],
  verse1: 8.6,
  v1: [
    { w: "Vibe@8.83 coding@9.20 through@9.52 the@10.28 night@10.66", e: 11.26 },
    { w: "Two@12.77 hours@13.00 till@13.80 it's@14.44 right@15.10", e: 15.52 },
    { w: "Vibe@16.96 coding,@17.36 can't@18.10 explain@18.68", e: 19.54 },
    { w: "Copy-paste@21.09 inside@21.96 my@22.38 brain@23.02", e: 23.82 },
    { w: "LLM@25.10 knows@26.58 what@26.96 to@27.42 do@27.90", e: 28.50 },
    { w: "Ship@28.82 it@29.42 when@30.00 the@30.52 build@30.98 is@31.72 through@31.98", e: 32.22 },
  ],
  // the band's first chorus downbeat; the voice comes in a beat later
  chorus: 32.43,
  // call and answer: the answer is the backing voice in brackets
  ch: [
    { w: "Vibe@32.66 coding!@33.10", e: 33.41, echo: "(Vibe@33.84 coding!)@34.16", ee: 34.48 },
    { w: "Ship@34.64 and@34.88 pray@35.20", e: 35.60, echo: "(every@35.88 day)@36.08", ee: 36.34 },
    { w: "Vibe@36.84 coding!@37.32", e: 37.54, echo: "(Vibe@37.90 coding!)@38.12", ee: 38.46 },
    { w: "That's@38.90 the@39.04 way@39.30", e: 39.68, echo: "(no@39.90 delay)@40.25", ee: 40.82 },
    { w: "We're@40.88 vibe@41.10 coding@41.46 but@42.10 forget@42.28 to@42.72 say@43.20", e: 43.82 },
    { w: "Vibe@45.15 coding@45.54 is@45.92 our@46.38 only@46.72 way!@47.30", e: 47.84 },
  ],
  interlude: 48.3,
  verse2: 55.9,
  v2: [
    { w: "LLMs@56.00 says@56.94 it's@57.38 clean@57.88", e: 58.85 },
    { w: "History@60.00 shows@60.55 a@61.14 different@61.48 scene@61.77", e: 62.56 },
    { w: "Vibe@63.98 coding,@64.38 errors@64.64 hide@65.66", e: 66.68 },
    { w: "Documentation?@68.00 We@69.54 just@69.86 lied@70.24", e: 71.12 },
    { w: "Prompting@72.06 till@73.20 it@73.44 looks@74.08 okay@74.62", e: 75.44 },
    { w: "Karpathy@76.04 showed@77.38 us@78.02 the@78.74 way@79.06", e: 79.54 },
  ],
  bridge: 80.4,
  br: [
    { w: "Parse@80.52 the@80.82 error,@80.90 parse@81.54 the@81.78 error@81.96", e: 82.40 },
    { w: "Vibe@82.62 coding@83.02 gets@83.30 no@83.72 fairer!@83.98", e: 84.28 },
    { w: "System@84.74 failing,@84.86 system@85.54 wailing@85.84", e: 86.50 },
    { w: "Vibe@86.66 coding,@87.04 never@87.38 sailing!@87.84", e: 88.30 },
  ],
  breakdown: 88.85,
  bd: [
    { w: "Extract@88.92 the@89.46 wisdom@89.58 from@89.96 the@90.34 mess@90.66", e: 90.86 },
    { w: "Vibe@91.04 coding,@91.38 more@91.60 or@91.94 less@92.18", e: 92.96 },
    { w: "Never@93.02 heard@93.66 of@94.18 unit@94.30 tests@94.64", e: 94.88 },
    { w: "Vibe@95.04 coding@95.46 at@95.74 its@96.44 best!@96.76", e: 97.12 },
    // "rest" is held until the stem goes silent at 105.9
    { w: "Claude@97.85 and@98.48 Codex@98.72 and@100.62 Cursor@100.80 do@102.04 the@102.37 rest!@102.85", e: 105.6 },
  ],
  // silence, then wordless voice at 109.1, 112.3 and 114.3 over a near-empty band
  quiet: 105.9,
  loudReturn: 117.25,
  outro: 124.9,
  out: [
    { w: "Vibe@125.00 coding@125.76 till@126.06 we@126.60 die@127.12", e: 127.62 },
    { w: "Vibe@127.76 coding,@128.22 don't@128.60 know@130.92 why@131.30", e: 131.82 },
    { w: "Ship@131.82 at@133.62 midnight,@134.30 wave@135.14 goodbye@136.18", e: 137.06, echo: "(bye)@138.70", ee: 141.9 },
  ],
  errors: 142.0,
  cry: 148.0,
  morning: 166.4,
  // "Vibe coding" and "system" are sung in the error-sound break; the rest of the
  // section is wordless (a transcription of 104-125 and 136-172 found no words
  // there), so "cry" is placed on the last sung sound, the "oh" at 169.08.
  last: { w: "Vibe@144.86 coding...@145.26 system@146.18 cry@169.08", e: 171.73 },
};
const SCENE_END = 171.73;  // end of the audio
const SCENE_TITLE = "Good Morning Claude";
