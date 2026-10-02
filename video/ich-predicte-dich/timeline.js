// Section and token onsets in seconds of source/audio.wav. Every lyric line is
// a list of tokens [text, onset]; a token appears on the onset of its syllable,
// never ahead of it. Onsets come from the forced alignment and the free
// transcription in timing-report.md, refined against the vocal stem (10 ms
// spectral-flux peaks and loudness of vocals.wav). Where they disagree the stem
// wins: the aligner stretched "Es" (48.14, sung 49.70), "Ich" in the second
// refrain couplet (58.30, sung 58.78), "bis" (60.40, sung 61.06), "nicht" at
// the end of the refrain (75.28, sung 74.42), and it lost the whole second half
// from 90 s on, where the transcription and the stem phrase starts hold
// (109.40, 119.53, 126.29, 132.08, ...). The song also opens with a sung
// "Ich predicte dich!" at 0.0 that the written lyrics do not have.
// The phrase at 98.18 is not in the written lyrics: the free transcription
// hears "Doch sie spricht!", a second Whisper pass with a biased prompt hears
// "Doch dieses Mal"; it is set as the bridge line repeated (three syllable
// onsets 98.18, 98.50, 98.64, then a held vowel to 99.55). The written
// "[slow] ich predicte dich... / ... nicht!" is sung as a two-syllable phrase
// at 144.50-146.5 (typed as the line again) and two single shouts at 151.52
// and 156.66, which the transcription hears as "Nice!"; the stem holds
// nothing else after 146.5.
// The tempo is 160 BPM (80 in the report's half time); motion follows the
// detected onsets in analysis.js rather than a fixed grid.
const TL = {
  open: { id: "open", toks: [["Ich", 0.04], [" pred", 0.35], ["icte", 0.6], [" dich!", 1.04]] },
  intro: 2.9,
  prompt: { id: "prompt", toks: [["Das", 8.9], [" kann", 9.13], [" ein", 9.38], [" Trans", 9.62], ["former", 9.9], [" nicht!", 10.38]] },
  gen: [
    { id: "g1", toks: [["Token", 13.32], [" für", 13.94], [" Token,", 14.17]] },
    { id: "g2", toks: [["scale", 14.79], [" it", 14.98], [" up.", 15.5]] },
    { id: "g3", toks: [["Token", 16.22], [" für", 16.84], [" Token,", 17.15]] },
    { id: "g4", toks: [["Ich", 17.95], [" pred", 18.38], ["icte", 18.6], [" dich", 19.0]] },
  ],
  // "scale it up": the camera travels the long tail of the vocabulary
  tail: 20.5,
  verse: [
    { id: "v1", toks: [["Ich", 29.2], [" bin", 29.45], [" auto", 29.66], ["regress", 30.07], ["iv,", 30.45]] },
    { id: "v2", toks: [["schwach", 33.58], [" emer", 34.06], ["gent,", 34.63]] },
    { id: "v3", toks: [["über-", 35.11], [" und", 35.5], [" unter", 35.72], ["schätzt,", 36.57]] },
    { id: "v4", toks: [["werd", 39.07], [" ag", 39.37], ["gress", 39.82], ["iv.", 40.17]] },
    { id: "v5", toks: [["Next", 41.92], [" token", 43.25], [" pre", 43.8], ["dicted,", 44.22]] },
    { id: "v6", toks: [["kein", 44.97], [" echter", 45.31], [" Sinn,", 45.93]] },
  ],
  // spoken, slow: the stillest stretch; the verse's last vowel ends at 47.2
  still: 47.45,
  spoken: [
    { id: "s1", toks: [["Es", 49.7], [" ist", 49.88], [" nur", 49.98], [" eine", 50.12], [" statist", 50.33], ["ische", 50.69], [" Verteil", 51.07], ["ung,", 51.49]] },
    { id: "s2", toks: [["und", 52.15], [" nicht", 52.32], [" echt.", 52.5]] },
  ],
  refrain: [
    { id: "r1a", toks: [["Ich", 52.85], [" pred", 53.01], ["icte", 53.27], [" dich,", 53.55]] },
    { id: "r1b", toks: [["bis", 55.14], [" du", 55.32], [" mich", 55.56], [" liest.", 56.1]] },
    { id: "r2a", toks: [["Ich", 58.78], [" pred", 58.88], ["icte", 59.2], [" dich,", 59.6]] },
    { id: "r2b", toks: [["bis", 61.06], [" nichts", 61.29], [" mehr", 61.85], [" schief", 62.3], [" ist.", 63.01]] },
    { id: "r3a", toks: [["Ich", 64.78], [" pred", 64.9], ["icte", 65.22], [" dich,", 65.6]] },
    { id: "r3b", toks: [["im", 66.98], [" Rauschen,", 67.25], [" im", 68.2], [" Licht.", 68.63]] },
    { id: "r4a", toks: [["Ich", 70.78], [" pred", 70.9], ["icte", 71.24], [" dich,", 71.58]] },
    { id: "r4b", toks: [["und", 72.93], [" du", 73.28], [" mich", 73.53], [" nicht.", 74.42]] },
  ],
  // "nicht." is held until 77.7
  bridge: 78.2,
  bridgeLines: [
    { id: "b1", toks: [["Em", 79.14], ["bed", 79.5], ["dings", 79.93]] },
    { id: "b2", toks: [["Vector", 82.1], [" Programs", 83.0]] },
    { id: "b3", toks: [["Latent", 84.4], [" Space", 86.3]] },
    { id: "b4", toks: [["doch", 88.45], [" sie", 88.62], [" spricht", 88.9]] },
  ],
  // loud return: the camera flies through the latent space toward her
  flight: 89.6,
  her: { id: "her", toks: [["Doch", 98.18], [" sie", 98.48], [" spricht!", 98.64]] },
  drop: 109.0,
  beams: [
    { id: "d1", toks: [["Token", 109.4], [" für", 109.93], [" Token,", 110.17]] },
    { id: "d2", toks: [["scale", 110.78], [" it", 110.99], [" up.", 111.5]] },
    { id: "d3", toks: [["Token", 112.16], [" für", 112.9], [" Token,", 113.1]] },
    { id: "d4", toks: [["Ich", 113.84], [" pred", 114.34], ["icte", 114.66], [" dich", 115.0]] },
  ],
  mal: 119.0,
  malLines: [
    // "Mal" is held from 120.42 to 123.6; the dash grows with it
    { id: "m1", toks: [["Doch", 119.53], [" dieses", 119.8], [" Mal", 120.42], [" –", 120.9]], held: 123.6 },
    { id: "m2", toks: [["ich", 126.29], [" pred", 126.49], ["icte", 126.79], [" dich.", 127.02]] },
  ],
  // the quiet bar before the end: 128.5 to 132
  hush: 128.6,
  end: 132.0,
  endLines: [
    { id: "e1", toks: [["Ich", 132.08], [" pred", 132.38], ["icte", 132.7], [" dich!", 133.0]], size: 132 },
  ],
  // the line climbs into the context and the last distribution opens
  endTail: 134.8,
  endPhrase: 144.5,
  endAgain: { id: "e2", toks: [["Ich", 144.5], [" pred", 145.14], ["icte", 145.66], [" dich", 146.1]] },
  // the two shouts at the end; the stem has nothing else after 146.5
  nicht: 151.52,
  lastNicht: 156.66,
};
const SCENE_END = 157.33;
const SCENE_TITLE = "Ich predicte dich";
